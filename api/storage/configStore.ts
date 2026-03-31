import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import crypto from 'crypto'
import { ttgConfigSchema } from '../core/schemas.js'
import type { TtgCheckpoint, TtgConfig } from '../../shared/types.js'
import { readEncryptedJsonFile, writeEncryptedJsonFile } from './encryptedJsonFile.js'

const CONFIG_DIR = path.resolve(process.cwd(), 'api/.data')
const CONFIG_PATH = path.join(CONFIG_DIR, 'ttg-config.enc.json')
const PASSPHRASE_PATH = path.join(CONFIG_DIR, 'ttg-passphrase.txt')

const DEFAULT_LIST_URL =
  'https://totheglory.im/browse.php?c=M&search_field=category:%22%E5%BD%B1%E8%A7%862160p%22'
const LEGACY_DEFAULT_LIST_URL = 'https://totheglory.im/browse.php'

const DEFAULT_IMDB_SEED_CONDITIONS = [
  { minImdbScore: 6, minSeeders: 10 },
  { minImdbScore: 5, minSeeders: 30 },
  { minImdbScore: 7, minSeeders: 1 },
]

function nowIso(): string {
  return new Date().toISOString()
}

export function getConfigPassphrase(): string {
  const envPassphrase = process.env.TTG_CONFIG_PASSPHRASE
  if (envPassphrase && envPassphrase.trim()) return envPassphrase.trim()

  try {
    const fromFile = fsSync.readFileSync(PASSPHRASE_PATH, 'utf8').trim()
    if (fromFile) return fromFile
  } catch {
    // ignore
  }

  fsSync.mkdirSync(CONFIG_DIR, { recursive: true })
  const generated = crypto.randomBytes(32).toString('base64')
  fsSync.writeFileSync(PASSPHRASE_PATH, generated, { mode: 0o600 })
  return generated
}

export function defaultConfig(): TtgConfig {
  const updatedAt = nowIso()
  return {
    credentials: {
      username: '',
      password: '',
    },
    listUrls: [DEFAULT_LIST_URL],
    filters: {
      includeKeywords: [],
      excludeKeywords: [],
      categories: [],
      imdbSeedConditions: DEFAULT_IMDB_SEED_CONDITIONS,
    },
    schedule: {
      crawlIntervalMinutes: 0,
      maxPages: 2,
      requestDelayMs: 800,
      resultsPageSize: 100,
    },
    checkpoint: {
      lastSeenIdByListUrl: {},
      updatedAt,
    },
  }
}

export async function configExists(): Promise<boolean> {
  try {
    await fs.access(CONFIG_PATH)
    return true
  } catch {
    return false
  }
}

export async function readConfig(): Promise<TtgConfig | null> {
  if (!(await configExists())) return null
  const passphrase = getConfigPassphrase()
  try {
    const parsed = await readEncryptedJsonFile<TtgConfig>(CONFIG_PATH, passphrase)
    return ttgConfigSchema.parse(parsed) as TtgConfig
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/authenticate data|bad decrypt|unsupported state/i.test(message)) {
      const backupPath = `${CONFIG_PATH}.corrupt-${Date.now()}`
      try {
        await fs.rename(CONFIG_PATH, backupPath)
      } catch {
        // ignore
      }
      console.error(`Failed to decrypt TTG config. Moved to ${backupPath}. Reconfigure settings or set TTG_CONFIG_PASSPHRASE to the original value.`)
      return null
    }
    throw err
  }
}

export async function writeConfig(config: TtgConfig): Promise<void> {
  const passphrase = getConfigPassphrase()
  const parsed = ttgConfigSchema.parse(config) as TtgConfig
  await fs.mkdir(CONFIG_DIR, { recursive: true })
  await writeEncryptedJsonFile(CONFIG_PATH, passphrase, parsed)
}

export async function readOrCreateDefaultConfig(): Promise<TtgConfig> {
  if (await configExists()) {
    const existing = await readConfig()
    if (existing) {
      if (existing.listUrls.length === 1 && existing.listUrls[0] === LEGACY_DEFAULT_LIST_URL) {
        const migrated: TtgConfig = { ...existing, listUrls: [DEFAULT_LIST_URL] }
        await writeConfig(migrated)
        return migrated
      }
      if (!existing.filters.imdbSeedConditions?.length) {
        const legacyHasAny =
          typeof existing.filters.minImdbScore === 'number' || typeof existing.filters.minSeeders === 'number'
        const legacy = legacyHasAny
          ? [
              {
                minImdbScore: typeof existing.filters.minImdbScore === 'number' ? existing.filters.minImdbScore : 0,
                minSeeders: typeof existing.filters.minSeeders === 'number' ? existing.filters.minSeeders : 0,
              },
            ]
          : []
        const migrated: TtgConfig = {
          ...existing,
          filters: {
            ...existing.filters,
            imdbSeedConditions: [...legacy, ...DEFAULT_IMDB_SEED_CONDITIONS],
          },
        }
        await writeConfig(migrated)
        return migrated
      }
      return existing
    }
  }
  return defaultConfig()
}

export async function writeCheckpoint(next: TtgCheckpoint): Promise<TtgConfig> {
  const cfg = await readOrCreateDefaultConfig()
  const updated: TtgConfig = {
    ...cfg,
    checkpoint: {
      ...next,
      updatedAt: nowIso(),
    },
  }
  await writeConfig(updated)
  return updated
}
