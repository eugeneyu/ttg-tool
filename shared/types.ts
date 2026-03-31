export type TtgCredentials = {
  username: string
  password: string
  securityQuestionId?: string
  securityAnswer?: string
  cookieHeader?: string
}

export type TtgFilters = {
  includeKeywords: string[]
  excludeKeywords: string[]
  categories: string[]
  imdbSeedConditions?: { minImdbScore: number; minSeeders: number }[]
  minImdbScore?: number
  minSeeders?: number
  minSizeMb?: number
  maxSizeMb?: number
  dateFrom?: string
  dateTo?: string
}

export type TtgCheckpoint = {
  lastSeenIdByListUrl: Record<string, number>
  updatedAt: string
}

export type TtgSchedule = {
  crawlIntervalMinutes: number
  maxPages: number
  requestDelayMs: number
  resultsPageSize: number
}

export type TtgConfig = {
  credentials: TtgCredentials
  listUrls: string[]
  filters: TtgFilters
  schedule: TtgSchedule
  checkpoint: TtgCheckpoint
}

export type TorrentItem = {
  id: string
  title: string
  nameHtml?: string
  imdbScore?: number
  imdbUrl?: string
  category?: string
  sizeText?: string
  seeders?: number
  leechers?: number
  uploadTimeText?: string
  isPinned?: boolean
  detailUrl: string
  downloadUrl?: string
}

export type MatchedTorrentItem = TorrentItem & {
  matchedBy: string[]
}

export type ScanStats = {
  listUrls: string[]
  pagesScanned: number
  totalItems: number
  matchedItems: number
  startedAt: string
  finishedAt: string
}

export type ScanResult = {
  runId: string
  matched: MatchedTorrentItem[]
  stats: ScanStats
  newCheckpoint: TtgCheckpoint
}

export type BrowseWindowBoundary = {
  uploadTimeText: string
  contentId: string
}

export type BrowseWindow = {
  createdAt: string
  start: BrowseWindowBoundary
  end: BrowseWindowBoundary
}

export type BrowseHistory = {
  windows: BrowseWindow[]
}
