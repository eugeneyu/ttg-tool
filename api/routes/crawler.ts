import { Router, type Request, type Response } from 'express'
import { configureRequestSchema, scanRequestSchema, ttgConfigSchema } from '../core/schemas.js'
import { readOrCreateDefaultConfig } from '../storage/configStore.js'
import type { TtgConfig } from '../../shared/types.js'
import { initRuntime, runtime } from '../state.js'
import { fetchTtgListHtml } from '../services/ttg/ttgCrawler.js'

const router = Router()

function redactConfig(cfg: TtgConfig): TtgConfig {
  return {
    ...cfg,
    credentials: {
      ...cfg.credentials,
      password: '',
      securityAnswer: cfg.credentials.securityAnswer ? '' : undefined,
      cookieHeader: cfg.credentials.cookieHeader ? '' : undefined,
    },
  }
}

router.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    await initRuntime()
    const cfg = await readOrCreateDefaultConfig()
    res.json({
      ok: true,
      scheduler: runtime.getSchedulerStatus(),
      checkpoint: cfg.checkpoint,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load status'
    res.status(500).json({ ok: false, error: message })
  }
})

router.get('/config', async (_req: Request, res: Response): Promise<void> => {
  try {
    const cfg = ttgConfigSchema.parse(await readOrCreateDefaultConfig()) as TtgConfig
    res.json({ ok: true, config: redactConfig(cfg) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load config'
    res.status(500).json({ ok: false, error: message })
  }
})

router.post('/configure', async (req: Request, res: Response): Promise<void> => {
  try {
    await initRuntime()
    const body = configureRequestSchema.parse(req.body)
    const current = ttgConfigSchema.parse(await readOrCreateDefaultConfig()) as TtgConfig

    const next: TtgConfig = {
      ...current,
      credentials: {
        username: body.username ?? current.credentials.username,
        password: body.password ?? current.credentials.password,
        securityQuestionId: body.securityQuestionId ?? current.credentials.securityQuestionId,
        securityAnswer: body.securityAnswer ?? current.credentials.securityAnswer,
        cookieHeader: body.cookieHeader ?? current.credentials.cookieHeader,
      },
      listUrls: body.listUrls ?? current.listUrls,
      filters: {
        ...current.filters,
        ...(body.filters ?? {}),
        imdbSeedConditions: body.filters?.imdbSeedConditions
          ? (body.filters.imdbSeedConditions as unknown as TtgConfig['filters']['imdbSeedConditions'])
          : current.filters.imdbSeedConditions,
      },
      schedule: {
        crawlIntervalMinutes: body.crawlInterval ?? current.schedule.crawlIntervalMinutes,
        maxPages: body.maxPages ?? current.schedule.maxPages,
        requestDelayMs: body.requestDelayMs ?? current.schedule.requestDelayMs,
        resultsPageSize: body.resultsPageSize ?? current.schedule.resultsPageSize,
      },
      checkpoint: {
        ...current.checkpoint,
        lastSeenIdByListUrl:
          body.checkpoint?.lastSeenIdByListUrl ?? current.checkpoint.lastSeenIdByListUrl,
        updatedAt: new Date().toISOString(),
      },
    }

    await runtime.configure(ttgConfigSchema.parse(next) as TtgConfig)
    res.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request'
    res.status(400).json({ ok: false, error: message })
  }
})

router.post('/scan', async (req: Request, res: Response): Promise<void> => {
  try {
    await initRuntime()
    const { mode, page } = scanRequestSchema.parse(req.body ?? {})
    const result = await runtime.scanAndCache(mode ?? 'sinceCheckpoint', page)
    res.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scan failed'
    res.status(500).json({ ok: false, error: message })
  }
})

router.get('/debug/list-html', async (req: Request, res: Response): Promise<void> => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      res.status(404).json({ ok: false, error: 'Not found' })
      return
    }
    await initRuntime()
    const cfg = await readOrCreateDefaultConfig()
    const listUrl = String(req.query.url ?? cfg.listUrls[0] ?? '')
    if (!listUrl) {
      res.status(400).json({ ok: false, error: 'Missing url' })
      return
    }
    const html = await fetchTtgListHtml(cfg, listUrl)
    const max = Number.parseInt(String(req.query.max ?? '200000'), 10)
    const clipped = Number.isFinite(max) && max > 0 ? html.slice(0, max) : html
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(clipped)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Debug fetch failed'
    res.status(500).json({ ok: false, error: message })
  }
})

router.get('/debug/credential-status', async (_req: Request, res: Response): Promise<void> => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      res.status(404).json({ ok: false, error: 'Not found' })
      return
    }
    const cfg = ttgConfigSchema.parse(await readOrCreateDefaultConfig()) as TtgConfig
    res.json({
      ok: true,
      username: cfg.credentials.username,
      hasPassword: Boolean(cfg.credentials.password && cfg.credentials.password.trim()),
      hasCookieHeader: Boolean(cfg.credentials.cookieHeader && cfg.credentials.cookieHeader.trim()),
      securityQuestionId: cfg.credentials.securityQuestionId ?? null,
      hasSecurityAnswer: Boolean(cfg.credentials.securityAnswer && cfg.credentials.securityAnswer.trim()),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed'
    res.status(500).json({ ok: false, error: message })
  }
})

export default router
