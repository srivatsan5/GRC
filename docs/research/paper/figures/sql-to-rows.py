"""
Turn the live demo-data scripts (db/install/07_mock_data.sql and 10_more_demo_data.sql) into rows per table,
so the in-memory stand-in holds the same data as the Oracle demo install. Used only for screenshots.

    python3 -I docs/research/paper/figures/sql-to-rows.py <out.json>
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
tables: dict[str, list[dict]] = {}
problems: list[str] = []


def split_top(s: str, sep: str = ',') -> list[str]:
    out, depth, q, cur = [], 0, False, ''
    i = 0
    while i < len(s):
        c = s[i]
        if q:
            cur += c
            if c == "'":
                if i + 1 < len(s) and s[i + 1] == "'":
                    cur += "'"; i += 1
                else:
                    q = False
        elif c == "'":
            q = True; cur += c
        elif c == '(':
            depth += 1; cur += c
        elif c == ')':
            depth -= 1; cur += c
        elif c == sep and depth == 0:
            out.append(cur); cur = ''
        else:
            cur += c
        i += 1
    if cur.strip():
        out.append(cur)
    return out


def split_and(s: str) -> list[str]:
    """Split a WHERE clause on AND at the top level (not inside parentheses or quotes)."""
    marked = ''.join(split_top_mark(s))
    return [p for p in marked.split('\x00') if p.strip()]


def split_top_mark(s: str):
    depth, q, i = 0, False, 0
    while i < len(s):
        c = s[i]
        if q:
            if c == "'":
                q = False
        elif c == "'":
            q = True
        elif c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
        elif depth == 0 and re.match(r'\s+AND\s+', s[i:], re.I):
            m = re.match(r'\s+AND\s+', s[i:], re.I)
            yield '\x00'; i += m.end(); continue
        yield c; i += 1


def lookup(sql: str):
    m = re.match(r"\(\s*SELECT\s+(MIN\((\w+)\)|\w+)\s+FROM\s+(\w+)\s+WHERE\s+(.+)\)\s*$", sql, re.S | re.I)
    if not m:
        problems.append(f'unparsed subquery: {sql[:120]}'); return None
    col = (m.group(2) or m.group(1)).upper()
    agg_min = m.group(2) is not None
    table, where = m.group(3).upper(), m.group(4)
    conds = []
    for part in split_and(where):
        cm = re.match(r"\s*(\w+)\s*=\s*(.+?)\s*$", part, re.S)
        conds.append((cm.group(1).upper(), value(cm.group(2), {})))
    hits = [row.get(col) for row in tables.get(table, []) if all(row.get(c) == v for c, v in conds)]
    hits = [h for h in hits if h is not None]
    if not hits:
        problems.append(f'no match for {sql[:120]}'); return None
    return min(hits) if agg_min else hits[0]


def value(tok: str, env: dict):
    t = tok.strip()
    if t.upper() == 'NULL':
        return None
    if re.fullmatch(r'-?\d+', t):
        return int(t)
    if re.fullmatch(r'-?\d*\.\d+', t):
        return float(t)
    if t.startswith("'") and t.endswith("'"):
        return t[1:-1].replace("''", "'")
    m = re.fullmatch(r"DATE\s+'(\d{4}-\d{2}-\d{2})'", t, re.I)
    if m:
        return m.group(1) + 'T00:00:00Z'
    m = re.fullmatch(r"TIMESTAMP\s+'([\d\-]+)\s+([\d:.]+)'", t, re.I)
    if m:
        return f'{m.group(1)}T{m.group(2)}Z'
    if t.startswith('('):
        return lookup(t)
    if re.fullmatch(r'[a-z_]\w*', t) and t in env:
        return env[t]
    problems.append(f'unknown value: {t[:80]}')
    return None


def insert(stmt: str, env: dict):
    # INSERT INTO ERM_LNK_INCIDENT_RISK ... SELECT i.UUID, r.UUID, 'x' FROM ERM_TRN_INCIDENT i, PER_TRN_IDENTIFY_RISK r WHERE ...
    m = re.match(r"INSERT\s+INTO\s+ERM_LNK_INCIDENT_RISK.*?INCIDENT_REF\s*=\s*'([^']+)'.*?ASSESSMENT_REFERENCE_NUMBER\s*=\s*'([^']+)'", stmt, re.S | re.I)
    if m:
        inc = next((r['UUID'] for r in tables.get('ERM_TRN_INCIDENT', []) if r.get('INCIDENT_REF') == m.group(1)), None)
        risk = next((r['UUID'] for r in tables.get('PER_TRN_IDENTIFY_RISK', []) if r.get('ASSESSMENT_REFERENCE_NUMBER') == m.group(2)), None)
        links = tables.setdefault('ERM_LNK_INCIDENT_RISK', [])
        if inc and risk and not any(l['INCIDENT_UUID'] == inc and l['RISK_UUID'] == risk for l in links):
            links.append({'UUID': len(links) + 1, 'INCIDENT_UUID': inc, 'RISK_UUID': risk, 'CREATED_BY': 'demo-seed'})
        elif not (inc and risk):
            problems.append(f'incident link not resolved: {m.group(1)} / {m.group(2)}')
        return
    m = re.match(r"INSERT\s+INTO\s+(\w+)\s*\((.*?)\)\s*VALUES\s*\((.*)\)\s*(?:RETURNING\s+UUID\s+INTO\s+(\w+))?\s*$", stmt, re.S | re.I)
    if not m:
        problems.append(f'unparsed insert: {stmt[:120]}'); return
    table = m.group(1).upper()
    cols = [c.strip().upper() for c in m.group(2).split(',')]
    vals = split_top(m.group(3))
    if len(cols) != len(vals):
        problems.append(f'{table}: {len(cols)} columns, {len(vals)} values'); return
    row = {c: value(v, env) for c, v in zip(cols, vals)}
    rows = tables.setdefault(table, [])
    if row.get('UUID') is None:
        row['UUID'] = max([r['UUID'] for r in rows if isinstance(r.get('UUID'), int)] + [0]) + 1
    rows.append(row)
    if m.group(4):
        env[m.group(4)] = row['UUID']


def statements(text: str):
    # Drop comment lines and SQL*Plus commands, then split on ';' outside quotes and parentheses.
    lines = [l for l in text.splitlines() if not l.strip().startswith('--') and not re.match(r'\s*(SET|PROMPT|/)\b', l)]
    return [s.strip() for s in split_top('\n'.join(lines), ';') if s.strip()]


# Module demo data first (controls, policies, incidents, ...), as db/seed/demo-rows.mjs defines it.
import subprocess
mod = json.loads(subprocess.run(['node', '--input-type=module', '-e',
    "import { demoRows } from './db/seed/demo-rows.mjs'; console.log(JSON.stringify(demoRows()))"],
    cwd=ROOT, capture_output=True, text=True, check=True).stdout)
for table, rows in mod.items():
    for r in rows:
        row = {}
        for k, v in r.items():
            if isinstance(v, dict) and '$ref' in v:
                rt, kc, kv = v['$ref']
                row[k] = next((p['UUID'] for p in tables.get(rt.upper(), []) if p.get(kc) == kv), None)
            else:
                row[k] = v
        lst = tables.setdefault(table.upper(), [])
        row['UUID'] = len(lst) + 1
        lst.append(row)

for name in ['07_mock_data.sql', '10_more_demo_data.sql']:
    env: dict = {}
    for st in statements((ROOT / 'db/install' / name).read_text(encoding='utf8')):
        st = re.sub(r'^(DECLARE\b.*?BEGIN|BEGIN)\s*', '', st, flags=re.S | re.I)
        if re.match(r'INSERT\s+INTO', st, re.I):
            insert(st, env)

json.dump(tables, open(sys.argv[1], 'w'), indent=1)
print({t: len(r) for t, r in sorted(tables.items())})
print(f'{len(problems)} problems'); print('\n'.join(problems[:30]))
