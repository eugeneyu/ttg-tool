import type { ScanResult, TtgConfig } from '../shared/types.js'
import { ResultsCache } from './services/resultsCache.js'
import { ScanScheduler } from './services/scheduler.js'
import { readOrCreateDefaultConfig, writeConfig } from './storage/configStore.js'

type ScanHandler = (mode: 'sinceCheckpoint' | 'full', page?: number) => Promise<ScanResult>

export class AppRuntime {
  private results: ResultsCache
  private scheduler: ScanScheduler
  private scanHandler: ScanHandler
  private lastConfig: TtgConfig | null

  constructor(scanHandler: ScanHandler) {
    this.results = new ResultsCache(5)
    this.scanHandler = scanHandler
    this.lastConfig = null
    this.scheduler = new ScanScheduler(async () => {
      await this.scanAndCache('sinceCheckpoint')
    })
  }

  async init(): Promise<void> {
    const cfg = await readOrCreateDefaultConfig()
    this.lastConfig = cfg
    this.scheduler.configure(cfg.schedule.crawlIntervalMinutes)
  }

  getSchedulerStatus(): { isRunning: boolean; lastRun: string | null; nextRun: string | null } {
    return this.scheduler.getStatus()
  }

  getLastResult(): ScanResult | null {
    return this.results.last()
  }

  getResult(runId: string): ScanResult | null {
    return this.results.get(runId)
  }

  async configure(next: TtgConfig): Promise<void> {
    await writeConfig(next)
    this.lastConfig = next
    this.scheduler.configure(next.schedule.crawlIntervalMinutes)
  }

  async scanAndCache(mode: 'sinceCheckpoint' | 'full', page?: number): Promise<ScanResult> {
    const result = await this.scanHandler(mode, page)
    this.results.put(result)
    if (page === undefined) {
      this.lastConfig = {
        ...(this.lastConfig ?? (await readOrCreateDefaultConfig())),
        checkpoint: result.newCheckpoint,
      }
      await writeConfig(this.lastConfig)
    }
    return result
  }
}
