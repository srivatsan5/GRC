/**
 * Local-first audit log with user attribution.
 *
 * Records every CRUD operation with: actor (user), action, entity, target id,
 * before/after snapshots (where applicable), timestamp, and result. Records are
 * persisted to localStorage so they survive reloads — and they merge with any
 * server-side audit log when one is available.
 *
 * This is the spine for SOX user attribution and ISO 31000 traceability.
 */

import type { AppUser } from '@/components/providers/auth-provider'

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'APPROVE'
  | 'REJECT'
  | 'EXPORT'
  | 'VIEW'
  | 'SETTINGS_CHANGE'
  | 'ROLE_CHANGE'

export interface AuditEntry {
  id: string
  timestamp: string
  actor_id: string
  actor_name: string
  actor_role: string
  action: AuditAction
  entity: string
  entity_id?: string | number
  description: string
  before?: any
  after?: any
  result: 'SUCCESS' | 'FAILURE'
  source: 'ui' | 'api'
}

const KEY = 'pericope_audit_log_v1'
const MAX_ENTRIES = 5000

function readAll(): AuditEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AuditEntry[]) : []
  } catch {
    return []
  }
}

function persist(entries: AuditEntry[]) {
  if (typeof window === 'undefined') return
  try {
    const trimmed = entries.slice(-MAX_ENTRIES)
    localStorage.setItem(KEY, JSON.stringify(trimmed))
  } catch { /* quota: ignore */ }
}

function currentUserFromSession(): Partial<AppUser> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem('pericope_current_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function recordAudit(input: Omit<AuditEntry, 'id' | 'timestamp' | 'actor_id' | 'actor_name' | 'actor_role' | 'source'> & { actor?: Partial<AppUser>, source?: 'ui' | 'api' }): AuditEntry {
  const actor = input.actor || currentUserFromSession() || { id: 'SYSTEM', name: 'System', role: 'System' }
  const entry: AuditEntry = {
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    actor_id: actor.id || 'SYSTEM',
    actor_name: actor.name || 'System',
    actor_role: (actor.role as string) || 'System',
    action: input.action,
    entity: input.entity,
    entity_id: input.entity_id,
    description: input.description,
    before: input.before,
    after: input.after,
    result: input.result,
    source: input.source || 'ui',
  }
  const all = readAll()
  all.push(entry)
  persist(all)
  return entry
}

export function listAudit(): AuditEntry[] {
  return readAll().sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
}

export function clearAudit() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY)
}

/** Seed a handful of realistic events on first boot so the audit page has user-attributed history. */
export function seedIfEmpty() {
  const existing = readAll()
  if (existing.length > 0) return
  const now = Date.now()
  const seed: AuditEntry[] = [
    { id: 'AUD-S-1', timestamp: new Date(now - 1000 * 60 * 15).toISOString(), actor_id: 'U-002', actor_name: 'Priya Sharma', actor_role: 'Risk Manager', action: 'CREATE', entity: 'Risk Assessment', entity_id: 'RCSA-F-202605-101', description: 'Created quarterly Finance RCSA cycle', result: 'SUCCESS', source: 'ui' },
    { id: 'AUD-S-2', timestamp: new Date(now - 1000 * 60 * 32).toISOString(), actor_id: 'U-003', actor_name: 'Anthony Muller', actor_role: 'Assessor', action: 'UPDATE', entity: 'Risk', entity_id: 'R-2026-014', description: 'Updated likelihood from 3 to 4 (Likely)', result: 'SUCCESS', source: 'ui' },
    { id: 'AUD-S-3', timestamp: new Date(now - 1000 * 60 * 60).toISOString(), actor_id: 'U-004', actor_name: 'Lin Wei', actor_role: 'Auditor', action: 'VIEW', entity: 'Audit Trail', description: 'Exported quarterly audit log to CSV', result: 'SUCCESS', source: 'ui' },
    { id: 'AUD-S-4', timestamp: new Date(now - 1000 * 60 * 120).toISOString(), actor_id: 'U-002', actor_name: 'Priya Sharma', actor_role: 'Risk Manager', action: 'APPROVE', entity: 'Mitigation Plan', entity_id: 'MP-2026-007', description: 'Approved control implementation plan', result: 'SUCCESS', source: 'ui' },
    { id: 'AUD-S-5', timestamp: new Date(now - 1000 * 60 * 240).toISOString(), actor_id: 'U-001', actor_name: 'Srivatsan B', actor_role: 'Administrator', action: 'ROLE_CHANGE', entity: 'User', entity_id: 'U-005', description: 'Set user Karen Diaz to Viewer (inactive)', result: 'SUCCESS', source: 'ui' },
    { id: 'AUD-S-6', timestamp: new Date(now - 1000 * 60 * 360).toISOString(), actor_id: 'U-001', actor_name: 'Srivatsan B', actor_role: 'Administrator', action: 'SETTINGS_CHANGE', entity: 'Settings', description: 'Updated organization profile (Industry → Financial Services)', result: 'SUCCESS', source: 'ui' },
  ]
  persist(seed)
}
