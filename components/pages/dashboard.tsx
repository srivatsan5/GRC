'use client'

/**
 * Executive dashboard (Charter, approved design): DESIGN_HANDOFF §5.
 * Every figure is computed from rows the page loads; nothing is invented. Unknown values read "—".
 */
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CircleCheck, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataState } from '@/components/data-state'
import { useAuth } from '@/components/providers/auth-provider'
import { CountUp, DueChip, Meter, PageHeader, Panel, Segmented, Callout } from '@/components/charter/primitives'
import { HeatmapLegend, RiskHeatmap, risksInCell, type CellRef, type HeatmapMode } from '@/components/charter/heatmap'
import { useRows, type Row } from '@/lib/data'
import { bandCounts, currentScore, type Risk } from '@/lib/risk'
import { toReading, type KriReading } from '@/lib/kri'
import { useOrgSettings } from '@/lib/settings'
import { workflowApi, type ApiWorkflowItem } from '@/lib/apiClient'
import { formatDate, pctOf } from '@/lib/format'
import { cn } from '@/lib/utils'
import { exportCsv, fileDate } from '@/components/analytics/csv'
import { riskCsvColumns, riskDate, riskLabel, useRisks } from '@/components/analytics/risk-data'
import { SEVERITIES, incidentOpen, kriStatuses, numOrNull, planComplete, planOverdue } from '@/components/analytics/ops-data'
import { AppetiteBullets, BandSplitBar, BandSwatchLegend, KriBreachTile, MonthColumns, type AppetiteRow, type MonthDatum } from '@/components/analytics/charter-charts'

const MONTHS_SHOWN = 12
const ATTENTION_LIMIT = 3

const MODE_TITLES: Record<HeatmapMode, string> = {
  inherent: 'Inherent risk matrix',
  residual: 'Residual risk matrix',
  movement: 'Inherent → residual movement',
}

function monthKey(value: string | null): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** "SUNDAY, 1 NOVEMBER 2026" (label-caps upper-cases it). */
function dateline(d: Date) {
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' })
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  return `${weekday}, ${date}`
}

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many)

/** The occupied cell with the highest score for a mode (the default selection), or null. */
function hottestCell(risks: Risk[], mode: HeatmapMode): CellRef | null {
  let best: CellRef | null = null
  for (let l = 5; l >= 1; l--)
    for (let i = 5; i >= 1; i--)
      if (risksInCell(risks, mode, { l, i }).length && (!best || l * i > best.l * best.i)) best = { l, i }
  return best
}

function readingTime(r: KriReading) {
  const t = new Date(r.date).getTime()
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t
}

