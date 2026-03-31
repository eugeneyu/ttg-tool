import type { BrowseHistory, BrowseWindowBoundary, ScanResult, TtgConfig } from "../../shared/types";

type ApiOk<T> = T & { ok: true };
type ApiErr = { ok: false; error: string };

function isProbablyHtml(text: string): boolean {
  const t = text.trimStart().slice(0, 200).toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.includes("<head") || t.includes("<body");
}

function resolveUrl(path: string): string {
  const envBase = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  const storedBase = (() => {
    try {
      return window.localStorage.getItem("ttg_api_base_url") ?? "";
    } catch {
      return "";
    }
  })();
  const baseRaw = envBase && envBase.trim() ? envBase : storedBase;
  const base = baseRaw && baseRaw.trim() ? baseRaw.trim().replace(/\/$/, "") : "";
  if (/^https?:\/\//i.test(path)) return path;
  return base ? `${base}${path}` : path;
}

async function fetchWithApiFallback(url: string, init?: RequestInit): Promise<Response> {
  const primaryUrl = resolveUrl(url)
  const res = await fetch(primaryUrl, { credentials: "same-origin", ...init })
  const targetLooksLocal = !/^https?:\/\//i.test(url) && url.startsWith("/api/")
  const envBase = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined
  const hasExplicitBase = Boolean(envBase && envBase.trim())
  if (!res.ok || !targetLooksLocal || hasExplicitBase) return res

  const contentType = res.headers.get("Content-Type") || ""
  if (!contentType.toLowerCase().includes("text/html")) return res

  const host = window.location.hostname
  const protocol = window.location.protocol
  const fallbackUrl = `${protocol}//${host}:3001${url}`
  return await fetch(fallbackUrl, { credentials: "omit", ...init })
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`Empty response (${res.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    if (isProbablyHtml(text)) {
      throw new Error(`Invalid JSON response (${res.status}): received HTML (check /api proxy or API base URL)`);
    }
    throw new Error(`Invalid JSON response (${res.status})`);
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<ApiOk<T>> {
  const doFetch = async (targetUrl: string, credentials: RequestCredentials): Promise<Response> => {
    return await fetch(targetUrl, {
      headers: { "Content-Type": "application/json" },
      ...init,
      credentials,
    });
  };

  let res: Response;
  try {
    res = await doFetch(resolveUrl(url), "same-origin");
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Request cancelled");
    }
    if (e instanceof TypeError && String(e.message).includes("Failed to fetch")) {
      await new Promise((r) => setTimeout(r, 250));
      try {
        res = await doFetch(resolveUrl(url), "same-origin");
      } catch {
        const host = typeof window !== "undefined" ? window.location.hostname : "<host>";
        const proto = typeof window !== "undefined" ? window.location.protocol : "http:";
        const hint =
          proto === "https:"
            ? `API must be reachable over HTTPS or behind a reverse proxy (mixed-content blocks http://).`
            : `Ensure the API is running and reachable (e.g. http://${host}:3001/api/health), or configure a reverse proxy for /api.`;
        throw new Error(`Failed to fetch. ${hint}`);
      }
    } else {
      throw e;
    }
  }

  const text = await res.text();
  const targetLooksLocal = !/^https?:\/\//i.test(url) && url.startsWith("/api/");
  const envBase = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  const hasExplicitBase = Boolean(envBase && envBase.trim());
  if (res.ok && targetLooksLocal && !hasExplicitBase && isProbablyHtml(text)) {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    const fallbackUrl = `${protocol}//${host}:3001${url}`;
    const fallbackRes = await doFetch(fallbackUrl, "omit");
    const fallbackData = await readJson<ApiOk<T> | ApiErr>(fallbackRes);
    if (!fallbackRes.ok || !fallbackData.ok) {
      const msg = (fallbackData as ApiErr).error || `Request failed: ${fallbackRes.status}`;
      throw new Error(msg);
    }
    return fallbackData as ApiOk<T>;
  }

  if (!text.trim()) {
    throw new Error(`Empty response (${res.status})`);
  }
  let data: ApiOk<T> | ApiErr;
  try {
    data = JSON.parse(text) as ApiOk<T> | ApiErr;
  } catch {
    if (isProbablyHtml(text)) {
      throw new Error(`Invalid JSON response (${res.status}): received HTML (check /api proxy or API base URL)`);
    }
    throw new Error(`Invalid JSON response (${res.status})`);
  }
  if (!res.ok || !data.ok) {
    const msg = (data as ApiErr).error || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return data as ApiOk<T>;
}

export async function getConfig(): Promise<TtgConfig> {
  const data = await requestJson<{ config: TtgConfig }>("/api/crawler/config");
  return data.config;
}

export async function getStatus(): Promise<{
  scheduler: { isRunning: boolean; lastRun: string | null; nextRun: string | null };
  checkpoint: { lastSeenIdByListUrl: Record<string, number>; updatedAt: string };
}> {
  const data = await requestJson<{
    scheduler: { isRunning: boolean; lastRun: string | null; nextRun: string | null };
    checkpoint: { lastSeenIdByListUrl: Record<string, number>; updatedAt: string };
  }>("/api/crawler/status");
  return { scheduler: data.scheduler, checkpoint: data.checkpoint };
}

export async function configure(payload: {
  username: string | null;
  password: string | null;
  securityQuestionId?: string | null;
  securityAnswer?: string | null;
  cookieHeader?: string | null;
  listUrls: string[];
  crawlInterval: number;
  maxPages: number;
  requestDelayMs: number;
  resultsPageSize: number;
  filters: TtgConfig["filters"];
}): Promise<void> {
  await requestJson<Record<string, never>>("/api/crawler/configure", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function scan(mode: "sinceCheckpoint" | "full", page?: number): Promise<ScanResult> {
  const data = await requestJson<ScanResult>("/api/crawler/scan", {
    method: "POST",
    body: JSON.stringify({ mode, page }),
  });
  return data;
}

export async function getLastResults(): Promise<ScanResult | null> {
  const data = await requestJson<{ runId: string | null; matched: unknown[]; stats: unknown }>("/api/results/last");
  if (!data.runId) return null;
  return data as unknown as ScanResult;
}

export async function exportRun(runId: string, format: "csv" | "json"): Promise<void> {
  const res = await fetchWithApiFallback("/api/results/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runId, format }),
  });
  if (!res.ok) {
    const data = await readJson<ApiErr>(res).catch(() => ({ ok: false, error: "Export failed" }));
    throw new Error(data.error);
  }

  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const match = cd.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : `ttg-results-${runId}.${format}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function getHistory(): Promise<BrowseHistory> {
  const data = await requestJson<{ history: BrowseHistory }>("/api/history");
  return data.history;
}

export async function appendHistoryWindow(payload: {
  start: BrowseWindowBoundary;
  end: BrowseWindowBoundary;
}): Promise<BrowseHistory> {
  const data = await requestJson<{ history: BrowseHistory }>("/api/history/append", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.history;
}

export async function clearHistory(): Promise<void> {
  await requestJson<Record<string, never>>("/api/history/clear", { method: "POST" });
}
