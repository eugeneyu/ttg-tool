import type { ScanResult } from '../../shared/types.js'

type CacheEntry = {
  runId: string
  createdAt: number
  value: ScanResult
}

export class ResultsCache {
  private maxEntries: number
  private byId: Map<string, CacheEntry>
  private lastRunId: string | null

  constructor(maxEntries = 5) {
    this.maxEntries = maxEntries
    this.byId = new Map()
    this.lastRunId = null
  }

  put(result: ScanResult): void {
    const entry: CacheEntry = {
      runId: result.runId,
      createdAt: Date.now(),
      value: result,
    }
    this.byId.set(result.runId, entry)
    this.lastRunId = result.runId
    this.trim()
  }

  get(runId: string): ScanResult | null {
    return this.byId.get(runId)?.value ?? null
  }

  last(): ScanResult | null {
    if (!this.lastRunId) return null
    return this.get(this.lastRunId)
  }

  private trim(): void {
    while (this.byId.size > this.maxEntries) {
      let oldest: CacheEntry | null = null
      for (const entry of this.byId.values()) {
        if (!oldest || entry.createdAt < oldest.createdAt) oldest = entry
      }
      if (!oldest) break
      this.byId.delete(oldest.runId)
      if (this.lastRunId === oldest.runId) this.lastRunId = null
    }
  }
}
