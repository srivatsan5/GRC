import { Router, type Request } from 'express'
import type { AppContext } from '../context.js'
import { actorOf } from '../context.js'
import { requireAuth } from '../auth/middleware.js'
import { can } from '../auth/permissions.js'
import { forbidden, HttpError, notFound } from '../http/errors.js'
import { OrdsError, type OrdsRow } from '../ords/client.js'
import { DECISION_STATUSES, isWritable, TABLES, type TableDef, type WritableTable } from './registry.js'
import { idParam, listQuery, normalizePayload } from './validate.js'

/** Translate a database failure into a safe API error. Never pretends the write succeeded. */
export function toHttpError(err: unknown): unknown {
  if (!(err instanceof OrdsError)) return err
  switch (err.kind) {
    case 'not_found':
      return new HttpError(404, 'NOT_FOUND', 'Record not found')
    case 'rejected':
      return new HttpError(422, 'DB_REJECTED', err.message)
    case 'timeout':
      return new HttpError(504, 'DB_TIMEOUT', 'The database did not respond in time. Nothing was changed; please retry.')
    case 'not_configured':
      return new HttpError(503, 'DB_NOT_CONFIGURED', 'The database connection is not configured.')
    case 'auth_failed':
      return new HttpError(503, 'DB_AUTH_FAILED', 'The API could not authenticate to the database.')
    case 'server_error':
      return new HttpError(502, 'DB_ERROR', 'The database returned an error. Please retry.')
    default:
      return new HttpError(503, 'DB_UNAVAILABLE', 'The database is unreachable right now. Please retry.')
  }
}

function resolveTable(name: string): TableDef {
  const def = Object.hasOwn(TABLES, name) ? TABLES[name] : undefined
  if (!def) throw notFound(`Unknown resource '${name}'`)
  return def
}

function requireRead(req: Request, def: TableDef) {
  const perm = def.access === 'restricted' ? 'reference:read-restricted' : 'read'
  if (!can(req.user!.role, perm)) throw forbidden()
}

function requireWritable(def: TableDef): WritableTable {
  if (!isWritable(def)) throw new HttpError(405, 'READ_ONLY', 'This resource is read-only')
  return def
}

function writableColumns(def: WritableTable): string[] {
  return [...Object.keys(def.columns), ...Object.values(def.serverColumns ?? {})]
}

/** Try each upstream name in turn (legacy spellings), moving on only when a table doesn't exist. */
async function withUpstream<T>(table: string, def: TableDef, fn: (upstream: string) => Promise<T>): Promise<T> {
  const candidates = ('upstreamCandidates' in def && def.upstreamCandidates) || [table]
  let lastErr: unknown
  for (const upstream of candidates) {
    try {
      return await fn(upstream)
    } catch (err) {
      lastErr = err
      if (!(err instanceof OrdsError && err.kind === 'not_found')) break
    }
  }
  throw lastErr
}

