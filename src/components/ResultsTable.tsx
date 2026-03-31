import { useEffect, useMemo, useRef } from "react";
import type { MatchedTorrentItem } from "../../shared/types";
import clsx from "clsx";
import { Loader2 } from "lucide-react";

export default function ResultsTable({
  items,
  pageSize,
  historyWindows,
  onWindowBoundaryChange,
  remotePage,
  onRemotePageChange,
  isLoading,
  showDebug,
}: {
  items: MatchedTorrentItem[];
  pageSize: number;
  historyWindows: { start: { uploadTimeText: string; contentId: string }; end: { uploadTimeText: string; contentId: string } }[];
  onWindowBoundaryChange: (payload: {
    start: { uploadTimeText: string; contentId: string };
    end: { uploadTimeText: string; contentId: string };
  } | null) => void;
  remotePage: number;
  onRemotePageChange: (nextPage: number) => void;
  isLoading: boolean;
  showDebug: boolean;
}) {
  const effectivePageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 100;

  const parseTime = (t?: string): number => {
    if (!t) return 0;
    const normalized = t.replace(/\s+/g, " ").trim();
    const m = normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
    );
    if (m) {
      const year = Number.parseInt(m[1], 10);
      const month = Number.parseInt(m[2], 10);
      const day = Number.parseInt(m[3], 10);
      const hour = m[4] ? Number.parseInt(m[4], 10) : 0;
      const minute = m[5] ? Number.parseInt(m[5], 10) : 0;
      const second = m[6] ? Number.parseInt(m[6], 10) : 0;
      const ms = Date.UTC(year, month - 1, day, hour, minute, second);
      return Number.isFinite(ms) ? ms : 0;
    }
    const fallback = Date.parse(normalized.replace(" ", "T"));
    return Number.isFinite(fallback) ? fallback : 0;
  };

  const sortedItems = useMemo(() => {
    return [...items];
  }, [items]);

  const pageItems = useMemo(() => {
    return sortedItems.slice(0, effectivePageSize);
  }, [effectivePageSize, sortedItems]);

  const isSeen = (item: MatchedTorrentItem): boolean => {
    if (item.isPinned) return false;
    const itemId = Number.parseInt(item.id, 10);
    if (!Number.isFinite(itemId)) return false;
    for (const w of historyWindows ?? []) {
      const startId = Number.parseInt(w.start.contentId, 10);
      const endId = Number.parseInt(w.end.contentId, 10);
      if (!Number.isFinite(startId) || !Number.isFinite(endId)) continue;
      const newer = Math.max(startId, endId);
      const older = Math.min(startId, endId);
      if (itemId >= older && itemId <= newer) return true;
    }
    return false;
  };

  const windowBoundary = useMemo(() => {
    const normal = pageItems.filter((x) => !x.isPinned);
    const first = normal[0];
    const last = normal[normal.length - 1];
    if (!first?.uploadTimeText || !last?.uploadTimeText) return null;
    return {
      start: { uploadTimeText: first.uploadTimeText, contentId: first.id },
      end: { uploadTimeText: last.uploadTimeText, contentId: last.id },
    };
  }, [pageItems]);

  const boundaryKey = useMemo(() => {
    if (!windowBoundary) return "";
    return `${windowBoundary.start.uploadTimeText}|${windowBoundary.start.contentId}::${windowBoundary.end.uploadTimeText}|${windowBoundary.end.contentId}`;
  }, [windowBoundary]);

  const lastReportedKeyRef = useRef<string>("");
  useEffect(() => {
    if (!boundaryKey || !windowBoundary) {
      onWindowBoundaryChange(null);
      return;
    }
    if (lastReportedKeyRef.current === boundaryKey) return;
    lastReportedKeyRef.current = boundaryKey;
    onWindowBoundaryChange(windowBoundary);
  }, [boundaryKey, onWindowBoundaryChange, windowBoundary]);

  const extractImdb = (nameHtml?: string): { score?: string; url?: string } => {
    if (!nameHtml) return {};
    const m = nameHtml.match(/class="imdb_rate"[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
    if (!m) return {};
    return { url: m[1], score: m[2].trim() };
  };

  return (
    <div className="w-full overflow-auto rounded-lg border border-zinc-800">
      <table className="min-w-[980px] w-full text-[12px]">
        <thead className="bg-zinc-900/70 text-zinc-300">
          <tr>
            {showDebug ? <th className="px-3 py-2 text-left font-medium">Seen</th> : null}
            <th className="px-3 py-2 text-left font-medium">Title</th>
            <th className="px-3 py-2 text-left font-medium">Category</th>
            <th className="px-3 py-2 text-left font-medium">Size</th>
            <th className="px-3 py-2 text-left font-medium">Seed/Leech</th>
            <th className="px-3 py-2 text-left font-medium">Uploaded</th>
            <th className="px-3 py-2 text-left font-medium">IMDb</th>
            {showDebug ? <th className="px-3 py-2 text-left font-medium">Matched</th> : null}
            <th className="px-3 py-2 text-center font-medium">DL</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {items.length ? (
            pageItems.map((i) => {
              const seen = isSeen(i);
              return (
              <tr
                key={i.id}
                className={clsx(
                    seen
                      ? "bg-zinc-800/10 hover:bg-zinc-800/20"
                      : "odd:bg-zinc-950 even:bg-zinc-950/60 hover:bg-zinc-900/40",
                )}
              >
                {showDebug ? (
                  <td className="px-3 py-2 text-zinc-300 whitespace-nowrap">{seen ? "Y" : "N"}</td>
                ) : null}
                  <td className={clsx("px-3 py-2", seen && "text-zinc-300")}>
                  {i.nameHtml ? (
                    <div
                        className={clsx("ttg-name-cell", seen && "opacity-85")}
                      dangerouslySetInnerHTML={{ __html: i.nameHtml }}
                    />
                  ) : (
                    <a
                      href={i.detailUrl}
                      target="_blank"
                      rel="noreferrer"
                        className={clsx(
                          "block whitespace-pre-line break-words leading-snug hover:underline",
                          seen ? "text-zinc-200" : "text-blue-300",
                        )}
                    >
                      {i.title}
                    </a>
                  )}
                    <div className={clsx("text-xs mt-1", seen ? "text-zinc-500" : "text-zinc-500")}>{i.id}</div>
                </td>
                  <td className={clsx("px-3 py-2 whitespace-nowrap", seen ? "text-zinc-400" : "text-zinc-300")}>{i.category ?? ""}</td>
                  <td className={clsx("px-3 py-2 whitespace-nowrap", seen ? "text-zinc-400" : "text-zinc-300")}>{i.sizeText ?? ""}</td>
                  <td className={clsx("px-3 py-2 whitespace-nowrap", seen ? "text-zinc-400" : "text-zinc-300")}>
                    <span className={clsx(seen ? "text-zinc-300" : "text-emerald-300")}>{i.seeders ?? ""}</span>
                    <span className="text-zinc-500"> / </span>
                    <span className={clsx(seen ? "text-zinc-300" : "text-rose-300")}>{i.leechers ?? ""}</span>
                </td>
                  <td className={clsx("px-3 py-2 whitespace-nowrap", seen ? "text-zinc-400" : "text-zinc-300")}>{i.uploadTimeText ?? ""}</td>
                  <td className={clsx("px-3 py-2 whitespace-nowrap", seen ? "text-zinc-400" : "text-zinc-300")}>
                  {(() => {
                    const fallback = extractImdb(i.nameHtml);
                    const url = i.imdbUrl ?? fallback.url;
                    const scoreText =
                      typeof i.imdbScore === "number"
                        ? i.imdbScore.toFixed(1)
                        : i.imdbScore !== undefined
                          ? String(i.imdbScore)
                          : fallback.score;
                    if (!scoreText) return <span className="text-zinc-600">—</span>;
                    return url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className={clsx("hover:underline", seen ? "text-zinc-200" : "text-blue-300")}
                        >
                        {scoreText}
                      </a>
                    ) : (
                        <span className={clsx(seen ? "text-zinc-200" : "text-zinc-300")}>{scoreText}</span>
                    );
                  })()}
                </td>
                  {showDebug ? (
                    <td className="px-3 py-2 text-[11px] text-zinc-400 whitespace-nowrap max-w-[260px] truncate">
                      {i.matchedBy.join(", ")}
                    </td>
                  ) : null}
                  <td className={clsx("px-3 py-2 text-center", seen && "opacity-70")}>
                  {i.downloadUrl ? (
                    <a href={i.downloadUrl} target="_blank" rel="noreferrer" className="inline-flex">
                      <img
                        src="https://totheglory.im/pic/dl.gif"
                        alt="下载种子"
                        title="下载种子"
                        className="h-4 w-4 opacity-90 hover:opacity-100"
                      />
                    </a>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
              </tr>
              );
            })
          ) : (
            <tr>
              <td className="px-3 py-10 text-center text-zinc-400" colSpan={showDebug ? 9 : 7}>
                No results yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
        <div>
          TTG page {remotePage === 0 ? "newest" : remotePage} · showing {pageItems.length} / {sortedItems.length}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {isLoading ? (
            <div className="mr-2 inline-flex items-center gap-1 text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-1 mr-2">
            {Array.from({ length: 11 }).map((_, n) => (
              <button
                key={n}
                type="button"
                className={clsx(
                  "rounded border border-zinc-800 px-2 py-1 hover:bg-zinc-900 disabled:opacity-50",
                  n === remotePage && "bg-zinc-900 text-zinc-100",
                )}
                onClick={() => onRemotePageChange(n)}
                disabled={isLoading}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rounded border border-zinc-800 px-2 py-1 hover:bg-zinc-900 disabled:opacity-50"
            onClick={() => onRemotePageChange(Math.max(0, remotePage - 1))}
            disabled={remotePage <= 0 || isLoading}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded border border-zinc-800 px-2 py-1 hover:bg-zinc-900 disabled:opacity-50"
            onClick={() => onRemotePageChange(remotePage + 1)}
            disabled={isLoading}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
