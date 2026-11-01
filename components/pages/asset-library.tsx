'use client'

/**
 * Business process library (read-only): per_mst_business_process and
 * per_mst_business_sub_process, with the number of risk-register entries per process.
 * The reference tables' column names aren't documented, so names, codes and parent
 * links are found defensively and anything not found is shown as "—".
 */
import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DataState } from '@/components/data-state'
import { useRows, type Row } from '@/lib/data'
import { DASH } from '@/lib/format'

const SKIP_NAME = /(created|updated|modified|approved|_by$|user|owner)/

function clean(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' || s === 'null' ? null : s
}

/** The first non-empty value among preferred keys, then any other `*_name` column. */
function pickName(row: Row, preferred: string[]): string | null {
  for (const k of preferred) {
    const v = clean(row[k])
    if (v) return v
  }
  for (const [k, v] of Object.entries(row)) {
    if (k.endsWith('_name') && !SKIP_NAME.test(k) && clean(v)) return clean(v)
  }
  return clean(row.name) ?? clean(row.title)
}

function pickCode(row: Row): string | null {
  for (const [k, v] of Object.entries(row)) {
    if ((k === 'code' || k.endsWith('_code')) && clean(v)) return clean(v)
  }
  return null
}

function pickDescription(row: Row): string | null {
  for (const [k, v] of Object.entries(row)) {
    if (k.includes('description') && clean(v)) return clean(v)
  }
  return null
}

function idOf(row: Row): number | null {
  const n = Number(row.uuid ?? row.id)
  return Number.isFinite(n) ? n : null
}

/** A sub-process's link to its process, if one of the usual columns is present. */
function parentOf(row: Row): number | null {
  for (const k of ['business_process_uuid', 'process_uuid', 'business_process_id', 'process_id', 'parent_uuid']) {
    const v = row[k]
    if (v != null && v !== '' && Number.isFinite(Number(v))) return Number(v)
  }
  return null
}

const norm = (s: string | null | undefined) => s?.trim().toLowerCase() ?? ''

interface Item {
  key: string
  id: number | null
  name: string | null
  code: string | null
  description: string | null
  risks: number
}

interface Process extends Item {
  subs: Item[]
}

