#!/usr/bin/env node
/**
 * Runs the browser end-to-end suites against a real, local stack:
 *   in-memory stand-in for Oracle ORDS (:8181) → Pericope API (:5000) → production web build (:3000)
 *
 * Each suite gets a fresh stack (fresh database, users and audit log).
 *
 *   npm run build && npm --prefix api run build     # once
 *   npm run e2e                                      # all suites
 *   npm run e2e -- core-flow                         # one suite
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

const ROOT = new URL('..', import.meta.url).pathname
const ALL = ['core-flow', 'real-data', 'security']
const suites = process.argv.slice(2).length ? process.argv.slice(2) : ALL
for (const s of suites) if (!ALL.includes(s)) throw new Error(`Unknown suite "${s}". Choose from: ${ALL.join(', ')}`)

mkdirSync(join(ROOT, 'e2e', 'screenshots'), { recursive: true })

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function waitFor(url, label, timeoutMs = 60_000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    try {
      const res = await fetch(url)
      if (res.status < 500) return
    } catch {
      /* not up yet */
    }
    await sleep(300)
  }
  throw new Error(`${label} did not start at ${url}`)
}

function start(label, cmd, args, opts) {
  const child = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  const lines = []
  const keep = d => {
    lines.push(String(d))
    if (lines.length > 200) lines.shift()
  }
  child.stdout.on('data', keep)
  child.stderr.on('data', keep)
  return {
    stop: () => {
      try {
        process.kill(-child.pid, 'SIGTERM')
      } catch {
        /* already gone */
      }
    },
    tail: () => `--- ${label} (last lines) ---\n${lines.join('').split('\n').slice(-25).join('\n')}`,
  }
}

async function stack() {
  const dataDir = mkdtempSync(join(tmpdir(), 'pericope-e2e-'))
  const db = start('fake ORDS', 'npx', ['tsx', 'scripts/fake-ords.ts'], { cwd: join(ROOT, 'api') })
  await waitFor('http://localhost:8181/ords/grc/', 'fake ORDS')
  const api = start('API', 'node', ['dist/server.js'], {
    cwd: join(ROOT, 'api'),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: '5000',
      DATA_DIR: dataDir,
      JWT_SECRET: randomBytes(32).toString('hex'),
      AUDIT_HMAC_KEY: randomBytes(32).toString('hex'),
      CORS_ORIGINS: 'http://localhost:3000',
      BOOTSTRAP_ADMIN_EMAIL: 'admin@pericope.local',
      BOOTSTRAP_ADMIN_NAME: 'Srivatsan B',
      BOOTSTRAP_ADMIN_PASSWORD: 'Local-dev-admin-2026',
      ORDS_BASE_URL: 'http://localhost:8181/ords/grc',
      ORDS_TOKEN_URL: 'http://localhost:8181/ords/grc/oauth/token',
      ORDS_CLIENT_ID: 'local',
      ORDS_CLIENT_SECRET: 'local',
      RATE_LIMIT_PER_MINUTE: '100000',
    },
  })
  await waitFor('http://localhost:5000/health', 'API')
  const web = start('web', 'npx', ['next', 'start', '-p', '3000'], { cwd: ROOT, env: { ...process.env, NEXT_PUBLIC_API_URL: 'http://localhost:5000' } })
  await waitFor('http://localhost:3000/runtime-config.js', 'web app')
  return {
    procs: [db, api, web],
    stop: async () => {
      for (const p of [web, api, db]) p.stop()
      await sleep(800)
      rmSync(dataDir, { recursive: true, force: true })
    },
  }
}

function runSuite(name) {
  return new Promise(resolve => {
    let out = ''
    const child = spawn('node', [join(ROOT, 'e2e', `${name}.cjs`)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', d => {
      out += d
      process.stdout.write(d)
    })
    child.stderr.on('data', d => {
      out += d
      process.stderr.write(d)
    })
    child.on('exit', code => resolve({ code, failed: code !== 0 || /^(FAIL|SCRIPT ERROR)/m.test(out) }))
  })
}

let failures = 0
for (const name of suites) {
  console.log(`\n=== ${name} ===`)
  const s = await stack()
  const { failed } = await runSuite(name)
  if (failed) {
    failures++
    for (const p of s.procs) console.log(p.tail())
  }
  await s.stop()
}
console.log(failures ? `\n${failures} suite(s) failed` : `\nAll ${suites.length} suite(s) passed`)
process.exit(failures ? 1 : 0)
