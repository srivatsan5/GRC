import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'

/** An error that is safe to show to API clients. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, 'BAD_REQUEST', message, details)
export const unauthorized = (message = 'Authentication required') => new HttpError(401, 'UNAUTHENTICATED', message)
export const forbidden = (message = 'You do not have permission to do this') => new HttpError(403, 'FORBIDDEN', message)
export const notFound = (message = 'Not found') => new HttpError(404, 'NOT_FOUND', message)
export const conflict = (message: string) => new HttpError(409, 'CONFLICT', message)

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(notFound(`No route for ${req.method} ${req.path}`))
}

/**
 * Final error handler. Never leaks stack traces, upstream URLs or raw database
 * messages: clients get a stable code and a human-readable message.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Some fields are invalid',
        details: err.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
      },
    })
    return
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } })
    return
  }
  // body-parser errors (malformed JSON, payload too large)
  const status = typeof err?.status === 'number' ? err.status : typeof err?.statusCode === 'number' ? err.statusCode : 500
  if (status >= 400 && status < 500) {
    res.status(status).json({ error: { code: 'BAD_REQUEST', message: status === 413 ? 'Request body too large' : 'Malformed request' } })
    return
  }
  console.error(`[api] unhandled error on ${req.method} ${req.path}:`, err)
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } })
}
