import { describe, expect, it } from 'vitest'
import { makeApp, xhr } from './helpers.js'

async function setup(role: Parameters<Awaited<ReturnType<typeof makeApp>>['addUser']>[0] = 'Risk Manager') {
  const env = await makeApp()
  env.fake.ensure('per_trn_identify_risk')
  env.fake.ensure('per_trn_control_implementation')
  env.fake.ensure('erm_trn_audit_log')
  await env.addUser(role, 'user@test.local')
  const agent = await env.login('user@test.local')
  return { ...env, agent }
}

const lastWrite = (fake: { calls: { method: string; body?: unknown }[] }, method: string) =>
  [...fake.calls].reverse().find(c => c.method === method && !(JSON.stringify(c.body ?? '').includes('ACTION_TYPE')))?.body as Record<string, unknown>

describe('reading data', () => {
  it('lists rows with OAuth and strips upstream links', async () => {
    const { agent, fake } = await setup('Viewer')
    fake.seed('per_trn_identify_risk', [{ uuid: 1, risk_statement: 'Vendor outage' }])
    const res = await agent.get('/api/per_trn_identify_risk?limit=50')
    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].risk_statement).toBe('Vendor outage')
    expect(JSON.stringify(res.body)).not.toMatch(/secret-host/)
    expect(fake.calls[0]!.auth).toMatch(/^Bearer tok-/)
  })

  it('rejects unknown tables, bad ids and unknown query params', async () => {
    const { agent } = await setup()
    expect((await agent.get('/api/all_secrets')).status).toBe(404)
    expect((await agent.get('/api/per_trn_identify_risk/..%2F..%2Fadmin')).status).toBe(400)
    expect((await agent.get('/api/per_trn_identify_risk/12abc')).status).toBe(400)
    expect((await agent.get('/api/per_trn_identify_risk?id=4')).status).toBe(400)
    expect((await agent.get('/api/per_trn_identify_risk?q=not-json')).status).toBe(400)
    expect((await agent.get('/api/__proto__')).status).toBe(404)
  })

  it('keeps identity tables for administrators only', async () => {
    const { agent, fake } = await setup('Risk Manager')
    fake.ensure('per_mst_user_details')
    expect((await agent.get('/api/per_mst_user_details')).status).toBe(403)
  })

  it('falls back to the legacy table spelling only when the first name does not exist', async () => {
    const { agent, fake } = await setup('Viewer')
    fake.seed('per_mst_control_clasification', [{ uuid: 7, name: 'Preventive' }])
    const res = await agent.get('/api/per_mst_control_classification')
    expect(res.status).toBe(200)
    expect(res.body.items[0].name).toBe('Preventive')
  })
})

