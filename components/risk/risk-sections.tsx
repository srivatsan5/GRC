'use client'

/**
 * Building blocks shared by the risk detail sheet (register) and the full risk page (/risks/[id]).
 * Every value comes from the database; missing values are designed states ("—", "Not rated",
 * "Never tested", "Not assigned"), never invented.
 */
import Link from 'next/link'
import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowRight, ArrowUp, Check, CircleCheck, Clock, OctagonAlert, Send, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRows, type Row } from '@/lib/data'
import { IMPACT_LABELS, LIKELIHOOD_LABELS, type Risk } from '@/lib/risk'
import { DASH, formatDate, formatDateTime } from '@/lib/format'
import { auditApi, type ApiAuditEntry } from '@/lib/apiClient'
import { useOrgSettings } from '@/lib/settings'
import { BandBadge } from '@/components/band-badge'
import { RiskHeatmap, riskRef } from '@/components/charter/heatmap'
import { ApprovalBadge, Chip, DueChip, Facts, Meter, Person } from '@/components/charter/primitives'
import { isActionComplete } from '@/components/treatment/shared'

export const IMPL_TABLE = 'per_trn_control_implementation'
export const LIB_TABLE = 'erm_mst_control'
export const PLAN_TABLE = 'per_trn_risk_monitoring'

// ── Links ────────────────────────────────────────────────────────────────────

/** Where a risk's controls (and residual rating) are managed. */
export function riskControlsHref(r: Pick<Risk, 'uuid' | 'cycleUuid'>): string {
  return r.cycleUuid != null ? `/rcsa/provisioning/${r.cycleUuid}/controls/${r.uuid}` : `/risks/${r.uuid}`
}
export const inherentRateHref = (r: Pick<Risk, 'uuid'>) => `/assessments/inherent?riskId=${r.uuid}`
export const auditHref = (r: Pick<Risk, 'uuid'>) => `/audit-trail?search=${encodeURIComponent(String(r.uuid))}`

/** Cycle reference as a mono link; "#id" when the cycle can't be found; "—" when none. */
export function CycleLink({ risk, cycle, withName, className }: { risk: Risk; cycle?: Row; withName?: boolean; className?: string }) {
  if (cycle) {
    const ref = cycle.cycle_reference ? String(cycle.cycle_reference) : null
    return (
      <span className={cn('inline-flex max-w-full min-w-0 flex-wrap items-baseline gap-x-2', className)}>
        <Link href={`/rcsa/provisioning/${cycle.uuid}`} className="truncate rounded-xs font-mono text-caption text-primary hover:underline focus-ring" title={String(cycle.cycle_name ?? '')}>
          {ref ?? String(cycle.cycle_name ?? `#${cycle.uuid}`)}
        </Link>
        {withName && ref && cycle.cycle_name && <span className="truncate text-body-sm text-foreground">{String(cycle.cycle_name)}</span>}
      </span>
    )
  }
  if (risk.cycleUuid != null) return <span className="font-mono text-caption text-muted-foreground" title="This cycle was not found">#{risk.cycleUuid}</span>
  return <span className="text-muted-foreground">{DASH}</span>
}

// ── Section heading (sheet / page) ───────────────────────────────────────────

