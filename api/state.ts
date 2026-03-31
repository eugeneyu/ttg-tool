import { AppRuntime } from './runtime.js'
import { scanOnce } from './services/scanService.js'

export const runtime = new AppRuntime(scanOnce)

let initialized = false

export async function initRuntime(): Promise<void> {
  if (initialized) return
  initialized = true
  await runtime.init()
}
