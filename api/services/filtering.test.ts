import { describe, expect, it } from 'vitest'
import { applyFilters } from './filtering.js'
import type { TorrentItem, TtgFilters } from '../../shared/types.js'

describe('applyFilters', () => {
  const base: TorrentItem = {
    id: '100',
    title: 'Example Movie 1080p',
    category: 'Movies',
    sizeText: '1500 MB',
    seeders: 10,
    leechers: 2,
    uploadTimeText: '2025-01-01 12:00',
    detailUrl: 'https://totheglory.im/details.php?id=100',
  }

  it('includes all when includeKeywords is empty', () => {
    const filters: TtgFilters = {
      includeKeywords: [],
      excludeKeywords: [],
      categories: [],
    }
    const out = applyFilters([base], filters)
    expect(out).toHaveLength(1)
  })

  it('filters by includeKeywords and excludeKeywords', () => {
    const filters: TtgFilters = {
      includeKeywords: ['movie'],
      excludeKeywords: ['cam'],
      categories: [],
    }
    expect(applyFilters([base], filters)).toHaveLength(1)
    expect(
      applyFilters([{ ...base, title: 'CAM rip' }], {
        ...filters,
        includeKeywords: ['cam'],
      }),
    ).toHaveLength(0)
  })

  it('filters by category', () => {
    const filters: TtgFilters = {
      includeKeywords: [],
      excludeKeywords: [],
      categories: ['movies'],
    }
    expect(applyFilters([base], filters)).toHaveLength(1)
    expect(applyFilters([{ ...base, category: 'TV' }], filters)).toHaveLength(0)
  })

  it('filters by size when size is parsable', () => {
    const filters: TtgFilters = {
      includeKeywords: [],
      excludeKeywords: [],
      categories: [],
      minSizeMb: 1000,
      maxSizeMb: 2000,
    }
    expect(applyFilters([base], filters)).toHaveLength(1)
    expect(applyFilters([{ ...base, sizeText: '900 MB' }], filters)).toHaveLength(0)
  })

  it('filters by date when parseable', () => {
    const filters: TtgFilters = {
      includeKeywords: [],
      excludeKeywords: [],
      categories: [],
      dateFrom: '2024-12-31',
      dateTo: '2025-01-02',
    }
    expect(applyFilters([base], filters)).toHaveLength(1)
    expect(applyFilters([{ ...base, uploadTimeText: '2025-02-01 12:00' }], filters)).toHaveLength(0)
  })
})
