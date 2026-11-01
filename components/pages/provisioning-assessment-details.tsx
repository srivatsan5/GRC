'use client'

/** /rcsa/provisioning/[id] — one assessment cycle and the risks assessed in it. */
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, ExternalLink, Gauge, MoreHorizontal, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState, EmptyState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { BandBadge, BandPips, RiskMovement } from '@/components/band-badge'
import { LifecycleStepper } from '@/components/charter/lifecycle-stepper'
import { ApprovalBadge, CountUp, DueChip, Meter, PageHeader, Panel, Person, Stat } from '@/components/charter/primitives'
import { useDeleteRow, useRow, useRowPage, useRows, type Row } from '@/lib/data'
import { BAND_STYLES, bandCounts, toRisk } from '@/lib/risk'
import { formatDate } from '@/lib/format'
import { useOrgSettings } from '@/lib/settings'
import { apiErrorMessage } from '@/lib/apiClient'
import { CYCLE_TABLE, RISK_TABLE, RiskDialog } from '@/components/rcsa/risk-dialog'
import { CycleDialog } from '@/components/rcsa/cycle-dialog'
import { CycleRiskDecision } from '@/components/cycles/decision'
import { CycleStatusChip, CycleTimeline, SortTh, type SortState } from '@/components/cycles/cycle-bits'

const PAGE_SIZE = 25
const CONTROL_TABLE = 'per_trn_control_implementation'

