import 'dotenv/config'
import { loadConfig } from './config.js'
import { buildContext } from './bootstrap.js'
import { createApp } from './app.js'
import { flushErrorReporting, initErrorReporting, log } from './lib/log.js'

async function main() {
  const config = loadConfig()
  await initErrorReporting({ dsn: config.SENTRY_DSN, environment: config.NODE_ENV, release: process.env.npm_package_version })
  const ctx = await buildContext(config)
  const app = createApp(ctx)

  if (!ctx.ords.configured) {
    log.warn('Oracle ORDS is not configured (ORDS_BASE_URL + ORDS_CLIENT_ID/SECRET); data endpoints will return 503')
  } else if (ctx.ords.authMode === 'anonymous') {
    log.warn('ORDS_ALLOW_ANONYMOUS=true: calling the database without OAuth; do not use in production')
  }
  if (ctx.users.count() === 0) {
    log.warn('no users exist; set BOOTSTRAP_ADMIN_EMAIL/PASSWORD or run `npm run user:create`')
  }

  const server = app.listen(config.PORT, () => {
    log.info('Pericope API listening', { port: config.PORT, env: config.NODE_ENV, databaseAuth: ctx.ords.authMode })
  })
  const shutdown = (signal: string) => {
    log.info('shutting down', { signal })
    server.close(() => void flushErrorReporting().finally(() => process.exit(0)))
    setTimeout(() => process.exit(1), 10_000).unref()
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('unhandledRejection', err => log.error('unhandled promise rejection', err))
}

main().catch(err => {
  // Configuration errors are written plainly so they read well in a terminal.
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
