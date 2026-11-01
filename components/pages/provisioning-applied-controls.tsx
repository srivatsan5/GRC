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
import { DASH } from '@/lib/format'
import { ResidualRating } from '@/components/treatment/residual-rating'
import { ControlImplementationDialog, useRemoveAppliedControl } from '@/components/treatment/control-dialog'
import { ValueChip, controlName, numOrNull, rowId, text } from '@/components/treatment/shared'

interface Props {
  assessmentId: string
  riskId: string
}

const RISK = 'per_trn_identify_risk'
const IMPL = 'per_trn_control_implementation'

export function ProvisioningAppliedControlsPage({ assessmentId, riskId }: Props) {
  const { hasPermission } = useAuth()
  const { money } = useOrgSettings()
  const confirm = useConfirm()
  const riskNum = Number(riskId)
  const validId = Number.isInteger(riskNum) && riskNum > 0

  const riskQ = useRow(RISK, validId ? riskNum : null)
  const controlsQ = useRows(IMPL, { filter: { identify_risk_uuid: riskNum }, enabled: validId })
  const libraryQ = useRows('erm_mst_control')
  const { remove, isPending: removing } = useRemoveAppliedControl()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)

  const risk = useMemo(() => (riskQ.data ? toRisk(riskQ.data) : null), [riskQ.data])
  const controls = controlsQ.data ?? []
  const library = useMemo(() => {
    const m = new Map<number, Row>()
    for (const c of libraryQ.data ?? []) {
      const id = rowId(c)
      if (id != null) m.set(id, c)
    }
    return m
  }, [libraryQ.data])

  const handleRemove = async (row: Row) => {
    const { name } = controlName(row.control_id, library)
    const ok = await confirm({
      title: 'Remove this control from the risk?',
      description: `“${name}” will no longer be recorded as mitigating this risk. The library control itself is not deleted.`,
      confirmLabel: 'Remove control',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await remove(row)
      toast.success('Control removed from the risk')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const stepper = (
    <nav aria-label="Assessment steps" className="bg-white border border-slate-200 rounded p-3 text-xs flex flex-wrap items-center justify-between gap-2">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link href="/rcsa/provisioning" className="text-slate-600 hover:underline">
            01 Setup
          </Link>
        </li>
        <li aria-hidden="true" className="text-slate-300">
          &rarr;
        </li>
        <li>
          <Link href={`/rcsa/provisioning/${encodeURIComponent(assessmentId)}`} className="text-slate-600 hover:underline">
            02 Assessment details
          </Link>
        </li>
        <li aria-hidden="true" className="text-slate-300">
          &rarr;
        </li>
        <li aria-current="step" className="font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          03 Controls &amp; residual rating
        </li>
        <li aria-hidden="true" className="text-slate-300">
          &rarr;
        </li>
        <li>
          <Link href={`/rcsa/monitoring?assessmentId=${encodeURIComponent(assessmentId)}`} className="text-slate-600 hover:underline">
            04 Monitoring
          </Link>
        </li>
      </ol>
      <Button asChild size="sm" variant="outline" className="text-xs h-7">
        <Link href={`/rcsa/provisioning/${encodeURIComponent(assessmentId)}`}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
          Back to assessment details
        </Link>
      </Button>
    </nav>
  )

  if (!validId) {
    return (
      <div className="space-y-6">
        {stepper}
        <EmptyState title="Risk not found" description={`“${riskId}” is not a valid risk id.`} />
      </div>
    )
  }
  if (riskQ.isLoading) return <div className="space-y-6">{stepper}<LoadingState /></div>
  if (riskQ.isError) {
    return (
      <div className="space-y-6">
        {stepper}
        {apiErrorCode(riskQ.error) === 'NOT_FOUND' ? (
          <EmptyState title="Risk not found" description={`There is no risk with id ${riskNum} in the register.`} />
        ) : (
          <ErrorState error={riskQ.error} onRetry={riskQ.refetch} />
        )}
      </div>
    )
  }
  if (!risk) return null

  return (
    <div className="space-y-6">
      {stepper}

      <section className="bg-white rounded border border-slate-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-500">{risk.referenceNumber ?? `Risk #${risk.uuid}`}</span>
              {risk.process && (
                <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 rounded border border-slate-200">{risk.process}</span>
              )}
              {risk.category && (
                <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 rounded border border-slate-200">{risk.category}</span>
              )}
            </div>
            <h1 className="text-lg font-bold text-slate-900 mt-1">{risk.statement ?? `Risk #${risk.uuid} (no statement recorded)`}</h1>
            <p className="text-xs text-slate-500 mt-1">
              Owner: <strong className="text-slate-800">{risk.owner ?? DASH}</strong> · Inherent SLE:{' '}
              <strong className="text-slate-800">{money(risk.sle)}</strong> · Controls applied:{' '}
              <strong className="text-slate-800">{controlsQ.data ? controls.length : DASH}</strong>
            </p>
          </div>
          {hasPermission('create') && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              Apply control
            </Button>
          )}
        </div>
      </section>

      <ResidualRating risk={risk} canEdit={hasPermission('update')} />

      <section className="bg-white rounded border border-slate-200 overflow-hidden" aria-labelledby="applied-heading">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="applied-heading" className="text-sm font-semibold text-slate-900">
            Controls mitigating this risk
          </h2>
          {controlsQ.data && <span className="text-xs text-slate-500">{controls.length} applied</span>}
        </div>
        <DataState
          query={[controlsQ, libraryQ]}
          empty={controls.length === 0}
          emptyTitle="No controls applied yet"
          emptyDescription="Apply controls from the library to record how this risk is mitigated."
          emptyAction={
            hasPermission('create') ? (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null)
                  setDialogOpen(true)
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                Apply control
              </Button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Control</th>
                  <th>Type</th>
                  <th>Frequency</th>
                  <th>Design</th>
                  <th>Operating</th>
                  <th>Evidence</th>
                  <th>Assessment</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {controls.map(c => {
                  const id = rowId(c)
                  const { code, name } = controlName(c.control_id, library)
                  return (
                    <tr key={id ?? JSON.stringify(c)}>
                      <td>
                        <span className="font-medium text-slate-900 block">{name}</span>
                        {code && <span className="text-[11px] text-slate-500 font-mono">{code}</span>}
                      </td>
                      <td className="text-slate-600">{text(c.control_type) ?? DASH}</td>
                      <td className="text-slate-600">{text(c.control_frequency) ?? DASH}</td>
                      <td>
                        <ValueChip value={c.control_design_effectiveness} />
                      </td>
                      <td>
                        <ValueChip value={c.control_effectiveness_rating} />
                      </td>
                      <td className="text-slate-600 max-w-[240px]">
                        <span className="line-clamp-2 text-xs">{text(c.evidence_notes) ?? DASH}</span>
                      </td>
                      <td className="text-xs text-slate-600">{c.is_stage_complted === 'Y' ? 'Complete' : 'In progress'}</td>
                      <td className="text-right whitespace-nowrap">
                        {hasPermission('update') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Edit ${name}`}
                            onClick={() => {
                              setEditing(c)
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
                            aria-label={`Remove ${name}`}
                            disabled={removing}
                            onClick={() => handleRemove(c)}
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

      <ControlImplementationDialog open={dialogOpen} onOpenChange={setDialogOpen} row={editing} riskId={numOrNull(risk.uuid)} />
    </div>
  )
}
