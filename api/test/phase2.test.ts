import { describe, expect, it } from 'vitest'
import { makeApp, xhr } from './helpers.js'
import type { Role } from '../src/auth/permissions.js'

async function env(role: Role = 'Risk Manager', tables: string[] = []) {
  const e = await makeApp()
  for (const t of ['per_trn_identify_risk', 'erm_trn_approval_request', 'erm_trn_approval_step', 'erm_mst_app_setting', ...tables]) e.fake.ensure(t)
  await e.addUser(role, 'me@test.local')
  return { ...e, agent: await e.login('me@test.local') }
}

describe('managed listing: search, sort, filter, paging', () => {
  async function seeded() {
    const e = await env('Viewer')
    e.fake.seed('per_trn_identify_risk', [
      { uuid: 1, risk_statement: 'Vendor OUTAGE at payment processor', process_name: 'Finance', inherent_sle: 50000 },
      { uuid: 2, risk_statement: 'Phishing leads to account takeover', process_name: 'IT', inherent_sle: 120000 },
      { uuid: 3, risk_statement: 'Data centre outage', process_name: 'IT', inherent_sle: null },
      { uuid: 4, risk_statement: 'Fraudulent refunds', process_name: 'Retail', inherent_sle: 9000 },
    ])
    return e
  }

  it('searches case-insensitively across the declared columns with a real total', async () => {
    const { agent } = await seeded()
    const res = await agent.get('/api/per_trn_identify_risk').query({ search: 'outage', page: 1, pageSize: 10 })
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(2)
    expect(res.body.items.map((r: { uuid: number }) => r.uuid).sort()).toEqual([1, 3])
  })

  it('sorts (nulls last), filters and pages', async () => {
    const { agent } = await seeded()
    const sorted = await agent.get('/api/per_trn_identify_risk').query({ sort: 'inherent_sle', order: 'desc', page: 1, pageSize: 2 })
    expect(sorted.body.items.map((r: { uuid: number }) => r.uuid)).toEqual([2, 1])
    expect(sorted.body).toMatchObject({ total: 4, page: 1, pageSize: 2, pageCount: 2, truncated: false })
    const page2 = await agent.get('/api/per_trn_identify_risk').query({ sort: 'inherent_sle', order: 'desc', page: 2, pageSize: 2 })
    expect(page2.body.items.map((r: { uuid: number }) => r.uuid)).toEqual([4, 3])
    const filtered = await agent.get('/api/per_trn_identify_risk').query({ filter: JSON.stringify({ process_name: ['it', 'Retail'] }), pageSize: 50 })
    expect(filtered.body.total).toBe(3)
  })

  it('rejects bad sort and filter parameters', async () => {
    const { agent } = await seeded()
    expect((await agent.get('/api/per_trn_identify_risk').query({ sort: 'x; drop' })).status).toBe(400)
    expect((await agent.get('/api/per_trn_identify_risk').query({ filter: '[1]' })).status).toBe(400)
    expect((await agent.get('/api/per_trn_identify_risk').query({ filter: JSON.stringify({ a: { $gt: 1 } }) })).status).toBe(400)
    expect((await agent.get('/api/per_trn_identify_risk').query({ pageSize: 5000 })).status).toBe(400)
  })

  it('says a module is not set up yet when its table is missing', async () => {
    const { agent } = await env('Risk Manager')
    const res = await agent.get('/api/erm_mst_vendor').query({ page: 1 })
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('NOT_PROVISIONED')
    const create = await agent.post('/api/erm_mst_vendor').set(xhr).send({ vendor_name: 'X', tier: 'Low' })
    expect(create.body.error.code).toBe('NOT_PROVISIONED')
  })
})

