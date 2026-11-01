'use client'

/** /rcsa/provisioning/[id] — one assessment cycle and the risks assessed in it. */
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState, EmptyState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { BandBadge } from '@/components/band-badge'
import { useDeleteRow, useRow, useRowPage, useRows, type Row } from '@/lib/data'
import { bandCounts, toRisk } from '@/lib/risk'
import { daysUntil, formatDate, formatNumber } from '@/lib/format'
import { useOrgSettings } from '@/lib/settings'
import { apiErrorMessage } from '@/lib/apiClient'
import { ApprovalBadge, RcsaStepper, SortHeader, type SortState } from '@/components/rcsa/shared'
import { CYCLE_TABLE, RISK_TABLE, RiskDialog } from '@/components/rcsa/risk-dialog'
import { CycleDialog, CycleStatusBadge } from '@/components/rcsa/cycle-dialog'
import { RiskDecisionButtons } from '@/components/rcsa/risk-decision'

const PAGE_SIZE = 25
const CONTROL_TABLE = 'per_trn_control_implementation'

export function ProvisioningAssessmentDetailsPage({ assessmentId }: { assessmentId: string }) {
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const { money, bands } = useOrgSettings()
  const cycleId = Number(assessmentId)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortState>({ sort: 'created_on', order: 'desc' })
  const [riskDialog, setRiskDialog] = useState<{ open: boolean; risk: Row | null }>({ open: false, risk: null })
  const [cycleOpen, setCycleOpen] = useState(false)

  const cycle = useRow(CYCLE_TABLE, Number.isFinite(cycleId) ? cycleId : null)
  const filter = { assessment_cycle_uuid: cycleId }
  const allRisks = useRows(RISK_TABLE, { filter, enabled: Number.isFinite(cycleId) })
  const pageQ = useRowPage(RISK_TABLE, { page, pageSize: PAGE_SIZE, sort: sort.sort, order: sort.order, filter }, { enabled: Number.isFinite(cycleId) })
  const items = pageQ.data?.items ?? []
  const ids = useMemo(() => items.map(r => Number(r.uuid)).filter(Number.isFinite), [items])
  const controls = useRows(CONTROL_TABLE, { filter: { identify_risk_uuid: ids }, enabled: ids.length > 0 })
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
    const counts = bandCounts(risks.map(r => r.inherentScore), bands)
    const sles = risks.map(r => r.sle).filter((v): v is number => v != null)
    return {
      total: risks.length,
      rated: risks.length - counts['Not rated'],
      approved: risks.filter(r => r.approvalStatus === 'APPROVED').length,
      highCritical: counts.High + counts.Critical,
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

  const c = cycle.data
  const due = daysUntil(c?.submission_deadline)
  const addButton = hasPermission('create') ? (
    <Button size="sm" className="h-8" onClick={() => setRiskDialog({ open: true, risk: null })}>
      <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
      Add risk to this cycle
    </Button>
  ) : null

  if (!Number.isInteger(cycleId) || cycleId <= 0) {
    return <EmptyState title="Assessment cycle not found" description="The link doesn't point to a valid cycle." action={<Link href="/rcsa/provisioning" className="text-xs text-blue-800 hover:underline">Back to all cycles</Link>} />
  }

  return (
    <div className="space-y-6 font-sans">
      <RcsaStepper
        active="setup"
        right={
          <Button asChild size="sm" variant="outline">
            <Link href="/rcsa/provisioning">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              All cycles
            </Link>
          </Button>
        }
      />

      <DataState query={cycle}>
        {c && (
          <div className="bg-white rounded border border-slate-200 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  {c.cycle_reference && <span className="font-mono text-xs font-semibold text-slate-700">{c.cycle_reference}</span>}
                  <CycleStatusBadge status={c.status} />
                </div>
                <h1 className="text-lg font-semibold text-slate-900 mt-1">{c.cycle_name}</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {[c.cycle_type, c.cycle_period].filter(Boolean).join(' · ') || 'Assessment cycle'} · {formatDate(c.cycle_start_date)} – {formatDate(c.cycle_end_date)} · Deadline {formatDate(c.submission_deadline)}
                  {due != null && due < 0 && c.status !== 'Completed' && <span className="ml-1 font-medium text-red-700">(overdue)</span>}
                </p>
                {c.notes && <p className="text-xs text-slate-600 mt-2 whitespace-pre-line">{c.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                {hasPermission('update') && (
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setCycleOpen(true)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                    Edit cycle
                  </Button>
                )}
                {addButton}
              </div>
            </div>

            <DataState query={allRisks} compact>
              <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Stat label="Risks" value={formatNumber(summary.total)} />
                <Stat label="Rated" value={`${summary.rated} / ${summary.total}`} />
                <Stat label="Approved" value={`${summary.approved} / ${summary.total}`} />
                <Stat label="High or critical (inherent)" value={formatNumber(summary.highCritical)} />
                <Stat label={`Total SLE${summary.sleCount && summary.sleCount < summary.total ? ` (${summary.sleCount} of ${summary.total} risks)` : ''}`} value={money(summary.sle)} />
              </dl>
            </DataState>
          </div>
        )}
      </DataState>

      {c && (
        <div className="bg-white rounded border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">Risks in this cycle</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Open a risk&apos;s controls to record how it is mitigated and its residual rating.</p>
          </div>
          <DataState query={pageQ} empty={items.length === 0} emptyTitle="No risks in this cycle yet" emptyDescription="Add a risk here, or assign existing risks to this cycle from the risk register." emptyAction={addButton}>
            <div className="overflow-x-auto">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <SortHeader label="Risk" column="risk_statement" state={sort} onSort={s => (setSort(s), setPage(1))} className="w-[34%]" />
                    <SortHeader label="Category" column="risk_type" state={sort} onSort={s => (setSort(s), setPage(1))} />
                    <SortHeader label="Owner" column="risk_owner" state={sort} onSort={s => (setSort(s), setPage(1))} />
                    <th>Inherent</th>
                    <th>Residual</th>
                    <SortHeader label="SLE" column="inherent_sle" state={sort} onSort={s => (setSort(s), setPage(1))} className="text-right" />
                    <th className="text-right">Controls</th>
                    <SortHeader label="Approval" column="approval_status" state={sort} onSort={s => (setSort(s), setPage(1))} />
                    <th className="text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(row => {
                    const r = toRisk(row)
                    return (
                      <tr key={r.uuid}>
                        <td>
                          <span className="font-medium text-slate-900 block">{r.statement ?? <span className="italic text-slate-400">No statement recorded</span>}</span>
                          {r.process && <span className="text-[11px] text-slate-500">{[r.process, r.subProcess].filter(Boolean).join(' › ')}</span>}
                        </td>
                        <td>{r.category ?? '—'}</td>
                        <td>{r.owner ?? '—'}</td>
                        <td>
                          <BandBadge score={r.inherentScore} />
                          {r.inherentScore == null && hasPermission('update') && (
                            <Link href={`/assessments/inherent?riskId=${r.uuid}`} className="block text-[11px] text-blue-800 hover:underline mt-0.5">
                              Rate now
                            </Link>
                          )}
                        </td>
                        <td>
                          <BandBadge score={r.residualScore} />
                        </td>
                        <td className="text-right tabular-nums whitespace-nowrap">{money(r.sle)}</td>
                        <td className="text-right tabular-nums">{controls.isLoading ? '…' : controls.isError ? '—' : (controlCount.get(r.uuid) ?? 0)}</td>
                        <td>
                          <ApprovalBadge status={r.approvalStatus} />
                        </td>
                        <td className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/rcsa/provisioning/${assessmentId}/controls/${r.uuid}`}>Controls &rarr;</Link>
                            </Button>
                            <RiskDecisionButtons risk={row} compact />
                            {hasPermission('update') && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Edit risk" onClick={() => setRiskDialog({ open: true, risk: row })}>
                                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                              </Button>
                            )}
                            {hasPermission('delete') && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-50" aria-label="Delete risk" disabled={del.isPending} onClick={() => remove(row)}>
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </Button>
                            )}
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
        </div>
      )}

      <RiskDialog open={riskDialog.open} risk={riskDialog.risk} cycleUuid={cycleId} lockCycle onOpenChange={open => setRiskDialog(d => ({ ...d, open }))} />
      {c && <CycleDialog open={cycleOpen} cycle={c} onOpenChange={setCycleOpen} />}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-slate-50 rounded border border-slate-200">
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className="text-lg font-semibold text-slate-900 tabular-nums">{value}</dd>
    </div>
  )
}
