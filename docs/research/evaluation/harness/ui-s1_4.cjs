// S1.4: fresh installation, before any user action other than signing in. Open the audit trail.
const { chromium } = require('playwright')
const fs = require('fs')
const EV = __dirname + '/../evidence'
;(async () => {
  const b = await chromium.launch()
  const out = {}
  // Baseline (B)
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
    const p = await ctx.newPage()
    await p.goto('http://localhost:3001/', { waitUntil: 'networkidle' })
    await p.click('button[type=submit]') // default credentials pre-filled by the baseline login form
    await p.waitForTimeout(2500)
    await p.goto('http://localhost:3001/audit-trail', { waitUntil: 'networkidle' })
    await p.waitForTimeout(2000)
    await p.screenshot({ path: EV + '/S1.4-baseline-audit-trail.png', fullPage: true })
    const text = await p.locator('body').innerText()
    const stored = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])))
    out.baseline = { url: p.url(), text: text.slice(0, 6000), localStorageKeys: Object.keys(stored), auditStore: Object.entries(stored).filter(([k]) => /audit/i.test(k)).map(([k, v]) => ({ k, v: JSON.parse(v) })) }
    await ctx.close()
  }
  // Artifact (E)
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
    const p = await ctx.newPage()
    await p.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' })
    await p.fill('#login-email', 'admin@eval.local'); await p.fill('#login-password', 'Admin-Eval-Pass-2026')
    await p.click('button[type=submit]')
    await p.waitForSelector('text=Dashboard', { timeout: 20000 })
    await p.goto('http://localhost:3000/audit-trail', { waitUntil: 'networkidle' })
    await p.waitForTimeout(2000)
    await p.screenshot({ path: EV + '/S1.4-erma-audit-trail.png', fullPage: true })
    const text = await p.locator('body').innerText()
    const api = await p.evaluate(async () => (await fetch('http://localhost:5000/api/audit?limit=100', { credentials: 'include' })).json())
    out.erma = { url: p.url(), text: text.slice(0, 6000), apiEntries: api }
    await ctx.close()
  }
  fs.writeFileSync(EV + '/S1.4.json', JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ b: out.baseline.auditStore, e: out.erma.apiEntries.items?.map(i => [i.seq, i.actor_name, i.action, i.description]) }, null, 1).slice(0, 5000))
  await b.close()
})()
