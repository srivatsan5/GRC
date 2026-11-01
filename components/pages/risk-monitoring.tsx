'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Download, Pencil, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState, EmptyState, ErrorState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { useRow, useRows, useUpdateRow, type Row } from '@/lib/data'
import { apiErrorCode, apiErrorMessage } from '@/lib/apiClient'
import { recordAudit } from '@/lib/auditLog'
import { toRisk, type Risk } from '@/lib/risk'
import { DASH, daysUntil, formatDate, formatPct } from '@/lib/format'
import { ActionPlanDialog, MONITORING } from '@/components/treatment/action-plan-dialog'
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
  type ActionStatus,
} from '@/components/treatment/shared'

const PAGE_SIZE = 25
const CYCLE = 'erm_trn_assessment_cycle'
const STATUSES: ActionStatus[] = ['Not started', 'In progress', 'Overdue', 'Completed']

export function RiskMonitoringPage() {
  const params = useSearchParams()
  const assessmentParam = params.get('assessmentId')
  const cycleId = numOrNull(assessmentParam)
  const { hasPermission } = useAuth()
  const confirm = useConfirm()

  const cycleQ = useRow(CYCLE, cycleId)
  const risksQ = useRows('per_trn_identify_risk', { filter: cycleId != null ? { assessment_cycle_uuid: cycleId } : undefined })
  const cycleRiskIds = useMemo(
    () => (cycleId != null ? (risksQ.data ?? []).map(r => toRisk(r).uuid).filter(Number.isFinite) : []),
    [cycleId, risksQ.data],
  )
  const plansQ = useRows(MONITORING, {
    filter: cycleId != null ? { identify_risk_uuid: cycleRiskIds } : undefined,
    enabled: cycleId == null || (risksQ.isSuccess && cycleRiskIds.length > 0),
  })
  const updateCycle = useUpdateRow(CYCLE)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ActionStatus | ''>('')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  useEffect(() => setPage(1), [search, status])

  const risks = useMemo(() => {
    const m = new Map<number, Risk>()
    for (const r of risksQ.data ?? []) {
      const risk = toRisk(r)
      if (Number.isFinite(risk.uuid)) m.set(risk.uuid, risk)
    }
    return m
  }, [risksQ.data])

  // A cycle with no risks has no plans; the plans query is then disabled, so treat it as empty.
  const noCycleRisks = cycleId != null && risksQ.isSuccess && cycleRiskIds.length === 0
  const plans = useMemo(() => (noCycleRisks ? [] : plansQ.data ?? []), [noCycleRisks, plansQ.data])

  const stats = useMemo(() => {
    const by = (s: ActionStatus) => plans.filter(p => actionStatus(p) === s).length
    const pcts = plans.map(p => numOrNull(p.completion_pct)).filter((n): n is number => n != null)
    return {
      total: plans.length,
      completed: by('Completed'),
      overdue: by('Overdue'),
      open: plans.length - by('Completed'),
      avg: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null,
      avgOf: pcts.length,
    }
  }, [plans])

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase()
    return plans
      .filter(p => {
        if (status && actionStatus(p) !== status) return false
        if (!term) return true
        const rid = numOrNull(p.identify_risk_uuid)
        return [text(p.monitoring_title), text(p.monitoring_goal), text(p.mitigation_owner), rid != null ? risks.get(rid)?.statement : null]
          .some(v => v && v.toLowerCase().includes(term))
      })
      .sort((a, b) => {
        const order = (p: Row) => ['Overdue', 'In progress', 'Not started', 'Completed'].indexOf(actionStatus(p))
        return order(a) - order(b) || String(a.estimated_end_date ?? '9999').localeCompare(String(b.estimated_end_date ?? '9999'))
      })
  }, [plans, status, search, risks])

  const exportCsv = () => {
    downloadCsv(
      `action-plans${cycleId != null ? `-cycle-${cycleId}` : ''}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['ID', 'Action plan', 'Goal', 'Risk ID', 'Risk', 'Owner', 'Planned start', 'Target end', 'Actual start', 'Actual end', 'Completion %', 'Status'],
      shown.map(p => {
        const rid = numOrNull(p.identify_risk_uuid)
        return [
          rowId(p),
          text(p.monitoring_title),
          text(p.monitoring_goal),
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
    recordAudit({
      action: 'EXPORT',
      entity: 'Action plans',
      entity_id: cycleId ?? undefined,
      description: `Exported ${shown.length} action plans to CSV${cycleId != null ? ` (cycle ${cycleId})` : ''}`,
      result: 'SUCCESS',
    })
  }

  const cycle = cycleQ.data
  const cycleDone = String(cycle?.status ?? '').toLowerCase() === 'completed'

  const finalize = async () => {
    if (cycleId == null) return
    const parts = [`${stats.open} of ${stats.total} action plan${stats.total === 1 ? ' is' : 's are'} still open`]
    if (stats.overdue) parts.push(`${stats.overdue} overdue`)
    const ok = await confirm({
      title: 'Finalize this assessment cycle?',
      description: `The cycle’s status will be set to Completed. ${parts.join(', ')}.`,
      confirmLabel: 'Finalize cycle',
      tone: stats.open > 0 ? 'warning' : 'info',
    })
    if (!ok) return
    try {
      await updateCycle.mutateAsync({ id: cycleId, values: { status: 'Completed' } })
      toast.success('Assessment cycle finalized')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  if (assessmentParam && cycleId == null) {
    return <EmptyState title="Assessment cycle not found" description={`“${assessmentParam}” is not a valid cycle id.`} />
  }

  const filtered = !!(search || status)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Risk monitoring</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {cycleId != null ? 'Action plans for the risks in this assessment cycle.' : 'Action plans across all risks, with progress and due dates.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={shown.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            Export CSV
          </Button>
          {hasPermission('create') && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              New action plan
            </Button>
          )}
        </div>
      </div>

      {cycleId != null && (
        <section className="bg-white border border-slate-200 rounded p-4" aria-labelledby="cycle-heading">
          {cycleQ.isLoading ? (
            <p className="text-xs text-slate-500">Loading cycle…</p>
          ) : cycleQ.isError ? (
            apiErrorCode(cycleQ.error) === 'NOT_FOUND' ? (
              <p className="text-sm text-slate-700">Assessment cycle #{cycleId} was not found.</p>
            ) : (
              <ErrorState error={cycleQ.error} onRetry={cycleQ.refetch} compact />
            )
          ) : cycle ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] text-slate-500 font-mono">{text(cycle.cycle_reference) ?? `Cycle #${cycleId}`}</span>
                <h2 id="cycle-heading" className="text-sm font-semibold text-slate-900">
                  {text(cycle.cycle_name) ?? `Cycle #${cycleId}`}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Status: <strong className="text-slate-800">{text(cycle.status) ?? DASH}</strong> · {formatDate(text(cycle.cycle_start_date))} –{' '}
                  {formatDate(text(cycle.cycle_end_date))} · {risksQ.data ? `${risks.size} risk${risks.size === 1 ? '' : 's'}` : DASH}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                  <Link href={`/rcsa/provisioning/${cycleId}`}>Cycle details</Link>
                </Button>
                {hasPermission('approve') &&
                  (cycleDone ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Cycle completed
                    </span>
                  ) : (
                    <Button size="sm" className="h-8 text-xs" onClick={finalize} disabled={updateCycle.isPending || (!plansQ.isSuccess && !noCycleRisks)}>
                      Finalize cycle
                    </Button>
                  ))}
              </div>
            </div>
          ) : null}
        </section>
      )}

      {(plansQ.isSuccess || noCycleRisks) && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ['Action plans', String(stats.total), null],
            ['Open', String(stats.open), null],
            ['Overdue', String(stats.overdue), 'Past target end date and not complete'],
            ['Completed', String(stats.completed), null],
            ['Average completion', formatPct(stats.avg), stats.avgOf < stats.total ? `Of ${stats.avgOf} plans with a % recorded` : null],
          ].map(([label, value, hint]) => (
            <div key={label} className="bg-white border border-slate-200 rounded p-3">
              <span className="block text-[11px] text-slate-500">{label}</span>
              <span className={`text-lg font-semibold tabular-nums ${label === 'Overdue' && stats.overdue > 0 ? 'text-red-700' : 'text-slate-900'}`}>{value}</span>
              {hint && <span className="block text-[10px] text-slate-400">{hint}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded">
        <div className="p-3 border-b border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label htmlFor="mon-search" className={labelCls}>
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <Input id="mon-search" className="pl-8 h-9" placeholder="Title, goal, owner, risk…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="mon-status" className={labelCls}>
              Status
            </label>
            <select id="mon-status" className={selectCls} value={status} onChange={e => setStatus(e.target.value as ActionStatus | '')}>
              <option value="">All</option>
              {STATUSES.map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <DataState
          query={noCycleRisks ? [risksQ] : [risksQ, plansQ]}
          empty={shown.length === 0}
          emptyTitle={
            filtered ? 'No action plans match' : noCycleRisks ? 'This cycle has no risks yet' : 'No action plans yet'
          }
          emptyDescription={
            filtered
              ? 'Clear the search or status filter.'
              : noCycleRisks
                ? 'Identify risks in the cycle before planning their treatment.'
                : 'Create action plans for risks that need treatment.'
          }
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Action plan</th>
                  <th>Risk</th>
                  <th>Owner</th>
                  <th>Target end</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageSlice(shown, page, PAGE_SIZE).map(p => {
                  const id = rowId(p)
                  const rid = numOrNull(p.identify_risk_uuid)
                  const due = daysUntil(text(p.estimated_end_date))
                  const st = actionStatus(p)
                  const title = text(p.monitoring_title) ?? `Action plan #${id}`
                  return (
                    <tr key={id ?? JSON.stringify(p)}>
                      <td className="max-w-[280px]">
                        <span className="font-medium text-slate-900 block">{title}</span>
                        {text(p.monitoring_goal) && <span className="text-[11px] text-slate-500 line-clamp-2">{text(p.monitoring_goal)}</span>}
                      </td>
                      <td className="max-w-[240px]">
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
                        {formatDate(text(p.estimated_end_date))}
                        {due != null && st !== 'Completed' && (
                          <span className={`block text-[11px] ${due < 0 ? 'text-red-700' : 'text-slate-500'}`}>
                            {due < 0 ? `${-due} day${due === -1 ? '' : 's'} overdue` : due === 0 ? 'Due today' : `Due in ${due} day${due === 1 ? '' : 's'}`}
                          </span>
                        )}
                      </td>
                      <td>
                        <ProgressBar value={numOrNull(p.completion_pct)} />
                      </td>
                      <td>
                        <ActionStatusBadge row={p} />
                      </td>
                      <td className="text-right">
                        {hasPermission('update') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Update ${title}`}
                            onClick={() => {
                              setEditing(p)
                              setDialogOpen(true)
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
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

      <ActionPlanDialog open={dialogOpen} onOpenChange={setDialogOpen} row={editing} />
    </div>
  )
}