export function ProvisioningAssessmentDetailsPage({ assessmentId }: { assessmentId: string }) {
  const router = useRouter()
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const { money, bands } = useOrgSettings()
  const cycleId = Number(assessmentId)
  const validId = Number.isInteger(cycleId) && cycleId > 0
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState>({
    sort: 'created_on',
    order: 'desc',
  })
  const [riskDialog, setRiskDialog] = useState<{
    open: boolean
    risk: Row | null
  }>({ open: false, risk: null })
  const [cycleOpen, setCycleOpen] = useState(false)

  const cycle = useRow(CYCLE_TABLE, validId ? cycleId : null)
  const filter = { assessment_cycle_uuid: cycleId }
  const allRisks = useRows(RISK_TABLE, { filter, enabled: validId })
  const pageQ = useRowPage(RISK_TABLE, { page, pageSize: PAGE_SIZE, sort: sort.sort, order: sort.order, filter }, { enabled: validId })
  const items = pageQ.data?.items ?? []
  const ids = useMemo(() => items.map(r => Number(r.uuid)).filter(Number.isFinite), [items])
  const controls = useRows(CONTROL_TABLE, {
    filter: { identify_risk_uuid: ids },
    enabled: ids.length > 0,
  })
  const del = useDeleteRow(RISK_TABLE)

  const controlCount = useMemo(() => {
    const m = new Map<number, number>()
    for (const c of controls.data ?? []) {
      const k = Number(c.identify_risk_uuid)
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [controls.data])

  const summary = useMemo(() => {
    const risks = (allRisks.data ?? []).map(toRisk)
    const counts = bandCounts(
      risks.map(r => r.inherentScore),
      bands,
    )
    const sles = risks.map(r => r.sle).filter((v): v is number => v != null)
    return {
      total: risks.length,
      rated: risks.length - counts['Not rated'],
      residual: risks.filter(r => r.residualScore != null).length,
      approved: risks.filter(r => r.approvalStatus === 'APPROVED').length,
      submitted: risks.filter(r => r.approvalStatus === 'SUBMITTED' || r.approvalStatus === 'IN_REVIEW' || r.approvalStatus === 'PENDING').length,
      high: counts.High,
      critical: counts.Critical,
      sle: sles.length ? sles.reduce((a, b) => a + b, 0) : null,
      sleCount: sles.length,
    }
  }, [allRisks.data, bands])

  async function remove(row: Row) {
    const r = toRisk(row)
    const ok = await confirm({
      title: 'Delete this risk?',
      description: `${r.statement ?? `Risk ${r.uuid}`} — the risk is removed permanently, together with its applied controls, action plans and assessment records.`,
      confirmLabel: 'Delete risk',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await del.mutateAsync(r.uuid)
      toast.success('Risk deleted')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const onSort = (s: SortState) => {
    setSort(s)
    setPage(1)
  }

  const c = cycle.data
  const completed = c?.status === 'Completed'
  const canCreate = hasPermission('create')
  const canUpdate = hasPermission('update')
  const canDelete = hasPermission('delete')
  const addButton = canCreate ? (
    <Button onClick={() => setRiskDialog({ open: true, risk: null })}>
      <Plus aria-hidden="true" />
      Add risk to this cycle
    </Button>
  ) : null

  if (!validId) {
    return (
      <div className="space-y-6">
        <LifecycleStepper current="cycles" />
        <Panel>
          <EmptyState
            title="Assessment cycle not found"
            description="The link doesn't point to a valid cycle."
            action={
              <Button asChild variant="secondary">
                <Link href="/rcsa/provisioning">Back to all cycles</Link>
              </Button>
            }
          />
        </Panel>
      </div>
    )
  }

  const pct = (part: number) => (summary.total ? Math.round((part / summary.total) * 100) : null)
  const statsLoading = allRisks.isLoading
  const hc = summary.high + summary.critical

  return (
    <div className="space-y-6">
      <LifecycleStepper current="cycles" />

      <DataState query={cycle}>
        {c ? (
          <PageHeader
            eyebrow={
              <Link href="/rcsa/provisioning" className="inline-flex items-center gap-1.5 rounded-xs hover:text-foreground focus-ring">
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                Assessment cycles
              </Link>
            }
            title={c.cycle_name || 'Untitled cycle'}
            description={
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="font-mono text-body-sm text-foreground-secondary">{c.cycle_reference || 'No reference'}</span>
                <CycleStatusChip status={c.status} />
                {[c.cycle_type, c.cycle_period].filter(Boolean).length > 0 && <span className="text-body-sm">{[c.cycle_type, c.cycle_period].filter(Boolean).join(' · ')}</span>}
                <span aria-hidden="true" className="hidden text-border-strong sm:inline">
                  |
                </span>
                <span className="text-body-sm tabular-nums">
                  {formatDate(c.cycle_start_date)} – {formatDate(c.cycle_end_date)}
                </span>
                <span className="inline-flex items-center gap-2 text-body-sm">
                  Deadline
                  <DueChip date={c.submission_deadline} done={completed} doneLabel="Cycle completed" noDateLabel="Not set" />
                </span>
              </span>
            }
            actions={
              <>
                {canUpdate && (
                  <Button variant="secondary" onClick={() => setCycleOpen(true)}>
                    <Pencil aria-hidden="true" />
                    Edit cycle
                  </Button>
                )}
                {addButton}
              </>
            }
          />
        ) : (
          <Panel>
            <EmptyState
              title="Assessment cycle not found"
              description="It may have been deleted."
              action={
                <Button asChild variant="secondary">
                  <Link href="/rcsa/provisioning">Back to all cycles</Link>
                </Button>
              }
            />
          </Panel>
        )}
      </DataState>

      {c && (
        <>
          {/* Progress: one panel, five cells split by hairlines, then the schedule */}
          <section aria-label="Cycle progress" className="surface-panel overflow-hidden">
            <div className="grid grid-cols-2 lg:grid-cols-5">
              <Cell>
                <Stat
                  label="Risks"
                  loading={statsLoading}
                  value={<CountUp value={summary.total} />}
                  context={
                    summary.sle != null
                      ? `${money(summary.sle, { compact: true })} SLE${summary.sleCount < summary.total ? ` · ${summary.sleCount} of ${summary.total} recorded` : ''}`
                      : 'No SLE recorded'
                  }
                />
              </Cell>
              <Cell className="border-l">
                <ProgressStat label="Inherent rated" part={summary.rated} whole={summary.total} pct={pct(summary.rated)} loading={statsLoading} />
              </Cell>
              <Cell className="border-t lg:border-t-0 lg:border-l">
                <ProgressStat label="Residual rated" part={summary.residual} whole={summary.total} pct={pct(summary.residual)} loading={statsLoading} />
              </Cell>
              <Cell className="border-t border-l lg:border-t-0">
                <ProgressStat
                  label="Approved"
                  part={summary.approved}
                  whole={summary.total}
                  pct={pct(summary.approved)}
                  loading={statsLoading}
                  note={summary.submitted ? `${summary.submitted} awaiting a decision` : undefined}
                />
              </Cell>
              <Cell className="col-span-2 border-t lg:col-span-1 lg:border-t-0 lg:border-l">
                <Stat
                  label="High & critical"
                  loading={statsLoading}
                  value={<CountUp value={hc} />}
                  tone={summary.critical ? 'text-risk-critical-text' : summary.high ? 'text-risk-high-text' : undefined}
                  context={summary.total ? `Inherent · ${summary.critical} critical, ${summary.high} high` : 'No risks yet'}
                >
                  {summary.critical > 0 && (
                    <span>
                      <span className={`inline-flex h-badge items-center gap-1.5 rounded-sm px-2 text-caption font-medium ${BAND_STYLES.Critical.solid}`}>
                        <BandPips level={4} />
                        {summary.critical} Critical
                      </span>
                    </span>
                  )}
                </Stat>
              </Cell>
            </div>
            <div className="grid grid-cols-1 items-center gap-x-10 gap-y-4 border-t bg-surface-sunken/60 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
                <span className="label-caps shrink-0">Schedule</span>
                <CycleTimeline start={c.cycle_start_date} end={c.cycle_end_date} deadline={c.submission_deadline} completed={completed} className="min-w-0 flex-1" />
              </div>
              <p className="text-body-sm text-muted-foreground">
                Finalize the cycle on{' '}
                <Link href="/rcsa/monitoring" className="inline-flex items-center gap-1 rounded-xs font-medium text-primary hover:underline focus-ring">
                  Monitoring
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </p>
            </div>
            {c.notes && (
              <div className="border-t px-5 py-4 sm:px-6">
                <p className="label-caps mb-1">Notes</p>
                <p className="max-w-3xl text-body-sm whitespace-pre-line text-foreground-secondary">{c.notes}</p>
              </div>
            )}
          </section>

          <Panel title="Risks in this cycle" meta={pageQ.data ? `${pageQ.data.total} risk${pageQ.data.total === 1 ? '' : 's'}` : undefined} bodyClassName="p-0 pt-4">
            <DataState
              query={pageQ}
              empty={items.length === 0}
              emptyTitle="No risks in this cycle yet"
              emptyDescription="Add a risk here, or assign existing risks to this cycle from the risk register."
              emptyAction={addButton}
            >
              <div className="overflow-x-auto">
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <SortTh label="Risk" column="risk_statement" state={sort} onSort={onSort} className="pl-6" />
                      <SortTh label="Owner" column="risk_owner" state={sort} onSort={onSort} />
                      <th>Inherent</th>
                      <th>Residual</th>
                      <SortTh label="SLE" column="inherent_sle" state={sort} onSort={onSort} numeric />
                      <th data-numeric>Controls</th>
                      <SortTh label="Approval" column="approval_status" state={sort} onSort={onSort} />
                      <th className="pr-6 text-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(row => {
                      const r = toRisk(row)
                      const href = `/risks/${r.uuid}`
                      const ref = r.referenceNumber ?? `#${r.uuid}`
                      const sub = [ref, r.process].filter(Boolean).join(' · ')
                      const assessHref = `/assessments/inherent?riskId=${r.uuid}`
                      const controlsHref = `/rcsa/provisioning/${assessmentId}/controls/${r.uuid}`
                      const nControls = controlCount.get(r.uuid) ?? 0
                      return (
                        <tr
                          key={r.uuid}
                          className="cursor-pointer"
                          onClick={e => {
                            if ((e.target as HTMLElement).closest('a,button,input,select,textarea,[role="menuitem"],[role="dialog"]')) return
                            router.push(href)
                          }}
                        >
                          <td className="py-2 pl-6">
                            <div className="w-44 xl:w-52">
                              <Link href={href} className="block truncate font-medium text-foreground underline-offset-2 hover:underline focus-ring rounded-xs" title={r.statement ?? undefined}>
                                {r.statement ?? <span className="font-normal text-muted-foreground italic">No statement recorded</span>}
                              </Link>
                              <span className="block truncate font-mono text-caption text-muted-foreground" title={sub}>
                                {sub}
                              </span>
                            </div>
                          </td>
                          <td className="max-w-[168px]">
                            <Person name={r.owner} />
                          </td>
                          <td className="whitespace-nowrap">
                            <BandBadge score={r.inherentScore} kind="Inherent" rateHref={canUpdate ? assessHref : undefined} />
                          </td>
                          <td className="whitespace-nowrap">
                            {r.inherentScore == null && r.residualScore == null ? (
                              <span className="text-caption text-muted-foreground">Rate inherent first</span>
                            ) : (
                              <RiskMovement inherent={r.inherentScore} residual={r.residualScore} rateHref={canUpdate ? controlsHref : undefined} />
                            )}
                          </td>
                          <td data-numeric className="whitespace-nowrap">
                            {r.sle == null ? <span className="text-muted-foreground">—</span> : money(r.sle)}
                          </td>
                          <td data-numeric>
                            {controls.isLoading ? (
                              <span className="skeleton inline-block h-3 w-4 align-middle" />
                            ) : controls.isError ? (
                              '—'
                            ) : (
                              <Link
                                href={controlsHref}
                                aria-label={`${nControls} control${nControls === 1 ? '' : 's'} applied: open controls for ${r.statement ?? ref}`}
                                className="inline-flex items-center gap-1 rounded-xs font-medium text-primary underline-offset-2 hover:underline focus-ring"
                              >
                                {nControls === 0 ? (canUpdate ? 'Apply' : 'None') : nControls}
                                <ArrowRight className="size-3" aria-hidden="true" />
                              </Link>
                            )}
                          </td>
                          <td>
                            <ApprovalBadge status={r.approvalStatus ?? 'DRAFT'} />
                          </td>
                          <td className="pr-6">
                            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                              <CycleRiskDecision risk={row} />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="size-8" aria-label={`More actions for ${r.statement ?? ref}`}>
                                    <MoreHorizontal aria-hidden="true" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-48">
                                  <DropdownMenuItem asChild>
                                    <Link href={href}>
                                      <ExternalLink aria-hidden="true" />
                                      Open risk
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <Link href={assessHref}>
                                      <Gauge aria-hidden="true" />
                                      {canUpdate ? 'Inherent assessment' : 'View inherent assessment'}
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <Link href={controlsHref}>
                                      <ShieldCheck aria-hidden="true" />
                                      Controls &amp; residual
                                    </Link>
                                  </DropdownMenuItem>
                                  {(canUpdate || canDelete) && <DropdownMenuSeparator />}
                                  {canUpdate && (
                                    <DropdownMenuItem onSelect={() => setRiskDialog({ open: true, risk: row })}>
                                      <Pencil aria-hidden="true" />
                                      Edit risk
                                    </DropdownMenuItem>
                                  )}
                                  {canDelete && (
                                    <DropdownMenuItem variant="destructive" disabled={del.isPending} onSelect={() => remove(row)}>
                                      <Trash2 aria-hidden="true" />
                                      Delete risk
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Pager page={page} pageSize={PAGE_SIZE} total={pageQ.data?.total ?? 0} onPage={setPage} busy={pageQ.isFetching} />
            </DataState>
          </Panel>
        </>
      )}

      <RiskDialog open={riskDialog.open} risk={riskDialog.risk} cycleUuid={cycleId} lockCycle onOpenChange={open => setRiskDialog(d => ({ ...d, open }))} />
      {c && <CycleDialog open={cycleOpen} cycle={c} onOpenChange={setCycleOpen} />}
    </div>
  )
}

function Cell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`min-w-0 p-5 lg:p-6 ${className ?? ''}`}>{children}</div>
}

function ProgressStat({ label, part, whole, pct, loading, note }: { label: string; part: number; whole: number; pct: number | null; loading?: boolean; note?: string }) {
  return (
    <Stat
      label={label}
      loading={loading}
      value={
        <>
          <CountUp value={part} />
          <span className="text-figure-sm text-muted-foreground"> / {whole}</span>
        </>
      }
      context={whole ? (note ?? `${pct}% of the cycle's risks`) : 'No risks yet'}
    >
      <Meter value={whole ? pct : null} label={`${label}: ${part} of ${whole}`} className="mt-1" />
    </Stat>
  )
}