describe('module tables', () => {
  it('validate enums (any case, stored canonically), ranges, ratings and e-mails', async () => {
    const { agent, fake } = await env('Risk Manager', ['erm_mst_vendor', 'erm_mst_control'])
    const ok = await agent.post('/api/erm_mst_vendor').set(xhr).send({ vendor_name: 'Cloudbase', tier: 'critical', risk_score: 78, contact_email: 'Partners@Cloudbase.io' })
    expect(ok.status).toBe(201)
    const row = [...fake.tables.get('erm_mst_vendor')!.values()][0]!
    expect(row).toMatchObject({ TIER: 'Critical', RISK_SCORE: 78, CONTACT_EMAIL: 'partners@cloudbase.io', STATUS: 'Active', OPEN_FINDINGS: 0, CREATED_BY: 'me@test.local' })
    const bad = await agent.post('/api/erm_mst_vendor').set(xhr).send({ vendor_name: 'X', tier: 'Huge', risk_score: 150, contact_email: 'nope' })
    expect(bad.status).toBe(400)
    expect(bad.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['CONTACT_EMAIL', 'RISK_SCORE', 'TIER'])
    const rating = await agent.post('/api/erm_mst_control').set(xhr).send({ control_code: 'C-1', control_name: 'MFA', design_effectiveness: 6 })
    expect(rating.status).toBe(400)
  })

  it('risk appetite can only be changed by approvers', async () => {
    const assessor = await env('Assessor', ['erm_mst_risk_appetite'])
    const body = { category: 'Financial', statement: 'Low appetite for FX losses', posture: 'Cautious', tolerance_score: 9 }
    expect((await assessor.agent.post('/api/erm_mst_risk_appetite').set(xhr).send(body)).status).toBe(403)
    const manager = await env('Risk Manager', ['erm_mst_risk_appetite'])
    expect((await manager.agent.post('/api/erm_mst_risk_appetite').set(xhr).send(body)).status).toBe(201)
    expect((await manager.agent.post('/api/erm_mst_risk_appetite').set(xhr).send({ ...body, tolerance_score: 30 })).status).toBe(400)
  })

  it('editors can remove links between records, but not delete the records themselves', async () => {
    const { agent, fake } = await env('Assessor', ['erm_lnk_control_risk', 'erm_lnk_incident_risk', 'erm_lnk_policy_control', 'erm_mst_control'])
    fake.seed('erm_lnk_control_risk', [{ uuid: 7, control_uuid: 1, risk_uuid: 2 }])
    fake.seed('erm_mst_control', [{ uuid: 1, control_code: 'C-1', control_name: 'MFA' }])
    expect((await agent.delete('/api/erm_lnk_control_risk/7').set(xhr)).status).toBe(204)
    expect((await agent.delete('/api/erm_mst_control/1').set(xhr)).status).toBe(403)
    const viewer = await env('Viewer', ['erm_lnk_control_risk'])
    viewer.fake.seed('erm_lnk_control_risk', [{ uuid: 8, control_uuid: 1, risk_uuid: 2 }])
    expect((await viewer.agent.delete('/api/erm_lnk_control_risk/8').set(xhr)).status).toBe(403)
  })

  it('stores likelihood and impact ratings on the risk register', async () => {
    const { agent, fake } = await env('Assessor')
    const res = await agent.post('/api/per_trn_identify_risk').set(xhr).send({ risk_statement: 'x', inherent_likelihood: 4, inherent_impact: '5' })
    expect(res.status).toBe(201)
    expect([...fake.tables.get('per_trn_identify_risk')!.values()][0]).toMatchObject({ INHERENT_LIKELIHOOD: 4, INHERENT_IMPACT: 5 })
    expect((await agent.post('/api/per_trn_identify_risk').set(xhr).send({ risk_statement: 'x', inherent_likelihood: 0 })).status).toBe(400)
  })

  it('approval workflow tables cannot be written directly', async () => {
    const { agent } = await env('Administrator')
    expect((await agent.post('/api/erm_trn_approval_request').set(xhr).send({ title: 'x' })).status).toBe(405)
    expect((await agent.post('/api/erm_mst_app_setting').set(xhr).send({})).status).toBe(404)
  })
})

