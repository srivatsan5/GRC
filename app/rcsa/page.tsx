'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Activity, ArrowRight, ClipboardList, Gauge, Settings2, ShieldCheck, Target } from 'lucide-react'
import { PericopeLayout } from '@/components/pericope-layout'
import { useRows } from '@/lib/data'
import { toRisk } from '@/lib/risk'
import { daysUntil, formatNumber } from '@/lib/format'

/** RCSA overview: the lifecycle stages with live counts from the database. */
export default function RcsaHubPage() {
  const cycles = useRows('erm_trn_assessment_cycle')
  const risks = useRows('per_trn_identify_risk')
  const applied = useRows('per_trn_control_implementation')
  const plans = useRows('per_trn_risk_monitoring')

  const stats = useMemo(() => {
    const active = (risks.data ?? []).map(toRisk).filter(r => r.isActive)
    const withControls = new Set((applied.data ?? []).map(c => Number(c.identify_risk_uuid)).filter(Number.isFinite))
    const openPlans = (plans.data ?? []).filter(p => !(p.is_stage_complted === 'Y' || Number(p.completion_pct) >= 100 || p.actual_end_date))
    return {
      cyclesOpen: (cycles.data ?? []).filter(c => c.status !== 'Completed').length,
      cyclesTotal: cycles.data?.length ?? 0,
      risks: active.length,
      rated: active.filter(r => r.inherentScore != null).length,
      residual: active.filter(r => r.residualScore != null).length,
      withControls: active.filter(r => withControls.has(r.uuid)).length,
      openPlans: openPlans.length,
      overduePlans: openPlans.filter(p => (daysUntil(p.estimated_end_date) ?? 0) < 0).length,
    }
  }, [cycles.data, risks.data, applied.data, plans.data])

  const loading = cycles.isLoading || risks.isLoading || applied.isLoading || plans.isLoading
  const n = (v: number) => (loading ? '…' : formatNumber(v))

  const stages = [
    { step: '01', title: 'Assessment cycles', href: '/rcsa/provisioning', icon: Settings2, text: 'Plan the cycle: scope, dates and deadline.', stat: `${n(stats.cyclesOpen)} open of ${n(stats.cyclesTotal)}` },
    { step: '02', title: 'Risk register', href: '/rcsa/identification', icon: Target, text: 'Record risk statements, owners and categories.', stat: `${n(stats.risks)} active risks` },
    { step: '03', title: 'Inherent assessment', href: '/assessments/inherent', icon: Gauge, text: 'Rate likelihood and impact before controls.', stat: `${n(stats.rated)} of ${n(stats.risks)} rated` },
    { step: '04', title: 'Controls & mitigation', href: '/rcsa/mitigation', icon: ShieldCheck, text: 'Apply library controls and set the residual rating.', stat: `${n(stats.withControls)} risks with controls · ${n(stats.residual)} residual-rated` },
    { step: '05', title: 'Monitoring', href: '/rcsa/monitoring', icon: Activity, text: 'Track action plans to completion and close the cycle.', stat: `${n(stats.openPlans)} open plans · ${n(stats.overduePlans)} overdue` },
  ]

  return (
    <PericopeLayout>
      <div className="space-y-6">
        <div className="pb-3 border-b border-slate-200">
          <h1 className="text-lg font-semibold text-slate-900">Risk & Control Self-Assessment</h1>
          <p className="text-xs text-slate-500">The five stages of an RCSA cycle, with live counts from the register.</p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {stages.map(s => (
            <li key={s.step}>
              <Link href={s.href} className="group block h-full rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                <div className="flex items-start justify-between">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-slate-700">
                    <s.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{s.step}</span>
                </div>
                <h2 className="mt-3 text-sm font-semibold text-slate-900">{s.title}</h2>
                <p className="mt-1 text-xs text-slate-500">{s.text}</p>
                <p className="mt-3 text-xs font-medium text-slate-700 tabular-nums">{s.stat}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs text-blue-700 group-hover:underline">
                  Open <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/heatmaps" className="group block h-full rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 hover:border-blue-300 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-white text-slate-700">
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="mt-3 text-sm font-semibold text-slate-900">Results</h2>
              <p className="mt-1 text-xs text-slate-500">Heatmaps, analytics and reports built from the ratings above.</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs text-blue-700 group-hover:underline">
                Open heatmaps <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </span>
            </Link>
          </li>
        </ol>
      </div>
    </PericopeLayout>
  )
}
