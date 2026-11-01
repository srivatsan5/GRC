import type { Config } from './config.js'
import type { AppContext } from './context.js'
import { OrdsClient } from './ords/client.js'
import { UserStore } from './users/store.js'
import { AuditLog } from './audit/log.js'
import { SessionService } from './auth/session.js'
import { hashPassword } from './auth/passwords.js'

export async function buildContext(config: Config, ords?: OrdsClient): Promise<AppContext> {
  const client =
    ords ??
    new OrdsClient({
      baseUrl: config.ORDS_BASE_URL,
      tokenUrl: config.ORDS_TOKEN_URL,
      clientId: config.ORDS_CLIENT_ID,
      clientSecret: config.ORDS_CLIENT_SECRET,
      allowAnonymous: config.ORDS_ALLOW_ANONYMOUS,
      timeoutMs: config.ORDS_TIMEOUT_MS,
    })
  const users = new UserStore(config.DATA_DIR)
  await users.load()
  const audit = new AuditLog(config.DATA_DIR, client)
  await audit.load()
  const ctx: AppContext = { config, ords: client, users, audit, sessions: new SessionService(config) }
  await ensureBootstrapAdmin(ctx)
  return ctx
}

async function ensureBootstrapAdmin(ctx: AppContext) {
  const { BOOTSTRAP_ADMIN_EMAIL: email, BOOTSTRAP_ADMIN_PASSWORD: password, BOOTSTRAP_ADMIN_NAME: name } = ctx.config
  if (ctx.users.count() > 0 || !email || !password) return
  const user = await ctx.users.create({ email, name, role: 'Administrator', department: 'Risk Office', passwordHash: await hashPassword(password) })
  await ctx.audit.record({
    actor: { id: 'SYSTEM', name: 'System', email: '', role: 'System' },
    action: 'USER_CREATE',
    entity: 'User',
    entityId: user.id,
    description: `Bootstrap administrator ${user.email} created from environment`,
    result: 'SUCCESS',
    source: 'api',
  })
  console.log(`[api] created bootstrap administrator ${user.email}. Remove BOOTSTRAP_ADMIN_PASSWORD from the environment now.`)
}
