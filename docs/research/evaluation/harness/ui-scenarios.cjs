/**
 * Browser scenarios of SCENARIOS.md (S1.1-S1.3, S4.2 baseline part, S6.1, S7.1, G4 UI part), run once per system.
 *   Baseline web :3001 → baseline API :5001;  ERMA-GRC web :3000 → ERMA-GRC API :5000;  shared stand-in :8181.
 * Captures screenshots, visible text and stored rows; outcomes are coded in RESULTS.md against the fixed criteria.
 *
 *   node docs/research/evaluation/harness/ui-scenarios.cjs
 */
const { chromium } = require('playwright')
const fs = require('fs')
const PILOT = process.env.PILOT === '1' // harness pilot on a throwaway stack: API calls are re-routed to :5100/:5101/:8282
const EV = PILOT ? process.env.EVIDENCE_DIR : __dirname + '/../evidence'
const DB = PILOT ? 'http://localhost:8282' : 'http://localhost:8181'
const SYS = {
  B: { web: 'http://localhost:3001', name: 'baseline' },
  E: { web: 'http://localhost:3000', name: 'erma' },
}
const out = { ranAt: new Date().toISOString(), setup: {}, B: {}, E: {} }
const ctl = async (method, path, body) => (await fetch(`${DB}/__control/${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json()
const rows = table => ctl('GET', `rows/${table}`)
const shot = (p, sys, id) => p.screenshot({ path: `${EV}/${id}-${SYS[sys].name}.png`, fullPage: true })
const text = async p => (await p.locator('main').count()) ? p.locator('main').first().innerText() : p.locator('body').innerText()

async function signIn(ctx, sys) {
  const p = await ctx.newPage()
  if (sys === 'B') {
    await p.goto(SYS.B.web + '/', { waitUntil: 'networkidle' })
    if (await p.locator('button[type=submit]').count()) await p.click('button[type=submit]') // pre-filled administrator persona
    await p.waitForTimeout(2500)
  } else {
    await p.goto(SYS.E.web + '/dashboard', { waitUntil: 'networkidle' })
    await p.fill('#login-email', 'admin@eval.local'); await p.fill('#login-password', 'Admin-Eval-Pass-2026')
    await p.click('button[type=submit]')
    await p.waitForSelector('text=Dashboard', { timeout: 20000 })
  }
  return p
}

async function search(p, term) {
  const typed = p.locator('main input[type=search]').first()
  const ph = p.locator('main').getByPlaceholder(/search/i).first()
  const target = (await typed.count()) ? typed : ph
  if (await target.count()) { await target.fill(term); await p.waitForTimeout(1200) }
}

/** Make a register row visible: the search box first; if that does not reveal it, clear it and sort by statement. */
async function reveal(p, needle, uuid) {
  await search(p, needle)
  if (await p.locator(`main >> text=${needle}`).count()) return 'search'
  await search(p, String(uuid))
  if (await p.locator(`main >> text=${needle}`).count()) return 'search by id'
  if (await p.locator('main tr', { hasText: `REF-${uuid}` }).count()) return 'search by id (row shown without the stored statement)'
  await search(p, '')
  const header = p.locator('main th').filter({ hasText: /statement/i }).first()
  for (const how of ['sort by statement (1st click)', 'sort by statement (2nd click)']) {
    if (!(await header.count())) break
    await header.click(); await p.waitForTimeout(800)
    if (await p.locator(`main >> text=${needle}`).count()) return how
  }
  return 'not reachable'
}
/** Text of the smallest table row / card that contains `needle`. */
async function rowText(p, needle) {
  const row = p.locator('tr', { hasText: needle })
  if (await row.count()) return row.first().innerText()
  const any = p.locator('main *', { hasText: needle })
  return (await any.count()) ? any.last().innerText() : null
}

;(async () => {
  // ---------------------------------------------------------------- identical set-up, written straight to the database
  const setup = {
    per_trn_identify_risk: [
      { UUID: 91001, RISK_STATEMENT: 'Eval S1.1 unrated risk', PROCESS_NAME: 'Finance', APPROVAL_STATUS: 'SUBMITTED', STATUS: 'Y', IS_STAGE_COMPLTED: 'N' },
      { UUID: 91002, RISK_STATEMENT: 'Test statement X', INHERENT_SLE: 123456, PROCESS_NAME: 'Finance', APPROVAL_STATUS: 'SUBMITTED', STATUS: 'Y', IS_STAGE_COMPLTED: 'N' },
      { UUID: 91003, RISK_STATEMENT: 'Eval S1.3 no approval status', PROCESS_NAME: 'Finance', STATUS: 'Y', IS_STAGE_COMPLTED: 'N' },
    ],
    erm_trn_assessment_cycle: [{ UUID: 92001, CYCLE_REFERENCE: 'CYC-EVAL-S71', CYCLE_NAME: 'Eval S7.1 empty cycle', CYCLE_TYPE: 'Quarterly', CYCLE_YEAR: 2026, STATUS: 'Planned' }],
  }
  for (const [t, list] of Object.entries(setup)) await ctl('POST', `rows/${t}`, list)
  out.setup = setup

  const b = await chromium.launch()
  for (const sys of ['B', 'E']) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
    if (PILOT) {
      await ctx.route('http://localhost:5000/**', r => r.continue({ url: r.request().url().replace(':5000', ':5100') }))
      await ctx.route('http://localhost:5001/**', r => r.continue({ url: r.request().url().replace(':5001', ':5101') }))
    }
    const errors = []
    ctx.on('page', pg => pg.on('pageerror', e => errors.push(e.message)))
    const p = await signIn(ctx, sys)
    const W = SYS[sys].web
    const R = out[sys]

    // ---------------------------------------------------------------- S1.1-S1.3: register and heatmap
    await p.goto(W + '/rcsa/identification', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
    for (const [id, needle, uuid] of [['S1.1', 'Eval S1.1 unrated risk', 91001], ['S1.2', 'Test statement X', 91002], ['S1.3', 'Eval S1.3 no approval status', 91003]]) {
      await p.goto(W + '/rcsa/identification', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
      const how = await reveal(p, needle, uuid)
      R[id] = { register: { revealedBy: how, row: (await rowText(p, needle)) ?? (await rowText(p, `REF-${uuid}`)), present: how !== 'not reachable' } }
      await shot(p, sys, `${id}-register`)
    }
    // S1.2: the stored SLE as the register shows it, and as the record's edit form shows it
    await p.goto(W + '/rcsa/identification', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
    await reveal(p, 'Test statement X', 91002)
    const edit = p.locator('tr', { hasText: 'Test statement X' }).first().getByRole('button', { name: /edit/i })
    if (await edit.count()) {
      await edit.first().click(); await p.waitForTimeout(800)
      R['S1.2'].editForm = await p.evaluate(() => [...document.querySelectorAll('[role=dialog] input, [role=dialog] textarea, [role=dialog] select')].map(el => `${el.id || el.name}: ${el.value}`))
      await shot(p, sys, 'S1.2-edit-form')
      await p.keyboard.press('Escape')
    }
    if (sys === 'B') {
      // The baseline also shows a single risk on its assessment-details page (it treats each register row as an assessment).
      for (const [id, uuid] of [['S1.1', 91001], ['S1.2', 91002], ['S1.3', 91003]]) {
        await p.goto(`${W}/rcsa/provisioning/${uuid}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
        R[id].detailPage = (await text(p)).slice(0, 2500)
        await shot(p, sys, `${id}-detail`)
      }
    }
    await p.goto(W + '/heatmaps', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
    const heat = await text(p)
    for (const [id, needle] of [['S1.1', 'Eval S1.1 unrated risk'], ['S1.2', 'Test statement X'], ['S1.3', 'Eval S1.3 no approval status']]) {
      R[id].heatmap = { mentioned: heat.includes(needle), context: heat.includes(needle) ? heat.slice(Math.max(0, heat.indexOf(needle) - 300), heat.indexOf(needle) + 300) : null }
    }
    R.heatmapText = heat.slice(0, 5000)
    await shot(p, sys, 'S1-heatmap')

    // ---------------------------------------------------------------- S7.1: an assessment cycle with no risks (same id, same stored state)
    await p.goto(W + '/rcsa/provisioning/92001', { waitUntil: 'networkidle' }); await p.waitForTimeout(2000)
    R['S7.1'] = {
      text: (await text(p)).slice(0, 4000),
      deleteButtons: await p.locator('main').getByRole('button', { name: /delete|remove/i }).count(),
      deleteIconButtons: await p.locator('main button:has(svg.lucide-trash2), main button:has(svg.lucide-trash-2), main button:has(svg.lucide-trash)').count(),
      tableRows: await p.locator('main tbody tr').count(),
    }
    await shot(p, sys, 'S7.1-cycle')

    // ---------------------------------------------------------------- S6.1: create a control and an incident through the UI
    await p.goto(W + '/control-library', { waitUntil: 'networkidle' }); await p.waitForTimeout(1000)
    if (sys === 'B') {
      await p.getByRole('button', { name: /new control|add control/i }).first().click(); await p.waitForTimeout(500)
      await p.getByPlaceholder('e.g. CTL-IT-001').fill('CTL-EVAL-S61')
      await p.getByPlaceholder('e.g. CISO').fill('Evaluation owner')
      await p.getByPlaceholder('Descriptive title of control').fill('Eval S6.1 control')
      await p.getByRole('button', { name: 'Save control' }).click()
    } else {
      await p.getByRole('button', { name: 'New control' }).click(); await p.waitForTimeout(500)
      await p.fill('#ctl-control_code', 'CTL-EVAL-S61'); await p.fill('#ctl-control_name', 'Eval S6.1 control'); await p.fill('#ctl-owner_name', 'Evaluation owner')
      await p.getByRole('button', { name: 'Create control' }).click()
    }
    await p.waitForTimeout(1500)
    await p.goto(W + '/incidents', { waitUntil: 'networkidle' }); await p.waitForTimeout(1000)
    if (sys === 'B') {
      await p.getByRole('button', { name: /new incident|report incident|add incident|log incident/i }).first().click(); await p.waitForTimeout(500)
      await p.getByPlaceholder('e.g. Database replication delay').fill('Eval S6.1 incident')
      await p.getByRole('button', { name: 'Save incident' }).click()
    } else {
      await p.getByRole('button', { name: 'Report incident' }).first().click(); await p.waitForTimeout(500)
      await p.fill('#i-title', 'Eval S6.1 incident')
      await p.locator('#i-severity').selectOption({ index: 1 })
      if (!(await p.inputValue('#i-reported_on'))) await p.fill('#i-reported_on', '2026-11-06')
      await p.locator('[role=dialog]').getByRole('button', { name: 'Report incident' }).click()
    }
    await p.waitForTimeout(1500)
    const presentNow = async () => {
      await p.goto(W + '/control-library', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200)
      await search(p, 'Eval S6.1 control')
      const control = (await p.locator('text=Eval S6.1 control').count()) > 0
      await p.goto(W + '/incidents', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200)
      await search(p, 'Eval S6.1 incident')
      const incident = (await p.locator('text=Eval S6.1 incident').count()) > 0
      return { control, incident }
    }
    const before = await presentNow()
    const storage = await p.evaluate(() => Object.keys(localStorage))
    const inDb = async () => {
      const all = await Promise.all(['erm_mst_control', 'erm_trn_incident', 'erm_controls', 'erm_incidents'].map(t => rows(t).catch(() => [])))
      return all.flat().filter(r => Object.values(r).some(v => v === 'Eval S6.1 control' || v === 'Eval S6.1 incident')).length
    }
    const dbRowsBefore = await inDb()
    // Clear all browser storage (local, session, cookies), reload and sign in again.
    await p.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
    await ctx.clearCookies()
    await p.close()
    const p2 = await signIn(ctx, sys)
    const pRef = p2
    const presentAfter = async () => {
      await pRef.goto(W + '/control-library', { waitUntil: 'networkidle' }); await pRef.waitForTimeout(1200)
      await search(pRef, 'Eval S6.1 control')
      const control = (await pRef.locator('text=Eval S6.1 control').count()) > 0
      await shot(pRef, sys, 'S6.1-control-library-after-clear')
      await pRef.goto(W + '/incidents', { waitUntil: 'networkidle' }); await pRef.waitForTimeout(1200)
      await search(pRef, 'Eval S6.1 incident')
      const incident = (await pRef.locator('text=Eval S6.1 incident').count()) > 0
      await shot(pRef, sys, 'S6.1-incidents-after-clear')
      return { control, incident }
    }
    R['S6.1'] = { presentBeforeClear: before, browserStorageKeysBeforeClear: storage, databaseRowsFound: dbRowsBefore, presentAfterClear: await presentAfter() }

    // ---------------------------------------------------------------- G4 (UI part): reading 14, red threshold 15, lower is worse
    const q = pRef
    await q.goto(W + '/kri', { waitUntil: 'networkidle' }); await q.waitForTimeout(1500)
    if (sys === 'B') {
      // The baseline's KRI module is browser-local; its own indicator KRI-FIN-003 has red threshold 15, lower is worse.
      const around = async name => { const t = await text(q); const i = t.indexOf(name); return i < 0 ? null : t.slice(i, i + 400) }
      const card = q.locator('div', { hasText: 'Operating Cash Buffer' }).filter({ has: q.locator('button[title="Log metric reading"]') }).last()
      R.G4 = { indicator: 'KRI-FIN-003 Operating Cash Buffer (green 45, amber 30, red 15, lower-worse; baseline seed)', before: await around('Operating Cash Buffer') }
      await card.locator('button[title="Log metric reading"]').click(); await q.waitForTimeout(400)
      await q.getByPlaceholder('e.g. 15').first().fill('14')
      await q.getByRole('button', { name: 'Update' }).first().click(); await q.waitForTimeout(800)
      R.G4.after = await around('Operating Cash Buffer')
      R.G4.statusEnteredByUser = false // the quick-reading bar has a value field only
      R.G4.stored = await q.evaluate(() => { const k = Object.keys(localStorage).find(x => /kri/i.test(x)); return k ? JSON.parse(localStorage.getItem(k)).find?.(x => x.code === 'KRI-FIN-003') ?? null : null })
    } else {
      const around = async name => { const t = await text(q); const i = t.indexOf(name); return i < 0 ? null : t.slice(Math.max(0, i - 50), i + 400) }
      R.G4 = { indicator: 'KRI-EVAL-G4 (green 25, amber 20, red 15, LOWER_WORSE; seeded in the database)', before: await around('Eval G4 liquidity coverage') }
      await q.getByRole('button', { name: 'Record a reading for KRI-EVAL-G4' }).click(); await q.waitForTimeout(600)
      R.G4.formFields = await q.evaluate(() => [...document.querySelectorAll('[role=dialog] input, [role=dialog] select, [role=dialog] textarea')].map(el => el.id))
      await q.fill('#reading-value', '14')
      if (!(await q.inputValue('#reading-date'))) await q.fill('#reading-date', '2026-11-06')
      await q.locator('[role=dialog]').getByRole('button', { name: /record reading/i }).click(); await q.waitForTimeout(1500)
      R.G4.statusEnteredByUser = R.G4.formFields.some(f => /traffic|status|light/i.test(f))
      const readings = (await rows('erm_trn_kri_readings')).filter(r => Number(r.KRI_UUID) === 93001)
      R.G4.stored = readings[readings.length - 1] ?? null
      R.G4.after = await around('Eval G4 liquidity coverage')
    }
    await shot(q, sys, 'G4-kri')

    // ---------------------------------------------------------------- S4.2, baseline part: alter one stored audit entry in its audit store
    if (sys === 'B') {
      await q.goto(W + '/audit-trail', { waitUntil: 'networkidle' }); await q.waitForTimeout(1000)
      const tamper = await q.evaluate(() => {
        const key = 'pericope_audit_log_v1'
        const list = JSON.parse(localStorage.getItem(key) || '[]')
        const e = list[0]
        const from = e.description
        e.description = from.slice(0, -1) + (from.endsWith('x') ? 'y' : 'x')
        localStorage.setItem(key, JSON.stringify(list))
        return { id: e.id, from, to: e.description, entries: list.length }
      })
      await q.reload({ waitUntil: 'networkidle' }); await q.waitForTimeout(1500)
      const t = await text(q)
      R['S4.2'] = { tamper, alteredShown: t.includes(tamper.to), integrityWarning: /integrity|tamper|broken|modified|verification failed/i.test(t.replace(/Immutable chronological record/i, '')), verifyFunctionExists: false, text: t.slice(0, 2500) }
      await shot(q, sys, 'S4.2-audit-after-tamper')
    }
    R.pageErrors = errors.slice(0, 20)
    await ctx.close()
  }
  await b.close()
  fs.writeFileSync(EV + '/ui-scenarios.json', JSON.stringify(out, null, 2))
  const brief = s => JSON.stringify(s, (k, v) => (typeof v === 'string' && v.length > 300 ? v.slice(0, 300) + '…' : v), 1)
  for (const sys of ['B', 'E']) console.log(`\n===== ${sys}`, brief({ ...out[sys], heatmapText: undefined }))
})().catch(e => { console.error('SCRIPT ERROR', e); fs.writeFileSync(EV + '/ui-scenarios.partial.json', JSON.stringify(out, null, 2)); process.exit(1) })
