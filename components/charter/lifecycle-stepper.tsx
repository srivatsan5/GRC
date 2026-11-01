'use client'

/**
 * RCSA lifecycle stepper (Charter): five stages with live progress from the database.
 * The current stage is a raised card with a filled number; stages 3 and 4 show a progress bar.
 */
import Link from 'next/link'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useRows } from '@/lib/data'
import { toRisk } from '@/lib/risk'
import { daysUntil } from '@/lib/format'
import { Meter } from './primitives'

export type LifecycleStage = 'cycles' | 'register' | 'inherent' | 'controls' | 'monitoring'

const STAGES: { key: LifecycleStage; label: string; href: string }[] = [
  { key: 'cycles', label: 'Assessment cycles', href: '/rcsa/provisioning' },
  { key: 'register', label: 'Risk register', href: '/rcsa/identification' },
  { key: 'inherent', label: 'Inherent assessment', href: '/assessments/inherent' },
  { key: 'controls', label: 'Controls & mitigation', href: '/rcsa/mitigation' },
  { key: 'monitoring', label: 'Monitoring', href: '/rcsa/monitoring' },
]

export function LifecycleStepper({ current, className }: { current: LifecycleStage; className?: string }) {
  const cycles = useRows('erm_trn_assessment_cycle')
  const risks = useRows('per_trn_identify_risk')
  const applied = useRows('per_trn_control_implementation')
  const links = useRows('erm_lnk_control_risk')
  const plans = useRows('per_trn_risk_monitoring')

  const s = useMemo(() => {
    const active = (risks.data ?? []).map(toRisk).filter(r => r.isActive)
    const withControls = new Set<number>()
    for (const c of applied.data ?? []) if (c.identify_risk_uuid != null) withControls.add(Number(c.identify_risk_uuid))
    for (const l of links.data ?? []) if (l.risk_uuid != null) withControls.add(Number(l.risk_uuid))
    const open = (plans.data ?? []).filter(p => !(p.is_stage_complted === 'Y' || Number(p.completion_pct) >= 100 || p.actual_end_date))
    const inProgress = (cycles.data ?? []).filter(c => c.status === 'In Progress' || c.status === 'Under Review')
    const latest = [...inProgress].sort((a, b) => String(b.cycle_start_date ?? '').localeCompare(String(a.cycle_start_date ?? '')))[0]
    const rated = active.filter(r => r.inherentScore != null).length
    const covered = active.filter(r => withControls.has(r.uuid)).length
    return {
      cycles: cycles.data ? `${inProgress.length} in progress${latest?.cycle_name ? ` · ${latest.cycle_name}` : ''}` : null,
      register: risks.data ? `${active.length} active risks` : null,
      inherent: risks.data ? `${rated} of ${active.length} rated` : null,
      inherentPct: active.length ? (rated / active.length) * 100 : null,
      controls: risks.data && applied.data ? `${covered} of ${active.length} with controls` : null,
      controlsPct: active.length ? (covered / active.length) * 100 : null,
      monitoring: plans.data ? `${open.length} open · ${open.filter(p => (daysUntil(p.estimated_end_date) ?? 0) < 0).length} overdue` : null,
    }
  }, [cycles.data, risks.data, applied.data, links.data, plans.data])

  const detail: Record<LifecycleStage, string | null> = { cycles: s.cycles, register: s.register, inherent: s.inherent, controls: s.controls, monitoring: s.monitoring }
  const pct: Partial<Record<LifecycleStage, number | null>> = { inherent: s.inherentPct, controls: s.controlsPct }

  return (
    <nav aria-label="RCSA lifecycle" className={cn('overflow-x-auto rounded-xl bg-surface-sunken p-1.5 shadow-[inset_0_0_0_1px_var(--border)]', className)}>
      <ol className="grid min-w-[880px] grid-cols-5 gap-1.5">
        {STAGES.map((st, idx) => {
          const on = st.key === current
          return (
            <li key={st.key}>
              <Link
                href={st.href}
                aria-current={on ? 'step' : undefined}
                className={cn(
                  'flex h-full items-start gap-3 rounded-lg px-3.5 py-2.5 transition-[background-color,box-shadow] duration-(--duration-fast) ease-out focus-ring',
                  on ? 'surface-raised' : 'hover:bg-hover',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full font-display text-caption',
                    on ? 'bg-primary text-primary-foreground' : 'text-foreground-secondary shadow-[inset_0_0_0_1px_var(--border-strong)]',
                  )}
                >
                  {idx + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-body-sm', on ? 'font-semibold text-foreground' : 'font-medium text-foreground')}>{st.label}</span>
                  <span className="block truncate text-caption text-muted-foreground">{detail[st.key] ?? <span className="skeleton inline-block h-3 w-20 align-middle" />}</span>
                  {pct[st.key] !== undefined && <Meter value={pct[st.key] ?? null} className="mt-1.5 h-1" label={`${st.label} progress`} />}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