export function AssetLibraryPage() {
  const processesQ = useRows('per_mst_business_process')
  const subsQ = useRows('per_mst_business_sub_process')
  const risksQ = useRows('per_trn_identify_risk')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { processes, orphanSubs } = useMemo(() => {
    const risks = risksQ.data ?? []
    const countRisks = (id: number | null, name: string | null, idKey: string, nameKey: string) =>
      risks.filter(r => (id != null && Number(r[idKey]) === id) || (name != null && norm(r[nameKey]) === norm(name))).length

    const processes: Process[] = (processesQ.data ?? []).map((row, i) => {
      const id = idOf(row)
      const name = pickName(row, ['business_process_name', 'process_name', 'name'])
      return {
        key: `p-${id ?? i}`,
        id,
        name,
        code: pickCode(row),
        description: pickDescription(row),
        risks: countRisks(id, name, 'business_process_uuid', 'process_name'),
        subs: [],
      }
    })
    const byId = new Map(processes.filter(p => p.id != null).map(p => [p.id!, p]))
    const orphanSubs: Item[] = []
    ;(subsQ.data ?? []).forEach((row, i) => {
      const id = idOf(row)
      const name = pickName(row, ['business_sub_process_name', 'sub_process_name', 'subprocess_name', 'name'])
      const item: Item = {
        key: `s-${id ?? i}`,
        id,
        name,
        code: pickCode(row),
        description: pickDescription(row),
        risks: countRisks(id, name, 'business_sub_process_uuid', 'sub_process_name'),
      }
      const parent = parentOf(row)
      const owner = parent != null ? byId.get(parent) : undefined
      if (owner) owner.subs.push(item)
      else orphanSubs.push(item)
    })
    const byName = (a: Item, b: Item) => (a.name ?? '').localeCompare(b.name ?? '')
    processes.sort(byName).forEach(p => p.subs.sort(byName))
    orphanSubs.sort(byName)
    return { processes, orphanSubs }
  }, [processesQ.data, subsQ.data, risksQ.data])

  const q = norm(search)
  const matches = (i: Item) => !q || [i.name, i.code, i.description].some(v => norm(v).includes(q))
  const shownProcesses = processes.filter(p => matches(p) || p.subs.some(matches))
  const shownOrphans = orphanSubs.filter(matches)

  const toggle = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-lg font-semibold text-slate-900">Business process library</h1>
        <p className="text-xs text-slate-500">Business processes and sub-processes from reference data, with the number of risks recorded against each.</p>
      </div>

      <DataState
        query={[processesQ, subsQ, risksQ]}
        empty={processes.length === 0 && orphanSubs.length === 0}
        emptyTitle="No business processes in reference data"
        emptyDescription="Business processes are maintained in the reference tables in the database."
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <label htmlFor="bp-search" className="sr-only">
              Search processes
            </label>
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input id="bp-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search processes…" className="h-8 pl-8 text-xs" />
          </div>
          <p className="text-xs text-slate-600">
            <span className="font-semibold tabular-nums text-slate-900">{processes.length}</span> processes ·{' '}
            <span className="font-semibold tabular-nums text-slate-900">{processes.reduce((n, p) => n + p.subs.length, 0) + orphanSubs.length}</span> sub-processes
          </p>
        </div>

        <div className="bg-white rounded border border-slate-200 overflow-x-auto">
          <table className="enterprise-table w-full text-xs">
            <thead>
              <tr>
                <th scope="col" className="w-8">
                  <span className="sr-only">Expand</span>
                </th>
                <th scope="col">Process</th>
                <th scope="col">Code</th>
                <th scope="col">Description</th>
                <th scope="col" className="text-right">
                  Sub-processes
                </th>
                <th scope="col" className="text-right">
                  Risks
                </th>
              </tr>
            </thead>
            <tbody>
              {shownProcesses.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No processes match “{search}”.
                  </td>
                </tr>
              )}
              {shownProcesses.map(p => {
                const open = expanded.has(p.key) || (!!q && p.subs.some(matches))
                const subs = q ? p.subs.filter(matches) : p.subs
                return (
                  <React.Fragment key={p.key}>
                    <tr>
                      <td>
                        {p.subs.length > 0 && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => toggle(p.key)}
                            aria-expanded={open}
                            aria-label={`${open ? 'Hide' : 'Show'} sub-processes of ${p.name ?? 'this process'}`}
                          >
                            {open ? <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
                          </Button>
                        )}
                      </td>
                      <td className="font-medium text-slate-900">{p.name ?? (p.id != null ? `Process #${p.id}` : DASH)}</td>
                      <td className="font-mono text-slate-600">{p.code ?? DASH}</td>
                      <td className="text-slate-600">{p.description ?? DASH}</td>
                      <td className="text-right tabular-nums">{p.subs.length}</td>
                      <td className="text-right tabular-nums">{p.risks}</td>
                    </tr>
                    {open &&
                      subs.map(s => (
                        <tr key={s.key} className="bg-slate-50/60">
                          <td />
                          <td className="pl-6 text-slate-800">{s.name ?? (s.id != null ? `Sub-process #${s.id}` : DASH)}</td>
                          <td className="font-mono text-slate-600">{s.code ?? DASH}</td>
                          <td className="text-slate-600">{s.description ?? DASH}</td>
                          <td />
                          <td className="text-right tabular-nums">{s.risks}</td>
                        </tr>
                      ))}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {orphanSubs.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">Sub-processes without a linked process</h2>
            <p className="text-[11px] text-slate-500">These sub-process rows have no recognisable link to a process in the reference data.</p>
            <div className="bg-white rounded border border-slate-200 overflow-x-auto">
              <table className="enterprise-table w-full text-xs">
                <thead>
                  <tr>
                    <th scope="col">Sub-process</th>
                    <th scope="col">Code</th>
                    <th scope="col">Description</th>
                    <th scope="col" className="text-right">
                      Risks
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shownOrphans.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500">
                        No sub-processes match “{search}”.
                      </td>
                    </tr>
                  )}
                  {shownOrphans.map(s => (
                    <tr key={s.key}>
                      <td className="font-medium text-slate-900">{s.name ?? (s.id != null ? `Sub-process #${s.id}` : DASH)}</td>
                      <td className="font-mono text-slate-600">{s.code ?? DASH}</td>
                      <td className="text-slate-600">{s.description ?? DASH}</td>
                      <td className="text-right tabular-nums">{s.risks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DataState>
    </div>
  )
}