describe('approval workflow (maker-checker)', () => {
  async function setup() {
    const e = await makeApp()
    for (const t of ['erm_trn_approval_request', 'erm_trn_approval_step']) e.fake.ensure(t)
    await e.addUser('Assessor', 'maker@test.local')
    await e.addUser('Risk Manager', 'rm@test.local')
    await e.addUser('Risk Manager', 'rm2@test.local')
    await e.addUser('Administrator', 'admin@test.local')
    const maker = await e.login('maker@test.local')
    const submit = await maker.post('/api/workflow').set(xhr).send({ title: 'Accept residual FX risk', request_type: 'Risk Acceptance', amount: 250000, approver_roles: ['Risk Manager', 'Administrator'] })
    return { ...e, maker, request: submit.body, submit }
  }

  it('records the submitter from the session and creates ordered steps', async () => {
    const { submit } = await setup()
    expect(submit.status).toBe(201)
    expect(submit.body).toMatchObject({ status: 'Pending', submitted_by: 'maker@test.local', next_step: 1, can_decide: false })
    expect(submit.body.steps.map((s: { approver_role: string }) => s.approver_role)).toEqual(['Risk Manager', 'Administrator'])
    expect(submit.body.blocked_reason).toMatch(/Only Risk Managers/)
  })

  it('walks a request through both steps with the right people', async () => {
    const { request, login } = await setup()
    const rm = await login('rm@test.local')
    const step1 = await rm.post(`/api/workflow/${request.uuid}/decision`).set(xhr).send({ decision: 'Approved', comment: 'Within appetite' })
    expect(step1.status).toBe(200)
    expect(step1.body).toMatchObject({ status: 'In Review', next_step: 2 })
    expect(step1.body.steps[0]).toMatchObject({ decision: 'Approved', decided_by: 'rm@test.local' })

    const rm2 = await login('rm2@test.local')
    const wrongRole = await rm2.post(`/api/workflow/${request.uuid}/decision`).set(xhr).send({ decision: 'Approved' })
    expect(wrongRole.status).toBe(403)
    expect(wrongRole.body.error.message).toMatch(/needs a Administrator/)

    const admin = await login('admin@test.local')
    const step2 = await admin.post(`/api/workflow/${request.uuid}/decision`).set(xhr).send({ decision: 'Approved' })
    expect(step2.body).toMatchObject({ status: 'Approved', next_step: null })
    expect(step2.body.closed_on).toBeTypeOf('string')
    expect((await admin.post(`/api/workflow/${request.uuid}/decision`).set(xhr).send({ decision: 'Approved' })).status).toBe(403)
  })

  it('nobody approves their own request, or two steps of the same request', async () => {
    const { login } = await setup()
    const admin = await login('admin@test.local')
    const own = await admin.post('/api/workflow').set(xhr).send({ title: 'Admin request', request_type: 'Control Change', approver_roles: ['Risk Manager', 'Administrator'] })
    const selfDecision = await admin.post(`/api/workflow/${own.body.uuid}/decision`).set(xhr).send({ decision: 'Approved' })
    expect(selfDecision.status).toBe(403)
    expect(selfDecision.body.error.message).toMatch(/submitted/)

    const rm = await login('rm@test.local')
    const twoStep = await rm.post('/api/workflow').set(xhr).send({ title: 'Needs two RMs', request_type: 'Policy Update', approver_roles: ['Risk Manager', 'Risk Manager'] })
    const otherAdmin = await login('admin@test.local')
    await otherAdmin.post(`/api/workflow/${twoStep.body.uuid}/decision`).set(xhr).send({ decision: 'Approved' })
    const again = await otherAdmin.post(`/api/workflow/${twoStep.body.uuid}/decision`).set(xhr).send({ decision: 'Approved' })
    expect(again.status).toBe(403)
    expect(again.body.error.message).toMatch(/already signed/)
  })

  it('a rejection needs a comment and closes the request', async () => {
    const { request, login } = await setup()
    const rm = await login('rm@test.local')
    expect((await rm.post(`/api/workflow/${request.uuid}/decision`).set(xhr).send({ decision: 'Rejected' })).status).toBe(400)
    const res = await rm.post(`/api/workflow/${request.uuid}/decision`).set(xhr).send({ decision: 'Rejected', comment: 'Exceeds tolerance' })
    expect(res.body.status).toBe('Rejected')
  })

  it('a step decided by someone else in the meantime is not overwritten', async () => {
    const { request, login, fake } = await setup()
    const rm = await login('rm@test.local')
    fake.beforePut = () => {
      const step = [...fake.tables.get('erm_trn_approval_step')!.values()].find(s => s.REQUEST_UUID === request.uuid && s.STEP_NO === 1)!
      step.DECISION = 'Rejected'
      step.COMMENTS = 'raced'
      fake.beforePut = undefined
    }
    const res = await rm.post(`/api/workflow/${request.uuid}/decision`).set(xhr).send({ decision: 'Approved' })
    expect(res.status).toBe(409)
  })

  it('only the submitter can withdraw, and only while open', async () => {
    const { request, login, maker } = await setup()
    const rm = await login('rm@test.local')
    expect((await rm.post(`/api/workflow/${request.uuid}/withdraw`).set(xhr)).status).toBe(403)
    expect((await maker.post(`/api/workflow/${request.uuid}/withdraw`).set(xhr)).body.status).toBe('Withdrawn')
    expect((await maker.post(`/api/workflow/${request.uuid}/withdraw`).set(xhr)).status).toBe(409)
  })

  it('lists what the signed-in user can decide', async () => {
    const { login } = await setup()
    const rm = await login('rm@test.local')
    const res = await rm.get('/api/workflow').query({ mine: 'to-decide' })
    expect(res.body.total).toBe(1)
    expect(res.body.items[0].can_decide).toBe(true)
  })

  it('audits decisions', async () => {
    const { request, login, ctx } = await setup()
    const rm = await login('rm@test.local')
    await rm.post(`/api/workflow/${request.uuid}/decision`).set(xhr).send({ decision: 'Approved' })
    const entry = ctx.audit.query({ limit: 5, offset: 0, action: 'APPROVE' }).items[0]!
    expect(entry).toMatchObject({ actor_email: 'rm@test.local', entity: 'Approval request' })
  })
})

