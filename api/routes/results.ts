import { Router, type Request, type Response } from 'express'
import { initRuntime, runtime } from '../state.js'
import type { MatchedTorrentItem } from '../../shared/types.js'

const router = Router()

function toCsv(items: MatchedTorrentItem[]): string {
  const header = [
    'id',
    'title',
    'category',
    'sizeText',
    'seeders',
    'leechers',
    'uploadTimeText',
    'detailUrl',
    'downloadUrl',
    'matchedBy',
  ]
  const rows = items.map((i) => [
    i.id,
    i.title,
    i.category ?? '',
    i.sizeText ?? '',
    i.seeders ?? '',
    i.leechers ?? '',
    i.uploadTimeText ?? '',
    i.detailUrl,
    i.downloadUrl ?? '',
    i.matchedBy.join('|'),
  ])

  const escape = (v: unknown): string => {
    const s = String(v ?? '')
    if (/[",\n\r]/.test(s)) return `"${s.split('"').join('""')}"`
    return s
  }

  return [header, ...rows].map((r) => r.map(escape).join(',')).join('\n')
}

router.get('/last', async (_req: Request, res: Response): Promise<void> => {
  await initRuntime()
  const last = runtime.getLastResult()
  if (!last) {
    res.json({ ok: true, runId: null, matched: [], stats: null })
    return
  }
  res.json({ ok: true, ...last })
})

router.get('/:runId', async (req: Request, res: Response): Promise<void> => {
  await initRuntime()
  const runId = String(req.params.runId)
  const found = runtime.getResult(runId)
  if (!found) {
    res.status(404).json({ ok: false, error: 'Run not found' })
    return
  }
  res.json({ ok: true, ...found })
})

router.post('/export', async (req: Request, res: Response): Promise<void> => {
  await initRuntime()
  const runId = String((req.body ?? {}).runId ?? '')
  const format = String((req.body ?? {}).format ?? 'csv').toLowerCase()
  const found = runtime.getResult(runId) ?? runtime.getLastResult()
  if (!found) {
    res.status(404).json({ ok: false, error: 'Run not found' })
    return
  }

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="ttg-results-${found.runId}.json"`)
    res.send(JSON.stringify(found, null, 2))
    return
  }

  const csv = toCsv(found.matched)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="ttg-results-${found.runId}.csv"`)
  res.send(csv)
})

export default router
