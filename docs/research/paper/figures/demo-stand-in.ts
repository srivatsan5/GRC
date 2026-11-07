/**
 * Screenshot-only ORDS stand-in holding the same rows as the Oracle demo install
 * (module demo data + 07_mock_data.sql + 10_more_demo_data.sql, converted by sql-to-rows.py).
 *
 *   npx --prefix api tsx docs/research/paper/figures/demo-stand-in.ts <rows.json>     (port 8181)
 */
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { FakeOrds } from '../../../../api/test/helpers.js'
import { TABLES } from '../../../../api/src/tables/registry.js'

const PORT = Number(process.env.FAKE_ORDS_PORT ?? 8181)
const fake = new FakeOrds()
for (const name of [...Object.keys(TABLES), 'erm_trn_audit_log', 'erm_mst_app_setting']) fake.ensure(name)
const data = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as Record<string, Record<string, unknown>[]>
for (const [table, rows] of Object.entries(data)) fake.seed(table.toLowerCase(), rows)

createServer(async (req, res) => {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const body = chunks.length ? Buffer.concat(chunks).toString() : undefined
  const h = req.headers as Record<string, string>
  const headers: Record<string, string> = { ...h }
  if (h['if-match']) headers['If-Match'] = h['if-match']
  if (h.authorization) headers.Authorization = h.authorization
  const r = await fake.fetch(`http://localhost:${PORT}${req.url}`, { method: req.method, headers, body })
  res.writeHead(r.status, { 'Content-Type': 'application/json', ...(r.headers.get('etag') ? { ETag: r.headers.get('etag')! } : {}) })
  res.end(await r.text())
}).listen(PORT, () => console.log(`[demo stand-in] http://localhost:${PORT}/ords/grc`))
