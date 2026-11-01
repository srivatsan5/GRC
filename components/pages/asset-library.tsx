'use client'

/**
 * Business process library (read-only): per_mst_business_process and
 * per_mst_business_sub_process, with the number of risk-register entries per process.
 * The reference tables' column names aren't documented, so names, codes and parent
 * links are found defensively and anything not found is shown as "—".
 */
import React, { useMemo, useState } from 'react'
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, CornerDownRight } from 'lucide-react'
import { CountUp, PageHeader, Panel, SearchField } from '@/components/charter/primitives'
import { Headline, HeadlineCell, Muted, NameCell, Toolbar } from '@/components/controls/charter-bits'
import { cn } from '@/lib/utils'
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

  const subCount = processes.reduce((n, p) => n + p.subs.length, 0) + orphanSubs.length
  const withRisks = processes.filter(p => p.risks > 0).length
  const loading = processesQ.isLoading || subsQ.isLoading || risksQ.isLoading
  const allOpen = shownProcesses.length > 0 && shownProcesses.every(p => p.subs.length === 0 || expanded.has(p.key))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reference data"
        title="Business processes"
        description="Business processes and sub-processes from reference data, with the number of risk-register entries recorded against each."
      />

      <DataState
        query={[processesQ, subsQ, risksQ]}
        empty={processes.length === 0 && orphanSubs.length === 0}
        emptyTitle="No business processes in reference data"
        emptyDescription="Business processes are maintained in the reference tables in the database."
      >
        <Headline label="Process figures">
          <HeadlineCell label="Processes" loading={loading} value={<CountUp value={processes.length} />} context="Top-level business processes" />
          <HeadlineCell label="Sub-processes" loading={loading} value={<CountUp value={subCount} />} context={orphanSubs.length ? `${orphanSubs.length} without a linked process` : 'All linked to a process'} />
          <HeadlineCell label="Processes with risks" loading={loading} value={<CountUp value={withRisks} />} context={`of ${processes.length} have at least one risk recorded`} />
        </Headline>

        <Toolbar
          end={
            <Button
              variant="ghost"
              onClick={() => setExpanded(allOpen ? new Set() : new Set(processes.filter(p => p.subs.length).map(p => p.key)))}
              disabled={!processes.some(p => p.subs.length)}
            >
              {allOpen ? <ChevronsDownUp aria-hidden="true" /> : <ChevronsUpDown aria-hidden="true" />}
              {allOpen ? 'Collapse all' : 'Expand all'}
            </Button>
          }
        >
          <SearchField label="Search processes" placeholder="Process, code, description…" value={search} onChange={setSearch} />
        </Toolbar>

        <Panel bodyClassName="p-0" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="enterprise-table min-w-[720px]">
              <thead>
                <tr>
                  <th scope="col" className="pl-6">Process</th>
                  <th scope="col">Description</th>
                  <th scope="col" data-numeric>
                    Sub-processes
                  </th>
                  <th scope="col" data-numeric className="pr-6">
                    Risks
                  </th>
                </tr>
              </thead>
              <tbody>
                {shownProcesses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
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
                        <td className="pl-3">
                          <div className="flex items-center gap-1">
                            {p.subs.length > 0 ? (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                onClick={() => toggle(p.key)}
                                aria-expanded={open}
                                aria-label={`${open ? 'Hide' : 'Show'} sub-processes of ${p.name ?? 'this process'}`}
                              >
                                <ChevronRight className={cn('transition-transform duration-(--duration-fast) ease-out', open && 'rotate-90')} aria-hidden="true" />
                              </Button>
                            ) : (
                              <span className="size-7 shrink-0" aria-hidden="true" />
                            )}
                            <NameCell name={p.name ?? (p.id != null ? `Process #${p.id}` : DASH)} code={p.code} maxWidth="max-w-[320px]" />
                          </div>
                        </td>
                        <td>
                          <span className="line-clamp-2 max-w-[420px] text-foreground-secondary" title={p.description ?? undefined}>
                            {p.description ?? <Muted>{DASH}</Muted>}
                          </span>
                        </td>
                        <td data-numeric className="tabular-nums">
                          {p.subs.length || <Muted>0</Muted>}
                        </td>
                        <td data-numeric className="pr-6 tabular-nums">
                          {p.risks ? <span className="font-medium text-foreground">{p.risks}</span> : <Muted>0</Muted>}
                        </td>
                      </tr>
                      {open &&
                        subs.map(s => (
                          <tr key={s.key} className="bg-surface-sunken/50">
                            <td className="pl-3">
                              <div className="flex items-center gap-1 pl-8">
                                <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                <NameCell name={<span className="font-normal">{s.name ?? (s.id != null ? `Sub-process #${s.id}` : DASH)}</span>} code={s.code} maxWidth="max-w-[300px]" />
                              </div>
                            </td>
                            <td>
                              <span className="line-clamp-2 max-w-[420px] text-foreground-secondary">{s.description ?? <Muted>{DASH}</Muted>}</span>
                            </td>
                            <td />
                            <td data-numeric className="pr-6 tabular-nums">
                              {s.risks ? <span className="font-medium text-foreground">{s.risks}</span> : <Muted>0</Muted>}
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {orphanSubs.length > 0 && (
          <Panel title="Sub-processes without a linked process" meta={`${orphanSubs.length} in reference data`} bodyClassName="p-0" className="overflow-hidden">
            <p className="px-6 pb-3 text-body-sm text-muted-foreground">These sub-process rows have no recognisable link to a process in the reference data.</p>
            <div className="overflow-x-auto">
              <table className="enterprise-table min-w-[600px]">
                <thead>
                  <tr>
                    <th scope="col" className="pl-6">Sub-process</th>
                    <th scope="col">Description</th>
                    <th scope="col" data-numeric className="pr-6">
                      Risks
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shownOrphans.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-muted-foreground">
                        No sub-processes match “{search}”.
                      </td>
                    </tr>
                  )}
                  {shownOrphans.map(s => (
                    <tr key={s.key}>
                      <td className="pl-6">
                        <NameCell name={s.name ?? (s.id != null ? `Sub-process #${s.id}` : DASH)} code={s.code} />
                      </td>
                      <td>
                        <span className="line-clamp-2 max-w-[480px] text-foreground-secondary">{s.description ?? <Muted>{DASH}</Muted>}</span>
                      </td>
                      <td data-numeric className="pr-6 tabular-nums">
                        {s.risks ? <span className="font-medium text-foreground">{s.risks}</span> : <Muted>0</Muted>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </DataState>
    </div>
  )
}
