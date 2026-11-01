'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Download, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { useRows, type Row } from '@/lib/data'
import { recordAudit } from '@/lib/auditLog'
import { toRisk, type Risk } from '@/lib/risk'
import { DASH, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ActionPlanDialog, MONITORING, useDeleteActionPlan } from '@/components/treatment/action-plan-dialog'
import {
  ActionStatusBadge,
  ProgressBar,
  actionStatus,
  downloadCsv,
  labelCls,
  numOrNull,
  pageSlice,
  riskLabel,
  rowId,
  selectCls,
  text,
} from '@/components/treatment/shared'

const PAGE_SIZE = 25
type Tab = 'all' | 'open' | 'overdue' | 'completed'
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Completed' },
]

function inTab(p: Row, tab: Tab): boolean {
  const s = actionStatus(p)
  if (tab === 'open') return s !== 'Completed'
  if (tab === 'overdue') return s === 'Overdue'
  if (tab === 'completed') return s === 'Completed'
  return true
}

export function MonitoringactionplanPage() {
  const { hasPermission } = useAuth()
  const params = useSearchParams()
  const focusId = numOrNull(params.get('id') ?? params.get('actionId'))

  const plansQ = useRows(MONITORING)
  const risksQ = useRows('per_trn_identify_risk')
  const { remove, isPending: removing } = useDeleteActionPlan()

  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState<number | null>(numOrNull(params.get('riskId')))
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  useEffect(() => setPage(1), [tab, search, riskFilter])

  // Deep link (?id=) opens that plan for editing once it has loaded.
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (focused || focusId == null || !plansQ.data) return
    const row = plansQ.data.find(p => rowId(p) === focusId)
    setFocused(true)
    if (row && hasPermission('update')) {
      setEditing(row)
      setDialogOpen(true)
    } else if (row) {
      setSearch(text(row.monitoring_title) ?? '')
    }
  }, [focusId, plansQ.data, focused, hasPermission])

  const risks = useMemo(() => {
    const m = new Map<number, Risk>()
    for (const r of risksQ.data ?? []) {
      const risk = toRisk(r)
      if (Number.isFinite(risk.uuid)) m.set(risk.uuid, risk)
    }
    return m
  }, [risksQ.data])

  const plans = useMemo(() => plansQ.data ?? [], [plansQ.data])
  const base = useMemo(() => {
    const term = search.trim().toLowerCase()
    return plans.filter(p => {
      if (riskFilter != null && numOrNull(p.identify_risk_uuid) !== riskFilter) return false
      if (!term) return true
      const rid = numOrNull(p.identify_risk_uuid)
      return [text(p.monitoring_title), text(p.monitoring_goal), text(p.root_cause), text(p.mitigation_owner), rid != null ? risks.get(rid)?.statement : null]
        .some(v => v && v.toLowerCase().includes(term))
    })
  }, [plans, search, riskFilter, risks])
  const tabCounts = useMemo(() => Object.fromEntries(TABS.map(t => [t.id, base.filter(p => inTab(p, t.id)).length])) as Record<Tab, number>, [base])
  const shown = useMemo(() => base.filter(p => inTab(p, tab)), [base, tab])

  const openNew = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const exportCsv = () => {
    downloadCsv(
      `action-plans-${new Date().toISOString().slice(0, 10)}.csv`,
      ['ID', 'Title', 'Goal', 'Root cause', 'Risk ID', 'Risk', 'Owner', 'Planned start', 'Target end', 'Actual start', 'Actual end', 'Completion %', 'Status'],
      shown.map(p => {
        const rid = numOrNull(p.identify_risk_uuid)
        return [
          rowId(p),
          text(p.monitoring_title),
          text(p.monitoring_goal),
          text(p.root_cause),
          rid,
          rid != null ? risks.get(rid)?.statement : null,
          text(p.mitigation_owner),
          text(p.estimated_start_date)?.slice(0, 10),
          text(p.estimated_end_date)?.slice(0, 10),
          text(p.actual_start_date)?.slice(0, 10),
          text(p.actual_end_date)?.slice(0, 10),
          numOrNull(p.completion_pct),
          actionStatus(p),
        ]
      }),
    )
    recordAudit({ action: 'EXPORT', entity: 'Action plans', description: `Exported ${shown.length} action plans to CSV`, result: 'SUCCESS' })
  }

  const filtered = !!search || riskFilter != null || tab !== 'all'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Action plans</h1>
          <p className="text-sm text-slate-500 mt-0.5">Treatment actions for risks: owner, target dates and progress.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={shown.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            Export CSV
          </Button>
          {hasPermission('create') && (
            <Button size="sm" onClick={openNew}>
              <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              New action plan
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded">
        <div role="tablist" aria-label="Filter by status" className="flex gap-1 border-b border-slate-200 px-3 pt-2">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-3 py-2 text-xs font-medium border-b-2 -mb-px',
                tab === t.id ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-600 hover:text-slate-900',
              )}
            >
              {t.label}
              {plansQ.data && <span className="ml-1 text-slate-400 tabular-nums">({tabCounts[t.id]})</span>}
            </button>
          ))}
        </div>

        <div className="p-3 border-b border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label htmlFor="ap-search" className={labelCls}>
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <Input id="ap-search" className="pl-8 h-9" placeholder="Title, goal, root cause, owner, risk…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="ap-risk-filter" className={labelCls}>
              Risk
            </label>
            <select id="ap-risk-filter" className={selectCls} value={riskFilter ?? ''} onChange={e => setRiskFilter(e.target.value ? Number(e.target.value) : null)}>
              <option value="">All risks</option>
              {riskFilter != null && !risks.has(riskFilter) && <option value={riskFilter}>Risk #{riskFilter}</option>}
              {[...risks.values()].map(r => (
                <option key={r.uuid} value={r.uuid}>
                  #{r.uuid} · {(r.statement ?? 'No statement').slice(0, 70)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataState
          query={[plansQ, risksQ]}
          empty={shown.length === 0}
          emptyTitle={filtered ? 'No action plans match' : 'No action plans yet'}
          emptyDescription={filtered ? 'Change the tab, search or risk filter.' : 'Create an action plan for a risk that needs treatment.'}
          emptyAction={
            !filtered && hasPermission('create') ? (
              <Button size="sm" onClick={openNew}>
                <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                New action plan
              </Button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Action plan</th>
                  <th>Risk</th>
                  <th>Owner</th>
                  <th>Planned</th>
                  <th>Actual</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageSlice(shown, page, PAGE_SIZE).map(p => {
                  const id = rowId(p)
                  const rid = numOrNull(p.identify_risk_uuid)
                  const title = text(p.monitoring_title) ?? `Action plan #${id}`
                  return (
                    <tr key={id ?? JSON.stringify(p)} className={id === focusId ? 'bg-blue-50/50' : undefined}>
                      <td className="max-w-[280px]">
                        <span className="font-medium text-slate-900 block">{title}</span>
                        {text(p.monitoring_goal) && <span className="text-[11px] text-slate-500 line-clamp-2">{text(p.monitoring_goal)}</span>}
                        {text(p.root_cause) && <span className="text-[11px] text-slate-400 line-clamp-1">Root cause: {text(p.root_cause)}</span>}
                      </td>
                      <td className="max-w-[220px]">
                        {rid != null ? (
                          <Link href={`/rcsa/mitigation/${rid}`} className="text-xs text-blue-700 hover:underline line-clamp-2">
                            {riskLabel(risks.get(rid), rid)}
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">No risk linked</span>
                        )}
                      </td>
                      <td className="text-xs text-slate-600">{text(p.mitigation_owner) ?? DASH}</td>
                      <td className="text-xs text-slate-600 whitespace-nowrap">
                        {formatDate(text(p.estimated_start_date))} – {formatDate(text(p.estimated_end_date))}
                      </td>
                      <td className="text-xs text-slate-600 whitespace-nowrap">
                        {formatDate(text(p.actual_start_date))} – {formatDate(text(p.actual_end_date))}
                      </td>
                      <td>
                        <ProgressBar value={numOrNull(p.completion_pct)} />
                      </td>
                      <td>
                        <ActionStatusBadge row={p} />
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {hasPermission('update') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Edit ${title}`}
                            onClick={() => {
                              setEditing(p)
                              setDialogOpen(true)
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          </Button>
                        )}
                        {hasPermission('delete') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-600 hover:bg-red-50"
                            aria-label={`Delete ${title}`}
                            disabled={removing}
                            onClick={() => remove(p)}
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={shown.length} onPage={setPage} />
        </DataState>
      </div>

      <ActionPlanDialog open={dialogOpen} onOpenChange={setDialogOpen} row={editing} defaultRiskId={riskFilter} />
    </div>
  )
}
