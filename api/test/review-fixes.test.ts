import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { makeApp, xhr } from './helpers.js'

async function as(role: 'Assessor' | 'Risk Manager' | 'Viewer' | 'Administrator') {
  const env = await makeApp()
  env.fake.ensure('per_trn_identify_risk')
  await env.addUser(role, 'user@test.local')
  return { ...env, agent: await env.login('user@test.local') }
}

describe('approval integrity', () => {
  it('approver-only fields cannot be set by an Assessor, and APPROVED_* are never client-writable', async () => {
    const { agent, fake } = await as('Assessor')
    const comments = await agent.post('/api/per_trn_identify_risk').set(xhr).send({ risk_statement: 'x', approver_comments: 'looks good' })
    expect(comments.status).toBe(403)
    const forged = await agent.post('/api/per_trn_identify_risk').set(xhr).send({ risk_statement: 'x', approval_status: 'pending', approved_by: 'boss@x', approved_on: '2024-01-01' })
    expect(forged.status).toBe(201)
    expect(forged.headers['x-ignored-fields']).toBe('approved_by,approved_on')
    const stored = [...fake.tables.get('per_trn_identify_risk')!.values()].at(-1)!
    expect(stored.APPROVED_BY).toBeUndefined()
    expect(stored.APPROVED_ON).toBeUndefined()
  })

  it('an Assessor editing an approved record sends it back for review', async () => {
    const { agent, fake, ctx } = await as('Assessor')
    fake.seed('per_trn_identify_risk', [{ uuid: 5, risk_statement: 'Signed off', approval_status: 'APPROVED', approved_on: '2026-10-01T00:00:00.000Z' }])
    const res = await agent.patch('/api/per_trn_identify_risk/5').set(xhr).send({ risk_statement: 'Quietly changed' })
    expect(res.status).toBe(200)
    const row = fake.tables.get('per_trn_identify_risk')!.get(5)!
    expect(row.RISK_STATEMENT).toBe('Quietly changed')
    expect(row.APPROVAL_STATUS).toBe('SUBMITTED')
    expect(row.APPROVED_ON).toBeNull()
    expect(ctx.audit.query({ limit: 5, offset: 0, action: 'UPDATE' }).items[0]!.description).toMatch(/sent back for review/)
  })

  it('an Assessor cannot clear the status of an approved record', async () => {
    const { agent, fake } = await as('Assessor')
    fake.seed('per_trn_identify_risk', [{ uuid: 6, approval_status: 'APPROVED' }])
    await agent.patch('/api/per_trn_identify_risk/6').set(xhr).send({ approval_status: null })
    expect(fake.tables.get('per_trn_identify_risk')!.get(6)!.APPROVAL_STATUS).toBe('SUBMITTED')
  })

  it('the server stamps APPROVED_ON on approval and clears it when reopened', async () => {
    const { agent, fake } = await as('Risk Manager')
    fake.seed('per_trn_identify_risk', [{ uuid: 7, approval_status: 'SUBMITTED' }])
    await agent.patch('/api/per_trn_identify_risk/7').set(xhr).send({ approval_status: 'APPROVED', approver_comments: 'ok' })
    expect(fake.tables.get('per_trn_identify_risk')!.get(7)!.APPROVED_ON).toBeTypeOf('string')
    await agent.patch('/api/per_trn_identify_risk/7').set(xhr).send({ approval_status: 'DRAFT' })
    expect(fake.tables.get('per_trn_identify_risk')!.get(7)!.APPROVED_ON).toBeNull()
  })
})

