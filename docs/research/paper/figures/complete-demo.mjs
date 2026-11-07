/**
 * Completes the demo data through the ERMA-GRC API, signed in as named demo users, so every screen
 * shows rated risks and a populated audit trail. Used only to prepare the screenshots.
 *
 *   node docs/research/paper/figures/complete-demo.mjs      (API on :5000, demo stand-in on :8181)
 */
const API = 'http://localhost:5000'
const PASS = 'Demo-User-Pass-2026'

async function call(cookie, method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await r.json().catch(() => null)
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(data)}`)
  return { data, cookie: r.headers.get('set-cookie')?.split(';')[0] }
}
const login = async (email, password = PASS) => (await call(null, 'POST', '/api/auth/login', { email, password })).cookie

const admin = await login('srivatsan@erma-grc.example', 'Demo-Admin-Pass-2026')
const people = [
  ['priya.raman@example.com', 'Priya Raman', 'Risk Manager', 'Risk Office'],
  ['asha.menon@example.com', 'Asha Menon', 'Risk Manager', 'Risk Office'],
  ['anthony.muller@demo.local', 'Anthony Muller', 'Assessor', 'Operations'], // same account as the demo approval requests
  ['elena.petrova@example.com', 'Elena Petrova', 'Assessor', 'Finance'],
  ['lin.wei@example.com', 'Lin Wei', 'Auditor', 'Internal Audit'],
  ['karen.diaz@example.com', 'Karen Diaz', 'Viewer', 'Compliance'],
]
for (const [email, name, role, department] of people) await call(admin, 'POST', '/api/users', { email, name, role, department, password: PASS })
const anthony = await login('anthony.muller@demo.local')
const elena = await login('elena.petrova@example.com')
const priya = await login('priya.raman@example.com')

const risks = (await call(admin, 'GET', '/api/per_trn_identify_risk?all=true')).data.items
const byRef = ref => risks.find(r => r.assessment_reference_number === ref)
const cycles = (await call(admin, 'GET', '/api/erm_trn_assessment_cycle?all=true')).data.items
const q1 = cycles.find(c => c.cycle_reference === 'RCSA-2027-1')
const q4 = cycles.find(c => c.cycle_reference === 'RCSA-2026-3')

// 1. Finish the ratings the demo left open (assessors rate; nothing here is an approval).
await call(anthony, 'PATCH', `/api/per_trn_identify_risk/${byRef('RSK-2026-009').uuid}`, { INHERENT_LIKELIHOOD: 3, INHERENT_IMPACT: 4, RESIDUAL_LIKELIHOOD: 2, RESIDUAL_IMPACT: 3, INHERENT_SLE: 750000 })
await call(anthony, 'PATCH', `/api/per_trn_identify_risk/${byRef('RSK-2026-008').uuid}`, { RESIDUAL_LIKELIHOOD: 2, RESIDUAL_IMPACT: 2 })
await call(elena, 'PATCH', `/api/per_trn_identify_risk/${byRef('RSK-2026-017').uuid}`, { RESIDUAL_LIKELIHOOD: 3, RESIDUAL_IMPACT: 4 }) // concentration barely reduced by controls

// 2. A new risk in the current Q4 cycle, and two risks scoping the planned Q1 2027 cycle.
const add = async (cookie, row) => (await call(cookie, 'POST', '/api/per_trn_identify_risk', { ASSESSMENT_CYCLE_UUID: q1.uuid, STATUS: 'Y', APPROVAL_STATUS: 'DRAFT', IS_SOP_AVAILABLE: 'Y', ...row })).data
const r19 = await add(elena, {
  ASSESSMENT_CYCLE_UUID: q4.uuid, START_DATE: '2026-10-01', END_DATE: '2026-12-31',
  ASSESSMENT_REFERENCE_NUMBER: 'RSK-2026-019', RISK_STATEMENT: 'Supplier price inflation erodes gross margin', RISK_TYPE: 'Financial',
  PROCESS_NAME: 'Procure to Pay', SUB_PROCESS_NAME: 'Supplier contracts', RISK_OWNER: 'Elena Petrova', RISK_CHAMPION: 'Priya Raman',
  INHERENT_LIKELIHOOD: 4, INHERENT_IMPACT: 3, RESIDUAL_LIKELIHOOD: 3, RESIDUAL_IMPACT: 2, INHERENT_SLE: 1200000, ASSESSMENT_REGISTERED_DATE: '2026-11-03',
})
const r20 = await add(anthony, {
  ASSESSMENT_REFERENCE_NUMBER: 'RSK-2026-020', RISK_STATEMENT: 'Cloud hosting costs exceed the IT budget', RISK_TYPE: 'Technology',
  PROCESS_NAME: 'IT Operations', SUB_PROCESS_NAME: 'Cloud services', RISK_OWNER: 'Marcus Lee', RISK_CHAMPION: 'Priya Raman',
  INHERENT_LIKELIHOOD: 3, INHERENT_IMPACT: 2, RESIDUAL_LIKELIHOOD: 2, RESIDUAL_IMPACT: 2, INHERENT_SLE: 250000, ASSESSMENT_REGISTERED_DATE: '2026-11-04',
})
await add(anthony, {
  ASSESSMENT_REFERENCE_NUMBER: 'RSK-2026-021', RISK_STATEMENT: 'Warehouse system go-live disrupts outbound shipping', RISK_TYPE: 'Operational',
  PROCESS_NAME: 'Inventory & Logistics', SUB_PROCESS_NAME: 'Warehousing', RISK_OWNER: 'Kenji Watanabe', RISK_CHAMPION: 'Priya Raman',
  INHERENT_LIKELIHOOD: 3, INHERENT_IMPACT: 4, RESIDUAL_LIKELIHOOD: 2, RESIDUAL_IMPACT: 3, INHERENT_SLE: 900000, ASSESSMENT_REGISTERED_DATE: '2026-11-05',
})

// 3. Link existing library controls to the new risks.
const controls = (await call(admin, 'GET', '/api/erm_mst_control?all=true')).data.items
const ctl = code => controls.find(c => c.control_code === code)?.uuid
for (const [code, risk] of [['CTL-VEN-DUE-06', r19.uuid], ['CTL-IT-AUTH-01', r20.uuid]]) {
  if (ctl(code)) await call(priya, 'POST', '/api/erm_lnk_control_risk', { CONTROL_UUID: ctl(code), RISK_UUID: risk })
}

// 4. RSK-2026-019 through its whole life: control applied, action plan, submitted by its maker, approved by a checker.
await call(elena, 'POST', '/api/per_trn_control_implementation', {
  IDENTIFY_RISK_UUID: r19.uuid, RISK_UUID: r19.uuid, CONTROL_ID: ctl('CTL-VEN-DUE-06'), CONTROL_TYPE: 'Preventive', CONTROL_FREQUENCY: 'Quarterly',
  CONTROL_DESIGN_EFFECTIVENESS: 'Effective', CONTROL_EFFECTIVENESS_RATING: 'Effective', IS_STAGE_COMPLTED: 'Y',
  EVIDENCE_NOTES: 'Price-review clauses checked on the 12 largest supplier contracts; no exceptions.',
})
await call(elena, 'POST', '/api/per_trn_risk_monitoring', {
  IDENTIFY_RISK_UUID: r19.uuid, RISK_UUID: r19.uuid, MONITORING_TITLE: 'Index-linked price caps in the top 12 supplier contracts',
  MONITORING_GOAL: 'Cap annual price rises at CPI + 2% for 80% of direct spend', MITIGATION_OWNER: 'Elena Petrova',
  ESTIMATED_START_DATE: '2026-11-10', ESTIMATED_END_DATE: '2027-02-28', COMPLETION_PCT: 25,
})
await call(elena, 'PATCH', `/api/per_trn_identify_risk/${r19.uuid}`, { APPROVAL_STATUS: 'SUBMITTED' })
await call(priya, 'PATCH', `/api/per_trn_identify_risk/${r19.uuid}`, { APPROVAL_STATUS: 'APPROVED', APPROVER_COMMENTS: 'Rating, control and action plan reviewed. Agreed.' })

// 5. Record the latest test of the two library controls that had none.
for (const [code, date] of [['CTL-COMP-MON-08', '2026-10-15'], ['CTL-VEN-DUE-06', '2026-09-28']]) {
  if (ctl(code)) await call(priya, 'PATCH', `/api/erm_mst_control/${ctl(code)}`, { LAST_TESTED_ON: date })
}

// 6. A November reading for the escalations indicator (status by the same rule as lib/kri.ts: higher is worse, amber 25).
const kris = (await call(admin, 'GET', '/api/erm_mst_kri_definition?all=true')).data.items
const ops = kris.find(k => k.kri_code === 'KRI-OPS-002')
await call(anthony, 'POST', '/api/erm_trn_kri_readings', { KRI_UUID: ops.uuid, READING_VALUE: 22, READING_DATE: '2026-11-06', TRAFFIC_LIGHT: 'GREEN', IS_BREACH: 'N' })

console.log('done', { r19: r19.uuid, r20: r20.uuid, q1: q1.uuid })
