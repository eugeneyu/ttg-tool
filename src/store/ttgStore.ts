import { create } from "zustand";
import type { BrowseHistory, BrowseWindowBoundary, ScanResult, TtgConfig } from "../../shared/types";
import * as api from "@/lib/ttgApi";

type Status = {
  scheduler: { isRunning: boolean; lastRun: string | null; nextRun: string | null };
  checkpoint: { lastSeenIdByListUrl: Record<string, number>; updatedAt: string };
};

type State = {
  config: TtgConfig | null;
  status: Status | null;
  lastResult: ScanResult | null;
  history: BrowseHistory | null;
  debugUi: boolean;
  setDebugUi: (next: boolean) => void;
  loading: { config: boolean; status: boolean; scan: boolean; save: boolean };
  error: string | null;
  loadConfig: () => Promise<void>;
  loadStatus: () => Promise<void>;
  loadLastResult: () => Promise<void>;
  loadHistory: () => Promise<void>;
  appendHistoryWindow: (payload: { start: BrowseWindowBoundary; end: BrowseWindowBoundary }) => Promise<void>;
  clearHistory: () => Promise<void>;
  saveConfig: (payload: {
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
  }) => Promise<void>;
  scan: (mode: "sinceCheckpoint" | "full", page?: number) => Promise<void>;
  exportRun: (runId: string, format: "csv" | "json") => Promise<void>;
  clearError: () => void;
};

export const useTtgStore = create<State>((set, get) => ({
  config: null,
  status: null,
  lastResult: null,
  history: null,
  debugUi: (() => {
    try {
      return window.localStorage.getItem("ttg_debug_ui") === "1";
    } catch {
      return false;
    }
  })(),
  setDebugUi: (next) => {
    try {
      window.localStorage.setItem("ttg_debug_ui", next ? "1" : "0");
    } catch {
      // ignore
    }
    set({ debugUi: next });
  },
  loading: { config: false, status: false, scan: false, save: false },
  error: null,
  clearError: () => set({ error: null }),

  loadConfig: async () => {
    set({ loading: { ...get().loading, config: true }, error: null });
    try {
      const config = await api.getConfig();
      set({ config });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to load config" });
    } finally {
      set({ loading: { ...get().loading, config: false } });
    }
  },

  loadStatus: async () => {
    set({ loading: { ...get().loading, status: true }, error: null });
    try {
      const status = await api.getStatus();
      set({ status });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to load status" });
    } finally {
      set({ loading: { ...get().loading, status: false } });
    }
  },

  loadLastResult: async () => {
    try {
      const lastResult = await api.getLastResults();
      set({ lastResult });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to load results" });
    }
  },

  loadHistory: async () => {
    try {
      const history = await api.getHistory();
      set({ history });
    } catch (e) {
      set({ history: { windows: [] } });
    }
  },

  appendHistoryWindow: async (payload) => {
    const currentWindows = get().history?.windows ?? [];
    const head = currentWindows[0];
    if (
      head &&
      head.start.uploadTimeText === payload.start.uploadTimeText &&
      head.start.contentId === payload.start.contentId &&
      head.end.uploadTimeText === payload.end.uploadTimeText &&
      head.end.contentId === payload.end.contentId
    ) {
      return;
    }
    const optimistic = {
      createdAt: new Date().toISOString(),
      start: payload.start,
      end: payload.end,
    };
    set({
      history: {
        windows: [optimistic, ...(currentWindows as any[])].slice(0, 10),
      },
    });
    try {
      const history = await api.appendHistoryWindow(payload);
      set({ history });
    } catch {
      // non-blocking
    }
  },

  clearHistory: async () => {
    set({ error: null });
    try {
      await api.clearHistory();
      set({ history: { windows: [] } });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to clear history" });
    }
  },

  saveConfig: async (payload) => {
    set({ loading: { ...get().loading, save: true }, error: null });
    try {
      await api.configure(payload);
      await get().loadConfig();
      await get().loadStatus();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save config";
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ loading: { ...get().loading, save: false } });
    }
  },

  scan: async (mode, page) => {
    set({ loading: { ...get().loading, scan: true }, error: null });
    try {
      const result = await api.scan(mode, page);
      set({ lastResult: result });
      await get().loadStatus();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Scan failed" });
    } finally {
      set({ loading: { ...get().loading, scan: false } });
    }
  },

  exportRun: async (runId, format) => {
    set({ error: null });
    try {
      await api.exportRun(runId, format);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Export failed" });
    }
  },
}));