export function tableRoutes(ctx: AppContext): Router {
  const router = Router()
  router.use(requireAuth)

  const audit = (req: Request, action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT', table: string, def: TableDef, id: unknown, ok: boolean, description: string, changes?: Record<string, unknown>) =>
    ctx.audit.record({
      actor: actorOf(req.user!),
      action,
      entity: def.label,
      entityId: id == null ? null : String(id),
      description: `${description} [${table}]`,
      result: ok ? 'SUCCESS' : 'FAILURE',
      source: 'api',
      ip: req.ip,
      changes,
    })

  router.get('/:table', async (req, res) => {
    const def = resolveTable(req.params.table!)
    requireRead(req, def)
    const query = listQuery.parse(req.query)
    try {
      const result = await withUpstream(req.params.table!, def, up => ctx.ords.list(up, query))
      res.json({ items: result.items, count: result.items.length, hasMore: result.hasMore, limit: query.limit, offset: query.offset })
    } catch (err) {
      throw toHttpError(err)
    }
  })

  router.get('/:table/:id', async (req, res) => {
    const def = resolveTable(req.params.table!)
    requireRead(req, def)
    const id = idParam.parse(String(req.params.id))
    try {
      res.json(await withUpstream(req.params.table!, def, up => ctx.ords.get(up, id)))
    } catch (err) {
      throw toHttpError(err)
    }
  })

  router.post('/:table', async (req, res) => {
    const table = String(req.params.table)
    const def = requireWritable(resolveTable(table))
    if (!can(req.user!.role, 'create')) throw forbidden()
    const { row, ignoredFields } = normalizePayload(def, req.body, 'create')
    const decision = typeof row.APPROVAL_STATUS === 'string' && DECISION_STATUSES.has(row.APPROVAL_STATUS)
    if (decision && !can(req.user!.role, 'approve')) throw forbidden('Only approvers can create records as approved or rejected')
    stampServerColumns(def, row, req, 'create')

    try {
      const created = await ctx.ords.create(table, row)
      const id = (created as OrdsRow).uuid ?? (created as OrdsRow).id ?? null
      await audit(req, 'CREATE', table, def, id, true, `Created ${def.label.toLowerCase()}`, row)
      if (ignoredFields.length) res.setHeader('X-Ignored-Fields', ignoredFields.join(','))
      res.status(201).json(created)
    } catch (err) {
      await audit(req, 'CREATE', table, def, null, false, `Failed to create ${def.label.toLowerCase()}: ${(err as Error).message}`)
      throw toHttpError(err)
    }
  })

  const update = async (req: Request, res: import('express').Response) => {
    const table = String(req.params.table)
    const def = requireWritable(resolveTable(table))
    if (!can(req.user!.role, 'update')) throw forbidden()
    const id = idParam.parse(String(req.params.id))
    const { row, ignoredFields } = normalizePayload(def, req.body, 'update')

    const status = typeof row.APPROVAL_STATUS === 'string' ? row.APPROVAL_STATUS : undefined
    const decision = status !== undefined && DECISION_STATUSES.has(status)
    if (decision) {
      if (!can(req.user!.role, 'approve')) throw forbidden('Only Risk Managers and Administrators can approve or reject')
      if ('APPROVED_ON' in def.columns && row.APPROVED_ON == null) row.APPROVED_ON = new Date().toISOString()
    }
    stampServerColumns(def, row, req, 'update')
    const action = decision ? (status === 'APPROVED' ? 'APPROVE' : 'REJECT') : 'UPDATE'

    try {
      const updated = await ctx.ords.update(table, id, row, writableColumns(def))
      await audit(req, action, table, def, id, true, `${action === 'UPDATE' ? 'Updated' : status === 'APPROVED' ? 'Approved' : 'Rejected'} ${def.label.toLowerCase()}`, row)
      if (ignoredFields.length) res.setHeader('X-Ignored-Fields', ignoredFields.join(','))
      res.json(updated)
    } catch (err) {
      await audit(req, action, table, def, id, false, `Failed to update ${def.label.toLowerCase()}: ${(err as Error).message}`)
      throw toHttpError(err)
    }
  }
  router.put('/:table/:id', update)
  router.patch('/:table/:id', update)

  router.delete('/:table/:id', async (req, res) => {
    const table = String(req.params.table)
    const def = requireWritable(resolveTable(table))
    if (!can(req.user!.role, 'delete')) throw forbidden()
    const id = idParam.parse(String(req.params.id))
    try {
      await ctx.ords.remove(table, id)
      await audit(req, 'DELETE', table, def, id, true, `Deleted ${def.label.toLowerCase()}`)
      res.status(204).end()
    } catch (err) {
      await audit(req, 'DELETE', table, def, id, false, `Failed to delete ${def.label.toLowerCase()}: ${(err as Error).message}`)
      throw toHttpError(err)
    }
  })

  return router
}

function stampServerColumns(def: WritableTable, row: Record<string, unknown>, req: Request, mode: 'create' | 'update') {
  const cols = def.serverColumns ?? {}
  const now = new Date().toISOString()
  const who = req.user!.email
  if (mode === 'create') {
    if (cols.created_on) row[cols.created_on] = now
    if (cols.created_by) row[cols.created_by] = who
  }
  if (cols.updated_on) row[cols.updated_on] = now
  if (cols.updated_by) row[cols.updated_by] = who
}
