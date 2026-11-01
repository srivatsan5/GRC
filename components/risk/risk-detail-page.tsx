'use client'

/**
 * /risks/[id] — the full risk page: the detail sheet's content laid out as a page, plus managing the
 * risk's controls (apply / edit / remove), its residual rating, its action plans (create / edit / delete)
 * and its audit history (for users who can read the audit trail).
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, OctagonAlert, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { EmptyState, ErrorState, LoadingState } from '@/components/data-state'
import { PageHeader, Panel } from '@/components/charter/primitives'
import { BandBadge } from '@/components/band-badge'
import { useDeleteRow, useRow, useRows, type Row } from '@/lib/data'
import { toRisk } from '@/lib/risk'
import { DASH, formatDate, formatDateTime } from '@/lib/format'
import { apiErrorMessage, type ApiAuditEntry } from '@/lib/apiClient'
import { CYCLE_TABLE, RISK_DEPENDENT_TABLES, RISK_TABLE, RiskDialog } from '@/components/rcsa/risk-dialog'
import { RiskDecisionButtons } from '@/components/rcsa/risk-decision'
import { ApprovalBadge } from '@/components/rcsa/shared'
import { ControlImplementationDialog, useRemoveAppliedControl } from '@/components/treatment/control-dialog'
import { ActionPlanDialog, useDeleteActionPlan } from '@/components/treatment/action-plan-dialog'
import { ResidualRating } from '@/components/treatment/residual-rating'
import { ActionPlanCard, ApprovalSummary, ControlCard, RiskFacts, inherentRateHref, openPlanCount, riskRef, useRiskAudit, useRiskRelated } from './risk-sections'

function httpStatus(err: unknown): number | null {
  const s = (err as { response?: { status?: number } } | null)?.response?.status
  return typeof s === 'number' ? s : null
}

export function RiskDetailPage({ id }: { id: string }) {
  const valid = /^\d+$/.test(id)
  const q = useRow(RISK_TABLE, valid ? id : null)

  if (!valid || (q.isError && httpStatus(q.error) === 404)) {
    return (
      <div className="surface-panel">
        <EmptyState
          title="Risk not found"
          description={valid ? `There is no risk with the id ${id}. It may have been deleted.` : 'This link does not point to a risk.'}
          action={
            <Button asChild variant="secondary">
              <Link href="/rcsa/identification">
                <ArrowLeft aria-hidden="true" />
                Back to the risk register
              </Link>
            </Button>
          }
        />
      </div>
    )
  }
  if (q.isError) return <div className="surface-panel"><ErrorState error={q.error} onRetry={q.refetch} /></div>
  if (q.isLoading || !q.data) return <div className="surface-panel px-6"><LoadingState label="Loading risk…" /></div>
  return <RiskDetail row={q.data} />
}

function RiskDetail({ row }: { row: Row }) {
  const router = useRouter()
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const risk = useMemo(() => toRisk(row), [row])
  const cycles = useRows(CYCLE_TABLE)
  const cycle = risk.cycleUuid != null ? cycles.data?.find(c => Number(c.uuid) === risk.cycleUuid) : undefined
  const { impl, plans, libById } = useRiskRelated(risk.uuid)
  const canUpdate = hasPermission('update')
  const canCreate = hasPermission('create')
  const canDelete = hasPermission('delete')
  const canAudit = hasPermission('audit')

  const [editOpen, setEditOpen] = useState(false)
  const [decisionError, setDecisionError] = useState<string | null>(null)
  const [controlDialog, setControlDialog] = useState<{ open: boolean; row: Row | null }>({ open: false, row: null })
  const [planDialog, setPlanDialog] = useState<{ open: boolean; row: Row | null }>({ open: false, row: null })
  const { remove: removeControl, isPending: removingControl } = useRemoveAppliedControl()
  const { remove: removePlan, isPending: removingPlan } = useDeleteActionPlan()
  const del = useDeleteRow(RISK_TABLE, { alsoInvalidate: RISK_DEPENDENT_TABLES })

  const controls = impl.data ?? []
  const planRows = plans.data ?? []

  async function onRemoveControl(c: Row) {
    const lib = c.control_id != null ? libById.get(Number(c.control_id)) : undefined
    const name = String(lib?.control_name ?? `Control #${c.control_id ?? c.uuid}`)
    const ok = await confirm({
      title: 'Remove this control from the risk?',
      description: `“${name}” will no longer be recorded as mitigating this risk. The library control itself is not deleted.`,
      confirmLabel: 'Remove control',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await removeControl(c)
      toast.success('Control removed from the risk')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  async function onDeleteRisk() {
    const ok = await confirm({
      title: 'Delete this risk?',
      description: `${risk.statement ?? `Risk ${risk.uuid}`} — removed permanently, together with its applied controls, action plans and assessment records.`,
      confirmLabel: 'Delete risk',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await del.mutateAsync(risk.uuid)
      toast.success('Risk deleted')
      router.push('/rcsa/identification')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const registered = risk.registeredDate ? formatDate(risk.registeredDate) : null
  const period = risk.startDate || risk.endDate ? `${formatDate(risk.startDate)} – ${formatDate(risk.endDate)}` : null

  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/rcsa/identification" className="inline-flex items-center gap-1 rounded-xs text-body-sm text-muted-foreground hover:text-foreground focus-ring">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Risk register
          </Link>
          <span aria-hidden="true" className="text-muted-foreground">
            ·
          </span>
          <span className="font-mono text-caption text-foreground-secondary">{riskRef(risk)}</span>
          <ApprovalBadge status={risk.approvalStatus} />
          {!risk.isActive && <span className="text-caption text-muted-foreground">Inactive</span>}
        </div>
        <PageHeader
          title={risk.statement ?? <span className="text-muted-foreground">No statement recorded</span>}
          description={[risk.category, risk.process, risk.subProcess].filter(Boolean).join(' · ') || undefined}
          actions={
            <>
              {canDelete && (
                <Button variant="ghost" onClick={onDeleteRisk} disabled={del.isPending} className="text-status-danger-fg hover:text-status-danger-fg">
                  <Trash2 aria-hidden="true" />
                  Delete
                </Button>
              )}
              {canUpdate && (
                <Button asChild variant="secondary">
                  <Link href={inherentRateHref(risk)}>Assess</Link>
                </Button>
              )}
              {canUpdate && (
                <Button variant="secondary" onClick={() => setEditOpen(true)}>
                  <Pencil aria-hidden="true" />
                  Edit
                </Button>
              )}
              <RiskDecisionButtons risk={row} layout="footer" onError={setDecisionError} />
            </>
          }
        />
        {decisionError && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-status-danger-bg px-3 py-2 text-body-sm text-status-danger-fg">
            <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {decisionError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <ResidualRating risk={risk} canEdit={canUpdate} />

          <Panel
            id="risk-controls"
            title="Controls"
            meta={impl.isSuccess ? `${controls.length} applied` : undefined}
            actions={
              canCreate && (
                <Button variant="secondary" size="sm" onClick={() => setControlDialog({ open: true, row: null })}>
                  <Plus aria-hidden="true" />
                  Apply control
                </Button>
              )
            }
          >
            <div className="space-y-3">
              {impl.isLoading && <LoadingState compact label="Loading controls…" />}
              {impl.isError && <ErrorState compact error={impl.error} onRetry={impl.refetch} />}
              {impl.isSuccess && controls.length === 0 && <EmptyState compact title="No controls applied" description="Apply a library control to record how this risk is mitigated and how well the control works." />}
              {controls.map(c => (
                <ControlCard
                  key={String(c.uuid)}
                  impl={c}
                  lib={c.control_id != null ? libById.get(Number(c.control_id)) : undefined}
                  actions={
                    (canUpdate || canDelete) && (
                      <>
                        {canUpdate && (
                          <Button variant="ghost" size="sm" onClick={() => setControlDialog({ open: true, row: c })}>
                            <Pencil aria-hidden="true" />
                            Edit
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="sm" disabled={removingControl} onClick={() => onRemoveControl(c)} className="text-status-danger-fg hover:text-status-danger-fg">
                            <Trash2 aria-hidden="true" />
                            Remove
                          </Button>
                        )}
                      </>
                    )
                  }
                />
              ))}
            </div>
          </Panel>

          <Panel
            id="risk-plans"
            title="Action plans"
            meta={plans.isSuccess ? `${openPlanCount(planRows)} open of ${planRows.length}` : undefined}
            actions={
              canCreate && (
                <Button variant="secondary" size="sm" onClick={() => setPlanDialog({ open: true, row: null })}>
                  <Plus aria-hidden="true" />
                  New action plan
                </Button>
              )
            }
          >
            <div className="space-y-3">
              {plans.isLoading && <LoadingState compact label="Loading action plans…" />}
              {plans.isError && <ErrorState compact error={plans.error} onRetry={plans.refetch} />}
              {plans.isSuccess && planRows.length === 0 && <EmptyState compact title="No action plans" description="Create a plan with an owner, a due date and progress to bring this risk within appetite." />}
              {planRows.map(p => (
                <ActionPlanCard
                  key={String(p.uuid)}
                  row={p}
                  actions={
                    (canUpdate || canDelete) && (
                      <>
                        {canUpdate && (
                          <Button variant="ghost" size="sm" onClick={() => setPlanDialog({ open: true, row: p })}>
                            <Pencil aria-hidden="true" />
                            Edit
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="sm" disabled={removingPlan} onClick={() => removePlan(p)} className="text-status-danger-fg hover:text-status-danger-fg">
                            <Trash2 aria-hidden="true" />
                            Delete
                          </Button>
                        )}
                      </>
                    )
                  }
                />
              ))}
            </div>
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel id="risk-details" title="Details">
            <RiskFacts
              risk={risk}
              cycle={cycle}
              onAssignOwner={canUpdate ? () => setEditOpen(true) : undefined}
              extra={[
                { label: 'Category', value: risk.category ?? <span className="text-muted-foreground">{DASH}</span> },
                { label: 'Champion', value: risk.champion ?? <span className="text-muted-foreground">Not assigned</span> },
                { label: 'Inherent', value: <BandBadge score={risk.inherentScore} kind="Inherent" rateHref={canUpdate ? inherentRateHref(risk) : undefined} /> },
                { label: 'Registered', value: registered ?? <span className="text-muted-foreground">{DASH}</span> },
                { label: 'Assessment', value: period ?? <span className="text-muted-foreground">{DASH}</span> },
                { label: 'SOP available', value: row.is_sop_available === 'Y' ? 'Yes' : row.is_sop_available === 'N' ? 'No' : <span className="text-muted-foreground">{DASH}</span> },
                { label: 'Created', value: risk.createdOn ? formatDate(risk.createdOn) : <span className="text-muted-foreground">{DASH}</span> },
              ]}
            />
          </Panel>

          <Panel id="risk-approval" title="Approval">
            <ApprovalSummary risk={risk} canAudit={canAudit} />
          </Panel>

          {canAudit && <HistoryPanel riskId={risk.uuid} version={JSON.stringify(row)} />}
        </div>
      </div>

      <RiskDialog open={editOpen} onOpenChange={setEditOpen} risk={row} />
      <ControlImplementationDialog open={controlDialog.open} onOpenChange={open => setControlDialog(d => ({ ...d, open }))} row={controlDialog.row} riskId={risk.uuid} />
      <ActionPlanDialog open={planDialog.open} onOpenChange={open => setPlanDialog(d => ({ ...d, open }))} row={planDialog.row} riskId={risk.uuid} />
    </div>
  )
}

// ── Audit history ────────────────────────────────────────────────────────────

const ACTION_LABEL: Record<string, string> = { CREATE: 'Created', UPDATE: 'Updated', DELETE: 'Deleted', APPROVE: 'Approved', REJECT: 'Rejected', EXPORT: 'Exported', VIEW: 'Viewed' }

function changeSummary(e: ApiAuditEntry): string | null {
  const keys = Object.keys((e.changes ?? {}) as Record<string, unknown>)
  if (!keys.length) return null
  const names = keys.map(k => k.toLowerCase().replace(/_uuid$/, '').replace(/_/g, ' '))
  return names.length > 4 ? `${names.slice(0, 4).join(', ')} and ${names.length - 4} more` : names.join(', ')
}

function HistoryPanel({ riskId, version }: { riskId: number; version: string }) {
  const audit = useRiskAudit(riskId, true, version)
  const entries = audit.data ?? []
  const [all, setAll] = useState(false)
  const shown = all ? entries : entries.slice(0, 8)
  return (
    <Panel id="risk-history" title="History" meta={audit.isSuccess ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}` : undefined}>
      {audit.isLoading && <LoadingState compact label="Loading history…" />}
      {audit.isError && <ErrorState compact error={audit.error} onRetry={audit.refetch} />}
      {audit.isSuccess && entries.length === 0 && <p className="text-body-sm text-muted-foreground">No changes to this risk are recorded in the audit trail yet.</p>}
      {shown.length > 0 && (
        <ol className="divide-y divide-border">
          {shown.map(e => {
            const changed = changeSummary(e)
            return (
              <li key={e.id} className="py-2.5 first:pt-0 last:pb-0">
                <p className="text-body-sm text-foreground">
                  <span className="font-medium">{ACTION_LABEL[e.action] ?? e.action}</span> <span className="text-muted-foreground">by {e.actor_name}</span>
                  {e.result === 'FAILURE' && <span className="ml-1.5 text-caption font-medium text-status-danger-fg">refused</span>}
                </p>
                {changed && <p className="truncate text-caption text-foreground-secondary" title={changed}>Changed {changed}</p>}
                <p className="text-caption text-muted-foreground">{formatDateTime(e.timestamp)}</p>
              </li>
            )
          })}
        </ol>
      )}
      {entries.length > 8 && (
        <Button variant="link" className="mt-3" onClick={() => setAll(a => !a)}>
          {all ? 'Show fewer' : `Show all ${entries.length}`}
        </Button>
      )}
    </Panel>
  )
}
