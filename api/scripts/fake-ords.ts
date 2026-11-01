/**
 * A local stand-in for Oracle ORDS so the app can run without the real database
 * (offline development, demos, end-to-end tests). Data lives in memory only.
 *
 *   npm run dev:fake-db            # listens on http://localhost:8181/ords/grc
 *   then in api/.env:
 *     ORDS_BASE_URL=http://localhost:8181/ords/grc
 *     ORDS_TOKEN_URL=http://localhost:8181/ords/grc/oauth/token
 *     ORDS_CLIENT_ID=local
 *     ORDS_CLIENT_SECRET=local
 */
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { FakeOrds } from '../test/helpers.js'
import { TABLES } from '../src/tables/registry.js'

const PORT = Number(process.env.FAKE_ORDS_PORT ?? 8181)
const fake = new FakeOrds()
for (const name of [...Object.keys(TABLES), 'erm_trn_audit_log']) fake.ensure(name)

// Seed the risk register with the real row shapes captured in probe_risks.json (if present).
const probe = new URL('../../probe_risks.json', import.meta.url)
if (existsSync(probe)) {
  const data = JSON.parse(readFileSync(probe, 'utf8')) as { items?: Record<string, unknown>[] }
  fake.seed('per_trn_identify_risk', (data.items ?? []).map(({ links: _l, ...row }) => row))
}

createServer(async (req, res) => {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const body = chunks.length ? Buffer.concat(chunks).toString() : undefined
  const response = await fake.fetch(`http://localhost:${PORT}${req.url}`, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body,
  })
  res.writeHead(response.status, { 'Content-Type': 'application/json' })
  res.end(await response.text())
}).listen(PORT, () => console.log(`[fake-ords] http://localhost:${PORT}/ords/grc  (${fake.tables.size} tables, in-memory)`))
