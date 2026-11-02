/**
 * Writes 06_mock_data.sql: demo rows for every table in 02_tables.sql.
 *
 *   node db/install/tools/mock.mjs
 *
 * - Tables the web app shows get hand-written rows (mock-curated.mjs).
 * - Every other table gets ROWS_PER_TABLE generated rows that respect its columns: types and lengths,
 *   NOT NULL, CHECK (… IN (…)) and BETWEEN rules, unique keys, and foreign keys (a child row points
 *   at a generated or hand-written parent row).
 * - Rows are inserted parents first. Ids are fixed; identity columns are moved past them at the end.
 * - Rows with a CREATED_BY column are stamped 'demo-seed'.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, SCRATCH } from './build.mjs'
import { curatedRows } from './mock-curated.mjs'
import { demoRows } from '../../seed/demo-rows.mjs'
import { createHash } from 'node:crypto'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ROWS_PER_TABLE = 5
/** Never given made-up rows: audit history must be real, and logs are written by the system. */
const NO_MOCK = new Set(['ERM_TRN_AUDIT_LOG', 'WF_DEBUG_LOG'])
/** Tables created by the migrations (V3), seeded by db/seed/demo_data.sql, referenced here by natural key. */
const MIGRATION_TABLES = new Set(['ERM_MST_CONTROL', 'ERM_TRN_INCIDENT', 'ERM_LNK_CONTROL_RISK', 'ERM_LNK_INCIDENT_RISK'])
/** Columns added by 05_app_alignment.sql or the migrations, so they are not in the exported DDL. */
const ADDED_COLUMNS = {
  PER_TRN_IDENTIFY_RISK: ['INHERENT_LIKELIHOOD', 'INHERENT_IMPACT', 'RESIDUAL_LIKELIHOOD', 'RESIDUAL_IMPACT'],
  PER_TRN_RISK_MONITORING: ['IDENTIFY_RISK_UUID', 'ASSESSMENT_REFERENCE_NUMBER_UUID'],
  PER_TRN_INHERENT_RISK_ASSESSMENT: ['CREATED_ON', 'CREATED_BY'],
}
const BASE_DATE = Date.UTC(2026, 0, 5)

// ------------------------------------------------------------------ table model
function columnInfo(name, spec) {
  const type = /^(TIMESTAMP\s*\(\d+\)(?: WITH(?: LOCAL)? TIME ZONE)?|INTERVAL [A-Z ()0-9]+?(?= |$)|[A-Z0-9_]+(?:\s*\([^)]*\))?)/.exec(spec)[1]
  const base = type.replace(/\s*\(.*$/, '').split(' ')[0]
  const size = /\((\d+)(?:\s*(?:CHAR|BYTE))?(?:,\s*(-?\d+))?\)/.exec(type)
  return {
    name,
    base,
    length: size ? Number(size[1]) : null,
    scale: size?.[2] != null ? Number(size[2]) : null,
    nullable: !/NOT NULL/.test(spec),
    hasDefault: /\bDEFAULT\b/.test(spec),
    identity: /AS IDENTITY/.test(spec),
    virtual: /\bVIRTUAL\b/.test(spec),
  }
}

const cols = s => [...s.matchAll(/"([A-Z0-9_$#]+)"/g)].map(m => m[1])

