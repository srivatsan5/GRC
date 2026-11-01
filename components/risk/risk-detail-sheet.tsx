'use client'

/**
 * Risk detail sheet (register, §7): 560 px floating sheet with the reference and approval status,
 * previous / next risk (within the current page), "Full page", the statement as a serif title, facts,
 * inherent → residual movement, applied controls, action plans, approval and the status action.
 */
import Link from 'next/link'
import React, { useState } from 'react'
import { ChevronDown, ChevronUp, OctagonAlert, Plus, SquareArrowOutUpRight } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/providers/auth-provider'
import { type Row } from '@/lib/data'
import { toRisk } from '@/lib/risk'
import { ApprovalBadge } from '@/components/charter/primitives'
import { RiskDecisionButtons } from '@/components/rcsa/risk-decision'
import { RiskDialog } from '@/components/rcsa/risk-dialog'
import { ActionPlanCard, ApprovalSummary, ControlCard, RiskFacts, RiskRatingMovement, SectionHeading, openPlanCount, riskControlsHref, riskRef, useRiskRelated } from './risk-sections'

export function RiskDetailSheet({
  row,
  cycle,
  onClose,
  onPrev,
  onNext,
}: {
  /** The risk to show; null closes the sheet. */
  row: Row | null
  cycle?: Row
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}) {
  const { hasPermission } = useAuth()
  const risk = row ? toRisk(row) : null
  const { impl, plans, libById } = useRiskRelated(risk?.uuid ?? null, !!risk)
  const [decisionError, setDecisionError] = useState<string | null>(null)
  // The edit dialog renders inside the sheet so Radix treats it as a nested layer (the sheet stays open).
  const [editOpen, setEditOpen] = useState(false)
  const canUpdate = hasPermission('update')
  const canCreate = hasPermission('create')
  const canAudit = hasPermission('audit')

  // Reset the inline decision error when the shown risk changes.
  const [shown, setShown] = useState<number | null>(null)
  if (risk && shown !== risk.uuid) {
    setShown(risk.uuid)
    setDecisionError(null)
  }

  const controls = impl.data ?? []
  const planRows = plans.data ?? []
  const openPlans = openPlanCount(planRows)

  return (
    <Sheet open={!!row} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="sm:max-w-[560px]" onOpenAutoFocus={e => e.preventDefault()}>
        {risk && row && (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* Header */}
              <header className="px-6 pt-4 pb-5">
                <div className="flex items-center gap-2 pr-10">
                  <span className="max-w-[45%] truncate font-mono text-caption text-foreground-secondary sm:max-w-none" title={riskRef(risk)}>{riskRef(risk)}</span>
                  <ApprovalBadge status={risk.approvalStatus ?? 'DRAFT'} />
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" className="size-8" onClick={onPrev} disabled={!onPrev} aria-label="Previous risk">
                      <ChevronUp aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8" onClick={onNext} disabled={!onNext} aria-label="Next risk">
                      <ChevronDown aria-hidden="true" />
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="text-foreground">
                      <Link href={`/risks/${risk.uuid}`} aria-label="Open the full risk page">
                        <SquareArrowOutUpRight aria-hidden="true" />
                        <span className="max-sm:hidden">Full page</span>
                      </Link>
                    </Button>
                  </div>
                </div>
                <SheetTitle className="mt-3 text-[1.75rem] leading-[2.125rem] font-normal tracking-[-0.02em]">{risk.statement ?? <span className="text-muted-foreground">No statement recorded</span>}</SheetTitle>
                <SheetDescription className="sr-only">Details, ratings, controls, action plans and approval for this risk.</SheetDescription>
                <RiskFacts risk={risk} cycle={cycle} onAssignOwner={canUpdate ? () => setEditOpen(true) : undefined} className="mt-5" />
              </header>

              <section aria-labelledby="sheet-movement" className="border-t px-6 py-5">
                <SectionHeading id="sheet-movement" title={<>Inherent → residual</>} />
                <RiskRatingMovement risk={risk} canRate={canUpdate} className="mt-4" />
              </section>

              <section aria-labelledby="sheet-controls" className="border-t px-6 py-5">
                <SectionHeading
                  id="sheet-controls"
                  title="Controls"
                  meta={impl.isSuccess ? `${controls.length} applied` : undefined}
                  actions={
                    canCreate && (
                      <Button asChild variant="secondary" size="sm">
                        <Link href={riskControlsHref(risk)}>
                          <Plus aria-hidden="true" />
                          Apply control
                        </Link>
                      </Button>
                    )
                  }
                />
                <div className="mt-4 space-y-3">
                  {impl.isLoading && <div className="skeleton h-24 w-full rounded-lg" aria-label="Loading controls" />}
                  {impl.isError && <p className="text-body-sm text-status-danger-fg">Controls could not be loaded.</p>}
                  {impl.isSuccess && controls.length === 0 && <p className="text-body-sm text-muted-foreground">No controls applied yet. Apply a library control to record how this risk is mitigated.</p>}
                  {controls.map(c => (
                    <ControlCard key={String(c.uuid)} impl={c} lib={c.control_id != null ? libById.get(Number(c.control_id)) : undefined} />
                  ))}
                </div>
              </section>

              <section aria-labelledby="sheet-plans" className="border-t px-6 py-5">
                <SectionHeading id="sheet-plans" title="Action plans" meta={plans.isSuccess ? `${openPlans} open` : undefined} />
                <div className="mt-4 space-y-3">
                  {plans.isLoading && <div className="skeleton h-20 w-full rounded-lg" aria-label="Loading action plans" />}
                  {plans.isError && <p className="text-body-sm text-status-danger-fg">Action plans could not be loaded.</p>}
                  {plans.isSuccess && planRows.length === 0 && <p className="text-body-sm text-muted-foreground">No action plans for this risk.</p>}
                  {planRows.map(p => (
                    <ActionPlanCard key={String(p.uuid)} row={p} />
                  ))}
                </div>
              </section>

              <section aria-labelledby="sheet-approval" className="border-t px-6 py-5">
                <SectionHeading id="sheet-approval" title="Approval" />
                <ApprovalSummary risk={risk} canAudit={canAudit} className="mt-4" />
              </section>
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-3.5">
              {decisionError && (
                <p role="alert" className="mb-3 flex items-start gap-2 rounded-md bg-status-danger-bg px-3 py-2 text-body-sm text-status-danger-fg">
                  <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {decisionError}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="mr-auto text-caption text-muted-foreground max-sm:hidden">Changes are logged to the audit trail</span>
                {canUpdate && (
                  <Button variant="secondary" onClick={() => setEditOpen(true)}>
                    Edit
                  </Button>
                )}
                <RiskDecisionButtons risk={row} layout="footer" onError={setDecisionError} />
              </div>
            </div>
            <RiskDialog open={editOpen} onOpenChange={setEditOpen} risk={row} />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
