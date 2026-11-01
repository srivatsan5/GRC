'use client'

/**
 * Treatment pipeline: every action plan (per_trn_risk_monitoring) grouped by a status
 * DERIVED from its progress and dates — nothing is read from a stored status flag:
 *   Done        completion 100%, an actual end date, or the stage marked complete
 *   Overdue     not done and the estimated end date has passed
 *   In progress some completion or an actual start date
 *   Not started everything else
 * Plans are created and edited on /monitoring/action-plan; this board is read-only.
 */
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Circle, CircleCheck, CircleDashed, Clock, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DueChip, Meter, PageHeader, Person, SearchField } from '@/components/charter/primitives'
import { DataState } from '@/components/data-state'
import { useRows, type Row } from '@/lib/data'
import { toRisk, type Risk } from '@/lib/risk'
import { daysUntil, formatDate, formatPct } from '@/lib/format'

type Stage = 'Not started' | 'In progress' | 'Overdue' | 'Done'
const STAGES: { id: Stage; icon: React.ComponentType<{ className?: string }>; iconClass: string; hint: string }[] = [
  { id: 'Not started', icon: Circle, iconClass: 'text-muted-foreground', hint: 'No progress or actual start yet' },
  { id: 'In progress', icon: CircleDashed, iconClass: 'text-status-info-fg', hint: 'Under way, within the target date' },
  { id: 'Overdue', icon: Clock, iconClass: 'text-status-danger-fg', hint: 'Past the target end, not complete' },
  { id: 'Done', icon: CircleCheck, iconClass: 'text-status-success-fg', hint: '100%, an actual end date, or marked complete' },
]

interface Plan {
  uuid: number
  title: string | null
  owner: string | null
  pct: number | null
  plannedEnd: string | null
  actualStart: string | null
  actualEnd: string | null
  riskUuid: number | null
  stage: Stage
  daysLeft: number | null
}

const text = (v: unknown) => (v == null || String(v).trim() === '' ? null : String(v).trim())

function toPlan(r: Row): Plan {
  const pctRaw = r.completion_pct == null || r.completion_pct === '' ? null : Number(r.completion_pct)
  const pct = pctRaw != null && Number.isFinite(pctRaw) ? Math.max(0, Math.min(100, pctRaw)) : null
  const plannedEnd = text(r.estimated_end_date)
  const actualStart = text(r.actual_start_date)
  const actualEnd = text(r.actual_end_date)
  const daysLeft = daysUntil(plannedEnd)
  const done = (pct ?? 0) >= 100 || !!actualEnd || r.is_stage_complted === 'Y'
  const stage: Stage = done ? 'Done' : daysLeft != null && daysLeft < 0 ? 'Overdue' : (pct ?? 0) > 0 || actualStart ? 'In progress' : 'Not started'
  const risk = r.identify_risk_uuid ?? r.risk_uuid
  return {
    uuid: Number(r.uuid ?? r.id),
    title: text(r.monitoring_title),
    owner: text(r.mitigation_owner),
    pct,
    plannedEnd,
    actualStart,
    actualEnd,
    riskUuid: risk == null || risk === '' ? null : Number(risk),
    stage,
    daysLeft,
  }
}