function model() {
  const tables = new Map()
  for (const t of parse()) {
    if (SCRATCH.has(t.name)) continue
    const columns = t.columns.map(c => columnInfo(c.name, c.spec))
    const allowed = {}
    const ranges = {}
    const uniques = []
    let pk = []
    for (const item of t.body) {
      if (/PRIMARY KEY/.test(item)) pk = cols(/PRIMARY KEY\s*\(([^)]*)\)/.exec(item)[1])
      if (/\bUNIQUE\s*\(/.test(item)) uniques.push(cols(/UNIQUE\s*\(([^)]*)\)/.exec(item)[1]))
      if (!/CHECK\s*\(/.test(item)) continue
      for (const m of item.matchAll(/"?([A-Za-z0-9_]+)"?\s+IN\s*\(([^()]*)\)/gi)) {
        const values = [...m[2].matchAll(/'((?:[^']|'')*)'|(-?\d+(?:\.\d+)?)/g)].map(v => (v[1] != null ? v[1].replace(/''/g, "'") : Number(v[2])))
        if (values.length && !/NOT\s*$/i.test(item.slice(0, m.index + m[0].indexOf(m[1]) + m[1].length + 1).replace(/"?[A-Za-z0-9_]+"?\s*$/, ''))) allowed[m[1].toUpperCase()] = values
      }
      for (const m of item.matchAll(/"?([A-Za-z0-9_]+)"?\s+BETWEEN\s+(-?\d+(?:\.\d+)?)\s+AND\s+(-?\d+(?:\.\d+)?)/gi)) ranges[m[1].toUpperCase()] = [Number(m[2]), Number(m[3])]
      for (const m of item.matchAll(/"?([A-Za-z0-9_]+)"?\s*(>=|>|<=|<)\s*(-?\d+(?:\.\d+)?)\b/g)) {
        const col = m[1].toUpperCase()
        const [lo, hi] = ranges[col] ?? [-Infinity, Infinity]
        const v = Number(m[3])
        ranges[col] = m[2].startsWith('>') ? [Math.max(lo, m[2] === '>' ? v + 1 : v), hi] : [lo, Math.min(hi, m[2] === '<' ? v - 1 : v)]
      }
    }
    const fks = t.fks.map(fk => ({
      columns: cols(/FOREIGN KEY\s*\(([^)]*)\)/.exec(fk)[1]),
      table: /REFERENCES "([A-Z0-9_$]+)"/.exec(fk)[1],
      refColumns: cols(/REFERENCES "[A-Z0-9_$]+"\s*\(([^)]*)\)/.exec(fk)[1]),
    }))
    tables.set(t.name, { name: t.name, temporary: t.temporary, columns, allowed, ranges, uniques, pk, fks, checks: t.body.filter(i => /CHECK\s*\(/.test(i)) })
  }
  return tables
}

// ------------------------------------------------------------------ generated values
const PEOPLE = ['Asha Menon', 'Daniel Okafor', 'Priya Raman', 'Marcus Lee', 'Elena Petrova', 'Tom Becker', 'Fatima Al-Sayed', 'Lucas Moreau', 'Grace Mensah']
const LEVELS = ['Low', 'Medium', 'High', 'Critical']
const words = name =>
  name
    .replace(/^(PER|PXT|ERM)_/, '')
    .replace(/^(GOV_|MST_|TRN_)+/, '')
    .split('_')
    .filter(Boolean)
    .map(w => w[0] + w.slice(1).toLowerCase())
    .join(' ')
const fit = (s, len) => (len && s.length > len ? s.slice(0, len) : s)

function dateFor(col, k) {
  let days = (k - 1) * 23
  if (/END|DUE|CLOS|EXPIR|_TO$|TO_DATE|NEXT|COMPLET|RESOLV|UNTIL|DEADLINE|FINISH|VALID_TO|RENEW/.test(col)) days += 60
  else if (/UPDATED|MODIFIED|LAST|APPROVED|DECID|REVIEWED|SUBMITTED|ACTION/.test(col)) days += 20
  return new Date(BASE_DATE + days * 86400000).toISOString().slice(0, 10)
}

function numberFor(c, k, range) {
  if (range) {
    const [lo, hi] = [Math.max(range[0], -1e9), Math.min(range[1], 1e9)]
    if (lo > hi) return null
    const span = Math.floor(hi - lo)
    return Math.max(lo, Math.min(hi, Math.ceil(lo) + ((k - 1) % (span + 1))))
  }
  if (/YEAR/.test(c.name)) return 2026
  if (/PCT|PERCENT/.test(c.name)) return (k * 17) % 100
  const max = c.length ? 10 ** (c.length - (c.scale ?? 0)) - 1 : Infinity
  if (/AMOUNT|VALUE|COST|LOSS|BUDGET|EXPOSURE|PRICE|REVENUE|LIMIT/.test(c.name) && max >= 1000000) return 25000 * k
  if (/SCORE|RATING|LEVEL|PRIORITY|RANK|SEVERITY|LIKELIHOOD|IMPACT/.test(c.name)) return Math.min(max, ((k - 1) % 5) + 1)
  if (/ORDER|SEQ|STEP|NO$|NUM|VERSION|POSITION/.test(c.name)) return Math.min(max, k)
  return Math.min(max, k * 3)
}