describe('updates', () => {
  it('preserve columns the API does not know about', async () => {
    const { agent, fake } = await as('Risk Manager')
    fake.seed('per_trn_identify_risk', [{ uuid: 8, risk_statement: 'a', created_by: 'priya', legacy_column: 42 }])
    await agent.patch('/api/per_trn_identify_risk/8').set(xhr).send({ risk_statement: 'b' })
    const row = fake.tables.get('per_trn_identify_risk')!.get(8)!
    expect(row).toMatchObject({ RISK_STATEMENT: 'b', CREATED_BY: 'priya', LEGACY_COLUMN: 42 })
  })

  it('detect a concurrent change (ETag) instead of overwriting it', async () => {
    const { agent, fake } = await as('Risk Manager')
    fake.seed('per_trn_identify_risk', [{ uuid: 9, risk_statement: 'a' }])
    fake.beforePut = () => {
      fake.tables.get('per_trn_identify_risk')!.get(9)!.RISK_STATEMENT = 'changed by someone else'
      fake.beforePut = undefined
    }
    const res = await agent.patch('/api/per_trn_identify_risk/9').set(xhr).send({ risk_statement: 'mine' })
    expect(res.status).toBe(409)
    expect(fake.tables.get('per_trn_identify_risk')!.get(9)!.RISK_STATEMENT).toBe('changed by someone else')
  })

  it('odd field names cannot crash the response after the write', async () => {
    const { agent } = await as('Risk Manager')
    const res = await agent.post('/api/per_trn_identify_risk').set(xhr).send({ risk_statement: 'x', 'bad€key': 1, 'line\nbreak': 2 })
    expect(res.status).toBe(201)
    expect(res.headers['x-ignored-fields']).toBeUndefined()
  })

  it('historical ($asof) queries are refused', async () => {
    const { agent } = await as('Viewer')
    expect((await agent.get('/api/per_trn_identify_risk').query({ q: JSON.stringify({ $asof: { $timestamp: '2020-01-01' } }) })).status).toBe(400)
  })
})

describe('users', () => {
  it('concurrent creates with the same email produce one user', async () => {
    const { addUser, login, ctx } = await makeApp()
    await addUser('Administrator', 'admin@test.local')
    const admin = await login('admin@test.local')
    const body = { email: 'twin@test.local', name: 'Twin', role: 'Viewer', password: 'Welcome-pass-2026' }
    const [a, b] = await Promise.all([admin.post('/api/users').set(xhr).send(body), admin.post('/api/users').set(xhr).send(body)])
    expect([a.status, b.status].sort()).toEqual([201, 409])
    expect(ctx.users.list().filter(u => u.email === 'twin@test.local')).toHaveLength(1)
  })
})

describe('audit log hardening', () => {
  it('browser events need the matching permission, cannot be approvals, and are labelled', async () => {
    const { agent } = await as('Viewer')
    expect((await agent.post('/api/audit').set(xhr).send({ action: 'DELETE', entity: 'Policy', description: 'x' })).status).toBe(403)
    expect((await agent.post('/api/audit').set(xhr).send({ action: 'APPROVE', entity: 'Policy', description: 'x' })).status).toBe(400)
    const ok = await agent.post('/api/audit').set(xhr).send({ action: 'EXPORT', entity: 'Report', description: 'x' })
    expect(ok.status).toBe(201)
    expect(ok.body.entity).toBe('Browser: Report')
  })

  it('detects entries removed from the end', async () => {
    const { agent, dataDir } = await as('Administrator')
    for (let i = 0; i < 3; i++) await agent.post('/api/audit').set(xhr).send({ action: 'EXPORT', entity: 'R', description: `e${i}` })
    const file = join(dataDir, 'audit.jsonl')
    const lines = readFileSync(file, 'utf8').trim().split('\n')
    writeFileSync(file, lines.slice(0, -2).join('\n') + '\n')
    const res = await agent.get('/api/audit/verify')
    expect(res.body.valid).toBe(false)
    expect(res.body.reason).toMatch(/missing from the end/)
  })

  it('a chain recomputed without the server key does not verify', async () => {
    const { agent, dataDir } = await as('Administrator')
    await agent.post('/api/audit').set(xhr).send({ action: 'EXPORT', entity: 'R', description: 'original' })
    const file = join(dataDir, 'audit.jsonl')
    let prev = '0'.repeat(64)
    const forged = readFileSync(file, 'utf8').trim().split('\n').map(line => {
      const e = JSON.parse(line)
      e.description = e.description.replace('original', 'forged')
      e.prev_hash = prev
      const canonical = JSON.stringify([e.seq, e.id, e.timestamp, e.actor_id, e.actor_name, e.actor_email, e.actor_role, e.action, e.entity, e.entity_id, e.description, e.result, e.source, e.ip, e.changes, e.prev_hash])
      e.hash = createHash('sha256').update(canonical).digest('hex')
      prev = e.hash
      return JSON.stringify(e)
    })
    writeFileSync(file, forged.join('\n') + '\n')
    expect((await agent.get('/api/audit/verify')).body.valid).toBe(false)
  })
})
