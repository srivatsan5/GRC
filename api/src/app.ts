import { randomUUID } from 'node:crypto'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import type { AppContext } from './context.js'
import { authenticate, csrfGuard } from './auth/middleware.js'
import { authRoutes } from './auth/routes.js'
import { userRoutes } from './users/routes.js'
import { auditRoutes } from './audit/routes.js'
import { tableRoutes } from './tables/routes.js'
import { workflowRoutes } from './workflow/routes.js'
import { settingsRoutes } from './settings/routes.js'
import { buildOpenApi } from './openapi.js'
import { errorHandler, notFoundHandler } from './http/errors.js'
import { log, setLogSilent } from './lib/log.js'

export function createApp(ctx: AppContext) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', ctx.config.TRUST_PROXY)
  setLogSilent(ctx.config.NODE_ENV === 'test')

  // First, so every later failure (even a malformed body) carries the request id.
  app.use(requestLogger)
  app.use(helmet())
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || ctx.config.CORS_ORIGINS.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-Requested-With', 'Authorization'],
      exposedHeaders: ['X-Ignored-Fields', 'X-Request-Id'],
      maxAge: 600,
    }),
  )
  app.use(express.json({ limit: '256kb' }))
  app.use(cookieParser())

  // Unauthenticated probes. They reveal nothing about the upstream host.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })
  app.get('/ready', async (_req, res) => {
    if (!ctx.ords.configured) {
      res.status(503).json({ status: 'not_ready', database: 'unconfigured' })
      return
    }
    try {
      await ctx.ords.ping('per_trn_identify_risk')
      res.json({ status: 'ready', database: 'ok' })
    } catch {
      res.status(503).json({ status: 'not_ready', database: 'unavailable' })
    }
  })
  const openapi = buildOpenApi()
  app.get('/api/openapi.json', (_req, res) => {
    res.json(openapi)
  })

  app.use(authenticate(ctx))
  // Limit per signed-in user (per IP only for anonymous requests), so many people behind one
  // office IP don't throttle each other.
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: ctx.config.RATE_LIMIT_PER_MINUTE,
      keyGenerator: req => (req.user ? `user:${req.user.id}` : `ip:${ipKeyGenerator(req.ip ?? '')}`),
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } },
    }),
  )
  app.use(csrfGuard(ctx.config.CORS_ORIGINS))

  app.use('/api/auth', authRoutes(ctx))
  app.use('/api/users', userRoutes(ctx))
  app.use('/api/audit', auditRoutes(ctx))
  app.use('/api/workflow', workflowRoutes(ctx))
  app.use('/api/settings', settingsRoutes(ctx))
  app.use('/api', tableRoutes(ctx))

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}

const REQUEST_ID = /^[A-Za-z0-9._-]{8,100}$/

/** Gives every request an id (or keeps a valid one from the proxy), returns it as X-Request-Id, and logs the outcome. */
const requestLogger: express.RequestHandler = (req, res, next) => {
  const incoming = req.get('X-Request-Id')
  req.id = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID()
  res.setHeader('X-Request-Id', req.id)
  const start = process.hrtime.bigint()
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6
    const fields = { requestId: req.id, method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms), user: req.user?.id ?? null, ip: req.ip }
    if (res.statusCode >= 500) log.warn('request failed', fields)
    else log.info('request', fields)
  })
  next()
}