function textFor(table, c, k) {
  const n = c.name
  const label = words(table)
  const person = PEOPLE[(k - 1) % PEOPLE.length]
  let s
  if (/EMAIL/.test(n)) s = `${person.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`
  else if (/(^|_)(URL|LINK|URI|ENDPOINT|HREF|WEBHOOK)($|_)/.test(n)) s = `https://example.com/${label.toLowerCase().replace(/ /g, '-')}/${k}`
  else if (/PHONE|MOBILE|FAX/.test(n)) s = `+1-555-010${k}`
  else if (/COUNTRY/.test(n)) s = ['US', 'GB', 'IN', 'AE', 'DE'][(k - 1) % 5]
  else if (/CURRENCY/.test(n)) s = ['USD', 'EUR', 'GBP', 'INR', 'AED'][(k - 1) % 5]
  else if (/(^|_)(IS|HAS|ALLOW|ENABLE|ENABLED|ACTIVE|FLAG|YN)($|_)|_YN$|_FLAG$/.test(n) || (c.base.startsWith('CHAR') && c.length === 1)) s = 'Y'
  else if (/STATUS|STATE/.test(n)) s = ['Active', 'Open', 'In Progress', 'Closed', 'Draft'][(k - 1) % 5]
  else if (/SEVERITY|PRIORITY|CRITICALITY|RATING|LEVEL|TIER|IMPACT|LIKELIHOOD/.test(n)) s = LEVELS[(k - 1) % 4]
  else if (/(CODE|REF|KEY|_NO|NUMBER|IDENTIFIER|SLUG)$|^CODE/.test(n)) s = `${label.replace(/[^A-Z]/g, '').slice(0, 4) || 'X'}-${String(k).padStart(3, '0')}`
  else if (/(OWNER|_BY|USER|ASSIGNEE|ASSIGNED_TO|AUTHOR|REVIEWER|APPROVER|CONTACT|LEAD|MANAGER|PERSON|NAME_OF|AUDITOR|CHAIR|SPONSOR)/.test(n) && !/UUID|_ID$/.test(n)) s = person
  else if (/MIME/.test(n)) s = 'application/pdf'
  else if (/FILE_?NAME|FILENAME/.test(n)) s = `${label.toLowerCase().replace(/ /g, '-')}-${k}.pdf`
  else if (/COLOU?R/.test(n)) s = ['#2E7D32', '#F9A825', '#EF6C00', '#C62828', '#1565C0'][(k - 1) % 5]
  else if (/TYPE|CATEGORY|KIND|CLASS/.test(n)) s = ['General', 'Operational', 'Regulatory', 'Financial', 'Technology'][(k - 1) % 5]
  else if (/(NAME|TITLE|LABEL|SUBJECT|HEADING)$/.test(n)) s = `${label} ${k}`
  else if (/DESC|NOTE|COMMENT|TEXT|SUMMARY|DETAIL|REMARK|BODY|CONTENT|MESSAGE|REASON|OBJECTIVE|SCOPE|PURPOSE|STATEMENT|RESPONSE|ANSWER|QUESTION|FINDING|RECOMMEND|ACTION|RESOLUTION|OUTCOME|CRITERIA|MSG/.test(n))
    s = `Demo ${label.toLowerCase()} ${k}: ${words(n).toLowerCase()}.`
  else if (/JSON|CONFIG|PARAMS|PAYLOAD|SETTINGS|METADATA|OPTIONS/.test(n)) s = '{}'
  else if (/ENGINE|MODEL|PROVIDER/.test(n)) s = 'demo'
  else s = `${words(n)} ${k}`
  return fit(s, c.length)
}

