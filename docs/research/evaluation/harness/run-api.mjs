/**
 * API-level scenarios of SCENARIOS.md, run once against each system.
 *   Baseline (B): legacy server.js on :5001.   Artifact (E): ERMA-GRC API on :5000.
 *   Both use the same ORDS stand-in on :8181 (harness/stand-in.ts).
 *
 *   node docs/research/evaluation/harness/run-api.mjs <phase>
 *     phase "main"   : S2.x, S3.x, S4.x, S5.2, G1, G2, G3, G4 (API part)
 *     phase "final"  : S5.3 (after the browser scenarios: on the baseline it disables the risk table for the process)
 *     phase "outage" : S5.1 (run after the stand-in has been stopped)
 *
 * Ground truth is read straight from the stand-in (/__control/rows), never from the system under test.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const B = process.env.B_URL ?? 'http://localhost:5001'
const E = process.env.E_URL ?? 'http://localhost:5000'
const DB = process.env.DB_URL ?? 'http://localhost:8181'
const EV = process.env.EVIDENCE_DIR ?? new URL('../evidence/', import.meta.url).pathname
const ERMA_DATA = process.env.ERMA_DATA_DIR
const phase = process.argv[2] ?? 'main'
const RISK = 'per_trn_identify_risk'

const log = [] // every request/response, for the evidence file
const results = []
const record = (id, system, outcome, criterion, evidence) => {
  results.push({ id, system, outcome, criterion, evidence })
  console.log(`${id.padEnd(6)} ${system === 'B' ? 'baseline' : 'ERMA-GRC'}  ${outcome.padEnd(9)} ${JSON.stringify(evidence).slice(0, 220)}`)
}

async function http(base, method, path, { body, headers = {}, cookie } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers }
  if (cookie) h.Cookie = cookie
  if (base === E && method !== 'GET') h['X-Requested-With'] = 'XMLHttpRequest'
  let status, data, setCookie
  try {
    const r = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
    status = r.status
    setCookie = r.headers.get('set-cookie')
    const text = await r.text()
    try { data = JSON.parse(text) } catch { data = text }
  } catch (err) {
    status = 'NETWORK_ERROR'
    data = String(err.cause?.code ?? err.message)
  }
  log.push({ at: new Date().toISOString(), system: base === B ? 'B' : base === E ? 'E' : 'DB', method, path, headers: Object.fromEntries(Object.entries(h).filter(([k]) => k !== 'Cookie')), body, status, data })
  return { status, data, setCookie }
}

const ctl = (method, path, body) => http(DB, method, `/__control/${path}`, { body })
const rows = async table => (await ctl('GET', `rows/${table}`)).data
const truth = async (table, uuid) => (await rows(table)).find(r => Number(r.UUID) === Number(uuid)) ?? null
const seed = (table, list) => ctl('POST', `rows/${table}`, list)
const rejected = s => typeof s === 'number' && s >= 400

// Baseline personas, sent the way its frontend sends them (lib/oracleService.ts: X-User-* headers).
const P = {
  admin: { 'X-User-Id': 'U-001', 'X-User-Name': 'Srivatsan B', 'X-User-Role': 'Administrator' },
  rm: { 'X-User-Id': 'U-002', 'X-User-Name': 'Priya Sharma', 'X-User-Role': 'Risk Manager' },
  assessor: { 'X-User-Id': 'U-003', 'X-User-Name': 'Anthony Muller', 'X-User-Role': 'Assessor' },
}

// ERMA-GRC accounts (real sign-in; the session cookie is the only identity the API accepts).
const PASS = 'Eval-Pass-2026-abc'
async function login(email, password = PASS) {
  const r = await http(E, 'POST', '/api/auth/login', { body: { email, password } })
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(r.data)}`)
  return r.setCookie.split(';')[0]
}

async function main() {
  const admin = await login('admin@eval.local', 'Admin-Eval-Pass-2026')
  const accounts = [['rm1@eval.local', 'Risk Manager'], ['rm2@eval.local', 'Risk Manager'], ['assessor@eval.local', 'Assessor'], ['deact@eval.local', 'Assessor']]
  const ids = {}
  for (const [email, role] of accounts) {
    const r = await http(E, 'POST', '/api/users', { cookie: admin, body: { email, name: `${role} ${email.split('@')[0]}`, role, department: 'Evaluation', password: PASS } })
    ids[email] = r.data?.id ?? r.data?.user?.id
  }
  const rm1 = await login('rm1@eval.local')
  const rm2 = await login('rm2@eval.local')
  const assessor = await login('assessor@eval.local')

  // ------------------------------------------------------------------ S2.1
  {
    const c = await http(B, 'POST', `/api/${RISK}`, { headers: P.assessor, body: { risk_statement: 'Eval S2.1 submitted risk (B)', risk_owner: 'Alice', approval_status: 'SUBMITTED' } })
    const id = c.data?.uuid
    const afterCreate = await truth(RISK, id)
    const d = await http(B, 'PUT', `/api/${RISK}/${id}`, { headers: P.rm, body: { risk_statement: 'Eval S2.1 submitted risk (B)', risk_owner: 'Alice', approval_status: 'APPROVED' } })
    const t = await truth(RISK, id)
    record('S2.1', 'B', t?.APPROVAL_STATUS === 'APPROVED' ? 'PREVENTED' : 'OCCURRED', 'stored APPROVAL_STATUS = APPROVED', { createStatus: c.status, storedAfterCreate: afterCreate?.APPROVAL_STATUS, decisionStatus: d.status, stored: t?.APPROVAL_STATUS })
  }
  {
    const c = await http(E, 'POST', `/api/${RISK}`, { cookie: assessor, body: { RISK_STATEMENT: 'Eval S2.1 submitted risk (E)', RISK_OWNER: 'Alice', APPROVAL_STATUS: 'SUBMITTED' } })
    const id = c.data?.uuid
    const afterCreate = await truth(RISK, id)
    const d = await http(E, 'PATCH', `/api/${RISK}/${id}`, { cookie: rm1, body: { APPROVAL_STATUS: 'APPROVED' } })
    const t = await truth(RISK, id)
    record('S2.1', 'E', t?.APPROVAL_STATUS === 'APPROVED' ? 'PREVENTED' : 'OCCURRED', 'stored APPROVAL_STATUS = APPROVED', { createStatus: c.status, storedAfterCreate: afterCreate?.APPROVAL_STATUS, decisionStatus: d.status, stored: t?.APPROVAL_STATUS })
  }

  // ------------------------------------------------------------------ S2.2
  // Identical set-up: an approved risk inserted directly into the database, one row per system.
  const approved = (uuid, sys) => ({ UUID: uuid, RISK_STATEMENT: `Eval S2.2 approved risk (${sys})`, RISK_OWNER: 'Alice', APPROVAL_STATUS: 'APPROVED', STATUS: 'Y', IS_STAGE_COMPLTED: 'N' })
  await seed(RISK, [approved(90001, 'B'), approved(90002, 'E'), approved(90003, 'E, non-approver variant')])
  {
    // The baseline frontend sends the whole record back on save; its PUT replaces the row.
    const d = await http(B, 'PUT', `/api/${RISK}/90001`, { headers: P.rm, body: { risk_statement: 'Eval S2.2 approved risk (B)', risk_owner: 'Bob', approval_status: 'APPROVED', status: 'Y' } })
    const t = await truth(RISK, 90001)
    record('S2.2', 'B', t?.APPROVAL_STATUS === 'APPROVED' ? 'PREVENTED' : 'OCCURRED', 'APPROVAL_STATUS still APPROVED after owner edit (editor: Risk Manager)', { editStatus: d.status, owner: t?.RISK_OWNER, stored: t?.APPROVAL_STATUS })
  }
  {
    const d = await http(E, 'PATCH', `/api/${RISK}/90002`, { cookie: rm1, body: { RISK_OWNER: 'Bob' } })
    const t = await truth(RISK, 90002)
    record('S2.2', 'E', t?.APPROVAL_STATUS === 'APPROVED' ? 'PREVENTED' : 'OCCURRED', 'APPROVAL_STATUS still APPROVED after owner edit (editor: Risk Manager)', { editStatus: d.status, owner: t?.RISK_OWNER, stored: t?.APPROVAL_STATUS })
    const v = await http(E, 'PATCH', `/api/${RISK}/90003`, { cookie: assessor, body: { RISK_OWNER: 'Bob' } })
    const tv = await truth(RISK, 90003)
    record('S2.2v', 'E', tv?.APPROVAL_STATUS === 'APPROVED' ? 'PREVENTED' : 'OCCURRED', 'variant, editor without approval rights (Assessor)', { editStatus: v.status, owner: tv?.RISK_OWNER, stored: tv?.APPROVAL_STATUS })
  }

  // ------------------------------------------------------------------ S3.1 / S3.2
  for (const [id, extra] of [['S3.1', {}], ['S3.2', { 'X-User-Role': 'Administrator' }]]) {
    for (const [sys, base] of [['B', B], ['E', E]]) {
      const statement = `Eval ${id} anonymous create (${sys})`
      const r = await http(base, 'POST', `/api/${RISK}`, { headers: extra, body: sys === 'B' ? { risk_statement: statement } : { RISK_STATEMENT: statement } })
      const stored = (await rows(RISK)).filter(x => x.RISK_STATEMENT === statement).length
      record(id, sys, rejected(r.status) && stored === 0 ? 'PREVENTED' : 'OCCURRED', 'rejected and no row created', { status: r.status, rowsCreated: stored })
    }
  }

  // ------------------------------------------------------------------ S3.3
  {
    const c = await http(B, 'POST', `/api/${RISK}`, { headers: P.rm, body: { risk_statement: 'Eval S3.3 self-approval (B)', approval_status: 'SUBMITTED' } })
    const id = c.data?.uuid
    const before = (await truth(RISK, id))?.APPROVAL_STATUS
    const d = await http(B, 'PUT', `/api/${RISK}/${id}`, { headers: P.rm, body: { risk_statement: 'Eval S3.3 self-approval (B)', approval_status: 'APPROVED' } })
    const after = (await truth(RISK, id))?.APPROVAL_STATUS
    record('S3.3', 'B', rejected(d.status) && before === after ? 'PREVENTED' : 'OCCURRED', 'self-approval rejected; status unchanged', { approveStatus: d.status, storedBefore: before, storedAfter: after })
  }
  {
    const c = await http(E, 'POST', `/api/${RISK}`, { cookie: rm1, body: { RISK_STATEMENT: 'Eval S3.3 self-approval (E)', APPROVAL_STATUS: 'SUBMITTED' } })
    const id = c.data?.uuid
    const before = (await truth(RISK, id))?.APPROVAL_STATUS
    const d = await http(E, 'PATCH', `/api/${RISK}/${id}`, { cookie: rm1, body: { APPROVAL_STATUS: 'APPROVED' } })
    const after = (await truth(RISK, id))?.APPROVAL_STATUS
    record('S3.3', 'E', rejected(d.status) && before === after ? 'PREVENTED' : 'OCCURRED', 'self-approval rejected; status unchanged', { approveStatus: d.status, message: d.data?.error?.message, storedBefore: before, storedAfter: after })
  }

  // ------------------------------------------------------------------ S3.4
  {
    const body = { user_name: 'Intruder Admin', email_id: 'intruder-b@example.com', role_name: 'Administrator' }
    const asAssessor = await http(B, 'POST', '/api/per_mst_user_details', { headers: P.assessor, body })
    const anon = await http(B, 'POST', '/api/per_mst_user_details', { body: { ...body, email_id: 'intruder-b2@example.com' } })
    const stored = (await rows('per_mst_user_details')).filter(r => String(r.EMAIL_ID ?? '').startsWith('intruder-b')).length
    record('S3.4', 'B', rejected(asAssessor.status) && rejected(anon.status) && stored === 0 ? 'PREVENTED' : 'OCCURRED', 'non-admin and unauthenticated writes to the user table rejected', { asAssessor: asAssessor.status, unauthenticated: anon.status, rowsCreated: stored })
  }
  {
    const user = { email: 'intruder-e@example.com', name: 'Intruder Admin', role: 'Administrator', department: 'x', password: PASS }
    const asAssessor = await http(E, 'POST', '/api/users', { cookie: assessor, body: user })
    const anon = await http(E, 'POST', '/api/users', { body: { ...user, email: 'intruder-e2@example.com' } })
    const table = await http(E, 'POST', '/api/per_mst_user_details', { cookie: assessor, body: { USER_NAME: 'Intruder Admin' } })
    const usersFile = ERMA_DATA && existsSync(`${ERMA_DATA}/users.json`) ? readFileSync(`${ERMA_DATA}/users.json`, 'utf8') : ''
    const stored = (usersFile.match(/intruder-e/g) ?? []).length + (await rows('per_mst_user_details')).filter(r => r.USER_NAME === 'Intruder Admin' && !r.EMAIL_ID).length
    record('S3.4', 'E', [asAssessor, anon, table].every(r => rejected(r.status)) && stored === 0 ? 'PREVENTED' : 'OCCURRED', 'non-admin and unauthenticated writes to the user table rejected', { asAssessorUsersApi: asAssessor.status, unauthenticatedUsersApi: anon.status, asAssessorUserTable: table.status, recordsCreated: stored })
  }

  // ------------------------------------------------------------------ S4.1
  {
    const claim = { 'X-User-Id': 'U-CEO', 'X-User-Name': 'CEO', 'X-User-Role': 'Administrator' }
    const r = await http(B, 'POST', '/api/erm_trn_audit_log', { headers: claim, body: { action: 'APPROVE', entity: 'Risk', entity_id: 'R-1', description: 'Eval S4.1 forged approval' } })
    const list = await http(B, 'GET', '/api/erm_trn_audit_log')
    const hit = (list.data?.items ?? []).find(e => e.description === 'Eval S4.1 forged approval')
    record('S4.1', 'B', rejected(r.status) || !hit || hit.actor_name !== 'CEO' ? 'PREVENTED' : 'OCCURRED', 'rejected, or not recorded under the claimed actor', { status: r.status, recordedActor: hit ? `${hit.actor_name} / ${hit.actor_role}` : null, recordedAction: hit?.action })
  }
  {
    const forged = { action: 'CREATE', entity: 'Risk', entity_id: 'R-1', description: 'Eval S4.1 forged entry', actor_name: 'CEO', actor_role: 'Administrator', actor_email: 'ceo@example.com' }
    const anon = await http(E, 'POST', '/api/audit', { headers: { 'X-User-Name': 'CEO', 'X-User-Role': 'Administrator' }, body: forged })
    const signedIn = await http(E, 'POST', '/api/audit', { cookie: assessor, headers: { 'X-User-Name': 'CEO', 'X-User-Role': 'Administrator' }, body: forged })
    const approve = await http(E, 'POST', '/api/audit', { cookie: assessor, body: { ...forged, action: 'APPROVE' } })
    const list = await http(E, 'GET', '/api/audit?search=Eval%20S4.1&limit=50', { cookie: admin })
    const hits = list.data?.items ?? []
    const underClaim = hits.filter(e => e.actor_name === 'CEO' || e.actor_email === 'ceo@example.com').length
    record('S4.1', 'E', underClaim === 0 ? 'PREVENTED' : 'OCCURRED', 'rejected, or not recorded under the claimed actor', { unauthenticated: anon.status, signedInAssessor: signedIn.status, forgedApprove: approve.status, recordedAs: hits.map(e => `${e.actor_email} / ${e.actor_role} / ${e.entity}`), recordedUnderClaim: underClaim })
  }

  // ------------------------------------------------------------------ S4.3
  {
    const c = await http(B, 'POST', `/api/${RISK}`, { headers: P.assessor, body: { risk_statement: 'Eval S4.3 attributed create (B)' } })
    const list = await http(B, 'GET', '/api/erm_trn_audit_log')
    const hit = (list.data?.items ?? []).find(e => e.action === 'CREATE' && String(e.entity_id) === String(c.data?.uuid))
    record('S4.3', 'B', hit && hit.actor_name === 'Anthony Muller' ? 'PREVENTED' : 'OCCURRED', 'audit entry names the acting user', { createStatus: c.status, entry: hit ? { actor: hit.actor_name, role: hit.actor_role, source: hit.source } : null, note: 'identity is the self-asserted X-User-* header; entry is held in server memory only' })
  }
  {
    const c = await http(E, 'POST', `/api/${RISK}`, { cookie: assessor, body: { RISK_STATEMENT: 'Eval S4.3 attributed create (E)' } })
    const list = await http(E, 'GET', `/api/audit?action=CREATE&entityId=${c.data?.uuid}`, { cookie: admin })
    const hit = (list.data?.items ?? []).find(e => e.entity === 'Risk register')
    record('S4.3', 'E', hit && hit.actor_email === 'assessor@eval.local' ? 'PREVENTED' : 'OCCURRED', 'audit entry names the acting user', { createStatus: c.status, entry: hit ? { actor: hit.actor_email, role: hit.actor_role, seq: hit.seq } : null })
  }

  // ------------------------------------------------------------------ S4.2 (artifact; the baseline part is browser-side, see ui-scenarios.cjs)
  if (ERMA_DATA) {
    const file = `${ERMA_DATA}/audit.jsonl`
    const original = readFileSync(file, 'utf8')
    const lines = original.split('\n')
    const i = 2 // third entry
    const entry = JSON.parse(lines[i])
    const pos = entry.description.length - 1
    const changed = { ...entry, description: entry.description.slice(0, pos) + (entry.description[pos] === 'x' ? 'y' : 'x') }
    lines[i] = JSON.stringify(changed)
    writeFileSync(file, lines.join('\n'))
    const v = await http(E, 'GET', '/api/audit/verify', { cookie: admin })
    writeFileSync(file, original) // restore so later scenarios start from a valid chain
    const restored = await http(E, 'GET', '/api/audit/verify', { cookie: admin })
    record('S4.2', 'E', v.data?.valid === false ? 'PREVENTED' : 'OCCURRED', 'verification reports the chain as broken', { tampered: { seq: entry.seq, field: 'description', from: entry.description, to: changed.description }, verify: v.data, afterRestore: restored.data })
  }

  // ------------------------------------------------------------------ S5.2 (database rejects the payload: HTTP 400 from ORDS)
  await ctl('POST', 'mode', { mode: 'reject_fk' })
  {
    const r = await http(B, 'POST', `/api/${RISK}`, { headers: P.assessor, body: { risk_statement: 'Eval S5.2 rejected by DB (B)' } })
    record('S5.2', 'B', rejected(r.status) ? 'PREVENTED' : 'OCCURRED', 'client receives an error status, not 200/201', { status: r.status, body: r.data })
  }
  {
    const r = await http(E, 'POST', `/api/${RISK}`, { cookie: assessor, body: { RISK_STATEMENT: 'Eval S5.2 rejected by DB (E)' } })
    record('S5.2', 'E', rejected(r.status) ? 'PREVENTED' : 'OCCURRED', 'client receives an error status, not 200/201', { status: r.status, body: r.data })
  }
  await ctl('POST', 'mode', { mode: 'ok' })

  // ------------------------------------------------------------------ G1 (two approvers decide the same approval step at once)
  {
    // Baseline: it has no server-side workflow; its approval decision is the record's APPROVAL_STATUS.
    await seed(RISK, [{ UUID: 90011, RISK_STATEMENT: 'Eval G1 pending decision (B)', APPROVAL_STATUS: 'SUBMITTED', STATUS: 'Y' }])
    const [a, b] = await Promise.all([
      http(B, 'PUT', `/api/${RISK}/90011`, { headers: P.rm, body: { risk_statement: 'Eval G1 pending decision (B)', approval_status: 'APPROVED' } }),
      http(B, 'PUT', `/api/${RISK}/90011`, { headers: P.admin, body: { risk_statement: 'Eval G1 pending decision (B)', approval_status: 'REJECTED' } }),
    ])
    const t = await truth(RISK, 90011)
    const succeeded = [a, b].filter(r => r.status === 200).length
    record('G1', 'B', succeeded === 1 ? 'PREVENTED' : 'OCCURRED', 'exactly one decision recorded', { approveStatus: a.status, rejectStatus: b.status, decisionsReportedAsSuccessful: succeeded, stored: t?.APPROVAL_STATUS })
  }
  {
    const w = await http(E, 'POST', '/api/workflow', { cookie: assessor, body: { title: 'Eval G1 approval request', request_type: 'Risk Acceptance', approver_roles: ['Risk Manager'] } })
    const id = w.data?.uuid
    const [a, b] = await Promise.all([
      http(E, 'POST', `/api/workflow/${id}/decision`, { cookie: rm1, body: { decision: 'Approved' } }),
      http(E, 'POST', `/api/workflow/${id}/decision`, { cookie: rm2, body: { decision: 'Rejected', comment: 'Eval G1 competing decision' } }),
    ])
    const steps = (await rows('erm_trn_approval_step')).filter(s => Number(s.REQUEST_UUID) === Number(id))
    const decided = steps.filter(s => s.DECISION)
    const audit = await http(E, 'GET', `/api/audit?entityId=${id}&entity=Approval%20request`, { cookie: admin })
    const decisionsLogged = (audit.data?.items ?? []).filter(e => e.action === 'APPROVE' || e.action === 'REJECT').length
    record('G1', 'E', decided.length === 1 && decisionsLogged === 1 && [a, b].filter(r => r.status === 200).length === 1 ? 'PREVENTED' : 'OCCURRED', 'exactly one decision recorded', { submit: w.status, rm1: [a.status, a.data?.error?.message], rm2: [b.status, b.data?.error?.message], storedDecisions: decided.map(s => `${s.DECISION} by ${s.DECIDED_BY}`), decisionsLogged })

    // Supplementary: the same race on a register record's APPROVAL_STATUS (the mechanism the baseline uses).
    await seed(RISK, [{ UUID: 90012, RISK_STATEMENT: 'Eval G1 pending decision (E, record status)', APPROVAL_STATUS: 'SUBMITTED', STATUS: 'Y' }])
    const [c, d] = await Promise.all([
      http(E, 'PATCH', `/api/${RISK}/90012`, { cookie: rm1, body: { APPROVAL_STATUS: 'APPROVED' } }),
      http(E, 'PATCH', `/api/${RISK}/90012`, { cookie: rm2, body: { APPROVAL_STATUS: 'REJECTED', APPROVER_COMMENTS: 'competing' } }),
    ])
    const t = await truth(RISK, 90012)
    const ok = [c, d].filter(r => r.status === 200).length
    record('G1v', 'E', ok === 1 ? 'PREVENTED' : 'OCCURRED', 'variant, record APPROVAL_STATUS instead of a workflow step', { approveStatus: c.status, rejectStatus: d.status, decisionsReportedAsSuccessful: ok, stored: t?.APPROVAL_STATUS })
  }

  // ------------------------------------------------------------------ G2 (deactivated user with a still-valid session)
  {
    // Baseline: accounts and their "active" flag exist only in the browser (components/providers/auth-provider.tsx,
    // localStorage key pericope_users_v1); the server cannot know a user was deactivated. Send the write as that user.
    const r = await http(B, 'POST', `/api/${RISK}`, { headers: P.assessor, body: { risk_statement: 'Eval G2 write after deactivation (B)' } })
    const stored = (await rows(RISK)).filter(x => x.RISK_STATEMENT === 'Eval G2 write after deactivation (B)').length
    record('G2', 'B', rejected(r.status) && stored === 0 ? 'PREVENTED' : 'OCCURRED', 'write rejected', { status: r.status, rowsCreated: stored })
  }
  {
    const deact = await login('deact@eval.local')
    const before = await http(E, 'GET', '/api/auth/me', { cookie: deact })
    const off = await http(E, 'PATCH', `/api/users/${ids['deact@eval.local']}`, { cookie: admin, body: { active: false } })
    const r = await http(E, 'POST', `/api/${RISK}`, { cookie: deact, body: { RISK_STATEMENT: 'Eval G2 write after deactivation (E)' } })
    const stored = (await rows(RISK)).filter(x => x.RISK_STATEMENT === 'Eval G2 write after deactivation (E)').length
    record('G2', 'E', rejected(r.status) && stored === 0 ? 'PREVENTED' : 'OCCURRED', 'write rejected', { sessionValidBefore: before.status, deactivate: off.status, write: r.status, rowsCreated: stored })
  }

  // ------------------------------------------------------------------ G3 (path-traversal id)
  for (const [sys, base, opts] of [['B', B, {}], ['E', E, { cookie: admin }]]) {
    const before = (await ctl('GET', 'log')).data.length
    const r = await http(base, 'GET', `/api/${RISK}/..%2F..%2Fper_mst_roles`, opts)
    const upstream = (await ctl('GET', 'log')).data.slice(before)
    record('G3', sys, r.status === 400 ? 'PREVENTED' : 'OCCURRED', 'rejected as invalid (400) by the system itself', { status: r.status, body: typeof r.data === 'string' ? r.data.slice(0, 200) : r.data, requestsReachingDatabase: upstream.map(u => `${u.method} ${u.url}`) })
  }

  // ------------------------------------------------------------------ G4, API part (the UI part is in ui-scenarios.cjs)
  {
    await seed('erm_mst_kri_definition', [{ UUID: 93001, KRI_CODE: 'KRI-EVAL-G4', KRI_NAME: 'Eval G4 liquidity coverage', GREEN_THRESHOLD: 25, AMBER_THRESHOLD: 20, RED_THRESHOLD: 15, DIRECTION: 'LOWER_WORSE', UNIT_OF_MEASURE: '%', IS_ACTIVE: 'Y' }])
    const b0 = await http(B, 'POST', '/api/erm_trn_kri_readings', { headers: P.assessor, body: { kri_uuid: 93001, reading_value: 14, reading_date: '2026-11-06' } })
    const tb = await truth('erm_trn_kri_readings', b0.data?.uuid)
    const e0 = await http(E, 'POST', '/api/erm_trn_kri_readings', { cookie: assessor, body: { KRI_UUID: 93001, READING_VALUE: 14, READING_DATE: '2026-11-06' } })
    const te = await truth('erm_trn_kri_readings', e0.data?.uuid)
    const e1 = await http(E, 'POST', '/api/erm_trn_kri_readings', { cookie: assessor, body: { KRI_UUID: 93001, READING_VALUE: 14, READING_DATE: '2026-11-06', TRAFFIC_LIGHT: 'GREEN', IS_BREACH: 'N' } })
    const te1 = await truth('erm_trn_kri_readings', e1.data?.uuid)
    const g4api = {
      baselineNoStatusSent: { status: b0.status, storedTrafficLight: tb?.TRAFFIC_LIGHT ?? null },
      ermaNoStatusSent: { status: e0.status, storedTrafficLight: te?.TRAFFIC_LIGHT ?? null },
      ermaClientDeclaresGreen: { status: e1.status, storedTrafficLight: te1?.TRAFFIC_LIGHT ?? null, storedBreach: te1?.IS_BREACH ?? null },
    }
    writeFileSync(EV + 'G4-api.json', JSON.stringify(g4api, null, 2))
    console.log('G4 API part', JSON.stringify(g4api))
  }

}

async function final() {
  const admin = await login('admin@eval.local', 'Admin-Eval-Pass-2026')
  // G4, API part for the baseline as well: a client-declared status on its KRI reading endpoint.
  {
    const r = await http(B, 'POST', '/api/erm_trn_kri_readings', { headers: P.assessor, body: { kri_uuid: 93001, reading_value: 14, reading_date: '2026-11-06', traffic_light: 'GREEN', is_breach: 'N' } })
    const t = await truth('erm_trn_kri_readings', r.data?.uuid)
    const file = EV + 'G4-api.json'
    const prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
    writeFileSync(file, JSON.stringify({ ...prev, baselineClientDeclaresGreen: { status: r.status, storedTrafficLight: t?.TRAFFIC_LIGHT ?? null, storedBreach: t?.IS_BREACH ?? null } }, null, 2))
    console.log('G4 API part (baseline, declared GREEN)', r.status, t?.TRAFFIC_LIGHT)
  }
  // ------------------------------------------------------------------ S5.3 (delete an id that does not exist) — last on the baseline:
  // its 404 handler marks the whole table "unavailable" for the rest of the process (UNAVAILABLE_CACHE).
  {
    const r = await http(B, 'DELETE', `/api/${RISK}/987654`, { headers: P.admin })
    record('S5.3', 'B', r.status === 200 || r.status === 204 ? 'OCCURRED' : 'PREVENTED', 'not reported as a successful deletion', { status: r.status, body: r.data })
  }
  {
    const r = await http(E, 'DELETE', `/api/${RISK}/987654`, { cookie: admin })
    record('S5.3', 'E', r.status === 200 || r.status === 204 ? 'OCCURRED' : 'PREVENTED', 'not reported as a successful deletion', { status: r.status, body: r.data })
  }
}

async function outage() {
  // S5.1: the stand-in process has been stopped before this phase runs (stop it by its own PID: killing every
  // process with a connection to its port also kills the two APIs, which hold keep-alive connections to it).
  const code = r => (r.status === 'NETWORK_ERROR' ? 'ENVIRONMENTAL_FAILURE (system under test unreachable)' : rejected(r.status) ? 'PREVENTED' : 'OCCURRED')
  const admin = await login('admin@eval.local', 'Admin-Eval-Pass-2026').catch(() => null)
  const assessor = await login('assessor@eval.local').catch(() => null)
  {
    const r = await http(B, 'POST', '/api/per_mst_risk_category', { headers: P.assessor, body: { category_name: 'Eval S5.1 during outage (B)' } })
    record('S5.1', 'B', code(r), 'client receives an error status; no success reported', { status: r.status, body: r.data })
  }
  {
    const r = await http(E, 'POST', `/api/${RISK}`, { cookie: assessor ?? admin, body: { RISK_STATEMENT: 'Eval S5.1 during outage (E)' } })
    record('S5.1', 'E', code(r), 'client receives an error status; no success reported', { status: r.status, body: r.data })
  }
}

await (phase === 'outage' ? outage() : phase === 'final' ? final() : main())
const file = `${EV}api-${phase}.json`
writeFileSync(file, JSON.stringify({ ranAt: new Date().toISOString(), results, requests: log }, null, 2))
console.log(`\n${results.length} outcomes → ${file}`)
