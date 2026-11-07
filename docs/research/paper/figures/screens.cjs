/**
 * Product screenshots of ERMA-GRC on the full demo data (the rows of the Oracle demo install,
 * completed through the app by complete-demo.mjs). Signed in as the administrator.
 *
 *   node docs/research/paper/figures/screens.cjs      (web :3000 → API :5000 → demo stand-in :8181)
 */
const { chromium } = require('playwright')
const fs = require('fs')
const OUT = __dirname + '/screens'
fs.mkdirSync(OUT, { recursive: true })
const W = 'http://localhost:3000'

;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', e => errors.push(e.message))
  await p.goto(W + '/dashboard', { waitUntil: 'networkidle' })
  await p.screenshot({ path: `${OUT}/01-sign-in.png` })
  await p.fill('#login-email', 'srivatsan@erma-grc.example'); await p.fill('#login-password', 'Demo-Admin-Pass-2026')
  await p.click('button[type=submit]'); await p.waitForSelector('text=Dashboard')

  const risks = await p.evaluate(async () => (await (await fetch('http://localhost:5000/api/per_trn_identify_risk?all=true', { credentials: 'include' })).json()).items)
  const featured = risks.find(r => r.assessment_reference_number === 'RSK-2026-019') // has a full history: created, control, plan, submitted, approved
  const shots = [
    ['02-dashboard', '/dashboard'],
    ['03-assessment-cycles', '/rcsa/provisioning'],
    ['04-risk-register', '/rcsa/identification'],
    ['05-risk-detail', `/risks/${featured.uuid}`],
    ['06-heatmap', '/heatmaps'],
    ['07-residual-analysis', '/assessments/residual'],
    ['08-key-risk-indicators', '/kri'],
    ['09-control-library', '/control-library'],
    ['10-risk-appetite', '/risk-appetite'],
    ['11-approvals', '/workflow'],
    ['12-audit-trail', '/audit-trail'],
    ['13-reports', '/reports'],
  ]
  const report = []
  for (const [name, path] of shots) {
    await p.goto(W + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
    const text = await p.locator('main').innerText()
    if (/couldn.t load|isn.t set up|pericope/i.test(text)) report.push(`${name}: problem text on screen`)
    await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  }
  await b.close()
  console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors')
  console.log(report.length ? report.join('\n') : 'no load errors or old product name on any screen')
})()
