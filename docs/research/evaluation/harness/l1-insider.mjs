/**
 * L1 (boundary scenario, expected OCCURRED): an insider who holds the audit HMAC key and write access to the
 * audit file rewrites one entry and recomputes the rest of the chain, as any verifier would (the canonical
 * form is public in api/src/audit/log.ts).
 *
 *   node l1-insider.mjs rewrite   # (a) edit + re-chain the file while the API runs, then ask it to verify
 *   node l1-insider.mjs rechain   # (b) with the API stopped: re-chain the whole file again (no other change)
 *   node l1-insider.mjs verify    # (b) after the API has been restarted: verify
 *
 * Env: ERMA_DATA_DIR, AUDIT_KEY_SOURCE_JWT (the evaluation JWT_SECRET; the key is derived from it when
 * AUDIT_HMAC_KEY is unset, see auditKeyFor in api/src/config.ts).
 */
import { createHash, createHmac } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const EV = new URL('../evidence/', import.meta.url).pathname
const file = `${process.env.ERMA_DATA_DIR}/audit.jsonl`
const key = createHash('sha256').update(`pericope-audit:${process.env.AUDIT_KEY_SOURCE_JWT}`).digest('hex')
const GENESIS = '0'.repeat(64)
const hashEntry = e =>
  createHmac('sha256', key)
    .update(JSON.stringify([e.seq, e.id, e.timestamp, e.actor_id, e.actor_name, e.actor_email, e.actor_role, e.action, e.entity, e.entity_id, e.description, e.result, e.source, e.ip, e.changes, e.prev_hash]))
    .digest('hex')

async function verify() {
  const login = await fetch('http://localhost:5000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ email: 'admin@eval.local', password: 'Admin-Eval-Pass-2026' }) })
  const cookie = login.headers.get('set-cookie').split(';')[0]
  return (await fetch('http://localhost:5000/api/audit/verify', { headers: { Cookie: cookie } })).json()
}

const step = process.argv[2]
const out = (() => { try { return JSON.parse(readFileSync(EV + 'L1.json', 'utf8')) } catch { return {} } })()
if (step === 'rewrite') {
  out.before = await verify()
  const entries = readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  // Rewrite history: turn the record of who created the S2.1 risk into a different actor.
  const target = entries.find(e => e.action === 'CREATE' && /Created risk register/i.test(e.description) && e.actor_email === 'assessor@eval.local')
  const original = { seq: target.seq, actor_email: target.actor_email, actor_name: target.actor_name }
  target.actor_email = 'rm2@eval.local'
  target.actor_name = 'Risk Manager rm2'
  let prev = GENESIS
  for (const e of entries) {
    e.prev_hash = prev
    const { hash: _old, ...rest } = e
    e.hash = hashEntry(rest)
    prev = e.hash
  }
  writeFileSync(file, entries.map(e => JSON.stringify(e)).join('\n') + '\n')
  out.rewrite = { seq: target.seq, from: original, to: { actor_email: target.actor_email, actor_name: target.actor_name }, entriesRechained: entries.length }
  out.whileApiRunning = await verify()
} else if (step === 'rechain') {
  const entries = readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  let prev = GENESIS
  for (const e of entries) {
    e.prev_hash = prev
    const { hash: _old, ...rest } = e
    e.hash = hashEntry(rest)
    prev = e.hash
  }
  writeFileSync(file, entries.map(e => JSON.stringify(e)).join('\n') + '\n')
  out.rechainedOffline = { entries: entries.length, editedEntryStillAltered: entries.find(e => e.seq === out.rewrite.seq)?.actor_email }
} else {
  out.afterRestart = await verify()
}
writeFileSync(EV + 'L1.json', JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 1))