describe('settings', () => {
  it('falls back to defaults when storage is not set up', async () => {
    const e = await makeApp()
    await e.addUser('Viewer', 'v@test.local')
    const agent = await e.login('v@test.local')
    const res = await agent.get('/api/settings')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ stored: false, reason: 'not_provisioned', settings: { currency: 'USD' } })
  })

  it('only administrators save, values are validated, and changes are audited', async () => {
    const { agent, ctx } = await env('Administrator')
    const settings = { orgName: 'Acme Bank', industry: 'Banking', currency: 'INR', idleTimeoutMinutes: 20, riskBands: { moderate: 6, high: 10, critical: 15 } }
    expect((await agent.put('/api/settings').set(xhr).send({ ...settings, riskBands: { moderate: 10, high: 8, critical: 15 } })).status).toBe(400)
    expect((await agent.put('/api/settings').set(xhr).send({ ...settings, mfa: true })).status).toBe(400)
    const saved = await agent.put('/api/settings').set(xhr).send(settings)
    expect(saved.status).toBe(200)
    expect((await agent.get('/api/settings')).body).toMatchObject({ stored: true, settings })
    await agent.put('/api/settings').set(xhr).send({ ...settings, currency: 'EUR' })
    const entry = ctx.audit.query({ limit: 1, offset: 0, action: 'SETTINGS_CHANGE' }).items[0]!
    expect(entry.description).toBe('Changed currency')

    const viewer = await env('Viewer')
    expect((await viewer.agent.put('/api/settings').set(xhr).send(settings)).status).toBe(403)
  })
})

describe('review fixes (phase 2)', () => {
  it('an approver cannot approve a risk they created; another approver can', async () => {
    const e = await makeApp()
    e.fake.ensure('per_trn_identify_risk')
    await e.addUser('Risk Manager', 'rm1@test.local')
    await e.addUser('Risk Manager', 'rm2@test.local')
    const rm1 = await e.login('rm1@test.local')
    const created = await rm1.post('/api/per_trn_identify_risk').set(xhr).send({ risk_statement: 'Self-approved?' })
    const own = await rm1.patch(`/api/per_trn_identify_risk/${created.body.uuid}`).set(xhr).send({ approval_status: 'APPROVED' })
    expect(own.status).toBe(403)
    expect(own.body.error.message).toMatch(/created/)
    const rm2 = await e.login('rm2@test.local')
    expect((await rm2.patch(`/api/per_trn_identify_risk/${created.body.uuid}`).set(xhr).send({ approval_status: 'APPROVED' })).status).toBe(200)
  })

  it('all=1 returns every matching row in one response', async () => {
    const { agent, fake } = await env('Viewer')
    fake.seed('per_trn_identify_risk', Array.from({ length: 1203 }, (_, i) => ({ uuid: i + 1, risk_statement: `r${i}` })))
    const res = await agent.get('/api/per_trn_identify_risk').query({ all: 1 })
    expect(res.body).toMatchObject({ total: 1203, truncated: false })
    expect(res.body.items).toHaveLength(1203)
  })

  it('filters accept long lists (link pickers)', async () => {
    const { agent } = await env('Viewer')
    const ids = Array.from({ length: 300 }, (_, i) => i + 1)
    expect((await agent.get('/api/per_trn_identify_risk').query({ filter: JSON.stringify({ uuid: ids }), pageSize: 10 })).status).toBe(200)
  })

  it('an idle-timeout sign-out ends only this device', async () => {
    const e = await makeApp()
    await e.addUser('Assessor', 'a@test.local')
    const tabA = await e.login('a@test.local')
    const tabB = await e.login('a@test.local')
    await tabA.post('/api/auth/logout').set(xhr).send({ allDevices: false })
    expect((await tabA.get('/api/auth/me')).status).toBe(401)
    expect((await tabB.get('/api/auth/me')).status).toBe(200)
    await tabB.post('/api/auth/logout').set(xhr).send({})
    expect((await tabB.get('/api/auth/me')).status).toBe(401)
  })
})

describe('rate limiting', () => {
  it('is per signed-in user, so colleagues behind one IP do not throttle each other', async () => {
    const e = await makeApp({ env: { RATE_LIMIT_PER_MINUTE: '5' } })
    e.fake.ensure('per_trn_identify_risk')
    await e.addUser('Viewer', 'a@test.local')
    await e.addUser('Viewer', 'b@test.local')
    const a = await e.login('a@test.local')
    const b = await e.login('b@test.local')
    for (let i = 0; i < 5; i++) await a.get('/api/per_trn_identify_risk')
    expect((await a.get('/api/per_trn_identify_risk')).status).toBe(429)
    expect((await b.get('/api/per_trn_identify_risk')).status).toBe(200)
  })
})
