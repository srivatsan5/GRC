import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { makeApp, PASSWORD, xhr } from './helpers.js'

describe('audit trail', () => {
  it('records data changes with the real user and a valid hash chain', async () => {
    const { addUser, login, fake } = await makeApp()
    fake.ensure('per_trn_identify_risk')
    fake.ensure('erm_trn_audit_log')
    await addUser('Risk Manager', 'rm@test.local')
    const agent = await login('rm@test.local')
    await agent.post('/api/per_trn_identify_risk').set(xhr).send({ risk_statement: 'Vendor outage' })

    const res = await agent.get('/api/audit?action=CREATE')
    expect(res.status).toBe(200)
    expect(res.body.items[0]).toMatchObject({ actor_email: 'rm@test.local', actor_role: 'Risk Manager', action: 'CREATE', result: 'SUCCESS' })
    expect((await agent.get('/api/audit/verify')).body).toMatchObject({ valid: true })

    // mirrored to Oracle with the real actor
    await new Promise(r => setTimeout(r, 20))
    const mirrored = [...fake.tables.get('erm_trn_audit_log')!.values()]
    expect(mirrored.some(r => String(r.ACTOR_NAME).includes('rm@test.local') && r.ACTION_TYPE === 'CREATE')).toBe(true)
  })

  it('detects tampering with the log file', async () => {
    const { addUser, login, dataDir } = await makeApp()
    await addUser('Administrator', 'admin@test.local')
    const agent = await login('admin@test.local')
    await agent.post('/api/audit').set(xhr).send({ action: 'EXPORT', entity: 'Report', description: 'Exported board pack' })
    const file = join(dataDir, 'audit.jsonl')
    writeFileSync(file, readFileSync(file, 'utf8').replace('Exported board pack', 'Nothing happened'))
    const res = await agent.get('/api/audit/verify')
    expect(res.body.valid).toBe(false)
    expect(res.body.reason).toBe('entry was modified')
  })

  it('UI events are attributed to the signed-in user, whatever the body claims', async () => {
    const { addUser, login } = await makeApp()
    await addUser('Administrator', 'admin@test.local')
    await addUser('Assessor', 'a@test.local')
    const agent = await login('a@test.local')
    const res = await agent.post('/api/audit').set(xhr).send({ action: 'APPROVE', entity: 'Policy', description: 'forged', actor_name: 'CEO', actor_role: 'Administrator' })
    expect(res.status).toBe(201)
    expect(res.body.actor_email).toBe('a@test.local')
    expect(res.body.actor_role).toBe('Assessor')
    expect(res.body.source).toBe('ui')
  })

  it('anonymous users cannot write and viewers cannot read the audit trail', async () => {
    const { app, addUser, login } = await makeApp()
    expect((await request(app).post('/api/audit').set(xhr).send({ action: 'APPROVE', entity: 'x', description: 'forged' })).status).toBe(401)
    await addUser('Viewer', 'v@test.local')
    const agent = await login('v@test.local')
    expect((await agent.get('/api/audit')).status).toBe(403)
  })

  it('logs failed sign-ins', async () => {
    const { app, ctx, addUser } = await makeApp()
    await addUser('Assessor', 'a@test.local')
    await request(app).post('/api/auth/login').set(xhr).send({ email: 'a@test.local', password: 'wrong-password-1' })
    expect(ctx.audit.query({ limit: 5, offset: 0, action: 'LOGIN_FAILED' }).total).toBe(1)
  })
})

describe('user management', () => {
  it('administrators can create users who can then sign in', async () => {
    const { app, addUser, login } = await makeApp()
    await addUser('Administrator', 'admin@test.local')
    const admin = await login('admin@test.local')
    const created = await admin.post('/api/users').set(xhr).send({ email: 'New@Test.local', name: 'New Person', role: 'Auditor', department: 'IA', password: 'Welcome-pass-2026' })
    expect(created.status).toBe(201)
    expect(created.body.passwordHash).toBeUndefined()
    expect((await admin.post('/api/users').set(xhr).send({ email: 'new@test.local', name: 'Dup', role: 'Viewer', password: 'Welcome-pass-2026' })).status).toBe(409)
    expect((await admin.post('/api/users').set(xhr).send({ email: 'weak@test.local', name: 'Weak', role: 'Viewer', password: 'password' })).status).toBe(400)
    const signIn = await request(app).post('/api/auth/login').set(xhr).send({ email: 'new@test.local', password: 'Welcome-pass-2026' })
    expect(signIn.body.user.role).toBe('Auditor')
  })

  it('non-administrators cannot manage users', async () => {
    const { addUser, login } = await makeApp()
    await addUser('Risk Manager', 'rm@test.local')
    const agent = await login('rm@test.local')
    expect((await agent.get('/api/users')).status).toBe(403)
    expect((await agent.post('/api/users').set(xhr).send({ email: 'x@test.local', name: 'X', role: 'Administrator', password: 'Welcome-pass-2026' })).status).toBe(403)
  })

  it('protects the last administrator and the admin’s own account', async () => {
    const { addUser, login } = await makeApp()
    const admin = await addUser('Administrator', 'admin@test.local')
    const agent = await login('admin@test.local')
    expect((await agent.patch(`/api/users/${admin.id}`).set(xhr).send({ role: 'Viewer' })).status).toBe(409)
    expect((await agent.patch(`/api/users/${admin.id}`).set(xhr).send({ active: false })).status).toBe(409)
  })

  it('a role change takes effect immediately by ending the user’s sessions', async () => {
    const { addUser, login } = await makeApp()
    await addUser('Administrator', 'admin@test.local')
    const rm = await addUser('Risk Manager', 'rm@test.local')
    const rmAgent = await login('rm@test.local')
    const admin = await login('admin@test.local')
    expect((await admin.patch(`/api/users/${rm.id}`).set(xhr).send({ role: 'Viewer' })).status).toBe(200)
    expect((await rmAgent.get('/api/auth/me')).status).toBe(401)
    const again = await login('rm@test.local', PASSWORD)
    expect((await again.get('/api/auth/me')).body.user.role).toBe('Viewer')
  })
})
