/**
 * Maker-checker approval workflow.
 *
 * Requests and their ordered steps live in ERM_TRN_APPROVAL_REQUEST / _STEP and can
 * only be changed through these routes, which enforce:
 *  - the submitter is always the signed-in user (from the session);
 *  - nobody can decide their own request (segregation of duties);
 *  - steps are decided in order, by the step's role (Administrators may act for any step);
 *  - one person cannot sign two steps of the same request;
 *  - a rejection needs a comment;
 *  - a step that someone else just decided is not overwritten (ETag check).
 */
import { Router } from 'express'
import { z } from 'zod'
import type { AppContext } from '../context.js'
import { actorOf } from '../context.js'
import { requireAuth } from '../auth/middleware.js'
import { can } from '../auth/permissions.js'
import { badRequest, conflict, forbidden, HttpError, notFound } from '../http/errors.js'
import { OrdsError, type OrdsRow } from '../ords/client.js'
import { loadAll } from '../ords/loadAll.js'
import { idParam } from '../tables/validate.js'
import { toHttpError } from '../tables/routes.js'
import type { StoredUser } from '../users/store.js'

const REQUESTS = 'erm_trn_approval_request'
const STEPS = 'erm_trn_approval_step'
const APPROVER_ROLES = ['Risk Manager', 'Administrator'] as const
const REQUEST_TYPES = ['Risk Assessment', 'Mitigation Plan', 'Control Change', 'Policy Update', 'Risk Acceptance'] as const

const SubmitBody = z.object({
  title: z.string().trim().min(3).max(300),
  request_type: z.enum(REQUEST_TYPES),
  business_unit: z.string().trim().max(100).optional(),
  amount: z.coerce.number().min(0).optional(),
  details: z.string().trim().max(4000).optional(),
  approver_roles: z.array(z.enum(APPROVER_ROLES)).min(1).max(3).default(['Risk Manager']),
})

const DecisionBody = z.object({
  decision: z.enum(['Approved', 'Rejected']),
  comment: z.string().trim().max(2000).optional(),
})

const ListQuery = z
  .object({
    status: z.enum(['Pending', 'In Review', 'Approved', 'Rejected', 'Withdrawn']).optional(),
    mine: z.enum(['submitted', 'to-decide']).optional(),
  })
  .strict()

export interface WorkflowStep {
  uuid: number
  step_no: number
  approver_role: string
  decision: string | null
  decided_by: string | null
  decided_name: string | null
  decided_on: string | null
  comments: string | null
}

export interface WorkflowItem extends OrdsRow {
  uuid: number
  status: string
  submitted_by: string
  steps: WorkflowStep[]
  next_step: number | null
  /** Whether the signed-in user may decide the next step right now. */
  can_decide: boolean
  /** Why not, when can_decide is false and a step is open. */
  blocked_reason: string | null
}

const OPEN = new Set(['Pending', 'In Review'])

function nextOpenStep(steps: WorkflowStep[]): WorkflowStep | undefined {
  return [...steps].sort((a, b) => a.step_no - b.step_no).find(s => !s.decision)
}

/** The single rule set used both to show buttons and to accept a decision. */
export function decisionBlock(user: StoredUser, request: { status: string; submitted_by: string }, steps: WorkflowStep[]): string | null {
  if (!OPEN.has(request.status)) return `This request is already ${request.status.toLowerCase()}`
  const step = nextOpenStep(steps)
  if (!step) return 'There is no open approval step'
  if (!can(user.role, 'approve')) return 'Only Risk Managers and Administrators can approve'
  if (request.submitted_by?.toLowerCase() === user.email) return 'You cannot approve a request you submitted'
  if (user.role !== 'Administrator' && user.role !== step.approver_role) return `Step ${step.step_no} needs a ${step.approver_role}`
  if (steps.some(s => s.decided_by?.toLowerCase() === user.email)) return 'You already signed an earlier step of this request'
  return null
}