/** Value for column c of generated row k, or undefined to leave the column out. */
function valueFor(t, c, k, state) {
  if (c.virtual) return undefined
  const fk = t.fks.find(f => f.columns.includes(c.name))
  if (fk) {
    if (fk.table === t.name) return null
    const parent = state.rows.get(fk.table)
    if (!parent?.length) return c.nullable ? null : undefined
    const prow = parent[(k - 1) % parent.length]
    return prow[fk.refColumns[fk.columns.indexOf(c.name)]] ?? null
  }
  if (c.identity || (t.pk.length === 1 && t.pk[0] === c.name && c.base === 'NUMBER')) return k
  // Text keys filled by SYS_GUID(): a fixed GUID-like value, so child rows can point at it.
  if (t.pk.length === 1 && t.pk[0] === c.name) return fit(createHash('md5').update(`${t.name}:${k}`).digest('hex').toUpperCase(), c.length)
  if (t.allowed[c.name]) return t.allowed[c.name][(k - 1) % t.allowed[c.name].length]
  if (c.hasDefault && !t.ranges[c.name]) return undefined
  if (c.name === 'CREATED_BY') return 'demo-seed'
  switch (c.base) {
    case 'NUMBER':
    case 'FLOAT':
    case 'INTEGER':
    case 'BINARY_DOUBLE':
    case 'BINARY_FLOAT':
      return numberFor(c, k, t.ranges[c.name])
    case 'DATE':
    case 'TIMESTAMP':
      return { $date: dateFor(c.name, k) }
    case 'VARCHAR2':
    case 'NVARCHAR2':
    case 'CHAR':
    case 'NCHAR':
    case 'CLOB':
    case 'NCLOB':
      return textFor(t.name, c, k)
    case 'JSON':
      return { $json: `{"demo": ${k}}` }
    default:
      return c.nullable ? null : undefined // BLOB, RAW, LONG, VECTOR …
  }
}

// ------------------------------------------------------------------ SQL
const DATE_COL = /(_ON|_DATE|_AT|DEADLINE|_TS|TIMESTAMP)$/
function lit(table, col, v, colInfo) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'object' && v.$ref) {
    const [t, keyCol, keyVal] = v.$ref
    return `(SELECT UUID FROM ${t} WHERE ${keyCol} = ${lit(t, keyCol, keyVal)})`
  }
  if (typeof v === 'object' && v.$date) return `DATE '${v.$date}'`
  if (typeof v === 'object' && v.$json) return `'${v.$json}'`
  if (typeof v === 'number') return String(v)
  const s = String(v).replace(/'/g, "''")
  const isDate = colInfo ? ['DATE', 'TIMESTAMP'].includes(colInfo.base) : DATE_COL.test(col)
  if (isDate && /^\d{4}-\d{2}-\d{2}$/.test(s)) return `DATE '${s}'`
  return `'${s}'`
}

function order(tables, wanted) {
  const done = new Set()
  const out = []
  const visiting = new Set()
  const visit = name => {
    if (done.has(name) || !wanted.has(name)) return
    if (visiting.has(name)) return // a cycle: the later table's key is left empty (generated rows only)
    visiting.add(name)
    for (const fk of tables.get(name)?.fks ?? []) if (fk.table !== name) visit(fk.table)
    visiting.delete(name)
    done.add(name)
    out.push(name)
  }
  for (const name of [...wanted].sort()) visit(name)
  return out
}

