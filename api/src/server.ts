import 'dotenv/config'
import { loadConfig } from './config.js'
import { buildContext } from './bootstrap.js'
import { createApp } from './app.js'

async function main() {
  const config = loadConfig()
  const ctx = await buildContext(config)
  const app = createApp(ctx)

  if (!ctx.ords.configured) {
    console.warn('[api] WARNING: Oracle ORDS is not configured (ORDS_BASE_URL + ORDS_CLIENT_ID/SECRET). Data endpoints will return 503.')
  } else if (ctx.ords.authMode === 'anonymous') {
    console.warn('[api] WARNING: ORDS_ALLOW_ANONYMOUS=true — calling the database without OAuth. Do not use in production.')
  }
  if (ctx.users.count() === 0) {
    console.warn('[api] WARNING: no users exist. Set BOOTSTRAP_ADMIN_EMAIL/PASSWORD or run `npm run user:create`.')
  }

  const server = app.listen(config.PORT, () => {
    console.log(`[api] Pericope API listening on :${config.PORT} (${config.NODE_ENV}); database auth: ${ctx.ords.authMode}`)
  })
  const shutdown = (signal: string) => {
    console.log(`[api] ${signal} received, shutting down`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 10_000).unref()
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