describe('writing data', () => {
  it('keeps values the user sent — defaults only fill missing fields (approval regression)', async () => {
    const { agent, fake } = await setup('Risk Manager')
    const res = await agent.post('/api/per_trn_identify_risk').set(xhr).send({ risk_statement: 'Cloud failover delay', is_stage_complted: 'Y', approval_status: 'APPROVED', status: 'N' })
    expect(res.status).toBe(201)
    const body = lastWrite(fake, 'POST')
    expect(body.APPROVAL_STATUS).toBe('APPROVED')
    expect(body.IS_STAGE_COMPLTED).toBe('Y')
    expect(body.STATUS).toBe('N')
    expect(body.CREATED_ON).toBeTypeOf('string')
  })

  it('applies defaults on create when fields are missing', async () => {
    const { agent, fake } = await setup('Assessor')
    await agent.post('/api/per_trn_identify_risk').set(xhr).send({ risk_statement: 'Fraud' })
    const body = lastWrite(fake, 'POST')
    expect(body).toMatchObject({ APPROVAL_STATUS: 'DRAFT', IS_STAGE_COMPLTED: 'N', STATUS: 'Y' })
  })

  it('persists approval on update and does not wipe other columns (ORDS PUT replaces rows)', async () => {
    const { agent, fake } = await setup('Risk Manager')
    fake.seed('per_trn_identify_risk', [{ uuid: 5, risk_statement: 'Keep me', risk_owner: 'Priya', approval_status: 'DRAFT', inherent_sle: 120000 }])
    const res = await agent.put('/api/per_trn_identify_risk/5').set(xhr).send({ approval_status: 'APPROVED' })
    expect(res.status).toBe(200)
    const stored = fake.tables.get('per_trn_identify_risk')!.get(5)!
    expect(stored.APPROVAL_STATUS).toBe('APPROVED')
    expect(stored.RISK_STATEMENT).toBe('Keep me')
    expect(stored.RISK_OWNER).toBe('Priya')
    expect(stored.INHERENT_SLE).toBe(120000)
    expect(stored.APPROVED_ON).toBeTypeOf('string')
  })

  it('only approvers can approve or reject', async () => {
    const { agent, fake } = await setup('Assessor')
    fake.seed('per_trn_identify_risk', [{ uuid: 5, risk_statement: 'x' }])
    expect((await agent.put('/api/per_trn_identify_risk/5').set(xhr).send({ approval_status: 'APPROVED' })).status).toBe(403)
    expect((await agent.post('/api/per_trn_identify_risk').set(xhr).send({ risk_statement: 'y', approval_status: 'REJECTED' })).status).toBe(403)
    expect((await agent.put('/api/per_trn_identify_risk/5').set(xhr).send({ approval_status: 'SUBMITTED' })).status).toBe(200)
  })

  it('enforces role permissions', async () => {
    const viewer = await setup('Viewer')
    expect((await viewer.agent.post('/api/per_trn_identify_risk').set(xhr).send({ risk_statement: 'x' })).status).toBe(403)
    const assessor = await setup('Assessor')
    assessor.fake.seed('per_trn_identify_risk', [{ uuid: 9 }])
    expect((await assessor.agent.delete('/api/per_trn_identify_risk/9').set(xhr)).status).toBe(403)
    const manager = await setup('Risk Manager')
    manager.fake.seed('per_trn_identify_risk', [{ uuid: 9 }])
    expect((await manager.agent.delete('/api/per_trn_identify_risk/9').set(xhr)).status).toBe(204)
  })

  it('reference tables are read-only', async () => {
    const { agent } = await setup('Administrator')
    expect((await agent.post('/api/per_mst_risk_category').set(xhr).send({ name: 'x' })).status).toBe(405)
    expect((await agent.delete('/api/per_mst_roles/1').set(xhr)).status).toBe(405)
  })

  it('validates types and reports ignored fields instead of silently dropping them', async () => {
    const { agent, fake } = await setup()
    const bad = await agent.post('/api/per_trn_identify_risk').set(xhr).send({ risk_statement: 'x', inherent_sle: 'lots', start_date: 'yesterday', is_sop_available: 'maybe' })
    expect(bad.status).toBe(400)
    expect(bad.body.error.code).toBe('VALIDATION_FAILED')
    expect(bad.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['INHERENT_SLE', 'IS_SOP_AVAILABLE', 'START_DATE'])

    const ok = await agent.post('/api/per_trn_identify_risk').set(xhr).send({ risk_statement: 'x', inherent_sle: '90000', identify_risk_uuid: 12, justification: 'why', start_date: '2026-05-01' })
    expect(ok.status).toBe(201)
    expect(ok.headers['x-ignored-fields']).toBe('justification')
    const body = lastWrite(fake, 'POST')
    expect(body.INHERENT_SLE).toBe(90000)
    expect(body.IDENTIFY_RISK_UUID).toBe(12) // links risk → assessment (used to be dropped)
    expect(body.START_DATE).toBe('2026-05-01T00:00:00.000Z')
  })

  it('accepts names like "rhythms" that the old junk filter rejected', async () => {
    const { agent } = await setup()
    expect((await agent.post('/api/per_trn_identify_risk').set(xhr).send({ risk_statement: 'rhythms' })).status).toBe(201)
  })

  it('rejects non-numeric control owners instead of silently saving 1', async () => {
    const { agent } = await setup()
    const res = await agent.post('/api/per_trn_control_implementation').set(xhr).send({ control_owner: 'IT Security' })
    expect(res.status).toBe(400)
  })

  it('requires required fields on create', async () => {
    const { agent, fake } = await setup()
    fake.ensure('erm_mst_kri_definition')
    const res = await agent.post('/api/erm_mst_kri_definition').set(xhr).send({ kri_name: 'Cash buffer' })
    expect(res.status).toBe(400)
    expect(res.body.error.details[0].field).toBe('KRI_CODE')
  })
})

