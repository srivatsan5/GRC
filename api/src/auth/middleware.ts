import type { RequestHandler } from 'express'
import type { AppContext } from '../context.js'
import { forbidden, unauthorized } from '../http/errors.js'
import { can, type Permission } from './permissions.js'
import { SESSION_COOKIE } from './session.js'

/** Resolve the session cookie (or a Bearer token for scripts) to an active user. */
export function authenticate(ctx: AppContext): RequestHandler {
  return async (req, _res, next) => {
    const header = req.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7) : (req.cookies?.[SESSION_COOKIE] as string | undefined)
    if (!token) return next()
    const claims = await ctx.sessions.verify(token)
    if (!claims) return next()
    const user = ctx.users.findById(claims.sub)
    if (user && user.active && user.tokenVersion === claims.ver) req.user = user
    next()
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized())
  next()
}

export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized())
    if (!can(req.user.role, permission)) return next(forbidden())
    next()
  }
}

/**
 * CSRF defence for cookie sessions: state-changing requests must carry a custom
 * header (which forces a CORS preflight) and, when present, an allowed Origin.
 */
export function csrfGuard(allowedOrigins: string[]): RequestHandler {
  const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])
  return (req, _res, next) => {
    if (SAFE.has(req.method)) return next()
    if (req.headers.authorization?.startsWith('Bearer ')) return next()
    const origin = req.headers.origin
    if (origin && !allowedOrigins.includes(origin)) return next(forbidden('Origin not allowed'))
    if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
      return next(forbidden('Missing X-Requested-With header'))
    }
    next()
  }
}
