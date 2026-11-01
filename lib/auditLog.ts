/**
 * Client-side audit helper.
 *
 * Events are sent to the API, which stores them in its hash-chained audit log.
 * The actor is always taken from the server session — the browser cannot
 * attribute an event to anyone else. Data changes made through the API are
 * already logged by the server, so call this only for actions the server
 * cannot see (exports, browser-only modules, settings).
 */
import { auditApi } from './apiClient'

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'REJECT'
  | 'EXPORT'
  | 'VIEW'
  | 'SETTINGS_CHANGE'
  | 'ROLE_CHANGE'
  | 'LOGIN'
  | 'LOGOUT'

export interface AuditEventInput {
  action: AuditAction
  entity: string
  entity_id?: string | number
  description: string
  result: 'SUCCESS' | 'FAILURE'
  /** Accepted for backwards compatibility; not sent (the server records its own snapshot). */
  before?: unknown
  after?: unknown
}

const SERVER_ACTIONS = new Set(['CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'VIEW', 'SETTINGS_CHANGE'])

/** Fire-and-forget: never blocks or breaks the UI if the audit call fails. */
export function recordAudit(input: AuditEventInput): void {
  if (typeof window === 'undefined') return
  // Session events are recorded by the server itself; browser-side approvals (e.g. in the
  // workflow module, not yet database-backed) are logged as updates, not as verified approvals.
  const action = SERVER_ACTIONS.has(input.action) ? input.action : 'UPDATE'
  const description = action === input.action ? input.description : `[${input.action}] ${input.description}`
  auditApi
    .record({
      action,
      entity: input.entity,
      entity_id: input.entity_id ?? null,
      description,
      result: input.result,
    })
    .catch(err => console.warn('[audit] event not recorded:', err?.message ?? err))
}
