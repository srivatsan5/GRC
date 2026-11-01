/**
 * Organisation settings, stored as one JSON document in ERM_MST_APP_SETTING (key 'org').
 * Only settings the app actually uses are accepted:
 *  - orgName / industry: shown in the app and on reports
 *  - currency: used to format every money amount
 *  - idleTimeoutMinutes: the web app signs users out after this much inactivity
 *  - riskBands: score thresholds used for Low / Moderate / High / Critical everywhere
 */
import { Router } from 'express'
import { z } from 'zod'
import type { AppContext } from '../context.js'
import { actorOf } from '../context.js'
import { requireAuth, requirePermission } from '../auth/middleware.js'
import { HttpError } from '../http/errors.js'
import { OrdsError, type OrdsRow } from '../ords/client.js'
import { toHttpError } from '../tables/routes.js'

const TABLE = 'erm_mst_app_setting'
const KEY = 'org'
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'SGD', 'AED', 'CAD', 'CHF'] as const

export const SettingsSchema = z
  .object({
    orgName: z.string().trim().min(1).max(120),
    industry: z.string().trim().max(80),
    currency: z.enum(CURRENCIES),
    idleTimeoutMinutes: z.number().int().min(5).max(480),
    riskBands: z
      .object({
        // A score >= threshold falls in that band (scores are likelihood × impact, 1–25).
        moderate: z.number().int().min(2).max(25),
        high: z.number().int().min(2).max(25),
        critical: z.number().int().min(2).max(25),
      })
      .refine(b => b.moderate < b.high && b.high < b.critical, 'Band thresholds must increase: moderate < high < critical'),
  })
  .strict()

export type OrgSettings = z.infer<typeof SettingsSchema>

export const DEFAULT_SETTINGS: OrgSettings = {
  orgName: 'Pericope ERM',
  industry: 'Financial Services',
  currency: 'USD',
  idleTimeoutMinutes: 30,
  riskBands: { moderate: 7, high: 12, critical: 16 },
}

async function readRow(ctx: AppContext): Promise<OrdsRow | null> {
  const { items } = await ctx.ords.list(TABLE, { limit: 10, offset: 0, q: JSON.stringify({ setting_key: KEY }) })
  return items.find(r => r.setting_key === KEY) ?? null
}

function parseStored(row: OrdsRow | null): OrgSettings {
  if (!row?.setting_value) return DEFAULT_SETTINGS
  try {
    const merged = { ...DEFAULT_SETTINGS, ...JSON.parse(String(row.setting_value)) }
    const parsed = SettingsSchema.safeParse(merged)
    return parsed.success ? parsed.data : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function settingsRoutes(ctx: AppContext): Router {
  const router = Router()

  // Everyone signed in needs the settings (currency, bands, timeout) to render the app.
  router.get('/', requireAuth, async (_req, res) => {
    try {
      res.json({ settings: parseStored(await readRow(ctx)), stored: true })
    } catch (err) {
      // Settings must never stop the app from loading: fall back to defaults and say so.
      const reason = err instanceof OrdsError && err.kind === 'not_found' ? 'not_provisioned' : 'unavailable'
      res.json({ settings: DEFAULT_SETTINGS, stored: false, reason })
    }
  })

  router.put('/', requirePermission('users:manage'), async (req, res) => {
    const next = SettingsSchema.parse(req.body)
    const user = req.user!
    const now = new Date().toISOString()
    try {
      const existing = await readRow(ctx)
      const before = parseStored(existing)
      const value = JSON.stringify(next)
      if (existing) {
        await ctx.ords.update(TABLE, Number(existing.uuid), () => ({ SETTING_VALUE: value, UPDATED_BY: user.email, UPDATED_ON: now }))
      } else {
        await ctx.ords.create(TABLE, { SETTING_KEY: KEY, SETTING_VALUE: value, CREATED_BY: user.email, CREATED_ON: now })
      }
      const changed = (Object.keys(next) as (keyof OrgSettings)[]).filter(k => JSON.stringify(before[k]) !== JSON.stringify(next[k]))
      await ctx.audit.record({
        actor: actorOf(user),
        action: 'SETTINGS_CHANGE',
        entity: 'Settings',
        description: changed.length ? `Changed ${changed.join(', ')}` : 'Saved settings (no changes)',
        result: 'SUCCESS',
        source: 'api',
        ip: req.ip,
        changes: Object.fromEntries(changed.map(k => [k, { from: before[k], to: next[k] }])),
      })
      res.json({ settings: next, stored: true })
    } catch (err) {
      if (err instanceof OrdsError && err.kind === 'not_found') {
        throw new HttpError(503, 'NOT_PROVISIONED', 'Settings storage is not set up in the database yet. Run the migrations in db/migrations.')
      }
      throw toHttpError(err)
    }
  })

  return router
}
