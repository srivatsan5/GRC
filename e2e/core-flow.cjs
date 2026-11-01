/**
 * The core RCSA journey, driven through the UI the way people use it:
 *   an assessor adds a risk → rates its inherent risk → applies a library control → submits it;
 *   a risk manager approves it; the risk then shows in the board report and the audit trail.
 * Run with `npm run e2e -- core-flow` (starts a fresh local stack).
 */
const { chromium } = require('playwright')
const BASE = 'http://localhost:3000'
const API = 'http://localhost:5000'
const STATEMENT = `E2E core flow: payment gateway outage ${Date.now().toString(36)}`
const results = []
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + String(extra).slice(0, 200) : ''}`)

async function login(browser, email, password) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  p.on('pageerror', e => errors.push(`${email}: ${e.message}`))
  await p.goto(BASE + '/dashboard', { waitUntil: 'networkidle' })
  await p.fill('#login-email', email)
  await p.fill('#login-password', password)
  await p.click('button[type=submit]')
  await p.waitForSelector('main#main', { timeout: 30000 })
  return p
}
const api = (p, method, path, body) =>
  p.evaluate(
    async ({ API, method, path, body }) => {
      const r = await fetch(API + path, { method, credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: body ? JSON.stringify(body) : undefined })
      let data = null
      try {
        data = await r.json()
      } catch {}
      return { status: r.status, data }
    },
    { API, method, path, body },
  )
const errors = []

;(async () => {
  const browser = await chromium.launch()

  // Setup: an administrator creates the two people in this story.
  const admin = await login(browser, 'admin@pericope.local', 'Local-dev-admin-2026')
  for (const [email, name, role] of [
    ['assessor@pericope.local', 'Asha Assessor', 'Assessor'],
    ['manager@pericope.local', 'Ravi Manager', 'Risk Manager'],
  ]) {
    await api(admin, 'POST', '/api/users', { email, name, role, department: 'Risk Office', password: 'Core-flow-pass-2026' })
  }

  // 1. The assessor adds a risk from the register.
  const assessor = await login(browser, 'assessor@pericope.local', 'Core-flow-pass-2026')
  await assessor.goto(BASE + '/rcsa/identification', { waitUntil: 'networkidle' })
  await assessor.getByRole('button', { name: 'Add risk' }).first().click()
  await assessor.fill('#risk-statement', STATEMENT)
  await assessor.fill('#risk-category', 'Technology')
  await assessor.fill('#risk-process', 'Payments')
  await assessor.fill('#risk-owner', 'Asha Assessor')
  await assessor.locator('[role=dialog] button[type=submit]').click()
  await assessor.waitForTimeout(1500)
  const found = await api(assessor, 'GET', `/api/per_trn_identify_risk?page=1&pageSize=5&search=${encodeURIComponent(STATEMENT)}`)
  const risk = found.data?.items?.[0]
  check('assessor adds a risk in the register; it is stored as a draft', !!risk && String(risk.approval_status ?? 'DRAFT').toUpperCase() === 'DRAFT', risk ? `uuid ${risk.uuid}` : JSON.stringify(found))
  if (!risk) throw new Error('risk was not created')
  const id = risk.uuid

  // 2. Inherent assessment: likelihood 4 × impact 5 = 20 (Critical).
  await assessor.goto(`${BASE}/assessments/inherent?riskId=${id}`, { waitUntil: 'networkidle' })
  await assessor.locator('label:has(input[name="ia-likelihood"][value="4"])').click()
  await assessor.locator('label:has(input[name="ia-impact"][value="5"])').click()
  await assessor.fill('#ia-description', 'Single gateway provider; two outages last year; no automatic failover.')
  await assessor.getByRole('button', { name: 'Save assessment' }).click()
  await assessor.waitForTimeout(1500)
  const rated = (await api(assessor, 'GET', `/api/per_trn_identify_risk/${id}`)).data
  check('inherent assessment saves likelihood 4 × impact 5', rated?.inherent_likelihood == 4 && rated?.inherent_impact == 5, JSON.stringify({ l: rated?.inherent_likelihood, i: rated?.inherent_impact }))
  const history = await api(assessor, 'GET', `/api/per_trn_inherent_risk_assessment?filter=${encodeURIComponent(JSON.stringify({ identify_risk_uuid: id }))}`)
  check('an assessment record is kept for the history', (history.data?.items ?? history.data ?? []).length >= 1)

  // 3. Apply a control from the library on the risk's page.
  await assessor.goto(`${BASE}/risks/${id}`, { waitUntil: 'networkidle' })
  const riskPage = await assessor.locator('main').innerText()
  check('risk page shows the Critical inherent rating', /20/.test(riskPage) && /Critical/.test(riskPage))
  await assessor.getByRole('button', { name: 'Apply control' }).first().click()
  await assessor.locator('[role=dialog] [role=option]').first().waitFor({ timeout: 15000 })
  await assessor.locator('[role=dialog] [role=option]').first().click()
  await assessor.locator('[role=dialog]').getByRole('button', { name: 'Apply control' }).click()
  await assessor.waitForTimeout(1500)
  const applied = await api(assessor, 'GET', `/api/per_trn_control_implementation?filter=${encodeURIComponent(JSON.stringify({ identify_risk_uuid: id }))}`)
  const appliedRows = applied.data?.items ?? applied.data ?? []
  check('a library control is applied to the risk', appliedRows.length === 1)
  const links = await api(assessor, 'GET', `/api/erm_lnk_control_risk?filter=${encodeURIComponent(JSON.stringify({ risk_uuid: id }))}`)
  check('the control library records which risk the control mitigates', (links.data?.items ?? links.data ?? []).length === 1)

  // 4. Submit for approval; the assessor cannot approve.
  await assessor.goto(`${BASE}/risks/${id}`, { waitUntil: 'networkidle' })
  await assessor.getByRole('button', { name: 'Submit for approval' }).click()
  await assessor.waitForTimeout(1200)
  const submitted = (await api(assessor, 'GET', `/api/per_trn_identify_risk/${id}`)).data
  check('assessor submits the risk for approval', submitted?.approval_status === 'SUBMITTED', submitted?.approval_status)
  const selfApprove = await api(assessor, 'PATCH', `/api/per_trn_identify_risk/${id}`, { approval_status: 'APPROVED' })
  check('assessor cannot approve (server refuses)', selfApprove.status === 403, selfApprove.status)
  check('assessor sees no Approve button', (await assessor.getByRole('button', { name: 'Approve' }).count()) === 0)

  // 5. The risk manager approves from the risk page.
  const manager = await login(browser, 'manager@pericope.local', 'Core-flow-pass-2026')
  await manager.goto(`${BASE}/rcsa/identification?view=awaiting`, { waitUntil: 'networkidle' })
  check('risk manager finds it under "Awaiting approval"', (await manager.locator('main').innerText()).includes(STATEMENT.slice(0, 30)))
  await manager.goto(`${BASE}/risks/${id}`, { waitUntil: 'networkidle' })
  await manager.getByRole('button', { name: 'Approve' }).first().click()
  await manager.locator('[role=alertdialog] button:has-text("Approve"), [role=dialog] button:has-text("Approve")').last().click()
  await manager.waitForTimeout(1500)
  const approved = (await api(manager, 'GET', `/api/per_trn_identify_risk/${id}`)).data
  check('risk manager approves; approver and time are recorded', approved?.approval_status === 'APPROVED' && !!approved?.approved_on, JSON.stringify({ s: approved?.approval_status, on: approved?.approved_on }))

  // 6. It shows in the board report and the audit trail.
  await manager.goto(`${BASE}/reports?report=risks`, { waitUntil: 'networkidle' })
  await manager.waitForTimeout(800)
  const report = await manager.locator('main').innerText()
  check('board report lists the approved risk', report.includes(STATEMENT.slice(0, 30)))
  await admin.goto(`${BASE}/audit-trail?search=${id}`, { waitUntil: 'networkidle' })
  await admin.waitForTimeout(800)
  const audit = await admin.locator('main').innerText()
  if (process.env.E2E_DEBUG) console.log(audit.slice(600, 4000))
  check('audit trail has the create, the submission and the approval', /Created|Create/.test(audit) && /Approve/.test(audit) && /Ravi Manager/.test(audit) && /Asha Assessor/.test(audit))

  check('no uncaught page errors', errors.length === 0, errors.join(' | '))
  console.log(results.join('\n'))
  await browser.close()
  if (results.some(r => r.startsWith('FAIL'))) process.exit(1)
})().catch(e => {
  console.log(results.join('\n'))
  console.error('SCRIPT ERROR', e.stack)
  process.exit(1)
})
