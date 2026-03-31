import type { MatchedTorrentItem, TorrentItem, TtgFilters } from '../../shared/types.js'

function includesAny(haystack: string, needles: string[]): string[] {
  const lower = haystack.toLowerCase()
  const matched: string[] = []
  for (const n of needles) {
    const needle = n.trim()
    if (!needle) continue
    if (lower.includes(needle.toLowerCase())) matched.push(needle)
  }
  return matched
}

function parseSizeToMb(sizeText?: string): number | null {
  if (!sizeText) return null
  const m = sizeText.trim().match(/(\d+(?:\.\d+)?)\s*(TB|GB|MB)/i)
  if (!m) return null
  const value = Number.parseFloat(m[1])
  if (!Number.isFinite(value)) return null
  const unit = m[2].toUpperCase()
  if (unit === 'MB') return value
  if (unit === 'GB') return value * 1024
  if (unit === 'TB') return value * 1024 * 1024
  return null
}

function parseUploadTime(uploadTimeText?: string): number | null {
  if (!uploadTimeText) return null
  const d = new Date(uploadTimeText)
  const t = d.getTime()
  return Number.isFinite(t) ? t : null
}

export function applyFilters(items: TorrentItem[], filters: TtgFilters): MatchedTorrentItem[] {
  const include = filters.includeKeywords ?? []
  const exclude = filters.excludeKeywords ?? []
  const categories = filters.categories ?? []

  const minImdbScore = filters.minImdbScore
  const minSeeders = filters.minSeeders
  const imdbSeedConditions = filters.imdbSeedConditions ?? []

  const minSizeMb = filters.minSizeMb
  const maxSizeMb = filters.maxSizeMb
  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom).getTime() : null
  const dateTo = filters.dateTo ? new Date(filters.dateTo).getTime() : null

  const out: MatchedTorrentItem[] = []
  for (const item of items) {
    const title = item.title ?? ''
    const excludedBy = includesAny(title, exclude)
    if (excludedBy.length) continue

    const matchedBy: string[] = []

    const includedBy = include.length ? includesAny(title, include) : ['*']
    if (!includedBy.length) continue
    if (include.length) matchedBy.push(...includedBy.map((k) => `include:${k}`))

    if (categories.length) {
      const cat = (item.category ?? '').toLowerCase()
      const ok = categories.some((c) => c.toLowerCase() === cat)
      if (!ok) continue
      matchedBy.push(`category:${item.category ?? ''}`)
    }

    if (minSizeMb || maxSizeMb) {
      const mb = parseSizeToMb(item.sizeText)
      if (mb === null) continue
      if (minSizeMb && mb < minSizeMb) continue
      if (maxSizeMb && mb > maxSizeMb) continue
      matchedBy.push('size')
    }

    if (imdbSeedConditions.length) {
      const score = item.imdbScore
      const seed = item.seeders

      const matchedIndex = imdbSeedConditions.findIndex((c) => {
        const imdbOk = !(typeof score === 'number' && Number.isFinite(score)) || score >= c.minImdbScore
        const seedOk =
          typeof seed === 'number' && Number.isFinite(seed)
            ? seed >= c.minSeeders
            : c.minSeeders <= 0
        return imdbOk && seedOk
      })
      if (matchedIndex < 0) continue
      const c = imdbSeedConditions[matchedIndex]
      matchedBy.push(`cond#${matchedIndex + 1}(imdb>=${c.minImdbScore},seed>=${c.minSeeders})`)
    } else {
      if (minImdbScore !== undefined) {
        const score = item.imdbScore
        if (typeof score === 'number' && Number.isFinite(score) && score < minImdbScore) continue
        matchedBy.push(`imdb>=${minImdbScore}`)
      }

      if (minSeeders !== undefined) {
        const s = item.seeders
        if (!(typeof s === 'number' && Number.isFinite(s))) {
          if (minSeeders > 0) continue
        } else if (s < minSeeders) continue
        matchedBy.push(`seed>=${minSeeders}`)
      }
    }

    if (dateFrom || dateTo) {
      const t = parseUploadTime(item.uploadTimeText)
      if (t === null) continue
      if (dateFrom && t < dateFrom) continue
      if (dateTo && t > dateTo) continue
      matchedBy.push('date')
    }

    out.push({ ...item, matchedBy: matchedBy.length ? matchedBy : ['*'] })
  }
  return out
}