function toStep(r: OrdsRow): WorkflowStep {
  return {
    uuid: Number(r.uuid),
    step_no: Number(r.step_no),
    approver_role: String(r.approver_role),
    decision: (r.decision as string) ?? null,
    decided_by: (r.decided_by as string) ?? null,
    decided_name: (r.decided_name as string) ?? null,
    decided_on: (r.decided_on as string) ?? null,
    comments: (r.comments as string) ?? null,
  }
}

function provisioningError(err: unknown): unknown {
  if (err instanceof OrdsError && err.kind === 'not_found') {
    return new HttpError(503, 'NOT_PROVISIONED', 'The approval workflow is not set up in the database yet. Run the migrations in db/migrations.')
  }
  return toHttpError(err)
}

export function workflowRoutes(ctx: AppContext): Router {
  const router = Router()
  router.use(requireAuth)

  async function loadOne(id: number): Promise<{ request: OrdsRow; steps: WorkflowStep[] }> {
    let request: OrdsRow
    try {
      request = await ctx.ords.get(REQUESTS, id)
    } catch (err) {
      if (err instanceof OrdsError && err.kind === 'not_found') throw notFound('Approval request not found')
      throw provisioningError(err)
    }
    const { rows } = await loadAll(ctx.ords, STEPS, { q: JSON.stringify({ request_uuid: id }) })
    return { request, steps: rows.filter(r => Number(r.request_uuid) === id).map(toStep).sort((a, b) => a.step_no - b.step_no) }
  }

  function present(user: StoredUser, request: OrdsRow, steps: WorkflowStep[]): WorkflowItem {
    const r = request as WorkflowItem
    const block = decisionBlock(user, r, steps)
    return { ...request, uuid: Number(request.uuid), status: String(request.status), submitted_by: String(request.submitted_by ?? ''), steps, next_step: nextOpenStep(steps)?.step_no ?? null, can_decide: block === null, blocked_reason: block }
  }

  router.get('/', async (req, res) => {
    const q = ListQuery.parse(req.query)
    try {
      const [{ rows: requests }, { rows: stepRows }] = await Promise.all([loadAll(ctx.ords, REQUESTS), loadAll(ctx.ords, STEPS)])
      const stepsByRequest = new Map<number, WorkflowStep[]>()
      for (const s of stepRows.map(r => ({ ...toStep(r), request_uuid: Number(r.request_uuid) }))) {
        const list = stepsByRequest.get(s.request_uuid) ?? []
        list.push(s)
        stepsByRequest.set(s.request_uuid, list)
      }
      let items = requests.map(r => present(req.user!, r, (stepsByRequest.get(Number(r.uuid)) ?? []).sort((a, b) => a.step_no - b.step_no)))
      if (q.status) items = items.filter(i => i.status === q.status)
      if (q.mine === 'submitted') items = items.filter(i => i.submitted_by.toLowerCase() === req.user!.email)
      if (q.mine === 'to-decide') items = items.filter(i => i.can_decide)
      items.sort((a, b) => String(b.submitted_on ?? '').localeCompare(String(a.submitted_on ?? '')))
      res.json({ items, total: items.length })
    } catch (err) {
      throw provisioningError(err)
    }
  })

  router.get('/:id', async (req, res) => {
    const id = idParam.parse(String(req.params.id))
    const { request, steps } = await loadOne(id)
    res.json(present(req.user!, request, steps))
  })

  router.post('/', async (req, res) => {
    if (!can(req.user!.role, 'create')) throw forbidden()
    const body = SubmitBody.parse(req.body)
    const user = req.user!
    const now = new Date().toISOString()
    let created: OrdsRow
    try {
      created = await ctx.ords.create(REQUESTS, {
        TITLE: body.title,
        REQUEST_TYPE: body.request_type,
        BUSINESS_UNIT: body.business_unit ?? null,
        AMOUNT: body.amount ?? null,
        DETAILS: body.details ?? null,
        STATUS: 'Pending',
        SUBMITTED_BY: user.email,
        SUBMITTED_NAME: user.name,
        SUBMITTED_ON: now,
        CREATED_BY: user.email,
        CREATED_ON: now,
      })
    } catch (err) {
      throw provisioningError(err)
    }
    const id = Number(created.uuid)
    try {
      for (const [i, role] of body.approver_roles.entries()) {
        await ctx.ords.create(STEPS, { REQUEST_UUID: id, STEP_NO: i + 1, APPROVER_ROLE: role, CREATED_BY: user.email, CREATED_ON: now })
      }
    } catch (err) {
      // Don't leave a request without its steps behind.
      await ctx.ords.remove(REQUESTS, id).catch(() => undefined)
      throw provisioningError(err)
    }
    await ctx.audit.record({ actor: actorOf(user), action: 'CREATE', entity: 'Approval request', entityId: id, description: `Submitted "${body.title}" (${body.request_type}) for ${body.approver_roles.length}-step approval`, result: 'SUCCESS', source: 'api', ip: req.ip })
    const { request, steps } = await loadOne(id)
    res.status(201).json(present(user, request, steps))
  })

  router.post('/:id/decision', async (req, res) => {
    const id = idParam.parse(String(req.params.id))
    const body = DecisionBody.parse(req.body)
    const user = req.user!
    if (body.decision === 'Rejected' && !body.comment) throw badRequest('A comment is required when rejecting')

    const { request, steps } = await loadOne(id)
    const block = decisionBlock(user, request as WorkflowItem, steps)
    if (block) throw forbidden(block)
    const step = nextOpenStep(steps)!
    const now = new Date().toISOString()

    try {
      await ctx.ords.update(STEPS, step.uuid, current => {
        if (current.decision) throw conflict('Someone else decided this step a moment ago. Reload to see it.')
        return { DECISION: body.decision, DECIDED_BY: user.email, DECIDED_NAME: user.name, DECIDED_ON: now, COMMENTS: body.comment ?? null, UPDATED_BY: user.email, UPDATED_ON: now }
      })
      const remaining = steps.filter(s => s.uuid !== step.uuid && !s.decision).length
      const status = body.decision === 'Rejected' ? 'Rejected' : remaining === 0 ? 'Approved' : 'In Review'
      await ctx.ords.update(REQUESTS, id, () => ({ STATUS: status, CLOSED_ON: status === 'In Review' ? null : now, UPDATED_BY: user.email, UPDATED_ON: now }))
      await ctx.audit.record({
        actor: actorOf(user),
        action: body.decision === 'Approved' ? 'APPROVE' : 'REJECT',
        entity: 'Approval request',
        entityId: id,
        description: `${body.decision} step ${step.step_no} of "${String(request.title)}"${body.comment ? ` — ${body.comment}` : ''} (request now ${status})`,
        result: 'SUCCESS',
        source: 'api',
        ip: req.ip,
      })
    } catch (err) {
      if (err instanceof HttpError) throw err
      throw toHttpError(err)
    }
    const fresh = await loadOne(id)
    res.json(present(user, fresh.request, fresh.steps))
  })

  router.post('/:id/withdraw', async (req, res) => {
    const id = idParam.parse(String(req.params.id))
    const user = req.user!
    const { request } = await loadOne(id)
    if (String(request.submitted_by ?? '').toLowerCase() !== user.email) throw forbidden('Only the submitter can withdraw a request')
    if (!OPEN.has(String(request.status))) throw conflict(`This request is already ${String(request.status).toLowerCase()}`)
    const now = new Date().toISOString()
    try {
      await ctx.ords.update(REQUESTS, id, () => ({ STATUS: 'Withdrawn', CLOSED_ON: now, UPDATED_BY: user.email, UPDATED_ON: now }))
    } catch (err) {
      throw toHttpError(err)
    }
    await ctx.audit.record({ actor: actorOf(user), action: 'UPDATE', entity: 'Approval request', entityId: id, description: `Withdrew "${String(request.title)}"`, result: 'SUCCESS', source: 'api', ip: req.ip })
    const fresh = await loadOne(id)
    res.json(present(user, fresh.request, fresh.steps))
  })

  return router
}
