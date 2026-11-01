'use client'

import Link from 'next/link'
import React, { useMemo } from 'react'
import { ArrowRight, BarChart3, Grid3x3, TrendingDown } from 'lucide-react'
import { PericopeLayout } from '@/components/pericope-layout'
import { useAuth } from '@/components/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Chip, CountUp, Meter, PageHeader, Stat } from '@/components/charter/primitives'
import { useRows } from '@/lib/data'
import { toRisk } from '@/lib/risk'
import { daysUntil } from '@/lib/format'
import { cn } from '@/lib/utils'

/** RCSA overview: the five lifecycle stages with live counts from the database. */
export default function RcsaHubPage() {
  const { hasPermission } = useAuth()
  const canRate = hasPermission('update') && hasPermission('create')
  const cycles = useRows('erm_trn_assessment_cycle')
  const risks = useRows('per_trn_identify_risk')
  const applied = useRows('per_trn_control_implementation')
  const links = useRows('erm_lnk_control_risk')
  const plans = useRows('per_trn_risk_monitoring')

  const stats = useMemo(() => {
    const active = (risks.data ?? []).map(toRisk).filter(r => r.isActive)
    // Same coverage rule as the lifecycle stepper: an applied control or a library link.
    const withControls = new Set<number>()
    for (const c of applied.data ?? []) if (c.identify_risk_uuid != null) withControls.add(Number(c.identify_risk_uuid))
    for (const l of links.data ?? []) if (l.risk_uuid != null) withControls.add(Number(l.risk_uuid))
    const openPlans = (plans.data ?? []).filter(p => !(p.is_stage_complted === 'Y' || Number(p.completion_pct) >= 100 || p.actual_end_date))
    const status = (s: string[]) => active.filter(r => s.includes(r.approvalStatus ?? 'DRAFT')).length
    const allCycles = cycles.data ?? []
    return {
      cyclesOpen: allCycles.filter(c => c.status === 'In Progress' || c.status === 'Under Review').length,
      cyclesPlanned: allCycles.filter(c => c.status === 'Planned').length,
      cyclesTotal: allCycles.length,
      risks: active.length,
      draft: status(['DRAFT', 'REJECTED']),
      submitted: status(['SUBMITTED', 'IN_REVIEW', 'PENDING']),
      approved: status(['APPROVED']),
      rated: active.filter(r => r.inherentScore != null).length,
      residual: active.filter(r => r.residualScore != null).length,
      withControls: active.filter(r => withControls.has(r.uuid)).length,
      openPlans: openPlans.length,
      overduePlans: openPlans.filter(p => (daysUntil(p.estimated_end_date) ?? 0) < 0).length,
      plansTotal: plans.data?.length ?? 0,
    }
  }, [cycles.data, risks.data, applied.data, links.data, plans.data])

  const loading = cycles.isLoading || risks.isLoading || applied.isLoading || links.isLoading || plans.isLoading
  const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : null)
  const ratedPct = pct(stats.rated, stats.risks)
  const coveredPct = pct(stats.withControls, stats.risks)
  const unrated = stats.risks - stats.rated

  const stages: Stage[] = [
    {
      title: 'Assessment cycles',
      href: '/rcsa/provisioning',
      text: 'Plan the round: scope, period and submission deadline.',
      figure: stats.cyclesOpen,
      unit: stats.cyclesOpen === 1 ? 'cycle in progress' : 'cycles in progress',
      context: `${stats.cyclesPlanned} planned · ${stats.cyclesTotal} in total`,
      next: stats.cyclesTotal === 0 && hasPermission('create') ? { label: 'Create the first cycle', href: '/rcsa/provisioning' } : undefined,
    },
    {
      title: 'Risk register',
      href: '/rcsa/identification',
      text: 'Record each risk statement with its owner, process and category.',
      figure: stats.risks,
      unit: stats.risks === 1 ? 'active risk' : 'active risks',
      context: `${stats.draft} draft · ${stats.submitted} submitted · ${stats.approved} approved`,
      next: stats.risks === 0 && hasPermission('create') ? { label: 'Add the first risk', href: '/rcsa/identification?new=1' } : undefined,
    },
    {
      title: 'Inherent assessment',
      href: '/assessments/inherent',
      text: 'Rate likelihood and impact before controls, with the reasoning.',
      figure: stats.rated,
      unit: `of ${stats.risks} rated`,
      context: unrated > 0 ? `${unrated} not rated yet` : stats.risks ? 'Every active risk is rated' : 'No risks to rate',
      pct: ratedPct,
      unratedNote: unrated > 0,
      next: unrated > 0 && canRate ? { label: `Rate ${unrated} risk${unrated === 1 ? '' : 's'}`, href: '/assessments/inherent' } : undefined,
    },
    {
      title: 'Controls & mitigation',
      href: '/rcsa/mitigation',
      text: 'Apply library controls, then set the residual rating.',
      figure: stats.withControls,
      unit: `of ${stats.risks} with controls`,
      context: `${stats.residual} residual-rated`,
      pct: coveredPct,
    },
    {
      title: 'Monitoring',
      href: '/rcsa/monitoring',
      text: 'Track action plans to completion and finalize the cycle.',
      figure: stats.openPlans,
      unit: stats.openPlans === 1 ? 'open action plan' : 'open action plans',
      context: `${stats.plansTotal} plans in total`,
      overdue: stats.overduePlans,
    },
  ]

  return (
    <PericopeLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Risk & control self-assessment"
          title="The RCSA lifecycle"
          description="Five stages take a risk from a planned cycle to a monitored action plan. Every figure below is live from the register."
          actions={
            <>
              <Button asChild variant="secondary">
                <Link href="/heatmaps">
                  <Grid3x3 aria-hidden="true" />
                  Heatmaps
                </Link>
              </Button>
              {!loading && unrated > 0 && canRate ? (
                <Button asChild>
                  <Link href="/assessments/inherent">
                    Rate {unrated} unrated risk{unrated === 1 ? '' : 's'}
                  </Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/rcsa/provisioning">Open assessment cycles</Link>
                </Button>
              )}
            </>
          }
        />

        <section aria-label="RCSA summary" className="surface-panel grid grid-cols-2 lg:grid-cols-4">
          <div className="p-5 lg:p-6">
            <Stat label="Cycles in progress" loading={loading} value={<CountUp value={stats.cyclesOpen} />} context={`${stats.cyclesTotal} cycle${stats.cyclesTotal === 1 ? '' : 's'} in total`} />
          </div>
          <div className="border-l p-5 lg:p-6">
            <Stat label="Active risks" loading={loading} value={<CountUp value={stats.risks} />} context={`${stats.approved} approved`} />
          </div>
          <div className="border-t p-5 lg:border-t-0 lg:border-l lg:p-6">
            <Stat
              label="Inherent rated"
              loading={loading}
              value={ratedPct == null ? '—' : <CountUp value={ratedPct} />}
              suffix={ratedPct == null ? undefined : '%'}
              context={`${stats.rated} of ${stats.risks} active risks`}
            >
              <Meter value={ratedPct} label="Share of active risks with an inherent rating" className="mt-1" />
            </Stat>
          </div>
          <div className="border-t border-l p-5 lg:border-t-0 lg:p-6">
            <Stat
              label="Control coverage"
              loading={loading}
              value={coveredPct == null ? '—' : <CountUp value={coveredPct} />}
              suffix={coveredPct == null ? undefined : '%'}
              context={`${stats.withControls} of ${stats.risks} have a control`}
            >
              <Meter value={coveredPct} label="Share of active risks with a control" className="mt-1" />
            </Stat>
          </div>
        </section>

        <section aria-labelledby="stages-title" className="surface-panel">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 sm:px-6">
            <h2 id="stages-title">Five stages</h2>
            <span className="text-caption text-muted-foreground">In the order a cycle runs</span>
          </div>
          <ol className="mt-2 pb-2">
            {stages.map((s, idx) => (
              <StageRow key={s.title} stage={s} n={idx + 1} last={idx === stages.length - 1} loading={loading} />
            ))}
          </ol>
        </section>

        <nav aria-label="Results" className="flex flex-col gap-3 rounded-lg bg-surface-sunken px-5 py-4 shadow-[inset_0_0_0_1px_var(--border)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-body-sm text-foreground-secondary">
            <span className="font-medium text-foreground">Results.</span> Heatmaps, residual analysis and reports are built from the ratings above.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <ResultLink href="/heatmaps" icon={Grid3x3}>
              Heatmaps
            </ResultLink>
            <ResultLink href="/assessments/residual" icon={TrendingDown}>
              Residual analysis
            </ResultLink>
            <ResultLink href="/reports" icon={BarChart3}>
              Reports
            </ResultLink>
          </div>
        </nav>
      </div>
    </PericopeLayout>
  )
}

