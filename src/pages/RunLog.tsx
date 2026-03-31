import { useEffect } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import ErrorBanner from "@/components/ErrorBanner";
import Button from "@/components/ui/Button";
import { useTtgStore } from "@/store/ttgStore";
import { RefreshCw } from "lucide-react";

export default function RunLog() {
  const { status, lastResult, error, clearError, loadStatus, loadLastResult, loading } = useTtgStore();

  useEffect(() => {
    void loadStatus();
    void loadLastResult();
  }, [loadStatus, loadLastResult]);

  return (
    <div className="space-y-4">
      {error ? <ErrorBanner message={error} onClose={clearError} /> : null}

      <Card>
        <CardHeader
          title="Scheduler"
          subtitle="Server-side schedule (best-effort)"
          right={
            <Button variant="secondary" onClick={() => void loadStatus()} disabled={loading.status}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          }
        />
        <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
            <div className="text-xs text-zinc-500">State</div>
            <div className="text-sm font-semibold">{status?.scheduler.isRunning ? "Running" : "Stopped"}</div>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
            <div className="text-xs text-zinc-500">Last Run</div>
            <div className="text-sm font-semibold">{status?.scheduler.lastRun ?? "—"}</div>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
            <div className="text-xs text-zinc-500">Next Run</div>
            <div className="text-sm font-semibold">{status?.scheduler.nextRun ?? "—"}</div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Last Run" subtitle="Ephemeral; cleared on server restart" />
        <CardBody className="space-y-3">
          {lastResult ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
                <div className="text-xs text-zinc-500">Run ID</div>
                <div className="text-sm font-semibold break-all">{lastResult.runId}</div>
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
                <div className="text-xs text-zinc-500">Pages</div>
                <div className="text-sm font-semibold">{lastResult.stats.pagesScanned}</div>
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
                <div className="text-xs text-zinc-500">Total</div>
                <div className="text-sm font-semibold">{lastResult.stats.totalItems}</div>
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
                <div className="text-xs text-zinc-500">Matched</div>
                <div className="text-sm font-semibold">{lastResult.stats.matchedItems}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-zinc-400">No run in memory yet.</div>
          )}

          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-xs text-zinc-400 mb-2">Raw payload</div>
            <pre className="max-h-[420px] overflow-auto text-xs text-zinc-300 whitespace-pre-wrap">
              {lastResult ? JSON.stringify(lastResult, null, 2) : ""}
            </pre>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