export function SectionHeading({ title, meta, actions, id, className }: { title: React.ReactNode; meta?: React.ReactNode; actions?: React.ReactNode; id?: string; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-2', className)}>
      <h3 id={id} className="flex items-baseline gap-2.5 font-display text-section text-foreground">
        {title}
        {meta != null && <span className="font-sans text-caption font-normal tracking-normal text-muted-foreground">{meta}</span>}
      </h3>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

// ── Facts ────────────────────────────────────────────────────────────────────

export function RiskFacts({ risk, cycle, onAssignOwner, extra, className }: { risk: Risk; cycle?: Row; onAssignOwner?: () => void; extra?: { label: string; value: React.ReactNode }[]; className?: string }) {
  const { money } = useOrgSettings()
  return (
    <Facts
      className={className}
      items={[
        {
          label: 'Owner',
          value: risk.owner ? (
            <Person name={risk.owner} />
          ) : (
            <span className="text-muted-foreground">
              Not assigned
              {onAssignOwner && (
                <>
                  {' · '}
                  <button type="button" onClick={onAssignOwner} className="rounded-xs font-medium text-primary hover:underline focus-ring">
                    Assign
                  </button>
                </>
              )}
            </span>
          ),
        },
        { label: 'Cycle', value: <CycleLink risk={risk} cycle={cycle} withName /> },
        { label: 'Process', value: [risk.process, risk.subProcess].filter(Boolean).join(' · ') || <span className="text-muted-foreground">{DASH}</span> },
        { label: 'SLE', value: <span className="font-medium tabular-nums">{money(risk.sle)}</span> },
        ...(extra ?? []),
      ]}
    />
  )
}

// ── Inherent → residual ──────────────────────────────────────────────────────

function lxi(l: number | null, i: number | null): string | null {
  return l != null && i != null ? `${LIKELIHOOD_LABELS[l - 1]} × ${IMPACT_LABELS[i - 1]}` : null
}

/** Mini movement grid, both badges with their L × I labels, and the reduction as a serif figure. */
export function RiskRatingMovement({ risk, canRate, className }: { risk: Risk; canRate: boolean; className?: string }) {
  const hasInherent = risk.inherentScore != null
  const hasResidual = risk.residualScore != null
  const delta = hasInherent && hasResidual ? risk.inherentScore! - risk.residualScore! : null
  const mode = hasInherent && hasResidual ? 'movement' : hasInherent ? 'inherent' : 'residual'
  const one = useMemo(() => [risk], [risk])
  return (
    <div className={cn('grid grid-cols-1 items-center gap-6 sm:grid-cols-[176px_minmax(0,1fr)]', className)}>
      <div className="w-[176px]">
        <RiskHeatmap risks={one} mode={mode} size="sm" showDetail={false} />
      </div>
      <div className="min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 text-body-sm text-muted-foreground">
            Inherent{lxi(risk.inherentLikelihood, risk.inherentImpact) && <> · {lxi(risk.inherentLikelihood, risk.inherentImpact)}</>}
          </span>
          <BandBadge score={risk.inherentScore} kind="Inherent" rateHref={canRate ? inherentRateHref(risk) : undefined} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 text-body-sm text-muted-foreground">
            Residual{lxi(risk.residualLikelihood, risk.residualImpact) && <> · {lxi(risk.residualLikelihood, risk.residualImpact)}</>}
          </span>
          <BandBadge score={risk.residualScore} kind="Residual" rateHref={canRate && hasInherent ? riskControlsHref(risk) : undefined} rateLabel="Rate" />
        </div>
        <div className="border-t pt-3">
          {delta != null ? (
            delta > 0 ? (
              <p className="flex items-baseline gap-2.5">
                <span className="figure text-figure text-status-success-fg">{delta}</span>
                <span className="inline-flex items-center gap-1 text-body-sm text-foreground-secondary">
                  <ArrowDown className="size-3.5 self-center text-status-success-fg" aria-hidden="true" />
                  {delta === 1 ? 'point' : 'points'} lower after controls
                </span>
              </p>
            ) : delta === 0 ? (
              <p className="text-body-sm text-foreground-secondary">Controls have not changed the score yet.</p>
            ) : (
              <p className="flex items-baseline gap-2.5">
                <span className="figure text-figure text-status-danger-fg">{-delta}</span>
                <span className="inline-flex items-center gap-1 text-body-sm text-foreground-secondary">
                  <ArrowUp className="size-3.5 self-center text-status-danger-fg" aria-hidden="true" />
                  points higher than inherent: check the ratings
                </span>
              </p>
            )
          ) : (
            <p className="text-body-sm text-muted-foreground">
              {!hasInherent ? 'Rate the inherent likelihood and impact first; the reduction appears once both ratings exist.' : 'Rate the residual risk after controls to see the reduction.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Controls ─────────────────────────────────────────────────────────────────

export function useRiskRelated(riskId: number | null, enabled = true) {
  const on = enabled && riskId != null && Number.isFinite(riskId)
  const impl = useRows(IMPL_TABLE, { filter: { identify_risk_uuid: riskId ?? -1 }, enabled: on })
  const lib = useRows(LIB_TABLE, { enabled: on })
  const plans = useRows(PLAN_TABLE, { filter: { identify_risk_uuid: riskId ?? -1 }, enabled: on })
  const libById = useMemo(() => new Map((lib.data ?? []).map(c => [Number(c.uuid), c])), [lib.data])
  return { impl, lib, plans, libById }
}

function text(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s : null
}

function EffectivenessChip({ kind, value }: { kind: 'Design' | 'Operating'; value: unknown }) {
  const v = text(value)
  const s = v?.toLowerCase() ?? ''
  if (!v) return <Chip tone="neutral" icon={null}>{kind} not assessed</Chip>
  if (s === 'effective') return <Chip tone="success" icon={Check}>{kind} effective</Chip>
  if (s.startsWith('partially')) return <Chip tone="warning" icon={TriangleAlert}>{kind} partially effective</Chip>
  if (s === 'ineffective') return <Chip tone="danger" icon={OctagonAlert}>{kind} ineffective</Chip>
  if (s === 'not tested') return <Chip tone="neutral" icon={Clock}>{kind} not tested</Chip>
  return <Chip tone="neutral" icon={null}>{`${kind}: ${v}`}</Chip>
}

/** One applied control (per_trn_control_implementation joined to the library control). */
export function ControlCard({ impl, lib, actions, className }: { impl: Row; lib?: Row; actions?: React.ReactNode; className?: string }) {
  const controlId = impl.control_id != null ? Number(impl.control_id) : null
  const name = text(lib?.control_name) ?? (controlId != null ? `Library control #${controlId} (not found)` : 'No library control linked')
  const code = text(lib?.control_code)
  const type = text(impl.control_type) ?? text(lib?.control_type)
  const freq = text(impl.control_frequency) ?? text(lib?.frequency)
  const tested = text(lib?.last_tested_on)
  const evidence = text(impl.evidence_notes)
  return (
    <article className={cn('rounded-lg bg-card px-4 py-3.5 shadow-[0_0_0_1px_var(--border),var(--elevation-xs)]', className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h4 className="truncate text-body font-medium text-foreground" title={name}>
            {name}
          </h4>
          <p className="mt-0.5 truncate font-mono text-caption text-muted-foreground">{[code ?? 'No code', type ?? 'Type not set', freq ?? 'Frequency not set'].join('  ·  ')}</p>
        </div>
        <span className="shrink-0 text-caption text-muted-foreground">{tested ? `Last tested ${formatDate(tested)}` : 'Never tested'}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
        <EffectivenessChip kind="Design" value={impl.control_design_effectiveness} />
        <EffectivenessChip kind="Operating" value={impl.control_effectiveness_rating} />
        <span className="min-w-0 text-caption text-muted-foreground sm:ml-auto">{evidence ? `Evidence: ${evidence}` : 'No evidence recorded'}</span>
      </div>
      {actions && <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t pt-3">{actions}</div>}
    </article>
  )
}

// ── Action plans ─────────────────────────────────────────────────────────────

export function ActionPlanCard({ row, actions, className }: { row: Row; actions?: React.ReactNode; className?: string }) {
  const done = isActionComplete(row)
  const pctRaw = row.completion_pct != null && row.completion_pct !== '' ? Number(row.completion_pct) : null
  const pct = pctRaw != null && Number.isFinite(pctRaw) ? Math.max(0, Math.min(100, pctRaw)) : null
  const due = text(row.estimated_end_date)
  const title = text(row.monitoring_title) ?? 'Untitled action plan'
  const sub = [text(row.mitigation_owner) ?? 'Owner not assigned', text(row.monitoring_goal)].filter(Boolean).join(' · ')
  return (
    <article className={cn('rounded-lg bg-card px-4 py-3.5 shadow-[0_0_0_1px_var(--border),var(--elevation-xs)]', className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
        <div className="min-w-0">
          <h4 className="truncate text-body font-medium text-foreground" title={title}>
            {title}
          </h4>
          <p className="mt-0.5 truncate text-caption text-muted-foreground" title={sub}>
            {sub}
          </p>
        </div>
        <DueChip date={due} done={done} doneLabel="Complete" />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Meter value={pct} className="flex-1" label={`${title} progress`} tone={done ? 'bg-status-success-fg' : 'bg-primary'} />
        <span className="w-10 text-right text-body-sm font-medium tabular-nums text-foreground">{pct != null ? `${Math.round(pct)}%` : DASH}</span>
        <span className="w-32 text-right text-caption text-muted-foreground whitespace-nowrap">{due ? `Due ${formatDate(due)}` : 'No due date'}</span>
      </div>
      {actions && <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t pt-3">{actions}</div>}
    </article>
  )
}

export function openPlanCount(rows: Row[]): number {
  return rows.filter(r => !isActionComplete(r)).length
}

// ── Approval ─────────────────────────────────────────────────────────────────

/** Audit entries for one risk, newest first (only for users who can read the audit trail). */
export function useRiskAudit(riskId: number | null, enabled: boolean, version?: unknown) {
  return useQuery({
    queryKey: ['audit', 'risk', riskId, version ?? null],
    queryFn: () => auditApi.list({ entity: 'Risk register', search: String(riskId), limit: 200 }),
    enabled: enabled && riskId != null,
    select: d => d.items.filter(e => e.entity_id === String(riskId)),
  })
}

type Step = { key: string; label: string; who: string; when: string; tone: 'success' | 'danger' | 'info' | 'neutral'; note?: string | null }

/** The approval-relevant steps (created, submitted, approved, rejected) from the audit entries, oldest first. */
export function approvalSteps(entries: ApiAuditEntry[]): Step[] {
  const out: Step[] = []
  for (const e of [...entries].reverse()) {
    if (e.result !== 'SUCCESS') continue
    const changes = (e.changes ?? {}) as Record<string, unknown>
    const status = String(changes.APPROVAL_STATUS ?? changes.approval_status ?? '').toUpperCase()
    const base = { key: e.id, who: e.actor_name, when: e.timestamp }
    if (e.action === 'CREATE') out.push({ ...base, label: 'Created', tone: 'neutral' })
    else if (e.action === 'APPROVE' || status === 'APPROVED') out.push({ ...base, label: 'Approved', tone: 'success' })
    else if (e.action === 'REJECT' || status === 'REJECTED') out.push({ ...base, label: 'Rejected', tone: 'danger', note: text(changes.APPROVER_COMMENTS ?? changes.approver_comments) })
    else if (status === 'SUBMITTED' || status === 'IN_REVIEW' || status === 'PENDING') out.push({ ...base, label: 'Submitted for approval', tone: 'info' })
  }
  return out
}

const STEP_ICON = { success: Check, danger: X, info: Send, neutral: CircleCheck } as const
const STEP_TONE = {
  success: 'bg-status-success-bg text-status-success-fg',
  danger: 'bg-status-danger-bg text-status-danger-fg',
  info: 'bg-status-info-bg text-status-info-fg',
  neutral: 'bg-muted text-foreground-secondary shadow-[inset_0_0_0_1px_var(--border)]',
} as const

export function StepTimeline({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const Icon = STEP_ICON[s.tone]
        return (
          <li key={s.key} className="relative flex gap-3 pb-3 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden="true" className="absolute top-6 bottom-0 left-[11px] w-px bg-border" />}
            <span aria-hidden="true" className={cn('relative inline-flex size-6 shrink-0 items-center justify-center rounded-full', STEP_TONE[s.tone])}>
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-body-sm text-foreground">
                <span className="font-medium">{s.label}</span> <span className="text-muted-foreground">by {s.who}</span>
              </p>
              <p className="text-caption text-muted-foreground">{formatDateTime(s.when)}</p>
              {s.note && <p className="mt-1 text-body-sm text-foreground-secondary">“{s.note}”</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function statusSentence(r: Risk): string {
  const on = text(r.raw.approved_on)
  const by = text(r.raw.approved_by)
  switch (r.approvalStatus ?? 'DRAFT') {
    case 'DRAFT':
      return 'Draft, not yet submitted.'
    case 'SUBMITTED':
    case 'IN_REVIEW':
    case 'PENDING':
      return 'Waiting for a Risk Manager or Administrator to decide.'
    case 'APPROVED':
      return `Approved${on ? ` on ${formatDate(on)}` : ''}${by ? ` by ${by}` : ''}.`
    case 'REJECTED':
      return `Rejected${on ? ` on ${formatDate(on)}` : ''}${by ? ` by ${by}` : ''}. Edit and resubmit it.`
    default:
      return `Status: ${r.approvalStatus}.`
  }
}

export function ApprovalSummary({ risk, canAudit, className }: { risk: Risk; canAudit: boolean; className?: string }) {
  const audit = useRiskAudit(risk.uuid, canAudit, `${risk.approvalStatus}-${risk.raw.approved_on ?? ''}`)
  const steps = useMemo(() => approvalSteps(audit.data ?? []), [audit.data])
  const comments = text(risk.raw.approver_comments)
  return (
    <div className={cn('space-y-3', className)}>
      <p className="flex flex-wrap items-center gap-2 text-body-sm text-foreground">
        <ApprovalBadge status={risk.approvalStatus ?? 'DRAFT'} />
        <span>
          {statusSentence(risk)}
          {canAudit && audit.isSuccess && steps.length === 0 && <span className="text-muted-foreground"> No approval history.</span>}
        </span>
      </p>
      {comments && (
        <p className="rounded-md bg-surface-sunken px-3 py-2 text-body-sm text-foreground-secondary shadow-[inset_0_0_0_1px_var(--border)]">
          <span className="font-medium text-foreground">Approver comments: </span>
          {comments}
        </p>
      )}
      {canAudit && steps.length > 0 && <StepTimeline steps={steps} />}
      <p className="text-caption text-muted-foreground">Maker-checker: nobody can approve or reject a risk they created, so another Risk Manager or Administrator must decide.</p>
      {canAudit && (
        <Link href={auditHref(risk)} className="inline-flex items-center gap-1 rounded-xs text-body-sm font-medium text-primary hover:underline focus-ring">
          View this risk in the audit trail <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

export { riskRef }