interface Stage {
  title: string
  href: string
  text: string
  figure: number
  unit: string
  context: string
  pct?: number | null
  overdue?: number
  unratedNote?: boolean
  next?: { label: string; href: string }
}

function StageRow({ stage: s, n, last, loading }: { stage: Stage; n: number; last: boolean; loading: boolean }) {
  return (
    <li
      className={cn(
        'relative grid grid-cols-[32px_minmax(0,1fr)] gap-x-4 px-5 sm:px-6 md:grid-cols-[32px_minmax(0,1.2fr)_minmax(0,1fr)_220px] md:items-center md:gap-x-8',
        !last && 'after:absolute after:right-5 after:bottom-0 after:left-[68px] after:h-px after:bg-border sm:after:right-6 sm:after:left-[72px]',
      )}
    >
      {/* number + connector */}
      <div className="relative row-span-2 flex justify-center self-stretch md:row-span-1">
        {!last && <span aria-hidden="true" className="absolute top-12 -bottom-4 w-px bg-border-strong" />}
        <span
          aria-hidden="true"
          className="relative mt-5 inline-flex size-8 shrink-0 items-center justify-center self-start rounded-full bg-card font-display text-body-lg text-foreground-secondary shadow-[inset_0_0_0_1px_var(--border-strong)] md:mt-6"
        >
          {n}
        </span>
      </div>
      <div className={'min-w-0 pt-5 md:py-5'}>
        <h3 className="text-body-lg font-semibold">
          <Link href={s.href} className="rounded-xs underline-offset-4 hover:underline focus-ring">
            <span className="sr-only">Stage {n}: </span>
            {s.title}
          </Link>
        </h3>
        <p className="mt-0.5 text-body-sm text-muted-foreground">{s.text}</p>
      </div>
      <div className={'col-start-2 min-w-0 pt-3 md:col-start-auto md:py-5'}>
        {loading ? (
          <span className="skeleton block h-6 w-32" aria-label="Loading" />
        ) : (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="figure text-figure-sm text-foreground">{s.figure}</span>
              <span className="text-body-sm text-foreground-secondary">{s.unit}</span>
            </p>
            {s.pct !== undefined && <Meter value={s.pct} className="mt-2 max-w-64" label={`${s.title} progress`} />}
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
              {s.unratedNote && <span aria-hidden="true" className="hatch inline-block size-3 rounded-[3px] bg-risk-unrated-bg shadow-[inset_0_0_0_1px_var(--risk-unrated-border)]" />}
              {s.context}
              {s.overdue != null && s.overdue > 0 && <Chip tone="danger">{`${s.overdue} overdue`}</Chip>}
            </p>
          </>
        )}
      </div>
      <div className={'col-start-2 flex flex-wrap items-center gap-2 pt-3 pb-5 md:col-start-auto md:justify-end md:py-5'}>
        {s.next && !loading && (
          <Button asChild variant="secondary" size="sm">
            <Link href={s.next.href}>{s.next.label}</Link>
          </Button>
        )}
        <Button asChild variant="ghost" size="sm" className={cn('text-primary hover:text-primary', !(s.next && !loading) && '-ml-3 md:ml-0')}>
          <Link href={s.href} aria-label={`Open ${s.title}`}>
            Open
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </li>
  )
}

function ResultLink({ href, icon: Icon, children }: { href: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-xs text-body-sm font-medium text-primary hover:underline focus-ring">
      <Icon className="size-4" aria-hidden="true" />
      {children}
    </Link>
  )
}
