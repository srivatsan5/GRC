import type { Config } from './config.js'
import type { OrdsClient } from './ords/client.js'
import type { UserStore, StoredUser } from './users/store.js'
import type { AuditLog, Actor } from './audit/log.js'
import type { SessionService } from './auth/session.js'

export interface AppContext {
  config: Config
  ords: OrdsClient
  users: UserStore
  audit: AuditLog
  sessions: SessionService
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: StoredUser
      /** Correlates a request's log lines, error reports and the client's error message. */
      id?: string
    }
  }
}

export function actorOf(user: StoredUser): Actor {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

export const ANONYMOUS: Actor = { id: 'ANONYMOUS', name: 'Anonymous', email: '', role: 'None' }
