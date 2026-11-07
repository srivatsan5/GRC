/**
 * The four panels of Figure 2, re-captured after the product was renamed to ERMA-GRC.
 * Same stored set-up as the recorded evaluation run (S1.1 unrated risk, S7.1 empty cycle).
 * (The product screens in screens/ come from screens.cjs, on the full demo data.)
 * Needs: stand-in :8181, baseline API :5001 + web :3001, ERMA-GRC API :5000 + web :3000.
 *
 *   node docs/research/paper/figures/capture.cjs
 */
const { chromium } = require('playwright')
const fs = require('fs')
const OUT = __dirname
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
  const ec = await b.newContext({ viewport: { width: 980, height: 900 }, deviceScaleFactor: 3 })
  const e = await ec.newPage()
  await e.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' })
  await e.fill('#login-email', 'admin@erma-grc.local'); await e.fill('#login-password', 'Demo-Admin-Pass-2026')
  await e.click('button[type=submit]'); await e.waitForSelector('text=Enterprise risk position')
  await e.goto('http://localhost:3000/rcsa/identification', { waitUntil: 'networkidle' }); await e.waitForTimeout(1200)
  await e.locator('main input[type=search]').first().fill('Eval S1.1 unrated risk'); await e.waitForTimeout(1200)
  // Print legibility: hide columns unrelated to the point (selection box, owner, cycle, row actions).
  await e.addStyleTag({ content: 'main table th:nth-child(1), main table td:nth-child(1), main table th:nth-child(3), main table td:nth-child(3), main table th:nth-child(4), main table td:nth-child(4), main table th:nth-child(n+9), main table td:nth-child(n+9) { display: none !important } main table { min-width: 0 !important; width: 100% !important; table-layout: auto !important }' })
  await e.waitForTimeout(300)
  await clip(e.locator('main table').first(), 'panel-b-erma-unrated.png')
  await e.goto('http://localhost:3000/rcsa/provisioning/92001', { waitUntil: 'networkidle' }); await e.waitForTimeout(1500)
  const emptySection = e.locator('main section, main div', { hasText: 'No risks in this cycle yet' }).filter({ hasText: 'Risks in this cycle' }).last()
  await clip(emptySection, 'panel-d-erma-empty-cycle.png')
  await ec.close()

  // ---------------------------------------------------------------- Baseline (crops of the content only)
  const bc = await b.newContext({ viewport: { width: 980, height: 900 }, deviceScaleFactor: 3 })
  const p = await bc.newPage()
  await p.goto('http://localhost:3001/', { waitUntil: 'networkidle' }); await p.click('button[type=submit]'); await p.waitForTimeout(2500)
  await p.goto('http://localhost:3001/rcsa/provisioning/91001', { waitUntil: 'networkidle' }); await p.waitForTimeout(2000)
  // Print legibility: hide the category and controls columns.
  await p.addStyleTag({ content: 'main table th:nth-child(2), main table td:nth-child(2), main table th:nth-child(5), main table td:nth-child(5) { display: none !important }' })
  await p.waitForTimeout(300)
  await clip(p.locator('main table').first(), 'panel-a-baseline-unrated.png')
  await p.goto('http://localhost:3001/rcsa/provisioning/92001', { waitUntil: 'networkidle' }); await p.waitForTimeout(2000)
  await p.addStyleTag({ content: 'main table th:nth-child(2), main table td:nth-child(2), main table th:nth-child(5), main table td:nth-child(5) { display: none !important }' })
  await p.waitForTimeout(300)
  await clip(p.locator('main table').first(), 'panel-c-baseline-empty-cycle.png')
  await bc.close()
  await b.close()
  console.log(leaks.length ? `NAME LEAK in: ${leaks.join(', ')}` : 'no "Pericope" text in any panel')
})()
