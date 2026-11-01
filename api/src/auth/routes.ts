import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import type { AppContext } from '../context.js'
import { actorOf, ANONYMOUS } from '../context.js'
import { badRequest, unauthorized } from '../http/errors.js'
import { requireAuth } from './middleware.js'
import { DUMMY_HASH, hashPassword, passwordProblem, verifyPassword } from './passwords.js'
import { permissionsFor } from './permissions.js'
import { SESSION_COOKIE } from './session.js'
import { toPublic, type StoredUser } from '../users/store.js'

const MAX_FAILED_LOGINS = 5
const LOCK_MINUTES = 15

const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
})

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(1).max(200),
})

export function sessionPayload(user: StoredUser) {
  return { user: toPublic(user), permissions: permissionsFor(user.role) }
}

export function authRoutes(ctx: AppContext): Router {
  const router = Router()

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: ctx.config.LOGIN_RATE_LIMIT_PER_15_MIN,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Try again in 15 minutes.' } },
  })

  router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = LoginBody.parse(req.body)
    const user = ctx.users.findByEmail(email)
    const genericFailure = () => unauthorized('Email or password is incorrect, or the account is temporarily locked')

    if (!user) {
      await verifyPassword(password, DUMMY_HASH) // equalise timing
      await ctx.audit.record({ actor: { ...ANONYMOUS, email }, action: 'LOGIN_FAILED', entity: 'Session', description: `Failed sign-in for unknown account ${email}`, result: 'FAILURE', source: 'api', ip: req.ip })
      throw genericFailure()
    }
    const ok = await verifyPassword(password, user.passwordHash)
    // Re-read after the slow hash: another request may have locked or changed the account meanwhile.
    const fresh = ctx.users.findById(user.id) ?? user
    const locked = Boolean(fresh.lockedUntil && new Date(fresh.lockedUntil) > new Date())
    if (!ok || !fresh.active || locked) {
      // Wrong passwords always count — including while locked — and a locked account answers exactly
      // like a wrong password, so responses don't reveal which emails exist.
      const { locked: nowLocked } = ok ? { locked: false } : await ctx.users.registerFailedLogin(fresh.id, MAX_FAILED_LOGINS, LOCK_MINUTES * 60_000)
      await ctx.audit.record({
        actor: actorOf(fresh),
        action: 'LOGIN_FAILED',
        entity: 'Session',
        entityId: fresh.id,
        description: !fresh.active ? 'Sign-in refused: account is deactivated' : locked ? 'Sign-in refused: account is locked' : nowLocked ? 'Wrong password — account locked for 15 minutes' : 'Wrong password',
        result: 'FAILURE',
        source: 'api',
        ip: req.ip,
      })
      throw genericFailure()
    }

    const updated = await ctx.users.update(fresh.id, { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date().toISOString() })
    const token = await ctx.sessions.issue(updated.id, updated.tokenVersion)
    res.cookie(SESSION_COOKIE, token, ctx.sessions.cookieOptions())
    await ctx.audit.record({ actor: actorOf(updated), action: 'LOGIN', entity: 'Session', entityId: updated.id, description: `${updated.name} signed in`, result: 'SUCCESS', source: 'api', ip: req.ip })
    res.json(sessionPayload(updated))
  })

  router.post('/logout', async (req, res) => {
    // Default: end every session of this user (bump the token version). The web app's idle
    // timeout sends {"allDevices": false} so one idle tab doesn't sign the user out elsewhere.
    const allDevices = (req.body as { allDevices?: unknown } | undefined)?.allDevices !== false
    if (req.user) {
      if (allDevices) await ctx.users.update(req.user.id, { tokenVersion: req.user.tokenVersion + 1 })
      await ctx.audit.record({ actor: actorOf(req.user), action: 'LOGOUT', entity: 'Session', entityId: req.user.id, description: `${req.user.name} signed out${allDevices ? '' : ' (idle timeout, this device)'}`, result: 'SUCCESS', source: 'api', ip: req.ip })
    }
    const { maxAge: _maxAge, ...opts } = ctx.sessions.cookieOptions()
    res.clearCookie(SESSION_COOKIE, opts)
    res.status(204).end()
  })

  router.get('/me', requireAuth, (req, res) => {
    res.json(sessionPayload(req.user!))
  })

  router.post('/change-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = ChangePasswordBody.parse(req.body)
    const user = req.user!
    if (!(await verifyPassword(currentPassword, user.passwordHash))) throw badRequest('Current password is incorrect')
    const problem = passwordProblem(newPassword)
    if (problem) throw badRequest(problem)
    const updated = await ctx.users.update(user.id, { passwordHash: await hashPassword(newPassword), tokenVersion: user.tokenVersion + 1 })
    await ctx.audit.record({ actor: actorOf(user), action: 'PASSWORD_CHANGE', entity: 'User', entityId: user.id, description: `${user.name} changed their password`, result: 'SUCCESS', source: 'api', ip: req.ip })
    // Re-issue a session for this browser; all other sessions are now invalid.
    res.cookie(SESSION_COOKIE, await ctx.sessions.issue(updated.id, updated.tokenVersion), ctx.sessions.cookieOptions())
    res.json(sessionPayload(updated))
  })

  return router
}
