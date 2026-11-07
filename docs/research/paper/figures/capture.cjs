/**
 * Screenshots for the paper, re-captured after the product was renamed to ERMA-GRC.
 * Same stored set-up as the recorded evaluation run (S1.1 unrated risk, S7.1 empty cycle).
 * Needs: stand-in :8181, baseline API :5001 + web :3001, ERMA-GRC API :5000 + web :3000.
 *
 *   node docs/research/paper/figures/capture.cjs
 */
const { chromium } = require('playwright')
const fs = require('fs')
const OUT = __dirname
const SCREENS = OUT + '/screens'
fs.mkdirSync(SCREENS, { recursive: true })
const ctl = (path, body) => fetch(`http://localhost:8181/__control/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

;(async () => {
  await ctl('rows/per_trn_identify_risk', [{ UUID: 91001, RISK_STATEMENT: 'Eval S1.1 unrated risk', PROCESS_NAME: 'Finance', APPROVAL_STATUS: 'SUBMITTED', STATUS: 'Y', IS_STAGE_COMPLTED: 'N' }])
  await ctl('rows/erm_trn_assessment_cycle', [{ UUID: 92001, CYCLE_REFERENCE: 'CYC-EVAL-S71', CYCLE_NAME: 'Eval S7.1 empty cycle', CYCLE_TYPE: 'Quarterly', CYCLE_YEAR: 2026, STATUS: 'Planned' }])

  const b = await chromium.launch()
  const leaks = []
  const clip = async (locator, file) => {
    const t = await locator.innerText()
    if (/pericope/i.test(t)) leaks.push(file)
    await locator.screenshot({ path: `${OUT}/${file}` })
  }

  // ---------------------------------------------------------------- ERMA-GRC
  const ec = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const e = await ec.newPage()
  await e.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' })
  await e.screenshot({ path: `${SCREENS}/01-sign-in.png` })
  await e.fill('#login-email', 'admin@erma-grc.local'); await e.fill('#login-password', 'Demo-Admin-Pass-2026')
  await e.click('button[type=submit]'); await e.waitForSelector('text=Dashboard'); await e.waitForTimeout(1500)
  await e.screenshot({ path: `${SCREENS}/02-dashboard.png` })
  await e.goto('http://localhost:3000/rcsa/identification', { waitUntil: 'networkidle' }); await e.waitForTimeout(1200)
  await e.screenshot({ path: `${SCREENS}/03-risk-register.png` })
  await e.locator('main input[type=search]').first().fill('Eval S1.1 unrated risk'); await e.waitForTimeout(1200)
  await clip(e.locator('main table').first(), 'panel-b-erma-unrated.png')
  await e.goto('http://localhost:3000/heatmaps', { waitUntil: 'networkidle' }); await e.waitForTimeout(1200)
  await e.screenshot({ path: `${SCREENS}/04-heatmap.png` })
  await e.goto('http://localhost:3000/rcsa/provisioning/92001', { waitUntil: 'networkidle' }); await e.waitForTimeout(1500)
  await e.screenshot({ path: `${SCREENS}/05-empty-cycle.png` })
  const emptySection = e.locator('main section, main div', { hasText: 'No risks in this cycle yet' }).filter({ hasText: 'Risks in this cycle' }).last()
  await clip(emptySection, 'panel-d-erma-empty-cycle.png')
  await e.goto('http://localhost:3000/audit-trail', { waitUntil: 'networkidle' }); await e.waitForTimeout(1500)
  await e.screenshot({ path: `${SCREENS}/06-audit-trail.png` })
  await e.goto('http://localhost:3000/workflow', { waitUntil: 'networkidle' }); await e.waitForTimeout(1200)
  await e.screenshot({ path: `${SCREENS}/07-approvals.png` })
  await e.goto('http://localhost:3000/kri', { waitUntil: 'networkidle' }); await e.waitForTimeout(1200)
  await e.screenshot({ path: `${SCREENS}/08-key-risk-indicators.png` })
  await ec.close()

  // ---------------------------------------------------------------- Baseline (crops of the content only)
  const bc = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const p = await bc.newPage()
  await p.goto('http://localhost:3001/', { waitUntil: 'networkidle' }); await p.click('button[type=submit]'); await p.waitForTimeout(2500)
  await p.goto('http://localhost:3001/rcsa/provisioning/91001', { waitUntil: 'networkidle' }); await p.waitForTimeout(2000)
  await clip(p.locator('main table').first(), 'panel-a-baseline-unrated.png')
  await p.goto('http://localhost:3001/rcsa/provisioning/92001', { waitUntil: 'networkidle' }); await p.waitForTimeout(2000)
  await clip(p.locator('main table').first(), 'panel-c-baseline-empty-cycle.png')
  await bc.close()
  await b.close()
  console.log(leaks.length ? `NAME LEAK in: ${leaks.join(', ')}` : 'no "Pericope" text in any panel')
})()
