import { Router } from 'express'
import { z } from 'zod'
import type { AppContext } from '../context.js'
import { actorOf } from '../context.js'
import { requireAuth, requirePermission } from '../auth/middleware.js'
import { AUDIT_ACTIONS } from './log.js'

const ListQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(1000).default(200),
    offset: z.coerce.number().int().min(0).default(0),
    action: z.enum(AUDIT_ACTIONS).optional(),
    actor: z.string().max(254).optional(),
    entity: z.string().max(128).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    search: z.string().max(200).optional(),
  })
  .strict()

/** Events the browser may report for modules that are not database-backed yet. */
const UI_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'EXPORT', 'VIEW', 'SETTINGS_CHANGE'] as const

const UiEvent = z.object({
  action: z.enum(UI_ACTIONS),
  entity: z.string().trim().min(1).max(128),
  entity_id: z.union([z.string().max(100), z.number()]).optional().nullable(),
  description: z.string().trim().min(1).max(2000),
  result: z.enum(['SUCCESS', 'FAILURE']).default('SUCCESS'),
})

export function auditRoutes(ctx: AppContext): Router {
  const router = Router()

  router.get('/', requirePermission('audit:read'), (req, res) => {
    const q = ListQuery.parse(req.query)
    res.json(ctx.audit.query(q))
  })

  router.get('/verify', requirePermission('audit:read'), async (_req, res) => {
    res.json(await ctx.audit.verify())
  })

  // The actor always comes from the session; clients cannot attribute events to anyone else.
  router.post('/', requireAuth, async (req, res) => {
    const e = UiEvent.parse(req.body)
    const entry = await ctx.audit.record({
      actor: actorOf(req.user!),
      action: e.action,
      entity: e.entity,
      entityId: e.entity_id ?? null,
      description: e.description,
      result: e.result,
      source: 'ui',
      ip: req.ip,
    })
    res.status(201).json(entry)
  })

  return router
}
