import { createHmac, randomUUID } from 'node:crypto'
import { appendFile, mkdir, readFile, stat, truncate } from 'node:fs/promises'
import { join } from 'node:path'
import type { OrdsClient } from '../ords/client.js'

export const AUDIT_ACTIONS = [
  'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT',
  'EXPORT', 'VIEW', 'SETTINGS_CHANGE', 'ROLE_CHANGE', 'USER_CREATE', 'USER_UPDATE', 'PASSWORD_CHANGE',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export interface Actor {
  id: string
  name: string
  email: string
  role: string
}

export interface AuditInput {
  actor: Actor
  action: AuditAction
  entity: string
  entityId?: string | number | null
  description: string
  result: 'SUCCESS' | 'FAILURE'
  source: 'api' | 'ui'
  ip?: string
  changes?: Record<string, unknown>
}

export interface AuditEntry {
  seq: number
  id: string
  timestamp: string
  actor_id: string
  actor_name: string
  actor_email: string
  actor_role: string
  action: AuditAction
  entity: string
  entity_id: string | null
  description: string
  result: 'SUCCESS' | 'FAILURE'
  source: 'api' | 'ui'
  ip: string | null
  changes: Record<string, unknown> | null
  prev_hash: string
  hash: string
}

const GENESIS = '0'.repeat(64)

function hashEntry(key: string, e: Omit<AuditEntry, 'hash'>): string {
  // Fixed key order so the hash is reproducible by any verifier.
  const canonical = JSON.stringify([
    e.seq, e.id, e.timestamp, e.actor_id, e.actor_name, e.actor_email, e.actor_role, e.action,
    e.entity, e.entity_id, e.description, e.result, e.source, e.ip, e.changes, e.prev_hash,
  ])
  // Keyed (HMAC-SHA256): without the server key nobody can recompute a valid chain after editing the file.
  return createHmac('sha256', key).update(canonical).digest('hex')
}

export interface AuditQuery {
  limit: number
  offset: number
  action?: string
  actor?: string
  entity?: string
  from?: string
  to?: string
  search?: string
}

/**
 * Append-only, hash-chained audit log stored as JSON lines in DATA_DIR/audit.jsonl.
 * Each entry commits to the previous entry's hash, so editing or deleting any
 * line breaks the chain and is detected by verify().
 *
 * Entries are also mirrored (best effort) to Oracle ERM_TRN_AUDIT_LOG.
 */
export class AuditLog {
  private entries: AuditEntry[] = []
  private chain: Promise<void> = Promise.resolve()
  private readonly file: string

  constructor(
    dataDir: string,
    private readonly key: string,
    private readonly ords?: OrdsClient,
  ) {
    this.file = join(dataDir, 'audit.jsonl')
  }

  async load(): Promise<void> {
    await mkdir(join(this.file, '..'), { recursive: true })
    let text = ''
    try {
      text = await readFile(this.file, 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
    this.entries = text
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as AuditEntry)
  }

  record(input: AuditInput): Promise<AuditEntry> {
    const run = this.chain.then(async () => {
      const prev = this.entries[this.entries.length - 1]
      const base: Omit<AuditEntry, 'hash'> = {
        seq: (prev?.seq ?? 0) + 1,
        id: `AUD-${randomUUID()}`,
        timestamp: new Date().toISOString(),
        actor_id: input.actor.id,
        actor_name: input.actor.name,
        actor_email: input.actor.email,
        actor_role: input.actor.role,
        action: input.action,
        entity: input.entity.slice(0, 128),
        entity_id: input.entityId == null ? null : String(input.entityId).slice(0, 100),
        description: input.description.slice(0, 2000),
        result: input.result,
        source: input.source,
        ip: input.ip ?? null,
        changes: input.changes ?? null,
        prev_hash: prev?.hash ?? GENESIS,
      }
      const entry: AuditEntry = { ...base, hash: hashEntry(this.key, base) }
      const sizeBefore = await stat(this.file).then(st => st.size, () => 0)
      try {
        await appendFile(this.file, JSON.stringify(entry) + '\n', { mode: 0o600 })
      } catch (err) {
        // Roll back a partial line (e.g. disk full) so the chain stays readable.
        await truncate(this.file, sizeBefore).catch(() => undefined)
        throw err
      }
      this.entries.push(entry)
      this.mirror(entry)
      return entry
    })
    // Keep the chain alive even if one append fails.
    this.chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  private mirror(e: AuditEntry) {
    if (!this.ords?.configured) return
    this.ords
      .create('erm_trn_audit_log', {
        ACTOR_NAME: `${e.actor_name} <${e.actor_email}>`.slice(0, 200),
        ACTOR_ROLE: e.actor_role.slice(0, 60),
        ACTION_TYPE: e.action,
        ENTITY_NAME: e.entity,
        ENTITY_ID: e.entity_id,
        // seq + hash in Oracle give an independent copy to compare the file against.
        DESCRIPTION: `${e.description} [seq ${e.seq} hash ${e.hash.slice(0, 16)}]`.slice(0, 4000),
        RESULT: e.result,
        SOURCE_SYSTEM: e.source === 'ui' ? 'UI' : 'API',
      })
      .catch(err => console.warn(`[audit] could not mirror seq ${e.seq} to Oracle: ${(err as Error).message}`))
  }

  query(q: AuditQuery): { items: AuditEntry[]; total: number } {
    const search = q.search?.toLowerCase()
    const filtered = this.entries.filter(e => {
      if (q.action && e.action !== q.action) return false
      if (q.actor && e.actor_id !== q.actor && e.actor_email !== q.actor.toLowerCase()) return false
      if (q.entity && e.entity !== q.entity) return false
      if (q.from && e.timestamp < q.from) return false
      if (q.to && e.timestamp > q.to) return false
      if (search && !`${e.description} ${e.actor_name} ${e.entity} ${e.entity_id ?? ''}`.toLowerCase().includes(search)) return false
      return true
    })
    filtered.reverse() // newest first
    return { items: filtered.slice(q.offset, q.offset + q.limit), total: filtered.length }
  }

  /** Re-hash the whole chain from disk. */
  async verify(): Promise<{ valid: boolean; entries: number; brokenAt?: number; reason?: string }> {
    let text = ''
    try {
      text = await readFile(this.file, 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { valid: true, entries: 0 }
      throw err
    }
    const lines = text.split('\n').filter(Boolean)
    let prevHash = GENESIS
    for (let i = 0; i < lines.length; i++) {
      let e: AuditEntry
      try {
        e = JSON.parse(lines[i]!) as AuditEntry
      } catch {
        return { valid: false, entries: lines.length, brokenAt: i + 1, reason: 'unreadable line' }
      }
      const { hash, ...rest } = e
      if (e.prev_hash !== prevHash) return { valid: false, entries: lines.length, brokenAt: e.seq ?? i + 1, reason: 'entry missing or reordered' }
      if (hashEntry(this.key, rest) !== hash) return { valid: false, entries: lines.length, brokenAt: e.seq ?? i + 1, reason: 'entry was modified' }
      prevHash = hash
    }
    // Detect entries removed from the end while the API is running.
    const last = this.entries[this.entries.length - 1]
    if (lines.length < this.entries.length || (last && last.hash !== prevHash)) {
      return { valid: false, entries: lines.length, brokenAt: lines.length + 1, reason: 'entries missing from the end of the log' }
    }
    return { valid: true, entries: lines.length }
  }
}
