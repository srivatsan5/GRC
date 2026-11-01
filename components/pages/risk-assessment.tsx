'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataState } from '@/components/data-state'
import { BandBadge, RiskMovement } from '@/components/band-badge'
import { Pager } from '@/components/pager'
import { useAuth } from '@/components/providers/auth-provider'
import { ApprovalBadge, CountUp, PageHeader, Panel, Person, SearchField, Segmented } from '@/components/charter/primitives'
import { HeatmapLegend, RiskHeatmap, riskRef, type CellRef } from '@/components/charter/heatmap'
import { useRowPage } from '@/lib/data'
import { BANDS, BAND_STYLES, bandCounts, bandOf, currentScore, toRisk } from '@/lib/risk'
import { useOrgSettings } from '@/lib/settings'
import { formatDate, formatNumber, formatPct, pctOf } from '@/lib/format'
import { riskDate, RISK_TABLE, useRisks } from '@/components/analytics/risk-data'
import { AnalysisTabs, AXIS_TICK, BAND_FILL, CHART_HATCH_DEFS, ChartTooltip, Headline, HeadlineCell, SplitBar } from '@/components/reports/kit'

const PAGE_SIZE = 25

/** /risk-assessment — every risk with its inherent and residual assessment, searchable and paged. */
export function RiskAssessmentPage() {
  const { hasPermission } = useAuth()
  const { bands, money } = useOrgSettings()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [matrix, setMatrix] = useState<'inherent' | 'residual'>('inherent')
  const [cell, setCell] = useState<CellRef | null>(null)

  // Deep link: /risk-assessment?q=… prefills the search.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (q) setSearchInput(q)
  }, [])

  // Debounce the search box; the server does the searching.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const pageQ = useRowPage(RISK_TABLE, { page, pageSize: PAGE_SIZE, search, sort: 'created_on', order: 'desc' })
  const rows = useMemo(() => (pageQ.data?.items ?? []).map(toRisk), [pageQ.data])

  // Distribution and totals over the whole register (not just this page).
  const allQ = useRisks()
  const all = allQ.data
  const active = useMemo(() => (all ?? []).filter(r => r.isActive), [all])
  const stats = useMemo(() => {
    const scores = active.map(currentScore)
    const counts = bandCounts(scores, bands)
    const rated = scores.filter((x): x is number => x != null)
    return {
      total: active.length,
      rated: rated.length,
      critical: counts.Critical,
      high: counts.High,
      residualRated: active.filter(r => r.residualScore != null).length,
      avg: rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null,
      chart: [...BANDS].reverse().map(b => ({ band: b as string, count: counts[b], fill: BAND_FILL[b] })).concat({ band: 'Not rated', count: counts['Not rated'], fill: BAND_FILL['Not rated'] }),
    }
  }, [active, bands])
  const avgBand = stats.avg == null ? null : bandOf(Math.round(stats.avg), bands)
  const unratedForMatrix = active.filter(r => (matrix === 'inherent' ? r.inherentScore : r.residualScore) == null).length

  return (
    <div className="space-y-6">
      <AnalysisTabs />
      <PageHeader
        eyebrow="Analytics · Risk overview"
        title="Risk assessment overview"
        description="Inherent and residual likelihood × impact scoring across the whole risk register."
        actions={
          hasPermission('create') ? (
            <Button asChild>
              <Link href="/rcsa/identification">Assess risks in the register</Link>
            </Button>
          ) : undefined
        }
      />

      <DataState query={allQ} compact>
        <div className="space-y-6">
          <Headline>
            <HeadlineCell label="Active risks" value={<CountUp value={stats.total} />} context={`${stats.rated} rated · ${stats.total - stats.rated} not rated`}>
              <SplitBar
                label="Rating coverage"
                parts={[
                  { value: stats.rated, className: 'bg-foreground/75', label: 'rated' },
                  { value: stats.total - stats.rated, className: 'hatch bg-risk-unrated-bg shadow-[inset_0_0_0_1px_var(--risk-unrated-border)]', label: 'not rated' },
                ]}
              />
            </HeadlineCell>
            <HeadlineCell
              label="Average current score"
              value={stats.avg == null ? '—' : <CountUp value={stats.avg} format={v => formatNumber(v, 1)} />}
              suffix={stats.avg == null ? undefined : '/ 25'}
              tone={avgBand ? BAND_STYLES[avgBand].text : undefined}
              context={stats.avg == null ? 'No ratings yet' : `${avgBand} band · residual if assessed, else inherent`}
            />
            <HeadlineCell
              label="High & critical now"
              value={<CountUp value={stats.high + stats.critical} />}
              tone={stats.critical ? 'text-risk-critical-text' : stats.high ? 'text-risk-high-text' : undefined}
              context={`${stats.critical} critical · ${stats.high} high on current score`}
            />
            <HeadlineCell
              label="Residual assessed"
              value={<CountUp value={pctOf(stats.residualRated, stats.total) ?? 0} />}
              suffix="%"
              context={
                <>
                  {stats.residualRated} of {stats.total} ·{' '}
                  <Link href="/assessments/residual" className="rounded-xs font-medium text-primary hover:underline focus-ring">
                    Residual analysis
                  </Link>
                </>
              }
            />
          </Headline>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <Panel
              title={`${matrix === 'inherent' ? 'Inherent' : 'Residual'} risk matrix`}
              actions={
                <Segmented
                  label="Matrix rating"
                  value={matrix}
                  onChange={m => {
                    setMatrix(m)
                    setCell(null)
                  }}
                  options={[
                    { value: 'inherent', label: 'Inherent' },
                    { value: 'residual', label: 'Residual' },
                  ]}
                />
              }
            >
              <div className="relative overflow-x-auto">
                <div className="min-w-[440px]">
                  <RiskHeatmap risks={active} mode={matrix} selected={cell} onSelect={setCell} />
                </div>
              </div>
              <HeatmapLegend className="mt-4" unrated={unratedForMatrix} rateHref={hasPermission('update') ? (matrix === 'inherent' ? '/assessments/inherent' : '/rcsa/mitigation') : undefined} />
            </Panel>

            <Panel title="Current score by band" meta={`${stats.total} active risks`}>
              <p className="-mt-1 mb-4 text-caption text-muted-foreground">Current = residual if assessed, else inherent.</p>
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.chart} margin={{ top: 24, right: 4, bottom: 0, left: 4 }} barCategoryGap="22%">
                    {CHART_HATCH_DEFS}
                    <CartesianGrid vertical={false} horizontal={false} />
                    <XAxis dataKey="band" axisLine={{ stroke: 'var(--chart-grid)' }} tickLine={false} tick={AXIS_TICK} interval={0} />
                    <YAxis hide allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'var(--hover)' }} content={<ChartTooltip format={v => `${v} · ${formatPct(pctOf(Number(v), stats.total))}`} />} />
                    <Bar dataKey="count" name="Risks" radius={[4, 4, 0, 0]} isAnimationActive={false} minPointSize={2}>
                      {stats.chart.map(e => (
                        <Cell key={e.band} fill={e.fill} stroke={e.band === 'Not rated' ? 'var(--risk-unrated-border)' : undefined} />
                      ))}
                      <LabelList dataKey="count" position="top" style={{ fontSize: 13, fontWeight: 600, fill: 'var(--foreground)' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-caption text-muted-foreground">
                {stats.total - stats.rated} risk{stats.total - stats.rated === 1 ? ' has' : 's have'} neither rating and {stats.total - stats.rated === 1 ? 'shows' : 'show'} as Not rated (hatched), never as zero.
              </p>
            </Panel>
          </div>
        </div>
      </DataState>

      <Panel title="All risks" meta={pageQ.data ? `${formatNumber(pageQ.data.total)} ${search ? 'matching' : 'in the register'}` : undefined} bodyClassName="p-0">
        <div className="px-6 pt-4 pb-4">
          <SearchField value={searchInput} onChange={setSearchInput} label="Search risks" placeholder="Search statement, process, owner…" className="sm:w-80" />
        </div>
        <DataState
          query={pageQ}
          empty={rows.length === 0}
          emptyTitle={search ? `No risks match “${search}”` : 'No risks in the register yet'}
          emptyAction={
            !search && hasPermission('create') ? (
              <Button asChild>
                <Link href="/rcsa/identification?new=1">Identify a risk</Link>
              </Button>
            ) : undefined
          }
        >
          <div className="relative overflow-x-auto border-t">
            <table className="enterprise-table min-w-[1040px]">
              <thead>
                <tr>
                  <th className="pl-6">Risk</th>
                  <th>Owner</th>
                  <th>Inherent</th>
                  <th>Residual · change</th>
                  <th data-numeric>SLE</th>
                  <th>Approval</th>
                  <th>Created</th>
                  <th className="w-12 pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.uuid}>
                    <td className="py-2 pl-6">
                      <span className="block max-w-[220px] truncate font-medium" title={r.statement ?? undefined}>
                        {r.statement ?? <span className="font-normal text-muted-foreground">No statement recorded</span>}
                      </span>
                      <span className="block max-w-[220px] truncate font-mono text-caption text-muted-foreground" title={[riskRef(r), r.category, r.process].filter(Boolean).join(' · ')}>
                        {riskRef(r)}
                        {(r.category ?? r.process) && <span className="font-sans"> · {r.category ?? r.process}</span>}
                        {!r.isActive && <span className="font-sans"> · inactive</span>}
                      </span>
                    </td>
                    <td>
                      <Person name={r.owner} />
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      <BandBadge score={r.inherentScore} kind="Inherent" rateHref={hasPermission('update') ? `/risks/${r.uuid}` : undefined} />
                      {r.inherentScore != null && <span className="mt-0.5 block text-caption text-muted-foreground tabular-nums">L{r.inherentLikelihood} × I{r.inherentImpact}</span>}
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      <RiskMovement inherent={r.inherentScore} residual={r.residualScore} rateHref={hasPermission('update') && r.inherentScore != null ? `/risks/${r.uuid}` : undefined} />
                      {r.residualScore != null && <span className="mt-0.5 block text-caption text-muted-foreground tabular-nums">L{r.residualLikelihood} × I{r.residualImpact}</span>}
                    </td>
                    <td data-numeric>{money(r.sle)}</td>
                    <td>
                      <ApprovalBadge status={r.approvalStatus} />
                    </td>
                    <td className="whitespace-nowrap text-foreground-secondary">{formatDate(riskDate(r))}</td>
                    <td className="pr-6">
                      <Link
                        href={`/risks/${r.uuid}`}
                        aria-label={`Open risk ${riskRef(r)}`}
                        className="inline-flex size-8 items-center justify-center rounded-md text-foreground-secondary hover:bg-hover hover:text-foreground focus-ring"
                      >
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={pageQ.data?.total ?? 0} onPage={setPage} busy={pageQ.isFetching} />
        </DataState>
      </Panel>
    </div>
  )
}
