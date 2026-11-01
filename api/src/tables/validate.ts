import { z } from 'zod'
export type { ColumnType }
import { APPROVAL_STATUSES, type ColumnSpec, type ColumnType, type WritableTable } from './registry.js'

const toNull = (v: unknown) => (v === '' || v === undefined ? null : v)

const numeric = z.preprocess(
  v => (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : v),
  z.number({ invalid_type_error: 'must be a number' }).finite(),
)

const COLUMN_SCHEMAS: Record<ColumnType, z.ZodTypeAny> = {
  id: numeric.pipe(z.number().int('must be a whole number').positive('must be a positive id')),
  int: numeric.pipe(z.number().int('must be a whole number').min(0, 'must not be negative')),
  number: numeric,
  percent: numeric.pipe(z.number().min(0, 'must be 0–100').max(100, 'must be 0–100')),
  flag: z.preprocess(v => {
    if (typeof v === 'boolean') return v ? 'Y' : 'N'
    if (typeof v === 'string') {
      const s = v.trim().toUpperCase()
      if (['Y', 'YES', 'TRUE', '1'].includes(s)) return 'Y'
      if (['N', 'NO', 'FALSE', '0'].includes(s)) return 'N'
    }
    return v
  }, z.enum(['Y', 'N'], { errorMap: () => ({ message: "must be 'Y' or 'N'" }) })),
  date: z
    .string()
    .trim()
    .refine(s => /^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(s) && !Number.isNaN(Date.parse(s)), 'must be an ISO date')
    .transform(s => new Date(s.length === 10 ? `${s}T00:00:00Z` : s).toISOString()),
  text: z.string().trim().max(4000, 'must be at most 4000 characters'),
  approval: z.preprocess(
    v => (typeof v === 'string' ? v.trim().toUpperCase().replace(/[\s-]+/g, '_') : v),
    z.enum(APPROVAL_STATUSES, { errorMap: () => ({ message: `must be one of ${APPROVAL_STATUSES.join(', ')}` }) }),
  ),
  scalar: z.union([z.string().trim().max(4000), z.number().finite()]),
  rating: numeric.pipe(z.number().int('must be a whole number').min(1, 'must be 1–5').max(5, 'must be 1–5')),
  email: z.string().trim().toLowerCase().email('must be an e-mail address').max(254),
}

const enumSchemas = new Map<readonly string[], z.ZodTypeAny>()

/** Zod schema for a column spec (cached for enums). */
export function schemaFor(spec: ColumnSpec): z.ZodTypeAny {
  if (typeof spec === 'string') return COLUMN_SCHEMAS[spec]
  if ('range' in spec) {
    const [min, max] = spec.range
    return numeric.pipe(z.number().int('must be a whole number').min(min, `must be ${min}–${max}`).max(max, `must be ${min}–${max}`))
  }
  let schema = enumSchemas.get(spec.enum)
  if (!schema) {
    // Accept any letter case from clients, store the canonical spelling.
    const canonical = new Map(spec.enum.map(v => [v.toLowerCase(), v]))
    schema = z.preprocess(
      v => (typeof v === 'string' ? canonical.get(v.trim().toLowerCase()) ?? v : v),
      z.enum(spec.enum as [string, ...string[]], { errorMap: () => ({ message: `must be one of: ${spec.enum.join(', ')}` }) }),
    )
    enumSchemas.set(spec.enum, schema)
  }
  return schema
}

/** Columns treated as free text for search defaults. */
export function isTextSpec(spec: ColumnSpec): boolean {
  return spec === 'text' || spec === 'email' || (typeof spec === 'object' && 'enum' in spec)
}

export interface NormalizedPayload {
  row: Record<string, unknown>
  ignoredFields: string[]
}

/**
 * Validate a client payload against a table definition.
 * - Keys are matched case-insensitively and returned in Oracle (upper) case.
 * - Unknown keys are dropped and reported back, never silently.
 * - Empty strings become NULL.
 * - On create, defaults fill only the columns the client did not send.
 */
