'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { FileDown } from 'lucide-react'
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { DataState } from '@/components/data-state'
import { useAuth } from '@/components/providers/auth-provider'
import { ApprovalBadge, CountUp, Meter, PageHeader, Panel } from '@/components/charter/primitives'
import { BAND_STYLES, bandCounts } from '@/lib/risk'
import { useOrgSettings } from '@/lib/settings'
import { formatNumber, formatPct, pctOf } from '@/lib/format'
import { exportCsv, fileDate } from '@/components/analytics/csv'
import { APPROVAL_LABELS, approvalLabel, countBy, riskCsvColumns, useRisks } from '@/components/analytics/risk-data'
import { AnalysisTabs, AXIS_TICK, BandStack, ChartTooltip, Headline, HeadlineCell, RankedBars, SplitBar } from '@/components/reports/kit'

/** Approval label → stored status, so the chart rows can carry the same icon + word badge as the register. */
const APPROVAL_STATUS_OF: Record<string, string> = Object.fromEntries(Object.entries(APPROVAL_LABELS).map(([k, v]) => [v, k]))

/**
 * /risk-assessments/dashboard — how far the assessment work has got across the register:
 * rating coverage, approval and completion status, SOP availability, and where the risks sit.
 * (Score analytics live on /assessments/access (inherent) and /assessments/residual.)
 */