describe('database failures are reported, never faked', () => {
  it('returns 503 when the database is unreachable and stores nothing', async () => {
    const { agent, fake, ctx } = await setup()
    fake.mode = 'down'
    const res = await agent.post('/api/per_trn_identify_risk').set(xhr).send({ risk_statement: 'x' })
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('DB_UNAVAILABLE')
    expect(JSON.stringify(res.body)).not.toMatch(/db\.example/)
    const list = await agent.get('/api/per_trn_identify_risk')
    expect(list.status).toBe(503) // not an empty 200
    const failures = ctx.audit.query({ limit: 10, offset: 0 }).items.filter(e => e.result === 'FAILURE')
    expect(failures.length).toBeGreaterThan(0)
  })

  it('reports deletes of missing rows as 404 instead of success', async () => {
    const { agent } = await setup()
    expect((await agent.delete('/api/per_trn_identify_risk/999999').set(xhr)).status).toBe(404)
  })

  it('does not create ghost rows when updating a missing id', async () => {
    const { agent, fake } = await setup()
    expect((await agent.put('/api/per_trn_identify_risk/424242').set(xhr).send({ risk_statement: 'ghost' })).status).toBe(404)
    expect(fake.tables.get('per_trn_identify_risk')!.has(424242)).toBe(false)
  })

  it('a 404 on one row does not disable the whole table', async () => {
    const { agent, fake } = await setup()
    await agent.get('/api/per_trn_identify_risk/999')
    fake.seed('per_trn_identify_risk', [{ uuid: 1, risk_statement: 'still here' }])
    const res = await agent.get('/api/per_trn_identify_risk')
    expect(res.body.items).toHaveLength(1)
  })

  it('maps Oracle constraint errors to a readable 422', async () => {
    const { agent, fake } = await setup()
    fake.mode = 'reject_fk'
    const res = await agent.post('/api/per_trn_identify_risk').set(xhr).send({ risk_statement: 'x', risk_type_uuid: 999 })
    expect(res.status).toBe(422)
    expect(res.body.error.message).toMatch(/linked record does not exist/i)
    expect(res.body.error.message).not.toMatch(/GRC\.FK_X/)
  })

  it('maps timeouts to 504', async () => {
    const { agent, fake } = await setup()
    fake.mode = 'timeout'
    expect((await agent.get('/api/per_trn_identify_risk')).status).toBe(504)
  })

  it('recovers after a token failure instead of switching to anonymous mode forever', async () => {
    const { agent, fake, ctx } = await setup()
    ;(ctx.ords as unknown as { invalidateToken(): void }).invalidateToken()
    fake.mode = 'token_fail'
    const first = await agent.get('/api/per_trn_identify_risk')
    expect(first.status).toBe(503)
    expect(first.body.error.code).toBe('DB_AUTH_FAILED')
    fake.mode = 'ok'
    await new Promise(r => setTimeout(r, 5100)) // token retry cooldown
    const second = await agent.get('/api/per_trn_identify_risk')
    expect(second.status).toBe(200)
    expect(fake.calls.at(-1)!.auth).toMatch(/^Bearer /)
  }, 10_000)

  it('refuses to call the database anonymously unless explicitly allowed', async () => {
    const env = await makeApp({ env: { ORDS_CLIENT_ID: '', ORDS_CLIENT_SECRET: '' } })
    await env.addUser('Viewer', 'v@test.local')
    const agent = await env.login('v@test.local')
    const res = await agent.get('/api/per_trn_identify_risk')
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('DB_NOT_CONFIGURED')
  })
})
