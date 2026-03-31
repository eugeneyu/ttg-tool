import puppeteer, { type Browser, type Page } from 'puppeteer'
import * as cheerio from 'cheerio'
import type { TorrentItem, TtgConfig } from '../../../shared/types.js'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fillFirst(page: Page, selectors: string[], value: string): Promise<boolean> {
  for (const sel of selectors) {
    const el = await page.$(sel)
    if (!el) continue
    await el.click({ clickCount: 3 })
    await page.keyboard.type(value)
    return true
  }
  return false
}

async function clickFirst(page: Page, selectors: string[]): Promise<boolean> {
  for (const sel of selectors) {
    const el = await page.$(sel)
    if (!el) continue
    await el.click()
    return true
  }
  return false
}

async function login(page: Page, cfg: TtgConfig): Promise<void> {
  if (await tryCookieLogin(page, cfg)) return
  await page.goto('https://totheglory.im/login.php', { waitUntil: 'domcontentloaded' })

  const loginHtml = await page.content().catch(() => '')
  const cn = loginHtml.match(/你还有[\s\S]*?<b>[\s\S]*?(\d+)[\s\S]*?次登录机会/)?.[1]
  const en = loginHtml.match(/You have[\s\S]*?<b>[\s\S]*?(\d+)[\s\S]*?remaining tries/i)?.[1]
  const attemptsLeft = [cn, en]
    .map((v) => (v ? Number.parseInt(v, 10) : null))
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .sort((a, b) => a - b)[0]
  if (attemptsLeft === 0) {
    throw new Error('TTG login blocked: 0 attempts remaining for current IP')
  }

  const usernameOk = await fillFirst(page, ['input[name="username"]', 'input[name="uid"]'], cfg.credentials.username)
  const passwordOk = await fillFirst(page, ['input[name="password"]', 'input[type="password"]'], cfg.credentials.password)
  if (!usernameOk || !passwordOk) throw new Error('Login form fields not found')

  if (cfg.credentials.securityQuestionId) {
    const passId = cfg.credentials.securityQuestionId.trim()
    if (passId && passId !== '0') {
      const hasPassId = await page.$('input[name="passid"]')
      if (hasPassId) {
        await page.evaluate((v) => {
          const el = document.querySelector('input[name="passid"]') as HTMLInputElement | null
          if (!el) return
          el.value = v
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
        }, passId)
      } else {
        const select = await page.$('select[name="questionid"], select[name="question"]')
        if (select) {
          await page.select('select[name="questionid"], select[name="question"]', passId)
        }
      }
    }
  }
  if (cfg.credentials.securityAnswer) {
    await fillFirst(page, ['input[name="passan"]', 'input[name="answer"]', 'input[name="securityanswer"]'], cfg.credentials.securityAnswer)
  }

  await Promise.race([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => undefined),
    (async () => {
      await clickFirst(page, ['input[type="submit"]', 'button[type="submit"]'])
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => undefined)
    })(),
  ])

  const url = page.url()
  if (url.includes('/login.php')) {
    const html = await page.content().catch(() => '')
    if (html.includes('用户登录') || html.toLowerCase().includes('login')) {
      const left = html.match(/你还有[\s\S]*?<b>[\s\S]*?(\d+)[\s\S]*?次登录机会/)?.[1]
      const leftNum = left ? Number.parseInt(left, 10) : null
      if (leftNum === 0) throw new Error('TTG login blocked: 0 attempts remaining for current IP')
      throw new Error('Login failed: still on login page')
    }
  }

  if (url.includes('takelogin.php')) {
    const html = await page.content().catch(() => '')
    if (html.includes('用户登录')) throw new Error('Login failed')
  }

  await page.goto('https://totheglory.im/browse.php', { waitUntil: 'domcontentloaded' })
  if (page.url().includes('/login.php')) {
    const html = await page.content().catch(() => '')
    const cn2 = html.match(/你还有[\s\S]*?<b>[\s\S]*?(\d+)[\s\S]*?次登录机会/)?.[1]
    const en2 = html.match(/You have[\s\S]*?<b>[\s\S]*?(\d+)[\s\S]*?remaining tries/i)?.[1]
    const left = [cn2, en2]
      .map((v) => (v ? Number.parseInt(v, 10) : null))
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
      .sort((a, b) => a - b)[0]
    const hint =
      html.includes('安全') || html.includes('passan')
        ? ' (hint: your account may require security question id + answer)'
        : ''
    throw new Error(`Login failed: browse redirected to login (triesLeft=${left ?? 'unknown'})${hint}`)
  }
  const browseHtml = await page.content().catch(() => '')
  if (browseHtml.includes('用户登录')) throw new Error('Login failed: browse shows login page')
}

