/**
 * Structured logging: one JSON object per line on stdout (info) or stderr (warn/error), so any
 * log platform (CloudWatch, Loki, Datadog, OCI Logging…) can index and alert on it.
 * Errors are also sent to Sentry when SENTRY_DSN is set.
 */
type Level = 'info' | 'warn' | 'error'
type Fields = Record<string, unknown>

let silent = false
let sentry: typeof import('@sentry/node') | null = null

/** Tests keep their output clean. */
export function setLogSilent(value: boolean) {
  silent = value
}

function errorFields(err: unknown): Fields {
  if (err instanceof Error) return { error: err.message, errorName: err.name, stack: err.stack }
  return { error: String(err) }
}

function write(level: Level, msg: string, fields: Fields = {}) {
  if (silent) return
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields })
  if (level === 'info') process.stdout.write(line + '\n')
  else process.stderr.write(line + '\n')
}

export const log = {
  info: (msg: string, fields?: Fields) => write('info', msg, fields),
  warn: (msg: string, fields?: Fields) => write('warn', msg, fields),
  /** Logs the error and reports it to Sentry (if configured). */
  error: (msg: string, err?: unknown, fields: Fields = {}) => {
    write('error', msg, { ...fields, ...(err === undefined ? {} : errorFields(err)) })
    if (sentry && err !== undefined) {
      sentry.captureException(err, { extra: { msg, ...fields }, tags: typeof fields.requestId === 'string' ? { requestId: fields.requestId } : undefined })
    }
  },
}

/** Turns on Sentry error reporting. Only loads the SDK when a DSN is configured. */
export async function initErrorReporting(opts: { dsn?: string; environment: string; release?: string }) {
  if (!opts.dsn) return
  const Sentry = await import('@sentry/node')
  // Errors only: no performance tracing. Sentry's defaults leave out request bodies, cookies and user details.
  Sentry.init({ dsn: opts.dsn, environment: opts.environment, release: opts.release, tracesSampleRate: 0 })
  sentry = Sentry
  log.info('error reporting enabled', { sentry: true })
}

/** Flushes pending error reports before the process exits. */
export async function flushErrorReporting() {
  if (sentry) await sentry.flush(2000).catch(() => undefined)
}
