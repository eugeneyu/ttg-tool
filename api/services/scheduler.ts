import cron from 'node-cron'

type ScheduleStatus = {
  isRunning: boolean
  lastRun: string | null
  nextRun: string | null
}

type ScanFn = () => Promise<void>

export class ScanScheduler {
  private task: cron.ScheduledTask | null
  private intervalHandle: NodeJS.Timeout | null
  private intervalMinutes: number
  private scanFn: ScanFn
  private status: ScheduleStatus

  constructor(scanFn: ScanFn) {
    this.task = null
    this.intervalHandle = null
    this.intervalMinutes = 0
    this.scanFn = scanFn
    this.status = { isRunning: false, lastRun: null, nextRun: null }
  }

  configure(intervalMinutes: number): void {
    this.stop()
    this.intervalMinutes = intervalMinutes
    if (!intervalMinutes || intervalMinutes <= 0) {
      this.status = { isRunning: false, lastRun: this.status.lastRun, nextRun: null }
      return
    }

    if (60 % intervalMinutes === 0) {
      this.task = cron.schedule(`*/${intervalMinutes} * * * *`, () => {
        void this.runOnce()
      })
      this.task.start()
      this.status.isRunning = true
      this.status.nextRun = new Date(Date.now() + intervalMinutes * 60_000).toISOString()
      return
    }

    this.intervalHandle = setInterval(() => {
      void this.runOnce()
    }, intervalMinutes * 60_000)

    this.status.isRunning = true
    this.status.nextRun = new Date(Date.now() + intervalMinutes * 60_000).toISOString()
  }

  async runOnce(): Promise<void> {
    const startedAt = new Date().toISOString()
    this.status.lastRun = startedAt
    this.status.nextRun = this.intervalMinutes
      ? new Date(Date.now() + this.intervalMinutes * 60_000).toISOString()
      : null
    try {
      await this.scanFn()
    } catch (err) {
      console.error(err)
    }
  }

  getStatus(): ScheduleStatus {
    return { ...this.status }
  }

  stop(): void {
    if (this.task) {
      this.task.stop()
      this.task.destroy()
      this.task = null
    }
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
    this.status.isRunning = false
    this.status.nextRun = null
  }
}
