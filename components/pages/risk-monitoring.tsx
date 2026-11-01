'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Check, CircleCheck, Clock, Download, Flag, Loader2, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LifecycleStepper } from '@/components/charter/lifecycle-stepper'
import { Chip, CountUp, DueChip, FilterChip, Meter, PageHeader, Panel, Person, SearchField, Stat } from '@/components/charter/primitives'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState, EmptyState, ErrorState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { useRow, useRows, useUpdateRow, type Row } from '@/lib/data'
import { apiErrorCode, apiErrorMessage } from '@/lib/apiClient'
import { recordAudit } from '@/lib/auditLog'
import { toRisk, type Risk } from '@/lib/risk'
import { DASH, daysUntil, formatDate } from '@/lib/format'
import { ActionPlanDialog, MONITORING } from '@/components/treatment/action-plan-dialog'
import {
  FigureStrip,
  ProgressBar,
  actionStatus,
  downloadCsv,
  numOrNull,
  pageSlice,
  riskLabel,
  riskRefOf,
  rowId,
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

  const [search, setSearch] = useState(params.get('q') ?? '')
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

  const stepper = <LifecycleStepper current="monitoring" />

  if (assessmentParam && cycleId == null) {
    return (
      <div className="space-y-6">
        {stepper}
        <EmptyState title="Assessment cycle not found" description={`“${assessmentParam}” is not a valid cycle id.`} />
      </div>
    )
  }

  const filtered = !!(search || status)
  const loaded = plansQ.isSuccess || noCycleRisks
  const showFinalize = cycleId != null && hasPermission('approve') && !!cycle && !cycleDone
  const newPlanButton = hasPermission('create') && (
    <Button
      variant={showFinalize ? 'secondary' : 'primary'}
      onClick={() => {
        setEditing(null)
        setDialogOpen(true)
      }}
    >
      <Plus aria-hidden="true" />
      New action plan
    </Button>
  )

  return (
    <div className="space-y-6">
      {stepper}

      <PageHeader
        eyebrow={cycleId != null ? 'RCSA · Step 5 · Cycle monitoring' : 'RCSA · Step 5'}
        title="Monitoring"
        description={cycleId != null ? 'Action plans for the risks in this assessment cycle, with progress and due dates.' : 'Action plans across all risks, with progress and due dates.'}
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={shown.length === 0}>
              <Download aria-hidden="true" />
              Export CSV
            </Button>
            {newPlanButton}
          </>
        }
      />

      {cycleId != null && (
        <section className="surface-panel px-6 py-4" aria-labelledby="cycle-heading">
          {cycleQ.isLoading ? (
            <div className="space-y-2" aria-label="Loading cycle">
              <span className="skeleton block h-4 w-40" />
              <span className="skeleton block h-5 w-72" />
            </div>
          ) : cycleQ.isError ? (
            apiErrorCode(cycleQ.error) === 'NOT_FOUND' ? (
              <p className="text-body-sm text-foreground">Assessment cycle #{cycleId} was not found.</p>
            ) : (
              <ErrorState error={cycleQ.error} onRetry={cycleQ.refetch} compact />
            )
          ) : cycle ? (
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="min-w-0 space-y-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-caption text-muted-foreground">{text(cycle.cycle_reference) ?? `Cycle #${cycleId}`}</span>
                  {cycleDone ? (
                    <Chip tone="success" icon={Check}>
                      Completed
                    </Chip>
                  ) : (
                    <Chip tone="info" icon={Clock}>
                      {text(cycle.status) ?? 'Status not set'}
                    </Chip>
                  )}
                </p>
                <h2 id="cycle-heading" className="font-display text-section text-foreground">
                  {text(cycle.cycle_name) ?? `Cycle #${cycleId}`}
                </h2>
                <p className="text-body-sm text-muted-foreground">
                  {formatDate(text(cycle.cycle_start_date))} – {formatDate(text(cycle.cycle_end_date))} · {risksQ.data ? `${risks.size} risk${risks.size === 1 ? '' : 's'}` : DASH}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="secondary">
                  <Link href={`/rcsa/provisioning/${cycleId}`}>Cycle details</Link>
                </Button>
                {showFinalize && (
                  <Button onClick={finalize} disabled={updateCycle.isPending || (!plansQ.isSuccess && !noCycleRisks)}>
                    {updateCycle.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Flag aria-hidden="true" />}
                    Finalize cycle
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </section>
      )}

      <FigureStrip>
        <Stat label="Open action plans" loading={!loaded} value={<CountUp value={stats.open} />} context={`${stats.total} in total`} />
        <Stat
          label={
            <span className="inline-flex items-center gap-1.5">
              <Clock className={'size-3.5 ' + (stats.overdue > 0 ? 'text-status-danger-fg' : 'text-muted-foreground')} aria-hidden="true" />
              Overdue
            </span>
          }
          loading={!loaded}
          value={<CountUp value={stats.overdue} />}
          tone={stats.overdue > 0 ? 'text-status-danger-fg' : undefined}
          context="Past the target end and not complete"
        />
        <Stat
          label={
            <span className="inline-flex items-center gap-1.5">
              <CircleCheck className="size-3.5 text-status-success-fg" aria-hidden="true" />
              Completed
            </span>
          }
          loading={!loaded}
          value={<CountUp value={stats.completed} />}
          context={stats.total ? `${Math.round((stats.completed / stats.total) * 100)}% of all plans` : 'No plans yet'}
        />
        <Stat
          label="Average completion"
          loading={!loaded}
          value={stats.avg == null ? DASH : <CountUp value={stats.avg} />}
          suffix={stats.avg == null ? undefined : '%'}
          context={stats.avg == null ? 'No progress recorded yet' : stats.avgOf < stats.total ? `Of ${stats.avgOf} plans with a % recorded` : `Across ${stats.avgOf} plans`}
        >
          <Meter value={stats.avg} label="Average completion" className="max-w-48" />
        </Stat>
      </FigureStrip>

      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={search} onChange={setSearch} label="Search action plans" placeholder="Title, goal, owner, risk…" />
        <FilterChip label="Status" value={status} onChange={v => setStatus(v as ActionStatus | '')} options={STATUSES.map(s => ({ value: s, label: s }))} />
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('')
              setStatus('')
            }}
          >
            Clear filters
          </Button>
        )}
        <span className="ml-auto text-caption tabular-nums text-muted-foreground">{loaded ? `${shown.length} of ${plans.length}` : ''}</span>
      </div>

      <Panel bodyClassName="p-0">
        <DataState
          query={noCycleRisks ? [risksQ] : [risksQ, plansQ]}
          empty={shown.length === 0}
          emptyTitle={filtered ? 'No action plans match' : noCycleRisks ? 'This cycle has no risks yet' : 'No action plans yet'}
          emptyDescription={
            filtered ? 'Clear the search or status filter.' : noCycleRisks ? 'Identify risks in the cycle before planning their treatment.' : 'Create action plans for risks that need treatment.'
          }
          emptyAction={!filtered && !noCycleRisks ? newPlanButton || undefined : undefined}
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table min-w-[960px]">
              <thead>
                <tr>
                  <th className="pl-6">Action plan</th>
                  <th>Risk</th>
                  <th>Owner</th>
                  <th>Progress</th>
                  <th>Due</th>
                  <th className="pr-6 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageSlice(shown, page, PAGE_SIZE).map(p => {
                  const id = rowId(p)
                  const rid = numOrNull(p.identify_risk_uuid)
                  const st = actionStatus(p)
                  const title = text(p.monitoring_title) ?? `Action plan #${id}`
                  const risk = rid != null ? risks.get(rid) : undefined
                  const end = text(p.estimated_end_date)
                  return (
                    <tr key={id ?? JSON.stringify(p)}>
                      <td className="max-w-[280px] py-2 pl-6">
                        <span className="block truncate font-medium text-foreground" title={title}>
                          {title}
                        </span>
                        <span className="block truncate text-caption text-muted-foreground" title={text(p.monitoring_goal) ?? undefined}>
                          {text(p.monitoring_goal) ?? 'No goal recorded'}
                        </span>
                      </td>
                      <td className="max-w-[240px] py-2">
                        {rid != null ? (
                          <>
                            <Link href={`/risks/${rid}`} className="block truncate rounded-xs text-foreground hover:text-primary hover:underline focus-ring" title={riskLabel(risk, rid)}>
                              {riskLabel(risk, rid)}
                            </Link>
                            <span className="block font-mono text-caption text-muted-foreground">{riskRefOf(risk, rid)}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">No risk linked</span>
                        )}
                      </td>
                      <td className="max-w-[160px]">
                        <Person name={text(p.mitigation_owner)} />
                      </td>
                      <td>
                        <ProgressBar value={numOrNull(p.completion_pct)} />
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="flex flex-col items-start gap-0.5">
                          <DueChip date={end} done={st === 'Completed'} doneLabel="Completed" />
                          {end && st !== 'Completed' && daysUntil(end) != null && (daysUntil(end) ?? 0) <= 14 && (
                            <span className="text-caption text-muted-foreground">Due {formatDate(end)}</span>
                          )}
                        </span>
                      </td>
                      <td className="pr-6 text-right">
                        {hasPermission('update') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Update ${title}`}
                            onClick={() => {
                              setEditing(p)
                              setDialogOpen(true)
                            }}
                          >
                            <Pencil aria-hidden="true" />
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
      </Panel>

      <ActionPlanDialog open={dialogOpen} onOpenChange={setDialogOpen} row={editing} />
    </div>
  )
}
