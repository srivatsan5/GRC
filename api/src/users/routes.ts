import { Router } from 'express'
import { z } from 'zod'
import type { AppContext } from '../context.js'
import { actorOf } from '../context.js'
import { requirePermission } from '../auth/middleware.js'
import { hashPassword, passwordProblem } from '../auth/passwords.js'
import { ROLES } from '../auth/permissions.js'
import { badRequest, conflict, notFound } from '../http/errors.js'
import { toPublic } from './store.js'

const CreateUser = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(2).max(120),
  role: z.enum(ROLES),
  department: z.string().trim().max(120).default(''),
  password: z.string().max(200),
})

const UpdateUser = z
  .object({
    name: z.string().trim().min(2).max(120),
    role: z.enum(ROLES),
    department: z.string().trim().max(120),
    active: z.boolean(),
  })
  .partial()
  .strict()

const ResetPassword = z.object({ password: z.string().max(200) })

export function userRoutes(ctx: AppContext): Router {
  const router = Router()
  router.use(requirePermission('users:manage'))

  router.get('/', (_req, res) => {
    res.json({ items: ctx.users.list().map(toPublic) })
  })

  router.post('/', async (req, res) => {
    const input = CreateUser.parse(req.body)
    const problem = passwordProblem(input.password)
    if (problem) throw badRequest(problem)
    if (ctx.users.findByEmail(input.email)) throw conflict('A user with this email already exists')
    const user = await ctx.users.create({ ...input, passwordHash: await hashPassword(input.password) })
    await ctx.audit.record({ actor: actorOf(req.user!), action: 'USER_CREATE', entity: 'User', entityId: user.id, description: `Created user ${user.email} as ${user.role}`, result: 'SUCCESS', source: 'api', ip: req.ip })
    res.status(201).json(toPublic(user))
  })

  router.patch('/:id', async (req, res) => {
    const target = ctx.users.findById(req.params.id)
    if (!target) throw notFound('User not found')
    const patch = UpdateUser.parse(req.body)
    const self = req.user!.id === target.id

    const losesAdmin = target.role === 'Administrator' && target.active && ((patch.role && patch.role !== 'Administrator') || patch.active === false)
    if (losesAdmin && ctx.users.activeAdminCount() <= 1) throw conflict('There must always be at least one active Administrator')
    if (self && patch.active === false) throw conflict('You cannot deactivate your own account')
    if (self && patch.role && patch.role !== target.role) throw conflict('You cannot change your own role')

    const securityChange = (patch.role && patch.role !== target.role) || patch.active === false
    const updated = await ctx.users.update(target.id, {
      ...patch,
      ...(securityChange ? { tokenVersion: target.tokenVersion + 1 } : {}),
    })
    const changes = Object.fromEntries(
      Object.entries(patch).map(([k, v]) => [k, { from: (target as unknown as Record<string, unknown>)[k], to: v }]),
    )
    await ctx.audit.record({
      actor: actorOf(req.user!),
      action: patch.role && patch.role !== target.role ? 'ROLE_CHANGE' : 'USER_UPDATE',
      entity: 'User',
      entityId: target.id,
      description: `Updated user ${target.email}`,
      result: 'SUCCESS',
      source: 'api',
      ip: req.ip,
      changes,
    })
    res.json(toPublic(updated))
  })

  router.post('/:id/reset-password', async (req, res) => {
    const target = ctx.users.findById(req.params.id)
    if (!target) throw notFound('User not found')
    const { password } = ResetPassword.parse(req.body)
    const problem = passwordProblem(password)
    if (problem) throw badRequest(problem)
    await ctx.users.update(target.id, { passwordHash: await hashPassword(password), tokenVersion: target.tokenVersion + 1, failedLogins: 0, lockedUntil: null })
    await ctx.audit.record({ actor: actorOf(req.user!), action: 'PASSWORD_CHANGE', entity: 'User', entityId: target.id, description: `Reset password for ${target.email}`, result: 'SUCCESS', source: 'api', ip: req.ip })
    res.status(204).end()
  })

  return router
}
