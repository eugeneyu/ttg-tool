import type { BrowseHistory, BrowseWindowBoundary, ScanResult, TtgConfig } from "../../shared/types";

type ApiOk<T> = T & { ok: true };
type ApiErr = { ok: false; error: string };

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`Empty response (${res.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON response (${res.status})`);
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<ApiOk<T>> {
  const doFetch = async (): Promise<Response> => {
    return await fetch(url, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  };

  let res: Response;
  try {
    res = await doFetch();
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Request cancelled");
    }
    if (e instanceof TypeError && String(e.message).includes("Failed to fetch")) {
      await new Promise((r) => setTimeout(r, 250));
      res = await doFetch();
    } else {
      throw e;
    }
  }
  const data = await readJson<ApiOk<T> | ApiErr>(res);
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
  const res = await fetch("/api/results/last", { credentials: "same-origin" });
  const data = await readJson<
    | { ok: true; runId: string | null; matched: unknown[]; stats: unknown }
    | ApiErr
  >(res);
  if (!data.ok) throw new Error((data as ApiErr).error);
  if (!data.runId) return null;
  return data as unknown as ScanResult;
}

export async function exportRun(runId: string, format: "csv" | "json"): Promise<void> {
  const res = await fetch("/api/results/export", {
    method: "POST",
    credentials: "same-origin",
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
