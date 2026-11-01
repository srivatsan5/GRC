import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { makeApp } from './helpers.js'

describe('operations', () => {
  it('gives every response a request id, keeping a valid one from the proxy', async () => {
    const { app } = await makeApp()
    const fresh = await request(app).get('/health')
    expect(fresh.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
    const kept = await request(app).get('/health').set('X-Request-Id', 'lb-req-12345678')
    expect(kept.headers['x-request-id']).toBe('lb-req-12345678')
    const unsafe = await request(app).get('/health').set('X-Request-Id', 'bad id <script>')
    expect(unsafe.headers['x-request-id']).not.toBe('bad id <script>')
  })
})
