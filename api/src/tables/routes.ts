import { Router, type Request } from 'express'
import type { AppContext } from '../context.js'
import { actorOf } from '../context.js'
import { requireAuth } from '../auth/middleware.js'
import { can } from '../auth/permissions.js'
import { forbidden, HttpError, notFound } from '../http/errors.js'
import { OrdsError, type OrdsRow } from '../ords/client.js'
import { APPROVER_ONLY_COLUMNS, DECISION_STATUSES, isWritable, TABLES, type TableDef, type WritableTable } from './registry.js'
import { idParam, isTextSpec, listQuery, normalizePayload } from './validate.js'

/** Hard cap on rows loaded for a managed (searched/sorted/paged) listing. */
export const MANAGED_LIST_CAP = 20_000
const ORDS_PAGE = 1000

/** Translate a database failure into a safe API error. Never pretends the write succeeded. */
export function toHttpError(err: unknown): unknown {
  if (!(err instanceof OrdsError)) return err
  switch (err.kind) {
    case 'not_found':
      return new HttpError(404, 'NOT_FOUND', 'Record not found')
    case 'conflict':
      return new HttpError(409, 'CONFLICT', 'Someone else changed this record. Reload it and try again.')
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

/** A 404 for a whole table means its migration has not been run (or it isn't REST-enabled). */
function notProvisionedOr(err: unknown, def: TableDef): unknown {
  if (err instanceof OrdsError && err.kind === 'not_found') {
    return new HttpError(503, 'NOT_PROVISIONED', `${def.label} is not set up in the database yet. Run the migrations in db/migrations.`)
  }
  return toHttpError(err)
}

/** Search columns: declared ones, else every text column of a writable table. */
function searchColumns(def: TableDef): string[] {
  if (def.search) return def.search.map(c => c.toLowerCase())
  if (isWritable(def)) return Object.entries(def.columns).filter(([, spec]) => isTextSpec(spec)).map(([c]) => c.toLowerCase())
  return []
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1 // nulls last
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

function matchesFilter(row: OrdsRow, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([col, wanted]) => {
    const actual = row[col.toLowerCase()]
    const options = Array.isArray(wanted) ? wanted : [wanted]
    return options.some(w =>
      w === null ? actual == null : typeof w === 'string' && typeof actual === 'string' ? actual.toLowerCase() === w.toLowerCase() : actual === w || String(actual) === String(w),
    )
  })
}

function requireWritable(def: TableDef): WritableTable {
  if (!isWritable(def)) throw new HttpError(405, 'READ_ONLY', 'This resource is read-only')
  return def
}

/** Echo ignored field names safely (only plain identifiers can go into a header). */
function setIgnoredHeader(res: import('express').Response, ignored: string[]) {
  const safe = ignored.filter(k => /^[A-Za-z0-9_]{1,64}$/.test(k)).slice(0, 50)
  if (safe.length) res.setHeader('X-Ignored-Fields', safe.join(','))
}

const isDecision = (v: unknown) => typeof v === 'string' && DECISION_STATUSES.has(v)
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
    const table = String(req.params.table)
    const def = resolveTable(table)
    requireRead(req, def)
    const query = listQuery.parse(req.query)
    const managed = query.page !== undefined || query.pageSize !== undefined || query.sort || query.search || query.filter || query.all
    try {
      if (!managed) {
        const result = await withUpstream(table, def, up => ctx.ords.list(up, query))
        res.json({ items: result.items, count: result.items.length, hasMore: result.hasMore, limit: query.limit, offset: query.offset })
        return
      }

      // Load the table through ORDS paging (capped), then filter / search / sort / page here.
      const rows: OrdsRow[] = []
      let truncated = false
      for (let offset = 0; ; offset += ORDS_PAGE) {
        const chunk = await withUpstream(table, def, up => ctx.ords.list(up, { limit: ORDS_PAGE, offset, q: query.q }))
        rows.push(...chunk.items)
        if (!chunk.hasMore || chunk.items.length === 0) break
        if (rows.length >= MANAGED_LIST_CAP) {
          truncated = true
          break
        }
      }

      let items = query.filter ? rows.filter(r => matchesFilter(r, query.filter!)) : rows
      if (query.search) {
        const term = query.search.toLowerCase()
        const cols = searchColumns(def)
        items = items.filter(r => cols.some(c => r[c] != null && String(r[c]).toLowerCase().includes(term)))
      }
      if (query.sort) {
        const key = query.sort.toLowerCase()
        const dir = query.order === 'desc' ? -1 : 1
        // Empty values always sort last, whichever the direction.
        items = [...items].sort((x, y) => {
          const a = x[key]
          const b = y[key]
          if (a == null || b == null) return a == null && b == null ? 0 : a == null ? 1 : -1
          return dir * compareValues(a, b)
        })
      }
      const total = items.length
      if (query.all) {
        res.json({ items, total, page: 1, pageSize: total, pageCount: 1, truncated })
        return
      }
      const pageSize = query.pageSize ?? 50
      const page = query.page ?? 1
      res.json({
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total,
        page,
        pageSize,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
        truncated,
      })
    } catch (err) {
      throw notProvisionedOr(err, def)
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
    const role = req.user!.role
    if (!can(role, def.writePermission ?? 'create')) throw forbidden()
    const { row, ignoredFields } = normalizePayload(def, req.body, 'create')
    const decision = isDecision(row.APPROVAL_STATUS)
    const approverFields = Object.keys(row).filter(k => APPROVER_ONLY_COLUMNS.has(k) && row[k] != null)
    if ((decision || approverFields.length) && !can(role, 'approve')) {
      throw forbidden('Only Risk Managers and Administrators can approve, reject or add approver comments')
    }
    stampServerColumns(def, row, req, 'create')
    if (decision && def.serverColumns?.approved_on) row[def.serverColumns.approved_on] = new Date().toISOString()
    setIgnoredHeader(res, ignoredFields)

    try {
      const created = await ctx.ords.create(table, row)
      const id = (created as OrdsRow).uuid ?? (created as OrdsRow).id ?? null
      await audit(req, 'CREATE', table, def, id, true, `Created ${def.label.toLowerCase()}`, row)
      res.status(201).json(created)
    } catch (err) {
      await audit(req, 'CREATE', table, def, null, false, `Failed to create ${def.label.toLowerCase()}: ${(err as Error).message}`)
      throw notProvisionedOr(err, def)
    }
  })

  const update = async (req: Request, res: import('express').Response) => {
    const table = String(req.params.table)
    const def = requireWritable(resolveTable(table))
    const role = req.user!.role
    if (!can(role, def.writePermission ?? 'update')) throw forbidden()
    const id = idParam.parse(String(req.params.id))
    const { row, ignoredFields } = normalizePayload(def, req.body, 'update')
    const isApprover = can(role, 'approve')
    const hasApproval = 'APPROVAL_STATUS' in def.columns
    const newStatus = row.APPROVAL_STATUS
    const decision = isDecision(newStatus)
    const approverFields = Object.keys(row).filter(k => APPROVER_ONLY_COLUMNS.has(k))
    if ((decision || approverFields.length) && !isApprover) {
      throw forbidden('Only Risk Managers and Administrators can approve, reject or add approver comments')
    }
    stampServerColumns(def, row, req, 'update')
    setIgnoredHeader(res, ignoredFields)
    const approvedOnCol = def.serverColumns?.approved_on
    let reopened = false

    // Segregation of duties: nobody approves or rejects a record they created themselves.
    // The creator comes from the server's audit log (the register tables have no CREATED_BY column).
    if (decision) {
      const creator = ctx.audit
        .query({ limit: 100_000, offset: 0, action: 'CREATE', entity: def.label })
        .items.find(e => e.entity_id === String(id) && e.result === 'SUCCESS')
      if (creator && creator.actor_email === req.user!.email) {
        throw forbidden('You cannot approve or reject a record you created — another approver must decide')
      }
    }

    const prepare = (current: OrdsRow): OrdsRow => {
      const currentStatus = typeof current.approval_status === 'string' ? current.approval_status.toUpperCase() : null
      if (hasApproval && isApprover) {
        if (decision && approvedOnCol) row[approvedOnCol] = new Date().toISOString()
        else if (newStatus !== undefined && isDecision(currentStatus) && approvedOnCol) row[approvedOnCol] = null
      }
      if (hasApproval && !isApprover) {
        if ('APPROVAL_STATUS' in row && row.APPROVAL_STATUS == null) row.APPROVAL_STATUS = 'DRAFT'
        // Editing an approved or rejected record without approval rights sends it back for review,
        // so signed-off content can never change silently.
        if (isDecision(currentStatus)) {
          row.APPROVAL_STATUS = 'SUBMITTED'
          if (approvedOnCol) row[approvedOnCol] = null
          reopened = true
        }
      }
      return row
    }

    const action = decision ? (newStatus === 'APPROVED' ? 'APPROVE' : 'REJECT') : 'UPDATE'
    const verb = action === 'APPROVE' ? 'Approved' : action === 'REJECT' ? 'Rejected' : 'Updated'
    try {
      const { after } = await ctx.ords.update(table, id, prepare)
      const note = reopened ? ' — was approved/rejected, sent back for review' : ''
      await audit(req, action, table, def, id, true, `${verb} ${def.label.toLowerCase()}${note}`, row)
      res.json(after)
    } catch (err) {
      if (err instanceof HttpError) throw err
      await audit(req, action, table, def, id, false, `Failed to update ${def.label.toLowerCase()}: ${(err as Error).message}`)
      throw toHttpError(err)
    }
  }
  router.put('/:table/:id', update)
  router.patch('/:table/:id', update)

  router.delete('/:table/:id', async (req, res) => {
    const table = String(req.params.table)
    const def = requireWritable(resolveTable(table))
    if (!can(req.user!.role, def.writePermission ?? def.deletePermission ?? 'delete')) throw forbidden()
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
