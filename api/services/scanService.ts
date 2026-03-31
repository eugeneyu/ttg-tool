import crypto from 'crypto'
import { ttgConfigSchema } from '../core/schemas.js'
import type { ScanResult, TtgCheckpoint, TtgConfig, TorrentItem } from '../../shared/types.js'
import { readOrCreateDefaultConfig } from '../storage/configStore.js'
import { applyFilters } from './filtering.js'
import { crawlTtgLists } from './ttg/ttgCrawler.js'

function nowIso(): string {
  return new Date().toISOString()
}

function emptyCheckpoint(cfg: TtgConfig): TtgCheckpoint {
  return {
    lastSeenIdByListUrl: cfg.checkpoint.lastSeenIdByListUrl ?? {},
    updatedAt: nowIso(),
  }
}

function maxNumericId(items: TorrentItem[]): number {
  let max = 0
  for (const i of items) {
    const n = Number.parseInt(i.id, 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return max
}

function currentCheckpointValue(cfg: TtgConfig): number {
  const values = Object.values(cfg.checkpoint.lastSeenIdByListUrl ?? {})
  return values.length ? Math.max(...values) : 0
}

export async function scanOnce(mode: 'sinceCheckpoint' | 'full', page?: number): Promise<ScanResult> {
  const cfg = ttgConfigSchema.parse(await readOrCreateDefaultConfig()) as TtgConfig
  if (!cfg.credentials.username || !cfg.credentials.password) {
    throw new Error('Missing totheglory.im credentials in config')
  }
  const startedAt = nowIso()

  const { listItems, pagesScanned } = await crawlTtgLists(cfg, page)
  const checkpointValue = mode === 'full' ? 0 : currentCheckpointValue(cfg)
  const matched = applyFilters(listItems, cfg.filters).map((i) => {
    if (mode !== 'sinceCheckpoint') return i
    const n = Number.parseInt(i.id, 10)
    if (Number.isFinite(n) && n > checkpointValue) {
      return { ...i, matchedBy: Array.from(new Set([...(i.matchedBy ?? []), 'new'])) }
    }
    return i
  })
  const maxId = maxNumericId(listItems)

  const newCheckpoint: TtgCheckpoint = {
    ...emptyCheckpoint(cfg),
    lastSeenIdByListUrl: Object.fromEntries(cfg.listUrls.map((u) => [u, maxId])),
    updatedAt: nowIso(),
  }

  const finishedAt = nowIso()
  return {
    runId: crypto.randomUUID(),
    matched,
    stats: {
      listUrls: cfg.listUrls,
      pagesScanned,
      totalItems: listItems.length,
      matchedItems: matched.length,
      startedAt,
      finishedAt,
    },
    newCheckpoint,
  }
}