export function Dashboard() {
  const { hasPermission } = useAuth()
  const { money, bands, settings } = useOrgSettings()
  const canApprove = hasPermission('approve')
  const canCreate = hasPermission('create')

  const risksQ = useRisks()
  const implQ = useRows('per_trn_control_implementation')
  const linkQ = useRows('erm_lnk_control_risk')
  const monQ = useRows('per_trn_risk_monitoring')
  const kriQ = useRows('erm_mst_kri_definition')
  const readQ = useRows('erm_trn_kri_readings')
  const incQ = useRows('erm_trn_incident')
  const appQ = useRows('erm_mst_risk_appetite')
  const wfQ = useQuery({ queryKey: ['workflow', 'dashboard', 'to-decide'], queryFn: () => workflowApi.list({ mine: 'to-decide' }) })

  const allRisks = risksQ.data
  const risks = useMemo(() => (allRisks ?? []).filter(r => r.isActive), [allRisks])
  const riskById = useMemo(() => new Map((allRisks ?? []).map(r => [r.uuid, r])), [allRisks])

  // ── Headline figures ──
  const riskStats = useMemo(() => {
    const rated = risks.filter(r => currentScore(r) != null).length
    const withSle = risks.filter(r => r.sle != null)
    const sle = withSle.reduce((s, r) => s + (r.sle ?? 0), 0)
    const current = bandCounts(risks.map(currentScore), bands)
    return {
      total: risks.length,
      rated,
      unrated: risks.length - rated,
      sle: withSle.length ? sle : null,
      sleCount: withSle.length,
      highOrCritical: current.High + current.Critical,
      high: current.High,
      critical: current.Critical,
      inherent: bandCounts(risks.map(r => r.inherentScore), bands),
      residual: bandCounts(risks.map(r => r.residualScore), bands),
    }
  }, [risks, bands])

  const coverage = useMemo(() => {
    const covered = new Set<number>()
    for (const row of implQ.data ?? []) if (row.identify_risk_uuid != null) covered.add(Number(row.identify_risk_uuid))
    for (const row of linkQ.data ?? []) if (row.risk_uuid != null) covered.add(Number(row.risk_uuid))
    const n = risks.filter(r => covered.has(r.uuid)).length
    return { covered: n, pct: pctOf(n, risks.length) }
  }, [implQ.data, linkQ.data, risks])

  const plans = useMemo(() => {
    const rows = monQ.data ?? []
    const overdue = rows
      .filter(planOverdue)
      .sort((a, b) => new Date(String(a.estimated_end_date)).getTime() - new Date(String(b.estimated_end_date)).getTime())
    return { open: rows.filter(r => !planComplete(r)).length, overdue }
  }, [monQ.data])

  const kris = useMemo(() => kriStatuses(kriQ.data ?? [], readQ.data ?? []), [kriQ.data, readQ.data])
  const kriAlerts = useMemo(() => {
    const red = kris.filter(k => k.light === 'RED')
    const amber = kris.filter(k => k.light === 'AMBER')
    return { red, amber, withReading: kris.filter(k => k.latest).length }
  }, [kris])

  /** The reading before the latest one, per KRI (for the delta on the breach tile). */
  const previousReading = useMemo(() => {
    const byKri = new Map<number, KriReading[]>()
    for (const row of readQ.data ?? []) {
      const r = toReading(row)
      if (!Number.isFinite(r.value)) continue
      byKri.set(r.kriUuid, [...(byKri.get(r.kriUuid) ?? []), r])
    }
    const prev = new Map<number, KriReading>()
    for (const [k, list] of byKri) {
      const sorted = list.sort((a, b) => readingTime(b) - readingTime(a))
      if (sorted[1]) prev.set(k, sorted[1])
    }
    return prev
  }, [readQ.data])

  const incidents = useMemo(() => {
    const open = (incQ.data ?? []).filter(incidentOpen)
    const bySeverity = SEVERITIES.map(s => ({ s, n: open.filter(i => String(i.severity ?? '').toLowerCase() === s.toLowerCase()).length }))
    return { open: open.length, bySeverity }
  }, [incQ.data])

  const approvals = useMemo(() => {
    const items = (wfQ.data?.items ?? []).filter(i => i.status === 'Pending' || i.status === 'In Review')
    return { items, waiting: items.length, decidable: items.filter(i => i.can_decide).length }
  }, [wfQ.data])

  // ── Exposure against appetite ──
  const appetite = useMemo(() => {
    const rows: AppetiteRow[] = (appQ.data ?? [])
      .map((row: Row) => {
        const category = String(row.category ?? '').trim()
        const matching = risks.filter(r => r.category && r.category.trim().toLowerCase() === category.toLowerCase() && currentScore(r) != null)
        const scores = matching.map(r => currentScore(r) as number)
        return {
          key: String(row.uuid ?? category),
          category: category || '—',
          posture: row.posture ? String(row.posture) : null,
          tolerance: numOrNull(row.tolerance_score),
          current: scores.length ? Math.max(...scores) : null,
          ratedCount: scores.length,
        }
      })
      .sort((a, b) => (a.tolerance ?? 99) - (b.tolerance ?? 99) || a.category.localeCompare(b.category))
    const measured = rows.filter(r => r.current != null)
    const above = measured.filter(r => r.tolerance != null && (r.current as number) > r.tolerance).length
    return { rows, within: measured.length - above, above, unmeasured: rows.length - measured.length }
  }, [appQ.data, risks])

  // ── New risks per month: the last 12 months up to today ──
  const trend = useMemo(() => {
    const now = new Date()
    const months: MonthDatum[] = []
    for (let k = MONTHS_SHOWN - 1; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1)
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        short: d.toLocaleDateString('en-GB', { month: 'narrow' }),
        long: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        count: 0,
      })
    }
    const index = new Map(months.map((m, i) => [m.key, i]))
    let undated = 0
    let outside = 0
    for (const r of risks) {
      const k = monthKey(riskDate(r))
      if (!k) undated++
      else if (index.has(k)) months[index.get(k)!]!.count++
      else outside++
    }
    const first = months[0]!
    const last = months[months.length - 1]!
    const range = `${new Date(first.key + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} – ${new Date(last.key + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
    return { months, undated, outside, range, inWindow: months.reduce((s, m) => s + m.count, 0) }
  }, [risks])

  // ── Heatmap ──
  const [mode, setMode] = useState<HeatmapMode>('inherent')
  const [picked, setPicked] = useState<CellRef | null | undefined>(undefined)
  const autoCell = useMemo(() => hottestCell(risks, mode), [risks, mode])
  const selectedCell = picked === undefined ? autoCell : picked
  const unratedForMode = useMemo(
    () =>
      risks.filter(r => (mode === 'inherent' ? r.inherentScore == null : mode === 'residual' ? r.residualScore == null : r.inherentScore == null || r.residualScore == null))
        .length,
    [risks, mode],
  )

  const exportRegister = () =>
    exportCsv({
      filename: `risk-register-${fileDate()}`,
      entity: 'per_trn_identify_risk',
      description: 'Exported risk register from dashboard',
      rows: risks,
      columns: riskCsvColumns(bands, settings.currency),
    })

  const loadingRisks = risksQ.isLoading
  const empty = risksQ.isSuccess && risks.length === 0
  const severityText = incidents.bySeverity.filter(x => x.n > 0).map(x => `${x.n} ${x.s.toLowerCase()}`).join(', ')

  const attentionCount = kriAlerts.red.length + plans.overdue.length + approvals.waiting
  const residualRated = riskStats.total - riskStats.residual['Not rated']
  const residualBands = (['Critical', 'High', 'Moderate', 'Low'] as const).filter(b => riskStats.residual[b] > 0)

  const approvalsContext =
    approvals.waiting === 0
      ? 'Nothing waiting for you'
      : approvals.decidable === approvals.waiting
        ? approvals.waiting === 1
          ? 'Ready for your decision'
          : approvals.waiting === 2
            ? 'Both ready for your decision'
            : `All ${approvals.waiting} ready for your decision`
        : `${approvals.decidable} of ${approvals.waiting} ready for your decision`

  // ── Panels ──

  const headline = (
    <section aria-label="Headline figures" className="surface-panel grid grid-cols-2 overflow-hidden lg:grid-cols-4">
      {/* Active risks */}
      <div className="flex min-w-0 flex-col gap-2 px-5 pt-5 pb-5 sm:px-7 sm:pt-[22px] sm:pb-6">
        <p className="label-caps">Active risks</p>
        <Figure loading={loadingRisks} error={risksQ.isError}>
          <CountUp value={riskStats.total} />
        </Figure>
        <div className="mt-1.5 flex h-[5px] gap-[3px]" aria-hidden="true">
          {riskStats.total === 0 ? (
            <span className="flex-1 rounded-[3px] bg-surface-sunken shadow-[inset_0_0_0_1px_var(--border)]" />
          ) : (
            <>
              {riskStats.rated > 0 && <span className="rounded-[3px] bg-foreground-secondary" style={{ flex: riskStats.rated }} />}
              {riskStats.unrated > 0 && <span className="hatch rounded-[3px] bg-surface-sunken shadow-[inset_0_0_0_1px_var(--border-strong)]" style={{ flex: riskStats.unrated }} />}
            </>
          )}
        </div>
        <p className="text-body-sm text-muted-foreground tabular-nums">
          {riskStats.total === 0 ? (
            'No risks in the register yet'
          ) : (
            <>
              {riskStats.rated} rated
              {riskStats.unrated > 0 && (
                <>
                  {' · '}
                  <Link href="/assessments/inherent" className="rounded-xs font-medium text-primary hover:underline focus-ring">
                    {riskStats.unrated} not rated
                  </Link>
                </>
              )}
            </>
          )}
        </p>
      </div>

      {/* High & critical */}
      <div className="flex min-w-0 flex-col gap-2 border-l px-5 pt-5 pb-5 sm:px-7 sm:pt-[22px] sm:pb-6">
        <p className="label-caps">High &amp; critical</p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Figure
            loading={loadingRisks}
            error={risksQ.isError}
            className={riskStats.critical > 0 ? 'text-risk-critical-text' : riskStats.high > 0 ? 'text-risk-high-text' : undefined}
          >
            <CountUp value={riskStats.highOrCritical} />
          </Figure>
          {!loadingRisks && riskStats.critical > 0 && <BandLabel band="Critical" count={riskStats.high > 0 ? riskStats.critical : null} />}
          {!loadingRisks && riskStats.high > 0 && <BandLabel band="High" count={riskStats.critical > 0 ? riskStats.high : null} />}
        </div>
        <div className="mt-1.5 hidden h-[5px] lg:block" aria-hidden="true" />
        <p className="text-body-sm text-muted-foreground tabular-nums">
          {riskStats.rated ? `Current score, ${riskStats.rated} rated ${plural(riskStats.rated, 'risk')}` : 'No risks rated yet'}
        </p>
      </div>

      {/* Control coverage */}
      <div className="flex min-w-0 flex-col gap-2 border-t px-5 pt-5 pb-5 sm:px-7 sm:pt-[22px] sm:pb-6 lg:border-t-0 lg:border-l">
        <p className="label-caps">Control coverage</p>
        <Figure loading={loadingRisks || implQ.isLoading || linkQ.isLoading} error={risksQ.isError || implQ.isError || linkQ.isError}>
          {coverage.pct == null ? (
            '—'
          ) : (
            <>
              <CountUp value={coverage.pct} />
              <span className="ml-0.5 text-[36px] text-muted-foreground">%</span>
            </>
          )}
        </Figure>
        <Meter value={coverage.pct} className="mt-1.5 h-[5px]" label="Control coverage" />
        <p className="text-body-sm text-muted-foreground tabular-nums">
          {riskStats.total ? `${coverage.covered} of ${riskStats.total} active risks have a control` : 'No active risks'}
        </p>
      </div>

      {/* Approvals waiting for me */}
      <div className="flex min-w-0 flex-col gap-2 border-t border-l bg-primary/8 px-5 pt-5 pb-5 sm:px-7 sm:pt-[22px] sm:pb-6 lg:border-t-0">
        <p className="label-caps text-primary">Approvals waiting for me</p>
        <div className="flex items-baseline justify-between gap-3">
          <Figure loading={wfQ.isLoading} error={wfQ.isError} className="text-primary">
            <CountUp value={approvals.waiting} />
          </Figure>
          {canApprove && approvals.waiting > 0 && (
            <Button asChild className="h-8 px-3">
              <Link href="/workflow">Review</Link>
            </Button>
          )}
        </div>
        <div className="mt-1.5 hidden h-[5px] lg:block" aria-hidden="true" />
        <p className="text-body-sm text-muted-foreground tabular-nums">{wfQ.isError ? 'Approvals could not be loaded' : approvalsContext}</p>
      </div>
    </section>
  )

  const strip = (
    <div className="flex flex-wrap gap-x-9 gap-y-2 px-1 text-body-sm text-foreground-secondary tabular-nums">
      <StripItem href="/rcsa/identification" figure={money(riskStats.sle, { compact: true })} loading={loadingRisks}>
        recorded SLE · {riskStats.sleCount} of {riskStats.total} {plural(riskStats.total, 'risk')}
      </StripItem>
      <StripItem href="/rcsa/monitoring" figure={String(plans.open)} loading={monQ.isLoading}>
        open action {plural(plans.open, 'plan')}
        {plans.overdue.length > 0 && (
          <>
            {' · '}
            <span className="font-medium text-status-danger-fg">{plans.overdue.length} overdue</span>
          </>
        )}
      </StripItem>
      <StripItem href="/kri" figure={String(kriAlerts.red.length)} loading={kriQ.isLoading || readQ.isLoading}>
        {kris.length === 0 ? (
          'KRIs in red · no active KRIs'
        ) : (
          <>
            {plural(kriAlerts.red.length, 'KRI', 'KRIs')} in red · {kriAlerts.amber.length} amber · {kriAlerts.withReading} of {kris.length} read
          </>
        )}
      </StripItem>
      <StripItem href="/incidents" figure={String(incidents.open)} loading={incQ.isLoading}>
        open {plural(incidents.open, 'incident')}
        {severityText && ` · ${severityText}`}
      </StripItem>
    </div>
  )

  const heatmap = (
    <Panel
      title={MODE_TITLES[mode]}
      className="flex flex-col"
      actions={
        <Segmented
          label="Heatmap mode"
          value={mode}
          onChange={m => {
            setMode(m)
            setPicked(undefined)
          }}
          options={[
            { value: 'inherent', label: 'Inherent' },
            { value: 'residual', label: 'Residual' },
            { value: 'movement', label: 'Movement' },
          ]}
        />
      }
      bodyClassName="flex flex-col gap-5 pt-5"
    >
      <DataState query={risksQ} compact>
        <div className="relative -mx-6 overflow-x-auto px-6 pb-1">
          <RiskHeatmap risks={risks} mode={mode} selected={selectedCell} onSelect={c => setPicked(c)} className="min-w-[460px]" />
        </div>
        <HeatmapLegend unrated={unratedForMode} rateHref={mode === 'inherent' ? '/assessments/inherent' : '/assessments/residual'} />
      </DataState>
    </Panel>
  )

  const attention = (
    <Panel
      title="Needs attention"
      meta={
        <span className="tabular-nums">
          {attentionCount} {plural(attentionCount, 'item')} ·{' '}
          <Link href="/workflow" className="rounded-xs font-medium text-primary hover:underline focus-ring">
            Open inbox
          </Link>
        </span>
      }
      bodyClassName="pt-1 pb-3"
    >
      <DataState query={[kriQ, readQ, monQ, wfQ]} compact>
        {attentionCount === 0 ? (
          <div className="flex items-center gap-3 py-6 text-body-sm text-foreground-secondary">
            <CircleCheck className="size-5 text-status-success-fg" aria-hidden="true" />
            Nothing needs your attention: no KRI in breach, no overdue action plan and no approval waiting for you.
          </div>
        ) : (
          <div>
            {kriAlerts.red.length > 0 && (
              <AttentionGroup label="KRI breach" count={kriAlerts.red.length} tone="text-risk-critical-text">
                <div className="mt-1 flex flex-col gap-2">
                  {kriAlerts.red.slice(0, 2).map(k => (
                    <KriBreachTile key={k.kri.uuid} kri={k.kri} latest={k.latest!} previous={previousReading.get(k.kri.uuid) ?? null} href={`/kri?q=${encodeURIComponent(k.kri.code || k.kri.name)}`} />
                  ))}
                  {kriAlerts.red.length > 2 && <MoreLink href="/kri" n={kriAlerts.red.length - 2} what="KRIs in breach" />}
                </div>
              </AttentionGroup>
            )}

            {plans.overdue.length > 0 && (
              <AttentionGroup label="Overdue action plans" count={plans.overdue.length} tone="text-status-warning-fg">
                <ul>
                  {plans.overdue.slice(0, ATTENTION_LIMIT).map(p => {
                    const risk = p.identify_risk_uuid != null ? riskById.get(Number(p.identify_risk_uuid)) : undefined
                    const pct = numOrNull(p.completion_pct)
                    const meta = [risk ? riskLabel(risk) : null, p.mitigation_owner ? String(p.mitigation_owner) : null, pct != null ? `${pct}% complete` : null].filter(Boolean).join(' · ')
                    return (
                      <li key={String(p.uuid)} className="flex flex-col items-start gap-2 border-t py-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-4 sm:gap-y-1">
                        <span className="flex w-full min-w-0 flex-col gap-0.5">
                          <Link href="/rcsa/monitoring" className="truncate rounded-xs text-body font-medium text-foreground hover:underline focus-ring" title={String(p.monitoring_title ?? '')}>
                            {String(p.monitoring_title ?? 'Untitled action plan')}
                          </Link>
                          {meta && (
                            <span className="truncate text-caption text-muted-foreground tabular-nums" title={meta}>
                              {meta}
                            </span>
                          )}
                        </span>
                        <DueChip date={p.estimated_end_date as string | null} />
                      </li>
                    )
                  })}
                </ul>
                {plans.overdue.length > ATTENTION_LIMIT && <MoreLink href="/rcsa/monitoring" n={plans.overdue.length - ATTENTION_LIMIT} what="overdue plans" />}
              </AttentionGroup>
            )}

            {approvals.waiting > 0 && (
              <AttentionGroup label="Approvals waiting for you" count={approvals.waiting} tone="text-primary">
                <ul>
                  {approvals.items.slice(0, ATTENTION_LIMIT).map(item => (
                    <ApprovalRow key={item.uuid} item={item} money={money} canReview={canApprove && item.can_decide} />
                  ))}
                </ul>
                {approvals.waiting > ATTENTION_LIMIT && <MoreLink href="/workflow" n={approvals.waiting - ATTENTION_LIMIT} what="approvals" />}
              </AttentionGroup>
            )}
          </div>
        )}
      </DataState>
    </Panel>
  )

  const exposure = (
    <Panel
      title="Exposure against appetite"
      meta={appetite.rows.length ? `${appetite.within} within · ${appetite.above} above · ${appetite.unmeasured} unmeasured` : undefined}
      className="min-w-0 xl:flex-[1.4_1_0%]"
      bodyClassName="pt-2.5 pb-5"
    >
      <DataState
        query={[appQ, risksQ]}
        compact
        empty={appetite.rows.length === 0}
        emptyTitle="No appetite statements yet"
        emptyDescription="Set a tolerance per risk category to compare it with the current exposure."
        emptyAction={
          <Link href="/risk-appetite" className="text-body-sm font-medium text-primary hover:underline">
            Open risk appetite
          </Link>
        }
      >
        <div className="relative -mx-6 overflow-x-auto px-6">
          <AppetiteBullets rows={appetite.rows} bands={bands} />
        </div>
        <p className="mt-3 text-caption text-muted-foreground">
          {appetite.unmeasured === appetite.rows.length ? (
            <>
              None of the {riskStats.rated} rated {plural(riskStats.rated, 'risk is', 'risks is')} linked to these categories yet, so exposure reads “—”, not zero.{' '}
            </>
          ) : (
            <>
              Current = the highest current score among rated active risks in the category.
              {appetite.unmeasured > 0 && ` ${appetite.unmeasured} ${plural(appetite.unmeasured, 'category has', 'categories have')} no rated risk, so ${plural(appetite.unmeasured, 'it reads', 'they read')} “—”, not zero.`}{' '}
            </>
          )}
          <Link href="/rcsa/identification" className="rounded-xs font-medium text-primary hover:underline focus-ring">
            Open register
          </Link>
        </p>
      </DataState>
    </Panel>
  )

  const byBand = (
    <Panel title="Inherent and residual, by band" meta={`${riskStats.total} active ${plural(riskStats.total, 'risk')}`} bodyClassName="flex flex-col gap-4 pt-4 pb-5">
      <DataState
        query={risksQ}
        compact
        empty={riskStats.total === 0}
        emptyTitle="No risks in the register yet"
        emptyAction={
          canCreate ? (
            <Link href="/rcsa/identification?new=1" className="text-body-sm font-medium text-primary hover:underline">
              Identify a risk
            </Link>
          ) : undefined
        }
      >
        <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2.5 text-caption">
          <span className="text-foreground-secondary">Inherent</span>
          <BandSplitBar counts={riskStats.inherent} label="Inherent" />
          <span className="text-foreground-secondary">Residual</span>
          <BandSplitBar counts={riskStats.residual} label="Residual" />
          <span />
          <BandSwatchLegend />
        </div>
        <p className="text-caption text-muted-foreground tabular-nums">
          {residualRated === 0
            ? `No residual ratings yet; ${riskStats.total - riskStats.inherent['Not rated']} of ${riskStats.total} risks have an inherent rating.`
            : residualBands.length === 1
              ? `Residual ratings exist for ${residualRated} of ${riskStats.total} risks; ${residualRated === 1 ? 'it sits' : `all ${residualRated} sit`} in ${residualBands[0]}.`
              : `Residual ratings exist for ${residualRated} of ${riskStats.total} risks; ${riskStats.residual.High + riskStats.residual.Critical} of them are High or Critical.`}
        </p>
      </DataState>
    </Panel>
  )

  const perMonth = (
    <Panel title="New risks per month" meta={trend.range} bodyClassName="pt-4 pb-5">
      <DataState query={risksQ} compact>
        <MonthColumns data={trend.months} />
        <p className="mt-2.5 text-caption text-muted-foreground">
          {[
            trend.inWindow === 0 ? 'No risks were registered in these 12 months.' : null,
            trend.undated > 0 ? `${trend.undated} ${plural(trend.undated, 'risk has', 'risks have')} no registered date and ${trend.undated === 1 ? 'is' : 'are'} not shown.` : null,
            trend.outside > 0 ? `${trend.outside} earlier ${plural(trend.outside, 'risk is', 'risks are')} outside this window.` : null,
          ]
            .filter(Boolean)
            .join(' ')}
        </p>
      </DataState>
    </Panel>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        size="hero"
        eyebrow={`${dateline(new Date())} · Live register`}
        title="Enterprise risk position"
        actions={
          <Button variant="secondary" onClick={exportRegister} disabled={!risksQ.isSuccess || risks.length === 0}>
            <Download aria-hidden="true" />
            Export register (CSV)
          </Button>
        }
      />

      {headline}

      {empty && (
        <Callout
          tone="info"
          action={
            canCreate ? (
              <Button asChild className="h-8 px-3">
                <Link href="/rcsa/identification?new=1">Identify the first risk</Link>
              </Button>
            ) : undefined
          }
        >
          The risk register is empty. {canCreate ? 'Identify a risk to start the heatmap, band totals and trends.' : 'Figures appear here once risks are identified.'}
        </Callout>
      )}

      {/* On mobile, Needs attention comes directly after the headline figures (§5.6). */}
      <div className="order-none max-xl:order-1">{strip}</div>

      <div className="contents xl:grid xl:grid-cols-[minmax(0,1.04fr)_minmax(0,1fr)] xl:items-start xl:gap-6">
        <div className="min-w-0 max-xl:order-2">{heatmap}</div>
        <div className="min-w-0 max-xl:order-0">{attention}</div>
      </div>

      <div className="flex flex-col gap-6 max-xl:order-3 xl:flex-row xl:items-start">
        {exposure}
        <div className="flex min-w-0 flex-col gap-6 xl:flex-[1_1_0%]">
          {byBand}
          {perMonth}
        </div>
      </div>
    </div>
  )
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function Figure({ loading, error, className, children }: { loading?: boolean; error?: boolean; className?: string; children: React.ReactNode }) {
  if (loading) return <span className="skeleton block h-[60px] w-20" aria-label="Loading" />
  return <p className={cn('figure text-figure-lg', className ?? 'text-foreground')}>{error ? '—' : children}</p>
}

/** Solid band badge (glyph + word) beside the headline figure; the count shows when both bands are present. */
function BandLabel({ band, count }: { band: 'Critical' | 'High'; count: number | null }) {
  const solid = band === 'Critical' ? 'bg-risk-critical text-risk-critical-fg' : 'bg-risk-high text-risk-high-fg'
  const level = band === 'Critical' ? 4 : 3
  return (
    <span className={cn('inline-flex h-badge -translate-y-2 items-center gap-1.5 rounded-sm px-2 text-caption font-medium whitespace-nowrap tabular-nums', solid)}>
      <span aria-hidden="true" className="inline-flex h-2.5 items-end gap-0.5">
        {[4, 6, 8, 10].map((h, i) => (
          <span key={h} className={cn('w-[3px] rounded-[1px] bg-current', i < level ? 'opacity-100' : 'opacity-30')} style={{ height: h }} />
        ))}
      </span>
      {count != null ? `${count} ${band}` : band}
    </span>
  )
}

function StripItem({ href, figure, loading, children }: { href: string; figure: string; loading?: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-baseline gap-2 rounded-xs focus-ring">
      {loading ? (
        <span className="skeleton inline-block h-5 w-8 self-center" aria-label="Loading" />
      ) : (
        <b className="figure text-figure-sm font-medium text-foreground">{figure}</b>
      )}
      <span className="group-hover:text-foreground">{children}</span>
    </Link>
  )
}

function AttentionGroup({ label, count, tone, children }: { label: string; count: number; tone: string; children: React.ReactNode }) {
  return (
    <section aria-label={label}>
      <h3 className="flex items-center gap-2 pt-4 pb-1">
        <span className={cn('label-caps', tone)}>{label}</span>
        <span className="text-caption text-muted-foreground tabular-nums">{count}</span>
      </h3>
      {children}
    </section>
  )
}

function MoreLink({ href, n, what }: { href: string; n: number; what: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 rounded-xs pt-1 pb-2 text-caption font-medium text-primary hover:underline focus-ring">
      {n} more {what} <ArrowRight className="size-3" aria-hidden="true" />
    </Link>
  )
}

function ApprovalRow({ item, money, canReview }: { item: ApiWorkflowItem; money: (v: number | null | undefined, o?: { compact?: boolean }) => string; canReview: boolean }) {
  const total = item.steps?.length ?? 0
  const step = item.next_step ?? null
  const meta = [
    step != null && total ? `Step ${step} of ${total}` : null,
    item.submitted_name ?? item.submitted_by ?? null,
    item.amount != null ? money(item.amount) : null,
    item.submitted_on ? formatDate(item.submitted_on, { day: 'numeric', month: 'short' }) : null,
  ].filter(Boolean)
  return (
    <li className="flex flex-col items-start gap-2 border-t py-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-4 sm:gap-y-1">
      <span className="flex w-full min-w-0 flex-col gap-0.5">
        <span className="truncate text-body font-medium text-foreground" title={item.title}>
          {item.title || item.request_type || `Request #${item.uuid}`}
        </span>
        <span className="truncate text-caption text-muted-foreground tabular-nums">
          <span className="font-mono">#{item.uuid}</span>
          {meta.length > 0 && ` · ${meta.join(' · ')}`}
        </span>
        {!item.can_decide && item.blocked_reason && <span className="text-caption text-muted-foreground">{item.blocked_reason}</span>}
      </span>
      {canReview && (
        <Button asChild className="h-8 px-3">
          <Link href="/workflow" aria-label={`Review ${item.title || `request #${item.uuid}`}`}>
            Review
          </Link>
        </Button>
      )}
    </li>
  )
}

export default Dashboard
