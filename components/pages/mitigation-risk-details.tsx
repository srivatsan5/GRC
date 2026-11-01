'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState, EmptyState, ErrorState, LoadingState } from '@/components/data-state'
import { useRow, useRows, type Row } from '@/lib/data'
import { apiErrorCode, apiErrorMessage } from '@/lib/apiClient'
import { toRisk } from '@/lib/risk'
import { useOrgSettings } from '@/lib/settings'
import { DASH, formatDate } from '@/lib/format'
import { ResidualRating } from '@/components/treatment/residual-rating'
import { ControlImplementationDialog, useRemoveAppliedControl } from '@/components/treatment/control-dialog'
import { ActionPlanDialog, MONITORING, useDeleteActionPlan } from '@/components/treatment/action-plan-dialog'
import { ActionStatusBadge, ProgressBar, ValueChip, controlName, numOrNull, rowId, text } from '@/components/treatment/shared'

const RISK = 'per_trn_identify_risk'
const IMPL = 'per_trn_control_implementation'

export function MitigationRiskDetailsPage({ riskId }: { riskId: string }) {
  const { hasPermission } = useAuth()
  const { money } = useOrgSettings()
  const confirm = useConfirm()
  const id = Number(riskId)
  const validId = Number.isInteger(id) && id > 0

  const riskQ = useRow(RISK, validId ? id : null)
  const controlsQ = useRows(IMPL, { filter: { identify_risk_uuid: id }, enabled: validId })
  const plansQ = useRows(MONITORING, { filter: { identify_risk_uuid: id }, enabled: validId })
  const libraryQ = useRows('erm_mst_control')
  const { remove: removeControl, isPending: removingControl } = useRemoveAppliedControl()
  const { remove: removePlan, isPending: removingPlan } = useDeleteActionPlan()

  const [controlOpen, setControlOpen] = useState(false)
  const [editControl, setEditControl] = useState<Row | null>(null)
  const [planOpen, setPlanOpen] = useState(false)
  const [editPlan, setEditPlan] = useState<Row | null>(null)

  const risk = useMemo(() => (riskQ.data ? toRisk(riskQ.data) : null), [riskQ.data])
  const library = useMemo(() => {
    const m = new Map<number, Row>()
    for (const c of libraryQ.data ?? []) {
      const cid = rowId(c)
      if (cid != null) m.set(cid, c)
    }
    return m
  }, [libraryQ.data])
  const controls = controlsQ.data ?? []
  const plans = plansQ.data ?? []

  const back = (
    <Button asChild variant="outline" size="sm" className="h-8 text-xs">
      <Link href="/rcsa/mitigation">
        <ArrowLeft className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
        Back to risk mitigation
      </Link>
    </Button>
  )

  if (!validId) {
    return (
      <div className="space-y-6">
        {back}
        <EmptyState title="Risk not found" description={`“${riskId}” is not a valid risk id.`} />
      </div>
    )
  }
  if (riskQ.isLoading) return <div className="space-y-6">{back}<LoadingState /></div>
  if (riskQ.isError) {
    return (
      <div className="space-y-6">
        {back}
        {apiErrorCode(riskQ.error) === 'NOT_FOUND' ? (
          <EmptyState title="Risk not found" description={`There is no risk with id ${id} in the register. It may have been deleted.`} />
        ) : (
          <ErrorState error={riskQ.error} onRetry={riskQ.refetch} />
        )}
      </div>
    )
  }
  if (!risk) return null

  const handleRemoveControl = async (row: Row) => {
    const { name } = controlName(row.control_id, library)
    const ok = await confirm({
      title: 'Remove this control from the risk?',
      description: `“${name}” will no longer be recorded as mitigating this risk. The library control itself is kept.`,
      confirmLabel: 'Remove control',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await removeControl(row)
      toast.success('Control removed from the risk')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const facts: [string, React.ReactNode][] = [
    ['Reference', risk.referenceNumber ?? `#${risk.uuid}`],
    ['Process', [risk.process, risk.subProcess].filter(Boolean).join(' › ') || DASH],
    ['Category', risk.category ?? DASH],
    ['Owner', risk.owner ?? DASH],
    ['Champion', risk.champion ?? DASH],
    ['Inherent SLE', money(risk.sle)],
    ['Approval status', risk.approvalStatus ?? DASH],
    ['Registered', formatDate(risk.registeredDate ?? risk.createdOn)],
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {back}
        {risk.cycleUuid != null && (
          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
            <Link href={`/rcsa/provisioning/${risk.cycleUuid}/controls/${risk.uuid}`}>Open in assessment cycle</Link>
          </Button>
        )}
      </div>

      <section className="bg-white rounded border border-slate-200 p-5 space-y-4">
        <div>
          <span className="font-mono text-xs text-slate-500">Risk #{risk.uuid}</span>
          <h1 className="text-lg font-bold text-slate-900 mt-1">{risk.statement ?? `Risk #${risk.uuid} (no statement recorded)`}</h1>
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-xs">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-slate-900 font-medium mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>
        {risk.inherentScore == null && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            This risk has no inherent rating yet. Rate its inherent likelihood and impact in the{' '}
            <Link href="/assessments/inherent" className="underline">
              inherent risk assessment
            </Link>
            , then record the residual rating below.
          </p>
        )}
      </section>

      <ResidualRating risk={risk} canEdit={hasPermission('update')} />

      <section className="bg-white rounded border border-slate-200 overflow-hidden" aria-labelledby="ctl-heading">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <h2 id="ctl-heading" className="text-sm font-semibold text-slate-900">
            Controls applied {controlsQ.data && <span className="text-slate-500 font-normal">({controls.length})</span>}
          </h2>
          {hasPermission('create') && (
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setEditControl(null)
                setControlOpen(true)
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              Apply control
            </Button>
          )}
        </div>
        <DataState query={[controlsQ, libraryQ]} compact empty={controls.length === 0} emptyTitle="No controls applied to this risk">
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Control</th>
                  <th>Frequency</th>
                  <th>Design</th>
                  <th>Operating</th>
                  <th>Evidence</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {controls.map(c => {
                  const { code, name } = controlName(c.control_id, library)
                  return (
                    <tr key={rowId(c) ?? JSON.stringify(c)}>
                      <td>
                        <span className="font-medium text-slate-900 block">{name}</span>
                        {code && <span className="text-[11px] text-slate-500 font-mono">{code}</span>}
                      </td>
                      <td className="text-xs text-slate-600">{text(c.control_frequency) ?? DASH}</td>
                      <td>
                        <ValueChip value={c.control_design_effectiveness} />
                      </td>
                      <td>
                        <ValueChip value={c.control_effectiveness_rating} />
                      </td>
                      <td className="max-w-[240px]">
                        <span className="line-clamp-2 text-xs text-slate-600">{text(c.evidence_notes) ?? DASH}</span>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {hasPermission('update') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Edit ${name}`}
                            onClick={() => {
                              setEditControl(c)
                              setControlOpen(true)
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
                            aria-label={`Remove ${name}`}
                            disabled={removingControl}
                            onClick={() => handleRemoveControl(c)}
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
        </DataState>
      </section>

      <section className="bg-white rounded border border-slate-200 overflow-hidden" aria-labelledby="plan-heading">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <h2 id="plan-heading" className="text-sm font-semibold text-slate-900">
            Action plans {plansQ.data && <span className="text-slate-500 font-normal">({plans.length})</span>}
          </h2>
          {hasPermission('create') && (
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setEditPlan(null)
                setPlanOpen(true)
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              New action plan
            </Button>
          )}
        </div>
        <DataState query={plansQ} compact empty={plans.length === 0} emptyTitle="No action plans for this risk">
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Action plan</th>
                  <th>Owner</th>
                  <th>Target end</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(p => {
                  const title = text(p.monitoring_title) ?? `Action plan #${rowId(p)}`
                  return (
                    <tr key={rowId(p) ?? JSON.stringify(p)}>
                      <td className="max-w-[300px]">
                        <span className="font-medium text-slate-900 block">{title}</span>
                        {text(p.monitoring_goal) && <span className="text-[11px] text-slate-500 line-clamp-2">{text(p.monitoring_goal)}</span>}
                      </td>
                      <td className="text-xs text-slate-600">{text(p.mitigation_owner) ?? DASH}</td>
                      <td className="text-xs text-slate-600">{formatDate(text(p.estimated_end_date))}</td>
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
                              setEditPlan(p)
                              setPlanOpen(true)
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
                            disabled={removingPlan}
                            onClick={() => removePlan(p)}
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
        </DataState>
      </section>

      <ControlImplementationDialog open={controlOpen} onOpenChange={setControlOpen} row={editControl} riskId={risk.uuid} />
      <ActionPlanDialog open={planOpen} onOpenChange={setPlanOpen} row={editPlan} riskId={risk.uuid} />
    </div>
  )
}
