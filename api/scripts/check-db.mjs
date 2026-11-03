#!/usr/bin/env node
/**
 * Explains why the API can't reach the database, in plain words.
 * Reads api/.env and tests the three things the API needs:
 *   1. the database address answers (the table exists and is REST-enabled)
 *   2. the client id + secret can sign in
 *   3. that client may read the tables
 *
 *   node api/scripts/check-db.mjs          (from the project folder)
 *   npm run check:db                       (from the api folder)
 *
 * Prints status codes only, never the secret.
 */
import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const envFile = join(dirname(fileURLToPath(import.meta.url)), '..', '.env')
const loaded = config({ path: envFile, quiet: true })
if (loaded.error) {
  console.log(`✗ No settings file at ${envFile}. Create api/.env first.`)
  process.exit(1)
}

const base = (process.env.ORDS_BASE_URL || '').trim().replace(/\/+$/, '')
const tokenUrl = (process.env.ORDS_TOKEN_URL || '').trim()
const id = (process.env.ORDS_CLIENT_ID || '').trim()
const secret = (process.env.ORDS_CLIENT_SECRET || '').trim()
const missing = [['ORDS_BASE_URL', base], ['ORDS_TOKEN_URL', tokenUrl], ['ORDS_CLIENT_ID', id], ['ORDS_CLIENT_SECRET', secret]].filter(([, v]) => !v)
if (missing.length) {
  console.log(`✗ Missing in api/.env: ${missing.map(([k]) => k).join(', ')}`)
  process.exit(1)
}
if (tokenUrl !== `${base}/oauth/token`) {
  console.log(`! ORDS_TOKEN_URL is usually ORDS_BASE_URL + "/oauth/token". Check both lines use the same address.`)
}

const table = `${base}/per_trn_identify_risk/?limit=1`
const call = async (url, init) => {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(15000) })
  } catch (e) {
    return { status: 0, error: e.cause?.code || e.message }
  }
}

console.log(`Database address: ${base.replace(/^(https?:\/\/[^/]+).*$/, '$1')} … /${base.split('/').pop()}\n`)

// 1. Address
const r1 = await call(table)
if (r1.status === 0) {
  console.log(`✗ 1. No answer from the database address (${r1.error}).`)
  console.log(`     Fix: the host in ORDS_BASE_URL is wrong. Copy it from the Database Actions address bar.`)
  process.exit(1)
}
if (r1.status === 404) {
  console.log('✗ 1. The address answers, but the risk table is not there (404).')
  console.log('     Either the part after /ords/ is not your schema alias, or install_all.sql has not run in that schema.')
  console.log('     Fix: in Database Actions (signed in as your schema) run:  SELECT pattern FROM user_ords_schemas;')
  console.log('          and use that value after /ords/ in both ORDS_ lines. Run install_all.sql there if you have not.')
  process.exit(1)
}
if (r1.status === 200) {
  console.log('! 1. The risk table is readable WITHOUT a login. Run db/install/08_finish.sql to protect it.')
} else {
  console.log(`✓ 1. Database address is right and the tables exist (${r1.status} without a login, as it should be).`)
}

// 2. Sign-in
const r2 = await call(tokenUrl, {
  method: 'POST',
  headers: {
    Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'grant_type=client_credentials',
})
let token = null
if (r2.status === 200) token = (await r2.json().catch(() => ({}))).access_token
if (!token) {
  console.log(`✗ 2. The client id/secret were refused (${r2.status || r2.error}).`)
  console.log('     Fix: the id/secret are wrong, or belong to another schema or database. Run db/install/09_oauth_client.sql')
  console.log('          in Database Actions (as your schema) and copy the ORDS_CLIENT_ID / ORDS_CLIENT_SECRET it prints.')
  process.exit(1)
}
console.log('✓ 2. The client id and secret work.')

// 3. Permission
const r3 = await call(table, { headers: { Authorization: `Bearer ${token}` } })
if (r3.status === 200) {
  console.log('✓ 3. The client can read the tables.\n\nAll good. Restart the API (Ctrl+C, then npm --prefix api run dev) and /ready will say ok.')
  process.exit(0)
}
console.log(`✗ 3. Signed in, but not allowed to read the tables (${r3.status}).`)
console.log('     Fix: the client is missing the role. Run db/install/09_oauth_client.sql and use the new id/secret it prints,')
console.log('          or in Database Actions > REST > Security > OAuth Clients add the role oracle.dbtools.role.autorest.<YOUR_SCHEMA>.')
process.exit(1)
