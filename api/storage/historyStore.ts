import fs from 'fs/promises'
import path from 'path'
import type { BrowseHistory, BrowseWindow, BrowseWindowBoundary } from '../../shared/types.js'

const HISTORY_DIR = path.resolve(process.cwd(), 'api/.data')
const HISTORY_PATH = path.join(HISTORY_DIR, 'ttg-browse-history.json')

function nowIso(): string {
  return new Date().toISOString()
}

function defaultHistory(): BrowseHistory {
  return { windows: [] }
}

export async function readHistory(): Promise<BrowseHistory> {
  try {
    const raw = await fs.readFile(HISTORY_PATH, 'utf8')
    const parsed = JSON.parse(raw) as BrowseHistory
    if (!parsed || !Array.isArray(parsed.windows)) return defaultHistory()
    return { windows: parsed.windows.slice(0, 10) }
  } catch {
    return defaultHistory()
  }
}

export async function writeHistory(next: BrowseHistory): Promise<void> {
  await fs.mkdir(HISTORY_DIR, { recursive: true })
  const trimmed: BrowseHistory = { windows: (next.windows ?? []).slice(0, 10) }
  await fs.writeFile(HISTORY_PATH, JSON.stringify(trimmed, null, 2), 'utf8')
}

export async function appendWindow(start: BrowseWindowBoundary, end: BrowseWindowBoundary): Promise<BrowseHistory> {
  const current = await readHistory()
  const window: BrowseWindow = {
    createdAt: nowIso(),
    start,
    end,
  }
  const next: BrowseHistory = {
    windows: [window, ...(current.windows ?? [])].slice(0, 10),
  }
  await writeHistory(next)
  return next
}

export async function clearHistory(): Promise<void> {
  await writeHistory(defaultHistory())
}