export function normalizePayload(def: WritableTable, body: unknown, mode: 'create' | 'update'): NormalizedPayload {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new z.ZodError([{ code: 'custom', path: [], message: 'Request body must be a JSON object' }])
  }

  const row: Record<string, unknown> = {}
  const ignoredFields: string[] = []
  const issues: z.ZodIssue[] = []

  for (const [rawKey, rawValue] of Object.entries(body as Record<string, unknown>)) {
    const key = rawKey.toUpperCase()
    const spec = Object.hasOwn(def.columns, key) ? def.columns[key] : undefined
    if (!spec) {
      ignoredFields.push(rawKey)
      continue
    }
    const value = toNull(rawValue)
    if (value === null) {
      row[key] = null
      continue
    }
    const parsed = schemaFor(spec).safeParse(value)
    if (parsed.success) {
      row[key] = parsed.data === '' ? null : parsed.data
    } else {
      for (const issue of parsed.error.issues) issues.push({ ...issue, path: [key] })
    }
  }

  if (mode === 'create') {
    for (const [col, val] of Object.entries(def.defaults ?? {})) {
      if (row[col] === undefined || row[col] === null) row[col] = val
    }
    const invalid = new Set(issues.map(i => String(i.path[0])))
    for (const col of def.required ?? []) {
      if (invalid.has(col)) continue // already reported as invalid
      if (row[col] === undefined || row[col] === null || row[col] === '') {
        issues.push({ code: 'custom', path: [col], message: 'is required' })
      }
    }
  } else {
    for (const col of def.required ?? []) {
      if (col in row && (row[col] === null || row[col] === '')) {
        issues.push({ code: 'custom', path: [col], message: 'cannot be cleared' })
      }
    }
    if (Object.keys(row).length === 0 && issues.length === 0) {
      issues.push({ code: 'custom', path: [], message: 'No updatable fields were provided' })
    }
  }

  if (issues.length) throw new z.ZodError(issues)
  return { row, ignoredFields }
}

export const idParam = z
  .string()
  .regex(/^\d{1,15}$/, 'id must be a positive whole number')
  .transform(Number)
  .refine(n => n > 0, 'id must be a positive whole number')

const filterParam = z
  .string()
  .max(2000)
  .transform((s, ctx) => {
    try {
      const v = JSON.parse(s)
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
    } catch {
      /* fall through */
    }
    ctx.addIssue({ code: 'custom', message: 'filter must be a JSON object of column → value (or list of values)' })
    return z.NEVER
  })
  .refine(
    f => Object.entries(f).every(([k, v]) => /^[A-Za-z0-9_]{1,64}$/.test(k) && (isScalar(v) || (Array.isArray(v) && v.length <= 50 && v.every(isScalar)))),
    'filter values must be strings, numbers, booleans or null (or lists of them)',
  )

function isScalar(v: unknown) {
  return v === null || ['string', 'number', 'boolean'].includes(typeof v)
}

export const listQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(10_000).default(1000),
    offset: z.coerce.number().int().min(0).default(0),
    // Managed listing (page/sort/search/filter): done by the API with real totals.
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(500).optional(),
    sort: z.string().regex(/^[A-Za-z0-9_]{1,64}$/, 'sort must be a column name').optional(),
    order: z.enum(['asc', 'desc']).optional(),
    search: z.string().trim().max(200).optional(),
    filter: filterParam.optional(),
    q: z
      .string()
      .max(2000)
      .refine(s => {
        try {
          const v = JSON.parse(s)
          return v !== null && typeof v === 'object' && !Array.isArray(v)
        } catch {
          return false
        }
      }, 'q must be a JSON object (ORDS filter syntax)')
      .refine(s => !/\$asof/i.test(s), 'historical ($asof) queries are not allowed')
      .optional(),
  })
  .strict()
