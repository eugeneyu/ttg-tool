import { z } from 'zod'

export const ttgCredentialsSchema = z.object({
  username: z.string(),
  password: z.string(),
  securityQuestionId: z.string().min(1).optional(),
  securityAnswer: z.string().min(1).optional(),
  cookieHeader: z.string().min(1).optional(),
})

export const ttgFiltersSchema = z.object({
  includeKeywords: z.array(z.string()),
  excludeKeywords: z.array(z.string()),
  categories: z.array(z.string()),
  imdbSeedConditions: z
    .array(
      z.object({
        minImdbScore: z.number().min(0).max(10),
        minSeeders: z.number().int().min(0).max(999),
      }),
    )
    .optional(),
  minImdbScore: z.preprocess(
    (v) => (v === null || v === '' ? undefined : v),
    z.number().min(0).max(10).optional(),
  ),
  minSeeders: z.preprocess(
    (v) => (v === null || v === '' ? undefined : v),
    z.number().int().min(0).max(999).optional(),
  ),
  minSizeMb: z.preprocess(
    (v) => (v === null || v === '' ? undefined : v),
    z.number().positive().optional(),
  ),
  maxSizeMb: z.preprocess(
    (v) => (v === null || v === '' ? undefined : v),
    z.number().positive().optional(),
  ),
  dateFrom: z.preprocess(
    (v) => (v === null || v === '' ? undefined : v),
    z.string().min(1).optional(),
  ),
  dateTo: z.preprocess(
    (v) => (v === null || v === '' ? undefined : v),
    z.string().min(1).optional(),
  ),
})

export const ttgCheckpointSchema = z.object({
  lastSeenIdByListUrl: z.record(z.number().nonnegative()),
  updatedAt: z.string().min(1),
})

export const ttgScheduleSchema = z.object({
  crawlIntervalMinutes: z.number().int().nonnegative(),
  maxPages: z.number().int().positive(),
  requestDelayMs: z.number().int().nonnegative(),
  resultsPageSize: z.number().int().min(10).max(500).default(100),
})

export const ttgConfigSchema = z.object({
  credentials: ttgCredentialsSchema,
  listUrls: z.array(z.string().url()).min(1),
  filters: ttgFiltersSchema,
  schedule: ttgScheduleSchema,
  checkpoint: ttgCheckpointSchema,
})

export const configureRequestSchema = z.object({
  username: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.string().min(1).optional()),
  password: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.string().min(1).optional()),
  securityQuestionId: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.string().min(1).optional()),
  securityAnswer: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.string().min(1).optional()),
  cookieHeader: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.string().min(1).optional()),
  listUrls: z.array(z.string().url()).optional(),
  crawlInterval: z.number().int().nonnegative().optional(),
  maxPages: z.number().int().positive().optional(),
  requestDelayMs: z.number().int().nonnegative().optional(),
  resultsPageSize: z.number().int().min(10).max(500).optional(),
  filters: ttgFiltersSchema.partial().optional(),
  checkpoint: z
    .object({
      lastSeenIdByListUrl: z.record(z.number().nonnegative()).optional(),
    })
    .optional(),
})

export const scanRequestSchema = z.object({
  mode: z.enum(['sinceCheckpoint', 'full']).optional(),
  page: z.number().int().nonnegative().optional(),
})
