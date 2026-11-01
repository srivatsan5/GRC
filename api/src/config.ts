import { createHash } from 'node:crypto'
import { z } from 'zod'

const bool = z
  .union([z.boolean(), z.string()])
  .transform(v => (typeof v === 'boolean' ? v : ['1', 'true', 'yes'].includes(v.trim().toLowerCase())))

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const ConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform(s => s.split(',').map(o => o.trim()).filter(Boolean)),
    JWT_SECRET: z.preprocess(emptyToUndefined, z.string().min(32, 'JWT_SECRET must be at least 32 characters')),
    // Key for the audit-log HMAC chain. Set it once and never change it (old entries would stop verifying).
    // Falls back to a key derived from JWT_SECRET.
    AUDIT_HMAC_KEY: z.preprocess(emptyToUndefined, z.string().min(32, 'AUDIT_HMAC_KEY must be at least 32 characters').optional()),
    SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(7 * 24 * 60).default(480),
    COOKIE_SECURE: bool.default(false),
    COOKIE_DOMAIN: z.preprocess(emptyToUndefined, z.string().optional()),
    DATA_DIR: z.string().default('./data'),
    BOOTSTRAP_ADMIN_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),
    BOOTSTRAP_ADMIN_NAME: z.preprocess(emptyToUndefined, z.string().default('Administrator')),
    BOOTSTRAP_ADMIN_PASSWORD: z.preprocess(emptyToUndefined, z.string().min(12).optional()),
    ORDS_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    ORDS_TOKEN_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
    // Legacy names (CLIENT_ID / CLIENT_SECRET) are accepted for backwards compatibility.
    ORDS_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
    ORDS_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
    ORDS_ALLOW_ANONYMOUS: bool.default(false),
    ORDS_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(8000),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(1200),
    LOGIN_RATE_LIMIT_PER_15_MIN: z.coerce.number().int().positive().default(10),
    // Express 'trust proxy' setting: hop count, or a list such as 'loopback'. Needed for correct client IPs behind nginx.
    TRUST_PROXY: z
      .string()
      .default('loopback')
      .transform(v => (/^\d+$/.test(v) ? Number(v) : v)),
  })
  .superRefine((c, ctx) => {
    if (c.NODE_ENV === 'production') {
      if (c.ORDS_ALLOW_ANONYMOUS) {
        ctx.addIssue({ code: 'custom', path: ['ORDS_ALLOW_ANONYMOUS'], message: 'must be false in production' })
      }
      if (!c.COOKIE_SECURE) {
        ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'must be true in production (HTTPS)' })
      }
    }
    if (c.BOOTSTRAP_ADMIN_EMAIL && !c.BOOTSTRAP_ADMIN_PASSWORD) {
      ctx.addIssue({ code: 'custom', path: ['BOOTSTRAP_ADMIN_PASSWORD'], message: 'required (12+ chars) when BOOTSTRAP_ADMIN_EMAIL is set' })
    }
  })

export type Config = z.infer<typeof ConfigSchema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse({
    ...env,
    ORDS_CLIENT_ID: env.ORDS_CLIENT_ID ?? env.CLIENT_ID,
    ORDS_CLIENT_SECRET: env.ORDS_CLIENT_SECRET ?? env.CLIENT_SECRET,
  })
  if (!parsed.success) {
    const lines = parsed.error.issues.map(i => `  - ${i.path.join('.') || 'config'}: ${i.message}`)
    throw new Error(`Invalid API configuration:\n${lines.join('\n')}`)
  }
  return parsed.data
}

/** Key for the audit HMAC chain: AUDIT_HMAC_KEY, or one derived from JWT_SECRET. */
export function auditKeyFor(config: Config): string {
  return config.AUDIT_HMAC_KEY ?? createHash('sha256').update(`pericope-audit:${config.JWT_SECRET}`).digest('hex')
}