async function preparePage(page: Page): Promise<void> {
  await page.setViewport({ width: 1280, height: 800 })
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  })
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en-US', 'en'] })
  })
}

function parseCookieHeader(cookieHeader: string): Array<{ name: string; value: string }> {
  return cookieHeader
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const idx = p.indexOf('=')
      if (idx <= 0) return null
      const name = p.slice(0, idx).trim()
      const value = p.slice(idx + 1).trim()
      if (!name) return null
      return { name, value }
    })
    .filter((v): v is { name: string; value: string } => Boolean(v))
}

async function tryCookieLogin(page: Page, cfg: TtgConfig): Promise<boolean> {
  const header = cfg.credentials.cookieHeader?.trim()
  if (!header) return false
  const cookies = parseCookieHeader(header)
  if (!cookies.length) return false

  await page.goto('https://totheglory.im/', { waitUntil: 'domcontentloaded' })
  await page.setCookie(
    ...cookies.map((c) => ({
      ...c,
      domain: 'totheglory.im',
      path: '/',
    })),
  )
  await page.goto('https://totheglory.im/browse.php', { waitUntil: 'domcontentloaded' })
  if (page.url().includes('/login.php')) return false
  const html = await page.content().catch(() => '')
  if (html.includes('用户登录')) return false
  return true
}

function normalizeListUrl(listUrl: string, pageIndex: number, pagesToFetch: number, overrideTtgPage?: number): string {
  if (overrideTtgPage !== undefined) {
    const url = new URL(listUrl)
    if (overrideTtgPage <= 0) url.searchParams.delete('page')
    else url.searchParams.set('page', String(overrideTtgPage))
    return url.toString()
  }

  if (pagesToFetch <= 1) return listUrl

  const url = new URL(listUrl)
  if (pageIndex <= 0) url.searchParams.delete('page')
  else url.searchParams.set('page', String(pageIndex))
  return url.toString()
}

function toAbsoluteUrl(baseUrl: string, maybeRelative: string): string {
  try {
    return new URL(maybeRelative, baseUrl).toString()
  } catch {
    return maybeRelative
  }
}

