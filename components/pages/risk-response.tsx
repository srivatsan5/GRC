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
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { DataState } from '@/components/data-state'
import { useRows, type Row } from '@/lib/data'
import { toRisk, type Risk } from '@/lib/risk'
import { DASH, daysUntil, formatDate, formatPct } from '@/lib/format'
import { cn } from '@/lib/utils'

type Stage = 'Not started' | 'In progress' | 'Overdue' | 'Done'
const STAGES: { id: Stage; tone: string; dot: string }[] = [
  { id: 'Not started', tone: 'text-slate-700', dot: 'bg-slate-400' },
  { id: 'In progress', tone: 'text-blue-800', dot: 'bg-blue-600' },
  { id: 'Overdue', tone: 'text-red-800', dot: 'bg-red-600' },
  { id: 'Done', tone: 'text-emerald-800', dot: 'bg-emerald-600' },
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Treatment pipeline</h1>
          <p className="text-xs text-slate-500">Action plans grouped by progress and due date. Create and edit plans under Action plans.</p>
        </div>
        <Link href="/monitoring/action-plan" className="inline-flex items-center h-7 px-2.5 text-xs rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
          Manage action plans
        </Link>
      </div>

      <DataState
        query={[plansQ, risksQ]}
        empty={plans.length === 0}
        emptyTitle="No action plans yet"
        emptyDescription="Action plans recorded against risks will appear here, grouped by progress."
        emptyAction={
          <Link href="/monitoring/action-plan" className="text-xs text-blue-800 hover:underline">
            Go to action plans
          </Link>
        }
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <label htmlFor="rr-search" className="sr-only">
              Search action plans
            </label>
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input id="rr-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, owner or risk…" className="h-8 pl-8 text-xs" />
          </div>
          <ul className="flex flex-wrap gap-3 text-xs text-slate-600">
            {STAGES.map(s => (
              <li key={s.id}>
                {s.id}: <span className="font-semibold tabular-nums text-slate-900">{byStage.get(s.id)!.length}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {STAGES.map(s => {
            const list = byStage.get(s.id)!
            return (
              <section key={s.id} aria-labelledby={`rr-col-${s.id}`} className="bg-slate-50 rounded border border-slate-200 p-3 space-y-2">
                <h2 id={`rr-col-${s.id}`} className={cn('flex items-center gap-1.5 text-xs font-semibold', s.tone)}>
                  <span className={cn('h-2 w-2 rounded-full', s.dot)} aria-hidden="true" />
                  {s.id}
                  <span className="ml-auto font-normal text-slate-500 tabular-nums">{list.length}</span>
                </h2>
                {list.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-slate-400">None</p>
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
      </DataState>
    </div>
  )
}

function PlanCard({ plan: p, risk }: { plan: Plan; risk?: Risk }) {
  const due =
    p.stage === 'Done'
      ? p.actualEnd
        ? `Finished ${formatDate(p.actualEnd)}`
        : `Due ${formatDate(p.plannedEnd)}`
      : p.daysLeft == null
        ? 'No due date'
        : p.daysLeft < 0
          ? `${-p.daysLeft} day${p.daysLeft === -1 ? '' : 's'} overdue (due ${formatDate(p.plannedEnd)})`
          : p.daysLeft === 0
            ? 'Due today'
            : `Due ${formatDate(p.plannedEnd)} · ${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'} left`
  return (
    <li className="bg-white rounded border border-slate-200 p-3 space-y-2 text-xs">
      <p className="font-semibold text-slate-900">{p.title ?? `Action plan #${p.uuid}`}</p>
      {p.riskUuid != null && (
        <p className="text-[11px] text-slate-600">
          Risk:{' '}
          <Link href={`/rcsa/mitigation/${p.riskUuid}`} className="text-blue-800 hover:underline">
            {risk ? (risk.referenceNumber ? `${risk.referenceNumber} — ` : '') + (risk.statement ?? `Risk #${risk.uuid}`) : `Risk #${p.riskUuid}`}
          </Link>
        </p>
      )}
      <p className="text-[11px] text-slate-500">Owner: {p.owner ?? DASH}</p>
      <p className={cn('text-[11px]', p.stage === 'Overdue' ? 'text-red-700 font-medium' : 'text-slate-500')}>{due}</p>
      <div className="flex items-center gap-2">
        <div
          className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden"
          role="progressbar"
          aria-label="Completion"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={p.pct ?? undefined}
        >
          <div className={cn('h-full rounded-full', p.stage === 'Done' ? 'bg-emerald-500' : p.stage === 'Overdue' ? 'bg-red-500' : 'bg-blue-600')} style={{ width: `${p.pct ?? 0}%` }} />
        </div>
        <span className="text-[11px] tabular-nums text-slate-600 w-9 text-right">{formatPct(p.pct)}</span>
      </div>
    </li>
  )
}