export function RiskResponsePage() {
  const plansQ = useRows('per_trn_risk_monitoring')
  const risksQ = useRows('per_trn_identify_risk')
  const [search, setSearch] = useState('')
  // ?q= deep link (read after mount to keep server and client markup identical)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (q) setSearch(q)
  }, [])

  const risksById = useMemo(() => new Map<number, Risk>((risksQ.data ?? []).map(r => toRisk(r)).map(r => [r.uuid, r])), [risksQ.data])
  const plans = useMemo(() => (plansQ.data ?? []).map(toPlan), [plansQ.data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return plans
    return plans.filter(p => {
      const risk = p.riskUuid != null ? risksById.get(p.riskUuid) : undefined
      return [p.title, p.owner, risk?.statement, risk?.referenceNumber].some(v => v?.toLowerCase().includes(q))
    })
  }, [plans, search, risksById])

  const byStage = useMemo(() => {
    const m = new Map<Stage, Plan[]>(STAGES.map(s => [s.id, []]))
    for (const p of filtered) m.get(p.stage)!.push(p)
    for (const list of m.values()) list.sort((a, b) => (a.plannedEnd ?? '9999').localeCompare(b.plannedEnd ?? '9999'))
    return m
  }, [filtered])

  const total = plans.length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Treatment"
        title="Treatment pipeline"
        description="Every action plan, grouped by its progress and due date. Create and edit plans under Action plans."
        actions={
          <Button asChild variant="secondary">
            <Link href="/monitoring/action-plan">
              <ListChecks aria-hidden="true" />
              Manage action plans
            </Link>
          </Button>
        }
      />

      <DataState
        query={[plansQ, risksQ]}
        empty={plans.length === 0}
        emptyTitle="No action plans yet"
        emptyDescription="Action plans recorded against risks will appear here, grouped by progress."
        emptyAction={
          <Button asChild>
            <Link href="/monitoring/action-plan">Go to action plans</Link>
          </Button>
        }
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <SearchField value={search} onChange={setSearch} label="Search action plans" placeholder="Search title, owner or risk…" />
            <ul className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-body-sm text-foreground-secondary sm:ml-auto" aria-label="Plans per stage">
              {STAGES.map(s => (
                <li key={s.id}>
                  <span className={'figure mr-1.5 text-figure-sm ' + (s.id === 'Overdue' && byStage.get(s.id)!.length > 0 ? 'text-status-danger-fg' : 'text-foreground')}>{byStage.get(s.id)!.length}</span>
                  {s.id.toLowerCase()}
                </li>
              ))}
              {search && <li className="text-caption text-muted-foreground">of {total} plans</li>}
            </ul>
          </div>

          <div>
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
              {STAGES.map(s => {
                const list = byStage.get(s.id)!
                const Icon = s.icon
                return (
                  <section key={s.id} aria-labelledby={`rr-col-${s.id}`} className="flex min-h-48 flex-col rounded-xl bg-surface-sunken p-2 shadow-[inset_0_0_0_1px_var(--border)]">
                    <header className="flex items-center gap-2 px-2 pt-1.5 pb-3" title={s.hint}>
                      <Icon className={'size-4 ' + s.iconClass} aria-hidden="true" />
                      <h2 id={`rr-col-${s.id}`} className="font-sans text-body-sm font-semibold text-foreground">
                        {s.id}
                      </h2>
                      <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-card px-1.5 text-caption tabular-nums text-foreground-secondary shadow-[inset_0_0_0_1px_var(--border)]">{list.length}</span>
                    </header>
                    {list.length === 0 ? (
                      <p className="mx-1 flex flex-1 items-center justify-center rounded-lg border border-dashed border-border-strong px-3 py-8 text-center text-caption text-muted-foreground">{search ? 'No matching plans' : 'No plans at this stage'}</p>
                    ) : (
                      <ul className="space-y-2">
                        {list.map(p => (
                          <PlanCard key={p.uuid} plan={p} risk={p.riskUuid != null ? risksById.get(p.riskUuid) : undefined} />
                        ))}
                      </ul>
                    )}
                  </section>
                )
              })}
            </div>
          </div>
        </div>
      </DataState>
    </div>
  )
}

function PlanCard({ plan: p, risk }: { plan: Plan; risk?: Risk }) {
  const title = p.title ?? `Action plan #${p.uuid}`
  return (
    <li className="surface-raised space-y-3 rounded-lg p-3.5 transition-shadow duration-(--duration-fast) ease-out hover:shadow-popover">
      <div className="space-y-1">
        <Link href={`/monitoring/action-plan?id=${p.uuid}`} className="block rounded-xs text-body-sm font-medium text-foreground hover:text-primary hover:underline focus-ring">
          {title}
        </Link>
        {p.riskUuid != null ? (
          <Link href={`/risks/${p.riskUuid}`} className="group flex min-w-0 items-baseline gap-1.5 rounded-xs text-caption focus-ring" title={risk?.statement ?? undefined}>
            <span className="shrink-0 font-mono text-muted-foreground">{risk?.referenceNumber ?? `#${p.riskUuid}`}</span>
            <span className="truncate text-foreground-secondary group-hover:text-primary group-hover:underline">{risk ? risk.statement ?? 'No statement recorded' : 'Risk not found'}</span>
          </Link>
        ) : (
          <p className="text-caption text-muted-foreground">No risk linked</p>
        )}
      </div>
      <Person name={p.owner} />
      <div className="flex items-center gap-2.5">
        <Meter value={p.pct} label={`${title} completion`} tone={p.stage === 'Done' ? 'bg-status-success' : 'bg-primary'} />
        <span className="w-9 shrink-0 text-right text-caption font-medium tabular-nums text-foreground">{formatPct(p.pct)}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DueChip date={p.plannedEnd} done={p.stage === 'Done'} doneLabel={p.actualEnd ? `Finished ${formatDate(p.actualEnd)}` : 'Done'} />
        {p.stage !== 'Done' && p.plannedEnd && p.daysLeft != null && p.daysLeft <= 14 && <span className="text-caption tabular-nums text-muted-foreground">Due {formatDate(p.plannedEnd)}</span>}
      </div>
    </li>
  )
}
