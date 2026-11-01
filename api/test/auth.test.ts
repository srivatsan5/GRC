import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { makeApp, ORIGIN, PASSWORD, xhr } from './helpers.js'

describe('authentication', () => {
  it('rejects data access without a session (no more implicit "System" role)', async () => {
    const { app } = await makeApp()
    const read = await request(app).get('/api/per_trn_identify_risk')
    expect(read.status).toBe(401)
    const write = await request(app).post('/api/per_trn_identify_risk').set(xhr).send({ risk_statement: 'x' })
    expect(write.status).toBe(401)
    const del = await request(app).delete('/api/per_trn_identify_risk/1').set(xhr).set('X-User-Role', 'Administrator')
    expect(del.status).toBe(401)
  })

  it('ignores spoofed X-User-Role headers', async () => {
    const { addUser, login } = await makeApp()
    await addUser('Viewer', 'v@test.local')
    const agent = await login('v@test.local')
    const res = await agent.post('/api/per_trn_identify_risk').set(xhr).set('X-User-Role', 'Administrator').send({ risk_statement: 'Vendor outage' })
    expect(res.status).toBe(403)
  })

  it('signs in with the right password and sets an httpOnly cookie', async () => {
    const { app, addUser } = await makeApp()
    await addUser('Assessor', 'a@test.local')
    const res = await request(app).post('/api/auth/login').set(xhr).send({ email: 'A@Test.local', password: PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('a@test.local')
    expect(res.body.user.passwordHash).toBeUndefined()
    expect(res.body.permissions).toContain('create')
    const cookie = String(res.headers['set-cookie'])
    expect(cookie).toMatch(/pericope_session=/)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
  })

  it('rejects a wrong password and unknown emails with the same message', async () => {
    const { app, addUser } = await makeApp()
    await addUser('Assessor', 'a@test.local')
    const wrong = await request(app).post('/api/auth/login').set(xhr).send({ email: 'a@test.local', password: 'nope-nope-nope-1' })
    const unknown = await request(app).post('/api/auth/login').set(xhr).send({ email: 'ghost@test.local', password: 'nope-nope-nope-1' })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.body.error.message).toBe(unknown.body.error.message)
  })

  it('refuses inactive users instead of falling back to the administrator', async () => {
    const { app, addUser } = await makeApp()
    await addUser('Administrator', 'admin@test.local')
    await addUser('Viewer', 'karen@test.local', false)
    const res = await request(app).post('/api/auth/login').set(xhr).send({ email: 'karen@test.local', password: PASSWORD })
    expect(res.status).toBe(401)
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('locks an account after 5 wrong passwords', async () => {
    const { app, addUser } = await makeApp()
    await addUser('Assessor', 'a@test.local')
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').set(xhr).send({ email: 'a@test.local', password: 'wrong-password-99' })
    }
    const res = await request(app).post('/api/auth/login').set(xhr).send({ email: 'a@test.local', password: PASSWORD })
    expect(res.status).toBe(423)
  })

  it('logout invalidates the session token, even if it was copied', async () => {
    const { app, addUser } = await makeApp()
    await addUser('Assessor', 'a@test.local')
    const login = await request(app).post('/api/auth/login').set(xhr).send({ email: 'a@test.local', password: PASSWORD })
    const cookie = login.headers['set-cookie'] as unknown as string[]
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(200)
    await request(app).post('/api/auth/logout').set(xhr).set('Cookie', cookie)
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401)
  })

  it('change-password requires the current password and enforces the policy', async () => {
    const { addUser, login } = await makeApp()
    await addUser('Assessor', 'a@test.local')
    const agent = await login('a@test.local')
    expect((await agent.post('/api/auth/change-password').set(xhr).send({ currentPassword: 'bad', newPassword: 'Another-pass-123' })).status).toBe(400)
    expect((await agent.post('/api/auth/change-password').set(xhr).send({ currentPassword: PASSWORD, newPassword: 'short1' })).status).toBe(400)
    expect((await agent.post('/api/auth/change-password').set(xhr).send({ currentPassword: PASSWORD, newPassword: 'Another-pass-123' })).status).toBe(200)
    expect((await agent.get('/api/auth/me')).status).toBe(200) // this browser was re-issued a session
  })

  it('creates the bootstrap administrator only when no users exist', async () => {
    const { app, ctx } = await makeApp({ env: { BOOTSTRAP_ADMIN_EMAIL: 'root@test.local', BOOTSTRAP_ADMIN_PASSWORD: 'Bootstrap-pass-1' } })
    expect(ctx.users.count()).toBe(1)
    const res = await request(app).post('/api/auth/login').set(xhr).send({ email: 'root@test.local', password: 'Bootstrap-pass-1' })
    expect(res.body.user.role).toBe('Administrator')
  })
})

describe('transport security', () => {
  it('blocks state-changing cookie requests without the CSRF header or from foreign origins', async () => {
    const { addUser, login } = await makeApp()
    await addUser('Administrator', 'admin@test.local')
    const agent = await login('admin@test.local')
    expect((await agent.post('/api/per_trn_identify_risk').send({ risk_statement: 'x' })).status).toBe(403)
    expect((await agent.post('/api/per_trn_identify_risk').set('X-Requested-With', 'XMLHttpRequest').set('Origin', 'https://evil.example').send({ risk_statement: 'x' })).status).toBe(403)
  })

  it('only allows configured CORS origins and sets security headers', async () => {
    const { app } = await makeApp()
    const good = await request(app).get('/health').set('Origin', ORIGIN)
    expect(good.headers['access-control-allow-origin']).toBe(ORIGIN)
    expect(good.headers['access-control-allow-credentials']).toBe('true')
    const bad = await request(app).get('/health').set('Origin', 'https://evil.example')
    expect(bad.headers['access-control-allow-origin']).toBeUndefined()
    expect(good.headers['x-content-type-options']).toBe('nosniff')
    expect(good.headers['x-powered-by']).toBeUndefined()
  })

  it('health does not leak the database host', async () => {
    const { app } = await makeApp()
    const res = await request(app).get('/health')
    expect(res.body).toEqual({ status: 'ok' })
    const ready = await request(app).get('/ready')
    expect(JSON.stringify(ready.body)).not.toMatch(/db\.example/)
  })
})
