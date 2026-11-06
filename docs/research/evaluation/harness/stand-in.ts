/**
 * Evaluation stand-in for Oracle ORDS, shared by both systems under test.
 *
 * It is the same in-memory FakeOrds used by the artifact's own tests and by api/scripts/fake-ords.ts,
 * seeded with the same demo rows. Evaluation-only additions (recorded as a deviation in RESULTS.md):
 *   POST /__control/mode   {"mode":"ok"|"reject_fk"|"server_error"}  switch failure behaviour (S5.2)
 *   GET  /__control/rows/<table>                                    read stored rows directly (ground truth)
 *   POST /__control/rows/<table>   [rows]                           insert rows directly (identical set-up)
 *   GET  /__control/log                                             every upstream request received
 *
 *   npx --prefix api tsx docs/research/evaluation/harness/stand-in.ts      (port 8181)
 */
import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { FakeOrds } from '../../../../api/test/helpers.js'
import { TABLES } from '../../../../api/src/tables/registry.js'
// @ts-expect-error plain ESM helper without type declarations
import { demoRows } from '../../../../db/seed/demo-rows.mjs'

const PORT = Number(process.env.FAKE_ORDS_PORT ?? 8181)
const fake = new FakeOrds()
for (const name of [...Object.keys(TABLES), 'erm_trn_audit_log', 'erm_mst_app_setting']) fake.ensure(name)
for (const [table, rows] of Object.entries(demoRows() as Record<string, Record<string, unknown>[]>)) {
  fake.seed(
    table.toLowerCase(),
    rows.map(r =>
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
    ),
  )
}

// Same real-shape risk rows as api/scripts/fake-ords.ts.
const probe = new URL('../../../../api/scripts/fixtures/risk-register-sample.json', import.meta.url)
if (existsSync(probe)) {
  const data = JSON.parse(readFileSync(probe, 'utf8')) as { items?: Record<string, unknown>[] }
  fake.seed('per_trn_identify_risk', (data.items ?? []).map(({ links: _l, ...row }) => row))
}

const log: { at: string; method: string; url: string }[] = []

createServer(async (req, res) => {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const body = chunks.length ? Buffer.concat(chunks).toString() : undefined
  const url = req.url ?? '/'
  const send = (status: number, data: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }

  if (url.startsWith('/__control/')) {
    const [, , what, table] = url.split('/')
    if (what === 'mode' && req.method === 'POST') {
      fake.mode = JSON.parse(body ?? '{}').mode
      return send(200, { mode: fake.mode })
    }
    if (what === 'log') return send(200, log)
    if (what === 'rows' && table) {
      if (req.method === 'POST') {
        fake.seed(table, JSON.parse(body ?? '[]'))
        return send(201, { ok: true })
      }
      return send(200, [...fake.ensure(table).values()])
    }
    return send(404, { error: 'unknown control' })
  }

  log.push({ at: new Date().toISOString(), method: req.method ?? 'GET', url })
  // Node lower-cases header names; FakeOrds reads them in ORDS spelling (If-Match, Authorization).
  const h = req.headers as Record<string, string>
  const headers: Record<string, string> = { ...h }
  if (h['if-match']) headers['If-Match'] = h['if-match']
  if (h.authorization) headers.Authorization = h.authorization
  const response = await fake.fetch(`http://localhost:${PORT}${url}`, { method: req.method, headers, body })
  res.writeHead(response.status, { 'Content-Type': 'application/json', ...(response.headers.get('etag') ? { ETag: response.headers.get('etag')! } : {}) })
  res.end(await response.text())
}).listen(PORT, () => console.log(`[stand-in] http://localhost:${PORT}/ords/grc`))