function sanitizeTtgNameHtml(baseUrl: string, html: string): string {
  const $ = cheerio.load(`<div id="_root">${html}</div>`)
  const root = $('#_root')

  root.find('script,style').remove()

  const allowedTags = new Set(['div', 'span', 'b', 'br', 'img', 'a'])
  const allowedAttrs = new Set(['href', 'src', 'alt', 'title', 'class', 'style', 'id', 'align', 'border'])

  root.find('*').each((_, el) => {
    const tag = String((el as any).tagName ?? '').toLowerCase()
    const $el = $(el)
    if (!allowedTags.has(tag)) {
      $el.replaceWith($el.text())
      return
    }

    const attrs = { ...(el as any).attribs }
    for (const [k, v] of Object.entries(attrs)) {
      const key = k.toLowerCase()
      if (key.startsWith('on')) {
        $el.removeAttr(k)
        continue
      }
      if (!allowedAttrs.has(key)) {
        $el.removeAttr(k)
        continue
      }
      if (key === 'style') {
        const s = String(v ?? '')
        if (/expression\s*\(|javascript:/i.test(s)) $el.removeAttr('style')
      }
      if (key === 'href') {
        const href = String(v ?? '').trim()
        if (!href || href.toLowerCase().startsWith('javascript:')) {
          $el.removeAttr('href')
        } else {
          $el.attr('href', toAbsoluteUrl(baseUrl, href))
          $el.attr('target', '_blank')
          $el.attr('rel', 'noreferrer')
        }
      }
      if (key === 'src') {
        const src = String(v ?? '').trim()
        if (src) $el.attr('src', toAbsoluteUrl(baseUrl, src))
      }
    }
  })

  return root.html() ?? ''
}

function parseListHtml(baseUrl: string, html: string): TorrentItem[] {
  const $ = cheerio.load(html)
  const items: TorrentItem[] = []

  const seen = new Set<string>()

  const idFromTitleHref = (href: string): string | null => {
    const m = href.match(/\/(?:t)\/(\d+)\//)
    return m ? m[1] : null
  }

  $('tr[id]').each((_, tr) => {
    const row = $(tr)
    const idAttr = (row.attr('id') ?? '').trim()
    if (!/^\d+$/.test(idAttr)) return
    if (seen.has(idAttr)) return

    const titleLink =
      row.find(`a[href^="/t/${idAttr}/"], a[href^="t/${idAttr}/"]`).first().length
        ? row.find(`a[href^="/t/${idAttr}/"], a[href^="t/${idAttr}/"]`).first()
        : row.find('a[href^="/t/"], a[href^="t/"]').first()

    const titleHref = (titleLink.attr('href') ?? '').trim()
    const idFromHref = titleHref ? idFromTitleHref(titleHref) : null
    const id = idFromHref ?? idAttr

    let title = ''
    const titleInnerHtml = titleLink.html() ?? ''
    if (titleInnerHtml) {
      const normalized = titleInnerHtml.replace(/<br\s*\/?\s*>/gi, '\n')
      title = cheerio.load(`<div>${normalized}</div>`)
        .text()
        .replace(/\r/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    } else {
      title = titleLink.text().replace(/\s+/g, ' ').trim()
    }
    if (!title) return
    seen.add(id)

    const detailUrl = new URL(titleHref || `/t/${id}/`, baseUrl).toString()
    const rowText = row.text().replace(/\s+/g, ' ').trim()

    const rowClass = String(row.attr('class') ?? '').toLowerCase()
    const rowStyle = String(row.attr('style') ?? '').toLowerCase()
    const rowBg = String(row.attr('bgcolor') ?? '').toLowerCase()
    const anyBg = rowBg || String(row.find('[bgcolor]').first().attr('bgcolor') ?? '').toLowerCase()
    const anyStyle =
      rowStyle ||
      String(row.find('[style*="background"], [style*="bgcolor"], [style*="color"]').first().attr('style') ?? '').toLowerCase()
    const isPinned =
      /置顶/.test(rowText) ||
      /sticky|pinned|top/.test(rowClass) ||
      Boolean(anyBg) ||
      /background/.test(anyStyle)

    const nameCell = row.find('td[align="left"]').first()
    const nameLeftHtmlRaw = nameCell.find('div.name_left').first().html() ?? ''
    const nameHtml = nameLeftHtmlRaw ? sanitizeTtgNameHtml(baseUrl, `<div class="name_left">${nameLeftHtmlRaw}</div>`) : undefined

    const categoryText =
      row.find('img[alt]').first().attr('alt')?.trim() ||
      row.find('a[href*="browse.php?cat="], a[href*="browse.php?c="]').first().text().trim() ||
      undefined

    const imdbAnchor = row.find('span.imdb_rate a[href]').first()
    const imdbScoreText = imdbAnchor.text().trim()
    const imdbScore = imdbScoreText ? Number.parseFloat(imdbScoreText) : undefined
    const imdbUrl = imdbAnchor.attr('href') ? toAbsoluteUrl(baseUrl, imdbAnchor.attr('href') as string) : undefined

    const sizeMatch = rowText.match(/(\d+(?:\.\d+)?)\s*(TB|GB|MB)/i)
    const sizeText = sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2].toUpperCase()}` : undefined

    const dlHref =
      row.find('a.dl_a[href^="/dl/"]').first().attr('href') ||
      row.find('a[href^="/dl/"]').first().attr('href') ||
      row.find('a[href*="download.php"], a[href*="dl.php"], a[href*="download"]').first().attr('href')
    const downloadUrl = dlHref ? new URL(dlHref, baseUrl).toString() : undefined

    const seedersText =
      row.find('a[href*="toseeders=1"], a[href*="toseeders="]').first().text().trim() ||
      undefined
    const leechersText =
      row.find('a[href*="todlers=1"], a[href*="todlers="]').first().text().trim() ||
      undefined
    let seeders = seedersText ? Number.parseInt(seedersText, 10) : undefined
    let leechers = leechersText ? Number.parseInt(leechersText, 10) : undefined
    if (!Number.isFinite(seeders) || !Number.isFinite(leechers)) {
      const slCellText = row
        .find('a[href*="toseeders=1"], a[href*="toseeders="]')
        .first()
        .closest('td')
        .text()
        .replace(/\s+/g, ' ')
        .trim()
      const m = slCellText.match(/(\d+)\s*\/\s*(\d+)/)
      if (m) {
        const s = Number.parseInt(m[1], 10)
        const l = Number.parseInt(m[2], 10)
        if (!Number.isFinite(seeders) && Number.isFinite(s)) seeders = s
        if (!Number.isFinite(leechers) && Number.isFinite(l)) leechers = l
      }
    }

    const timeMatch = rowText.match(/\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?/)?.[0]
    const uploadTimeText = timeMatch || undefined

    items.push({
      id,
      title,
      nameHtml,
      imdbScore: Number.isFinite(imdbScore) ? imdbScore : undefined,
      imdbUrl,
      category: categoryText,
      sizeText,
      seeders: Number.isFinite(seeders) ? seeders : undefined,
      leechers: Number.isFinite(leechers) ? leechers : undefined,
      uploadTimeText,
      isPinned,
      detailUrl,
      downloadUrl,
    })
  })

  return items
}

export async function crawlTtgLists(
  cfg: TtgConfig,
  ttgPage?: number,
): Promise<{ listItems: TorrentItem[]; pagesScanned: number }> {
  let browser: Browser | null = null
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    })
    const page = await browser.newPage()
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    )
    await preparePage(page)

    await login(page, cfg)

    const all: TorrentItem[] = []
    let pagesScanned = 0
    for (const listUrl of cfg.listUrls) {
      if (ttgPage !== undefined) {
        const url = normalizeListUrl(listUrl, 0, 1, ttgPage)
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        if (page.url().includes('/login.php')) throw new Error('Not logged in')
        const html = await page.content()
        const items = parseListHtml('https://totheglory.im/', html)
        if (!items.length && html.includes('用户登录')) throw new Error('Not logged in')
        all.push(...items)
        pagesScanned += 1
        continue
      }

      const targetItems = cfg.schedule.resultsPageSize ?? 100
      const estimatedPerPage = 50
      const minPagesForTarget = Math.max(1, Math.ceil(targetItems / estimatedPerPage))
      const pagesToFetch = Math.min(10, Math.max(cfg.schedule.maxPages, minPagesForTarget))

      const perList = new Map<string, TorrentItem>()
      let lastCount = 0
      for (let p = 0; p < pagesToFetch; p += 1) {
        const url = normalizeListUrl(listUrl, p, pagesToFetch)
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        if (page.url().includes('/login.php')) throw new Error('Not logged in')
        const html = await page.content()
        const items = parseListHtml('https://totheglory.im/', html)
        if (!items.length && html.includes('用户登录')) throw new Error('Not logged in')
        for (const it of items) perList.set(it.id, it)
        all.push(...items)
        pagesScanned += 1
        if (perList.size >= targetItems) break
        if (perList.size === lastCount) break
        lastCount = perList.size
        if (cfg.schedule.requestDelayMs) await sleep(cfg.schedule.requestDelayMs)
      }
    }

    const byId = new Map<string, TorrentItem>()
    for (const i of all) byId.set(i.id, i)
    return { listItems: Array.from(byId.values()), pagesScanned }
  } finally {
    if (browser) await browser.close().catch(() => undefined)
  }
}

export async function fetchTtgListHtml(cfg: TtgConfig, listUrl: string): Promise<string> {
  let browser: Browser | null = null
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    })
    const page = await browser.newPage()
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    )
    await preparePage(page)
    await login(page, cfg)
    await page.goto(listUrl, { waitUntil: 'domcontentloaded' })
    if (page.url().includes('/login.php')) throw new Error('Not logged in')
    const html = await page.content()
    if (html.includes('用户登录')) throw new Error('Not logged in')
    return html
  } finally {
    if (browser) await browser.close().catch(() => undefined)
  }
}