export function RiskassessmentsdashboardPage() {
  const { bands, money, settings } = useOrgSettings()
  const { hasPermission } = useAuth()
  const risksQ = useRisks()
  const all = risksQ.data
  const risks = useMemo(() => (all ?? []).filter(r => r.isActive), [all])

  const s = useMemo(() => {
    const inherentRated = risks.filter(r => r.inherentScore != null).length
    const residualRated = risks.filter(r => r.residualScore != null).length
    const complete = risks.filter(r => r.isComplete).length
    const approved = risks.filter(r => r.approvalStatus === 'APPROVED').length
    const sop = (v: unknown) => (v === 'Y' ? 'SOP available' : v === 'N' ? 'No SOP' : 'Not recorded')
    const sleByCategory = new Map<string, { total: number; n: number }>()
    for (const r of risks) {
      if (r.sle == null) continue
      const k = r.category ?? 'Not specified'
      const cur = sleByCategory.get(k) ?? { total: 0, n: 0 }
      sleByCategory.set(k, { total: cur.total + r.sle, n: cur.n + 1 })
    }
    return {
      inherentRated,
      residualRated,
      complete,
      approved,
      approval: countBy(risks, r => approvalLabel(r.approvalStatus)),
      completion: [
        { name: 'Stage complete', count: complete },
        { name: 'In progress', count: risks.length - complete },
      ],
      sop: countBy(risks, r => sop(r.raw.is_sop_available)),
      byCategory: countBy(risks, r => r.category),
      byProcess: countBy(risks, r => r.process),
      sleByCategory: [...sleByCategory.entries()].map(([name, v]) => ({ name, count: v.total, n: v.n })).sort((a, b) => b.count - a.count),
      inherent: bandCounts(risks.map(r => r.inherentScore), bands),
      residual: bandCounts(risks.map(r => r.residualScore), bands),
    }
  }, [risks, bands])

  const pipeline = [
    { stage: 'Identified', count: risks.length },
    { stage: 'Inherent rated', count: s.inherentRated },
    { stage: 'Residual rated', count: s.residualRated },
    { stage: 'Approved', count: s.approved },
    { stage: 'Stage complete', count: s.complete },
  ].map(p => ({ ...p, pct: pctOf(p.count, risks.length) }))

  const onExport = () =>
    exportCsv({
      filename: `risk-assessments-${fileDate()}`,
      entity: 'per_trn_identify_risk',
      description: 'Exported risk assessment register from assessment dashboard',
      rows: risks,
      columns: riskCsvColumns(bands, settings.currency),
    })

  const sopTone = (name: string) => (name === 'SOP available' ? 'bg-chart-1' : name === 'No SOP' ? 'bg-chart-3' : 'hatch bg-risk-unrated-bg shadow-[inset_0_0_0_1px_var(--risk-unrated-border)]')

  return (
    <div className="space-y-6">
      <AnalysisTabs />
      <PageHeader
        eyebrow="Analytics · Assessment progress"
        title="Assessment progress"
        description="How far the assessment work has got across the active risk register: ratings, approvals, completion and SOP coverage."
        actions={
          <Button variant="secondary" onClick={onExport} disabled={!risksQ.isSuccess || risks.length === 0}>
            <FileDown aria-hidden="true" />
            Export CSV
          </Button>
        }
      />

      <DataState
        query={risksQ}
        empty={risks.length === 0}
        emptyTitle="No risks in the register yet"
        emptyDescription="Progress appears once risks are identified."
        emptyAction={
          hasPermission('create') ? (
            <Button asChild>
              <Link href="/rcsa/identification?new=1">Identify a risk</Link>
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-6">
          <Headline>
            <HeadlineCell label="Active risks" value={<CountUp value={risks.length} />} context={`${s.approved} approved · ${risks.length - s.approved} not yet approved`}>
              <SplitBar
                label="Approval"
                parts={[
                  { value: s.approved, className: 'bg-foreground/75', label: 'approved' },
                  { value: risks.length - s.approved, className: 'hatch bg-risk-unrated-bg shadow-[inset_0_0_0_1px_var(--risk-unrated-border)]', label: 'not approved' },
                ]}
              />
            </HeadlineCell>
            <ProgressCell label="Inherent assessed" n={s.inherentRated} of={risks.length} href="/assessments/access" />
            <ProgressCell label="Residual assessed" n={s.residualRated} of={risks.length} href="/assessments/residual" />
            <ProgressCell label="Stage complete" n={s.complete} of={risks.length} />
          </Headline>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Panel title="Assessment pipeline" meta="Share of active risks at each step">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipeline} layout="vertical" margin={{ top: 0, right: 72, bottom: 0, left: 0 }} barCategoryGap={10}>
                    <XAxis type="number" domain={[0, Math.max(1, risks.length)]} hide />
                    <YAxis type="category" dataKey="stage" width={112} tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
                    <Tooltip cursor={{ fill: 'var(--hover)' }} content={<ChartTooltip format={(v, e) => `${v} of ${risks.length} · ${formatPct((e.payload as { pct?: number | null })?.pct ?? null)}`} />} />
                    <Bar dataKey="count" name="Risks" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={30} background={{ fill: 'var(--muted)', radius: 4 }} isAnimationActive={false}>
                      <LabelList
                        dataKey="count"
                        position="right"
                        content={props => {
                          const { x, y, width, height, index } = props as { x: number; y: number; width: number; height: number; index: number }
                          const p = pipeline[index]
                          if (!p) return null
                          return (
                            <text x={Number(x) + Number(width) + 8} y={Number(y) + Number(height) / 2} dominantBaseline="central" fontSize={12} fill="var(--foreground)">
                              <tspan fontWeight={600}>{p.count}</tspan>
                              <tspan fill="var(--chart-axis)"> · {formatPct(p.pct)}</tspan>
                            </text>
                          )
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-caption text-muted-foreground">Each bar is out of {risks.length} active risks; the track behind it is the whole register.</p>
            </Panel>

            <Panel title="Inherent and residual, by band" meta={`${risks.length} active risks`}>
              <BandStack rows={[{ label: 'Inherent', counts: s.inherent }, { label: 'Residual', counts: s.residual }]} />
              <table className="enterprise-table mt-5">
                <thead>
                  <tr>
                    <th>Band</th>
                    <th data-numeric>Inherent</th>
                    <th data-numeric>Residual</th>
                  </tr>
                </thead>
                <tbody>
                  {(['Critical', 'High', 'Moderate', 'Low'] as const).map(b => (
                    <tr key={b}>
                      <td>
                        <span className="inline-flex items-center gap-2">
                          <span aria-hidden="true" className={`size-2.5 rounded-[3px] ${BAND_STYLES[b].dot}`} />
                          {b}
                        </span>
                      </td>
                      <td data-numeric>{s.inherent[b]}</td>
                      <td data-numeric>{s.residual[b]}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="text-muted-foreground">Not rated</td>
                    <td data-numeric className="text-muted-foreground">{s.inherent['Not rated']}</td>
                    <td data-numeric className="text-muted-foreground">{s.residual['Not rated']}</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-3 text-caption text-muted-foreground">
                Residual ratings exist for {s.residualRated} of {risks.length} risks; {risks.length - s.inherentRated} have no inherent rating yet.
              </p>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel title="Approval status">
              <ul className="divide-y">
                {s.approval.map(a => (
                  <li key={a.name} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                    <ApprovalBadge status={APPROVAL_STATUS_OF[a.name] ?? (a.name === 'Not recorded' ? null : a.name)} />
                    <span className="text-body-sm tabular-nums">
                      <span className="font-medium text-foreground">{a.count}</span>
                      <span className="text-muted-foreground"> · {formatPct(pctOf(a.count, risks.length))}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Completion">
              <RankedBars items={s.completion.map(c => ({ ...c, barClassName: c.name === 'Stage complete' ? 'bg-chart-1' : 'bg-chart-5' }))} total={risks.length} />
            </Panel>
            <Panel title="SOP availability">
              <RankedBars items={s.sop.map(x => ({ ...x, barClassName: sopTone(x.name) }))} total={risks.length} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel title="By category" meta={`${s.byCategory.length} categories`}>
              <RankedBars items={s.byCategory} total={risks.length} limit={10} />
            </Panel>
            <Panel title="By business process" meta={`${s.byProcess.length} processes`}>
              <RankedBars items={s.byProcess} total={risks.length} limit={10} />
            </Panel>
            <Panel title="Recorded SLE by category">
              {s.sleByCategory.length === 0 ? (
                <p className="text-body-sm text-muted-foreground">No risk has an SLE recorded yet.</p>
              ) : (
                <RankedBars
                  items={s.sleByCategory.map(c => ({ name: `${c.name} (${c.n})`, count: c.count }))}
                  total={0}
                  limit={10}
                  barClassName="bg-chart-2"
                  valueLabel={v => money(v, { compact: true })}
                />
              )}
            </Panel>
          </div>
        </div>
      </DataState>
    </div>
  )
}

function ProgressCell({ label, n, of, href }: { label: string; n: number; of: number; href?: string }) {
  const pct = pctOf(n, of)
  return (
    <HeadlineCell
      label={label}
      value={pct == null ? '—' : <CountUp value={pct} />}
      suffix={pct == null ? undefined : '%'}
      context={
        <>
          {formatNumber(n)} of {formatNumber(of)} risks
          {href && (
            <>
              {' · '}
              <Link href={href} className="rounded-xs font-medium text-primary hover:underline focus-ring">
                Analyse
              </Link>
            </>
          )}
        </>
      }
    >
      <Meter value={pct} label={label} />
    </HeadlineCell>
  )
}
