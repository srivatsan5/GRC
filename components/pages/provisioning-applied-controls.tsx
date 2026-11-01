'use client'

/**
 * RCSA step 4 for one risk: controls applied to it and its residual rating.
 * Hero = inherent → residual (movement matrix, badges, reduction). Below, the applied controls as Charter cards.
 */
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, ExternalLink, FileText, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState, EmptyState, ErrorState, LoadingState } from '@/components/data-state'
import { LifecycleStepper } from '@/components/charter/lifecycle-stepper'
import { Chip, PageHeader, Panel, Person } from '@/components/charter/primitives'
import { useRow, useRows, type Row } from '@/lib/data'
import { apiErrorCode, apiErrorMessage } from '@/lib/apiClient'
import { toRisk } from '@/lib/risk'
import { useOrgSettings } from '@/lib/settings'
import { DASH } from '@/lib/format'
import { ResidualRating } from '@/components/treatment/residual-rating'
import { ControlImplementationDialog, useRemoveAppliedControl } from '@/components/treatment/control-dialog'
import { EffectivenessChip, controlName, numOrNull, rowId, testStatus, text } from '@/components/treatment/shared'

interface Props {
  assessmentId: string
  riskId: string
}

const RISK = 'per_trn_identify_risk'
const IMPL = 'per_trn_control_implementation'
const CYCLE = 'erm_trn_assessment_cycle'

