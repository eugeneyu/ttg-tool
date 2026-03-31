import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ResultsTable from "@/components/ResultsTable";
import ErrorBanner from "@/components/ErrorBanner";
import { useTtgStore } from "@/store/ttgStore";
import { Zap } from "lucide-react";

export default function Dashboard() {
  const [browsePage, setBrowsePage] = useState(0);
  const currentWindowRef = useRef<{
    start: { uploadTimeText: string; contentId: string };
    end: { uploadTimeText: string; contentId: string };
  } | null>(null);
  const {
    config,
    status,
    lastResult,
    history,
    debugUi,
    loading,
    error,
    clearError,
    loadConfig,
    loadStatus,
    loadLastResult,
    loadHistory,
    appendHistoryWindow,
    scan,
  } = useTtgStore();

  const handleWindowBoundaryChange = useCallback(
    (
      payload: {
        start: { uploadTimeText: string; contentId: string };
        end: { uploadTimeText: string; contentId: string };
      } | null,
    ) => {
      currentWindowRef.current = payload;
    },
    [],
  );

  const handleRemotePageChange = useCallback(
    (nextPage: number) => {
      const window = currentWindowRef.current;
      if (window) void appendHistoryWindow(window);
      setBrowsePage(nextPage);
      void scan("full", nextPage);
    },
    [appendHistoryWindow, scan],
  );

  useEffect(() => {
    void loadConfig();
    void loadStatus();
    void loadLastResult();
    void loadHistory();
  }, [loadConfig, loadStatus, loadLastResult, loadHistory]);

  return (
    <div className="space-y-4">
      {error ? <ErrorBanner message={error} onClose={clearError} /> : null}

      <Card>
        <CardHeader
          title="Results"
          subtitle="Ephemeral results from the last scan run"
          right={
            <Button
              onClick={() => {
                setBrowsePage(0);
                void scan("sinceCheckpoint");
              }}
              disabled={loading.scan}
            >
              <Zap className="h-4 w-4" />
              Scan New
            </Button>
          }
        />
        <CardBody>
          <ResultsTable
            items={lastResult?.matched ?? []}
            pageSize={config?.schedule.resultsPageSize ?? 100}
            historyWindows={history?.windows ?? []}
            onWindowBoundaryChange={handleWindowBoundaryChange}
            remotePage={browsePage}
            onRemotePageChange={handleRemotePageChange}
            isLoading={loading.scan}
            showDebug={debugUi}
          />
        </CardBody>
      </Card>

      {debugUi ? (
        <Card>
          <CardHeader title="Checkpoint" subtitle='Used for "new since last check"' />
          <CardBody className="space-y-2">
            <div className="text-xs text-zinc-400">Updated</div>
            <div className="text-sm font-semibold">{status?.checkpoint.updatedAt ?? "—"}</div>
            <div className="mt-3 space-y-2">
              {status?.checkpoint.lastSeenIdByListUrl ? (
                Object.entries(status.checkpoint.lastSeenIdByListUrl).map(([k, v]) => (
                  <div key={k} className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
                    <div className="text-xs text-zinc-500 break-all">{k}</div>
                    <div className="text-sm font-semibold">Last id: {v}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-zinc-400">No checkpoint yet.</div>
              )}
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
