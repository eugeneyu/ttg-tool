import { Router, type Request, type Response } from 'express'
import { appendWindow, clearHistory, readHistory } from '../storage/historyStore.js'

const router = Router()

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const history = await readHistory()
    res.json({ ok: true, history })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read history'
    res.status(500).json({ ok: false, error: message })
  }
})

router.post('/append', async (req: Request, res: Response): Promise<void> => {
  try {
    const start = (req.body ?? {}).start
    const end = (req.body ?? {}).end
    if (!start?.uploadTimeText || !start?.contentId || !end?.uploadTimeText || !end?.contentId) {
      res.status(400).json({ ok: false, error: 'Invalid window boundaries' })
      return
    }
    const history = await appendWindow(
      { uploadTimeText: String(start.uploadTimeText), contentId: String(start.contentId) },
      { uploadTimeText: String(end.uploadTimeText), contentId: String(end.contentId) },
    )
    res.json({ ok: true, history })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to append history'
    res.status(500).json({ ok: false, error: message })
  }
})

router.post('/clear', async (_req: Request, res: Response): Promise<void> => {
  try {
    await clearHistory()
    res.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to clear history'
    res.status(500).json({ ok: false, error: message })
  }
})

export default router

