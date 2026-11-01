import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { loadConfig } from '../src/config.js'
import { buildContext } from '../src/bootstrap.js'
import { createApp } from '../src/app.js'
import { OrdsClient } from '../src/ords/client.js'
import { hashPassword } from '../src/auth/passwords.js'
import type { Role } from '../src/auth/permissions.js'

export const ORIGIN = 'http://localhost:3000'
export const PASSWORD = 'Correct-horse-42'

type Mode = 'ok' | 'down' | 'timeout' | 'token_fail' | 'reject_fk' | 'server_error'

/** In-memory imitation of Oracle ORDS AutoREST, including its PUT-replaces-row behaviour. */
export class FakeOrds {
  tables = new Map<string, Map<number, Record<string, unknown>>>()
  mode: Mode = 'ok'
  calls: { method: string; path: string; body?: unknown; auth?: string | null }[] = []
  tokenRequests = 0
  /** Called between the GET and the PUT of an update, to simulate a concurrent edit. */
  beforePut?: () => void
  private nextId = 1000
  private etag = (row: Record<string, unknown>) => `"${Buffer.from(JSON.stringify(row)).toString('base64').slice(-24)}"`

  seed(table: string, rows: Record<string, unknown>[]) {
    const t = this.ensure(table)
    for (const r of rows) {
      const id = Number(r.UUID ?? r.uuid ?? this.nextId++)
      t.set(id, { ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toUpperCase(), v])), UUID: id })
    }
  }

  ensure(table: string) {
    if (!this.tables.has(table)) this.tables.set(table, new Map())
    return this.tables.get(table)!
  }

  fetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    const headers = (init?.headers ?? {}) as Record<string, string>
    if (url.pathname.endsWith('/oauth/token')) {
      this.tokenRequests++
      if (this.mode === 'token_fail') return new Response('{"error":"invalid_client"}', { status: 401 })
      return Response.json({ access_token: 'tok-' + this.tokenRequests, expires_in: 3600 })
    }
    if (this.mode === 'down') throw new TypeError('fetch failed')
    if (this.mode === 'timeout') throw Object.assign(new Error('timeout'), { name: 'TimeoutError' })
    if (this.mode === 'server_error') return new Response('boom', { status: 500 })

    const [, , , table, idStr] = url.pathname.split('/') // /ords/schema/<table>/<id>
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    this.calls.push({ method, path: url.pathname + url.search, body, auth: headers.Authorization ?? null })
    if (!this.tables.has(table!)) return Response.json({ code: 'NotFound', message: 'Not Found' }, { status: 404 })
    const t = this.tables.get(table!)!
    const lower = (r: Record<string, unknown>) => ({
      ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])),
      links: [{ rel: 'self', href: 'https://secret-host.example/ords' }],
    })

    if (this.mode === 'reject_fk' && method !== 'GET') {
      return Response.json({ code: 'BadRequest', message: 'ORA-02291: integrity constraint (GRC.FK_X) violated - parent key not found' }, { status: 400 })
    }

    if (method === 'GET' && !idStr) {
      const limit = Number(url.searchParams.get('limit') ?? 25)
      return Response.json({ items: [...t.values()].slice(0, limit).map(lower), hasMore: false })
    }
    const id = Number(idStr)
    if (method === 'GET') {
      const row = t.get(id)
      return row ? Response.json(lower(row), { headers: { ETag: this.etag(row) } }) : Response.json({ code: 'NotFound' }, { status: 404 })
    }
    if (method === 'POST') {
      const newId = this.nextId++
      const row = { ...body, UUID: newId }
      t.set(newId, row)
      return Response.json(lower(row), { status: 201 })
    }
    if (method === 'PUT') {
      if (!t.has(id)) return Response.json({ code: 'NotFound' }, { status: 404 })
      this.beforePut?.()
      const ifMatch = headers['If-Match']
      if (ifMatch && ifMatch !== this.etag(t.get(id)!)) return Response.json({ code: 'PreconditionFailed' }, { status: 412 })
      const row = { ...body, UUID: id } // AutoREST: full replacement
      t.set(id, row)
      return Response.json(lower(row))
    }
    if (method === 'DELETE') {
      if (!t.delete(id)) return Response.json({ code: 'NotFound' }, { status: 404 })
      return Response.json({ rowsDeleted: 1 })
    }
    return new Response('unsupported', { status: 405 })
  }
}

export async function makeApp(opts: { env?: Record<string, string>; ords?: FakeOrds } = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'pericope-api-test-'))
  const fake = opts.ords ?? new FakeOrds()
  const config = loadConfig({
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-test-secret-test-secret-123',
    CORS_ORIGINS: ORIGIN,
    DATA_DIR: dataDir,
    ORDS_BASE_URL: 'https://db.example/ords/grc',
    ORDS_TOKEN_URL: 'https://db.example/ords/grc/oauth/token',
    ORDS_CLIENT_ID: 'id',
    ORDS_CLIENT_SECRET: 'secret',
    RATE_LIMIT_PER_MINUTE: '10000',
    LOGIN_RATE_LIMIT_PER_15_MIN: '1000',
    ...opts.env,
  })
  const ords = new OrdsClient({
    baseUrl: config.ORDS_BASE_URL,
    tokenUrl: config.ORDS_TOKEN_URL,
    clientId: config.ORDS_CLIENT_ID,
    clientSecret: config.ORDS_CLIENT_SECRET,
    allowAnonymous: config.ORDS_ALLOW_ANONYMOUS,
    timeoutMs: 2000,
    fetchImpl: fake.fetch,
  })
  const ctx = await buildContext(config, ords)
  const app = createApp(ctx)
  const hash = await hashPassword(PASSWORD)

  const addUser = async (role: Role, email = `${role.toLowerCase().replace(/\s/g, '.')}@test.local`, active = true) => {
    const u = await ctx.users.create({ email, name: role + ' User', role, department: 'Test', passwordHash: hash })
    if (!active) await ctx.users.update(u.id, { active: false })
    return u
  }

  /** A supertest agent that is signed in and sends the CSRF header. */
  const login = async (email: string, password = PASSWORD) => {
    const agent = request.agent(app)
    const res = await agent.post('/api/auth/login').set('X-Requested-With', 'XMLHttpRequest').set('Origin', ORIGIN).send({ email, password })
    if (res.status !== 200) throw new Error(`login failed ${res.status} ${JSON.stringify(res.body)}`)
    return agent
  }

  return { app, ctx, fake, dataDir, addUser, login }
}

export const xhr = { 'X-Requested-With': 'XMLHttpRequest', Origin: ORIGIN }
