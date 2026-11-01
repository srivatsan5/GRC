const { chromium } = require('playwright')
const BASE = 'http://localhost:3000', API = 'http://localhost:5000'
const results = []
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + String(extra).slice(0, 220) : ''}`)

async function login(ctx, email, password) {
  const p = await ctx.newPage()
  await p.goto(BASE + '/dashboard', { waitUntil: 'networkidle' })
  await p.fill('#login-email', email); await p.fill('#login-password', password)
  await p.click('button[type=submit]')
  await p.waitForSelector('text=Dashboard', { timeout: 20000 })
  return p
}
const api = (p, method, path, body) => p.evaluate(async ({ API, method, path, body }) => {
  const r = await fetch(API + path, { method, credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: body ? JSON.stringify(body) : undefined })
  let data = null; try { data = await r.json() } catch {}
  return { status: r.status, data }
}, { API, method, path, body })

;(async () => {
  const b = await chromium.launch()
  const adminCtx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const errors = []
  adminCtx.on('page', pg => pg.on('pageerror', e => errors.push(`${pg.url()}: ${e.message}`)))
  const admin = await login(adminCtx, 'admin@pericope.local', 'Local-dev-admin-2026')

  // users for role tests
  for (const [email, role] of [['maker@pericope.local', 'Assessor'], ['rm@pericope.local', 'Risk Manager'], ['viewer@pericope.local', 'Viewer']]) {
    await api(admin, 'POST', '/api/users', { email, name: role + ' Person', role, department: 'Ops', password: 'Phase2-password-1' })
  }

  // 1. every route renders without crashing or showing a load error
  const routes = ['/dashboard', '/rcsa/provisioning', '/rcsa/identification', '/rcsa/mitigation', '/rcsa/monitoring', '/assessments/inherent', '/assessments/residual', '/assessments/access', '/assessments/controls', '/heatmaps', '/kri', '/kri/configuration', '/kri/matrix', '/reports', '/control-library', '/risk-appetite', '/workflow', '/policy', '/vendor-risk', '/incidents', '/bcp', '/scenario', '/audit-trail', '/users', '/settings', '/risk-assessment', '/risk-assessments/dashboard', '/monitoring/action-plan', '/monitoring/actions-hierarchy', '/risk-response', '/asset-library']
  const broken = []
  for (const r of routes) {
    const before = errors.length
    await admin.goto(BASE + r, { waitUntil: 'networkidle' }).catch(e => broken.push(`${r} nav ${e.message}`))
    await admin.waitForTimeout(400)
    const txt = await admin.locator('body').innerText()
    if (/Couldn’t load this data|isn’t set up in the database/.test(txt)) broken.push(`${r}: error state shown`)
    if (errors.length > before) broken.push(`${r}: page error`)
    if (txt.length < 200) broken.push(`${r}: nearly empty (${txt.length} chars)`)
    await admin.screenshot({ path: `./e2e/screenshots/p2${r.replace(/\//g, '_')}.png` })
  }
  check(`all ${routes.length} routes render with real data, no errors`, broken.length === 0, broken.join(' | '))

  for (const [from, to] of [['/', '/dashboard'], ['/appetite/framework', '/risk-appetite'], ['/risk-planning/identify', '/rcsa/identification'], ['/risk-assessments/list', '/rcsa/provisioning'], ['/monitoring/risk-monitoring', '/monitoring']]) {
    await admin.goto(BASE + from, { waitUntil: 'networkidle' })
    if (!admin.url().endsWith(to)) broken.push(`${from} -> ${admin.url()}`)
  }
  check('duplicate/orphan routes redirect to their canonical page', !broken.some(x => x.includes('->')))

  // 2. modules show seeded database rows (not browser data)
  await admin.goto(BASE + '/vendor-risk', { waitUntil: 'networkidle' })
  check('vendor register shows database rows', (await admin.locator('text=Cloudbase Hosting Ltd').count()) > 0)
  await admin.evaluate(() => localStorage.clear())
  await admin.goto(BASE + '/control-library', { waitUntil: 'networkidle' })
  check('control library survives clearing browser storage (data is in the DB)', (await admin.locator('text=MFA on all production systems').count()) > 0)

  // 3. no fabricated numbers on the dashboard
  await admin.goto(BASE + '/dashboard', { waitUntil: 'networkidle' }); await admin.waitForTimeout(800)
  const dash = await admin.locator('main').innerText()
  check('dashboard: no 2500% coverage, no fake $40,000 rows', !/2500%/.test(dash) && !/40,000/.test(dash))
  check('dashboard: legacy risks shown as not rated', /not rated/i.test(dash))

  // 4. settings: currency drives money formatting everywhere
  const saved = await api(admin, 'PUT', '/api/settings', { orgName: 'Acme Bank', industry: 'Banking', currency: 'EUR', idleTimeoutMinutes: 30, riskBands: { moderate: 7, high: 12, critical: 16 } })
  await admin.goto(BASE + '/vendor-risk', { waitUntil: 'networkidle' }); await admin.waitForTimeout(600)
  check('settings saved; vendor values now shown in EUR', saved.status === 200 && /€/.test(await admin.locator('main').innerText()))

  // 5. risk rating flows into heatmap + residual
  const cycle = await api(admin, 'POST', '/api/erm_trn_assessment_cycle', { cycle_name: 'E2E Q4 RCSA', cycle_reference: 'RCSA-2026-E2E', cycle_start_date: '2026-10-01', cycle_end_date: '2026-12-31', status: 'In Progress' })
  const risk = await api(admin, 'POST', '/api/per_trn_identify_risk', { risk_statement: 'E2E: core banking outage', risk_type: 'Operational', process_name: 'IT', inherent_likelihood: 5, inherent_impact: 4, assessment_cycle_uuid: cycle.data?.uuid })
  await api(admin, 'PATCH', `/api/per_trn_identify_risk/${risk.data?.uuid}`, { residual_likelihood: 2, residual_impact: 3 })
  await admin.goto(BASE + `/rcsa/provisioning/${cycle.data?.uuid}`, { waitUntil: 'networkidle' }); await admin.waitForTimeout(600)
  const cycleTxt = (await admin.locator('main').innerText()).replace(/\s+/g, ' ')
  check('cycle page lists its rated risk with inherent 20 and residual 6', /E2E: core banking outage/.test(cycleTxt) && /20 · Critical/.test(cycleTxt) && /6 · Low/.test(cycleTxt), cycleTxt.match(/E2E[^\n]*/)?.[0])
  await admin.goto(BASE + '/heatmaps', { waitUntil: 'networkidle' }); await admin.waitForTimeout(600)
  await admin.screenshot({ path: './e2e/screenshots/p2-heatmap-rated.png' })

  // 6. KRI reading recorded with computed traffic light
  const kris = await api(admin, 'GET', '/api/erm_mst_kri_definition?page=1&pageSize=10&search=outage')
  const kri = kris.data.items[0]
  const reading = await api(admin, 'POST', '/api/erm_trn_kri_readings', { kri_uuid: kri.uuid, reading_date: '2026-10-31', reading_value: 13, traffic_light: 'RED', is_breach: 'Y' })
  await admin.goto(BASE + '/kri/matrix', { waitUntil: 'networkidle' }); await admin.waitForTimeout(600)
  check('KRI reading stored and shown in matrix', reading.status === 201 && /13/.test(await admin.locator('main').innerText()))

  // 7. maker-checker through the UI
  const makerCtx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const maker = await login(makerCtx, 'maker@pericope.local', 'Phase2-password-1')
  const sub = await api(maker, 'POST', '/api/workflow', { title: 'E2E: accept FX residual risk', request_type: 'Risk Acceptance', amount: 120000, approver_roles: ['Risk Manager'] })
  const selfTry = await api(maker, 'POST', `/api/workflow/${sub.data.uuid}/decision`, { decision: 'Approved' })
  check('maker cannot approve own request', selfTry.status === 403, selfTry.data?.error?.message)
  const rmCtx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const rm = await login(rmCtx, 'rm@pericope.local', 'Phase2-password-1')
  await rm.goto(BASE + '/workflow', { waitUntil: 'networkidle' }); await rm.waitForTimeout(800)
  await rm.screenshot({ path: './e2e/screenshots/p2-workflow-rm.png' })
  const card = rm.locator('text=E2E: accept FX residual risk')
  check('RM sees the request waiting for them', (await card.count()) > 0)
  const approveBtn = rm.locator('button:has-text("Approve")').first()
  if (await approveBtn.isEnabled().catch(() => false)) {
    await approveBtn.click()
    const confirmBtn = rm.locator('[role=alertdialog] button:has-text("Approve"), [role=dialog] button:has-text("Approve")').last()
    if (await confirmBtn.count()) await confirmBtn.click().catch(() => {})
    await rm.waitForTimeout(1200)
  }
  const after = await api(rm, 'GET', `/api/workflow/${sub.data.uuid}`)
  check('RM approves in the UI; request becomes Approved', after.data?.status === 'Approved', after.data?.status)

  // 8. viewer is read-only
  const vCtx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const viewer = await login(vCtx, 'viewer@pericope.local', 'Phase2-password-1')
  await viewer.goto(BASE + '/vendor-risk', { waitUntil: 'networkidle' }); await viewer.waitForTimeout(600)
  const addBtns = await viewer.locator('button:has-text("Add"), button:has-text("New")').count()
  check('viewer sees no add/new buttons on vendor register', addBtns === 0, `buttons=${addBtns}`)

  // review fixes
  await admin.goto(BASE + '/rcsa', { waitUntil: 'networkidle' }); await admin.waitForTimeout(600)
  const hub = await admin.locator('main').innerText()
  check('RCSA hub: live counts, no marketing claims', /active risks/.test(hub) && !/neural|Real-time DB|ISO 27001/i.test(hub))
  await admin.click('button[aria-label*="attention"], button[aria-label*="Nothing needs"]')
  await admin.waitForTimeout(500)
  const bell = await admin.locator('header').innerText()
  check('bell shows real items (KRI breach recorded above), no invented notifications', /KRI breach/.test(bell) && !/CTL-FIN-SOD-07|10m ago/.test(bell), bell.replace(/\s+/g, ' ').slice(0, 200))
  const footer = await admin.locator('footer').innerText().catch(() => '')
  check('footer version comes from package.json', /v4\.0\.0/.test(footer), footer)

  check('no uncaught page errors', errors.length === 0, errors.join(' | '))
  console.log(results.join('\n'))
  await b.close()
})().catch(e => { console.log(results.join('\n')); console.error('SCRIPT ERROR', e.stack); process.exit(1) })