export function buildMock() {
  const tables = model()
  const curated = curatedRows()
  const problems = []
  for (const [name, list] of Object.entries(curated)) {
    if (MIGRATION_TABLES.has(name)) continue
    const t = tables.get(name)
    if (!t) throw new Error(`curated table ${name} is not in the DDL`)
    const known = new Set([...t.columns.map(c => c.name), ...(ADDED_COLUMNS[name] ?? [])])
    for (const r of list) for (const col of Object.keys(r)) if (!known.has(col)) throw new Error(`${name}.${col} is not a column`)
  }

  const wanted = new Set([...tables.keys()].filter(n => !tables.get(n).temporary && !NO_MOCK.has(n)))
  for (const n of Object.keys(curated)) if (tables.has(n)) wanted.add(n)
  const state = { rows: new Map() }
  const sql = []
  let total = 0
  const generated = []

  // Rows the module seed (06, db/seed/demo_data.sql) already inserted: known here so other rows can
  // point at them (a fresh schema numbers them 1, 2, … in insert order), but not inserted again.
  const seeded = demoRows()
  for (const [name, list] of Object.entries(seeded)) {
    if (!tables.has(name)) continue
    state.rows.set(name, list.map((r, i) => ({ ...r, UUID: i + 1 })))
    wanted.delete(name)
  }
  const sequence = [...order(tables, wanted).filter(n => !MIGRATION_TABLES.has(n)), ...Object.keys(curated).filter(n => MIGRATION_TABLES.has(n))]
  for (const name of sequence) {
    const t = tables.get(name)
    let list = curated[name]
    if (!list) {
      list = []
      for (let k = 1; k <= ROWS_PER_TABLE; k++) {
        const row = {}
        for (const c of t.columns) {
          const v = valueFor(t, c, k, state)
          if (v !== undefined) row[c.name] = v
          else if (!c.nullable && !c.hasDefault && !c.identity && !c.virtual) problems.push(`${name}.${c.name}: no value for a NOT NULL column`)
        }
        // A unique key over few distinct values (e.g. two foreign keys to small tables) would repeat: stop there.
        const dup = t.uniques.concat(t.pk.length > 1 ? [t.pk] : []).some(u => list.some(o => u.every(col => JSON.stringify(o[col]) === JSON.stringify(row[col]))))
        if (dup) break
        list.push(row)
      }
      generated.push(name)
    }
    // What children may point at: plain values only (dates as their literal).
    state.rows.set(
      name,
      list.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v && typeof v === 'object' && v.$date ? { $date: v.$date } : v]))),
    )
    if (!list.length) continue
    sql.push(`\n-- ${name} (${list.length})${curated[name] ? '' : '  [generated]'}`)
    const info = new Map((t?.columns ?? []).map(c => [c.name, c]))
    for (const r of list) {
      const keys = Object.keys(r).filter(k => r[k] !== undefined)
      sql.push(`INSERT INTO ${name} (${keys.join(', ')}) VALUES (${keys.map(k => lit(name, k, r[k], info.get(k))).join(', ')});`)
      total++
    }
  }

  const header = `-- =============================================================================
-- 07  Demo data for every table (${total} rows)
-- Run after 06 (db/seed/demo_data.sql), which seeds the module tables this file links to.
-- Hand-written rows for what the app shows (lookups, people, cycles, the risk register,
-- assessments, controls, monitoring, plans, KPIs); generated rows for the other tables.
-- Generated by db/install/tools/mock.mjs. Rebuild with: node db/install/tools/mock.mjs
-- Remove later: every row is in a fresh schema, so 01_drop_all.sql + a re-install is simplest;
-- rows with a CREATED_BY column carry 'demo-seed'.
-- =============================================================================
SET DEFINE OFF
SET SERVEROUTPUT ON
`
  const footer = `
COMMIT;

-- Move every identity column past the ids used above, so new rows the app creates get fresh ids.
DECLARE
  n_max NUMBER;
BEGIN
  FOR c IN (SELECT table_name, column_name FROM user_tab_identity_cols) LOOP
    EXECUTE IMMEDIATE 'SELECT NVL(MAX("' || c.column_name || '"), 0) FROM "' || c.table_name || '"' INTO n_max;
    EXECUTE IMMEDIATE 'ALTER TABLE "' || c.table_name || '" MODIFY ("' || c.column_name
      || '" GENERATED BY DEFAULT ON NULL AS IDENTITY (START WITH ' || (n_max + 1) || '))';
  END LOOP;
  DBMS_OUTPUT.PUT_LINE('Identity columns moved past the demo ids.');
END;
/
`
  writeFileSync(join(root, '07_mock_data.sql'), header + sql.join('\n') + '\n' + footer)
  console.log(`07_mock_data.sql: ${total} rows, ${Object.keys(curated).length} hand-written tables, ${generated.length} generated`)
  if (problems.length) console.log('problems:\n  ' + [...new Set(problems)].join('\n  '))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) buildMock()