export function ProvisioningAppliedControlsPage({ assessmentId, riskId }: Props) {
  const { hasPermission } = useAuth()
  const { money } = useOrgSettings()
  const confirm = useConfirm()
  const riskNum = Number(riskId)
  const validId = Number.isInteger(riskNum) && riskNum > 0
  const cycleNum = numOrNull(assessmentId)

  const riskQ = useRow(RISK, validId ? riskNum : null)
  const cycleQ = useRow(CYCLE, cycleNum)
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

  const canCreate = hasPermission('create')
  const openNew = () => {
    setEditing(null)
    setDialogOpen(true)
  }

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

  const cycleHref = `/rcsa/provisioning/${encodeURIComponent(assessmentId)}`
  const backLink = (
    <Button asChild variant="ghost" className="-ml-2 w-fit">
      <Link href={cycleHref}>
        <ArrowLeft aria-hidden="true" />
        Back to the assessment cycle
      </Link>
    </Button>
  )

  const shell = (body: React.ReactNode) => (
    <div className="space-y-6">
      <LifecycleStepper current="controls" />
      {backLink}
      {body}
    </div>
  )

  if (!validId) return shell(<EmptyState title="Risk not found" description={`“${riskId}” is not a valid risk id.`} />)
  if (riskQ.isLoading) return shell(<LoadingState />)
  if (riskQ.isError) {
    return shell(
      apiErrorCode(riskQ.error) === 'NOT_FOUND' ? (
        <EmptyState title="Risk not found" description={`There is no risk with id ${riskNum} in the register.`} />
      ) : (
        <ErrorState error={riskQ.error} onRetry={riskQ.refetch} />
      ),
    )
  }
  if (!risk) return null

  const cycle = cycleQ.data
  const ref = risk.referenceNumber ?? `#${risk.uuid}`

  return (
    <div className="space-y-6">
      <LifecycleStepper current="controls" />

      <div className="space-y-3">
        {backLink}
        <PageHeader
          eyebrow={
            <>
              RCSA · Step 4 · Controls &amp; residual rating · <span className="font-mono normal-case tracking-normal">{ref}</span>
            </>
          }
          title={risk.statement ?? <span className="text-muted-foreground">No statement recorded</span>}
          actions={
            <>
              <Button asChild variant="secondary">
                <Link href={`/risks/${risk.uuid}`}>
                  <ExternalLink aria-hidden="true" />
                  Open risk
                </Link>
              </Button>
              {canCreate && (
                <Button onClick={openNew}>
                  <Plus aria-hidden="true" />
                  Apply control
                </Button>
              )}
            </>
          }
        />
      </div>

      {/* Context strip: a plain definition list, no cards */}
      <dl className="flex flex-wrap items-center gap-x-8 gap-y-3 text-body-sm">
        {[
          { label: 'Owner', value: <Person name={risk.owner} /> },
          {
            label: 'Cycle',
            value: cycle ? (
              <Link href={cycleHref} className="group inline-flex min-w-0 items-baseline gap-1.5 rounded-xs focus-ring" title={text(cycle.cycle_name) ?? undefined}>
                <span className="font-mono text-caption text-primary group-hover:underline">{text(cycle.cycle_reference) ?? `#${cycleNum}`}</span>
                <span className="max-w-[28ch] truncate text-foreground-secondary">{text(cycle.cycle_name)}</span>
              </Link>
            ) : (
              <span className="font-mono text-caption text-muted-foreground">{cycleQ.isLoading ? '…' : cycleNum != null ? `#${cycleNum}` : DASH}</span>
            ),
          },
          { label: 'Process', value: <span className="block max-w-[32ch] truncate" title={risk.process ?? undefined}>{risk.process ?? DASH}</span> },
          { label: 'Category', value: risk.category ?? DASH },
          { label: 'SLE', value: <span className="tabular-nums">{money(risk.sle)}</span> },
        ].map(f => (
          <div key={f.label} className="flex min-w-0 items-center gap-2.5">
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd className="min-w-0 text-foreground">{f.value}</dd>
          </div>
        ))}
      </dl>

      <ResidualRating risk={risk} canEdit={hasPermission('update')} />

      <Panel
        id="applied-controls"
        title="Controls"
        meta={controlsQ.data ? `${controls.length} applied` : undefined}
        actions={
          canCreate && controls.length > 0 ? (
            <Button variant="secondary" size="sm" onClick={openNew}>
              <Plus aria-hidden="true" />
              Apply control
            </Button>
          ) : undefined
        }
      >
        <DataState
          query={[controlsQ, libraryQ]}
          empty={controls.length === 0}
          emptyTitle="No controls applied yet"
          emptyDescription="Apply controls from the library to record how this risk is mitigated, then set the residual rating above."
          emptyAction={
            canCreate ? (
              <Button onClick={openNew}>
                <Plus aria-hidden="true" />
                Apply control
              </Button>
            ) : undefined
          }
        >
          <ul className="space-y-3">
            {controls.map(c => {
              const id = rowId(c)
              const { code, name } = controlName(c.control_id, library)
              const ts = testStatus(c)
              const evidence = text(c.evidence_notes)
              return (
                <li key={id ?? JSON.stringify(c)} className="rounded-lg bg-card px-4 py-3.5 shadow-[0_0_0_1px_var(--border),var(--elevation-xs)]">
                  <div className="flex flex-col items-start justify-between gap-x-4 gap-y-2 sm:flex-row">
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-medium text-foreground">{name}</p>
                      <p className="mt-0.5 font-mono text-caption text-muted-foreground">
                        {[code ?? 'No code', text(c.control_type) ?? 'Type not set', text(c.control_frequency) ?? 'Frequency not set'].join(' · ')}
                      </p>
                    </div>
                    <div className="-mr-2 flex items-center gap-1 max-sm:-ml-0.5">
                      <Chip tone={ts.tone === 'success' ? 'success' : ts.tone === 'info' ? 'info' : 'neutral'} icon={ts.tone === 'success' ? ShieldCheck : null} className="mr-1">
                        {ts.label}
                      </Chip>
                      {hasPermission('update') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${name}`}
                          onClick={() => {
                            setEditing(c)
                            setDialogOpen(true)
                          }}
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
                      )}
                      {hasPermission('delete') && (
                        <Button variant="ghost" size="icon" className="hover:bg-status-danger-bg hover:text-status-danger-fg" aria-label={`Remove ${name}`} disabled={removing} onClick={() => handleRemove(c)}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <EffectivenessChip kind="Design" value={c.control_design_effectiveness} />
                    <EffectivenessChip kind="Operating" value={c.control_effectiveness_rating} />
                    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-caption sm:ml-auto text-foreground-secondary">
                      <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate" title={evidence ?? undefined}>
                        {evidence ? `Evidence: ${evidence}` : 'No evidence recorded'}
                      </span>
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </DataState>
      </Panel>

      <nav aria-label="Next step" className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <span className="text-body-sm text-muted-foreground">When the controls and residual rating are recorded, plan the remaining treatment.</span>
        <Button asChild variant="secondary">
          <Link href={`/rcsa/monitoring?assessmentId=${encodeURIComponent(assessmentId)}`}>
            Next: monitoring
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </nav>

      <ControlImplementationDialog open={dialogOpen} onOpenChange={setDialogOpen} row={editing} riskId={numOrNull(risk.uuid)} />
    </div>
  )
}
