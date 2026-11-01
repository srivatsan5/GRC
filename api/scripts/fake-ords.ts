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
for (const name of [...Object.keys(TABLES), 'erm_trn_audit_log', 'erm_mst_app_setting']) fake.ensure(name)

// Demo content for the modules (same rows as db/seed/demo_data.sql); parent references resolved by natural key.
// @ts-expect-error plain ESM helper without type declarations
const { demoRows } = (await import('../../db/seed/demo-rows.mjs')) as { demoRows: () => Record<string, Record<string, unknown>[]> }
for (const [table, rows] of Object.entries(demoRows())) {
  const resolved = rows.map(r =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => {
        if (v && typeof v === 'object' && '$ref' in v) {
          const [refTable, keyCol, keyVal] = (v as { $ref: [string, string, string] }).$ref
          const parent = [...fake.ensure(refTable.toLowerCase()).values()].find(p => p[keyCol] === keyVal)
          return [k, parent?.UUID ?? null]
        }
        return [k, v]
      }),
    ),
  )
  fake.seed(table.toLowerCase(), resolved)
}

// Seed the risk register with real row shapes captured from the database (fixtures/risk-register-sample.json).
const probe = new URL('./fixtures/risk-register-sample.json', import.meta.url)
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
