'use client'

/**
 * Charter analytics for one rating (inherent or residual) over the active risk register:
 * coverage, the 5×5 matrix, movement after controls (residual), bands, categories and the top-scored risks.
 * Every figure counts only risks that actually carry the rating; nothing is invented.
 */
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUpRight, FileDown } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { DataState } from '@/components/data-state'
import { BandBadge, RiskMovement } from '@/components/band-badge'
import { useAuth } from '@/components/providers/auth-provider'
import { PageHeader, Panel, Callout, CountUp, Person, Segmented } from '@/components/charter/primitives'
import { HeatmapLegend, RiskHeatmap, bandRanges, riskRef, type CellRef, type HeatmapMode } from '@/components/charter/heatmap'
import { BAND_STYLES, BANDS, bandCounts, bandOf, type Band, type Risk } from '@/lib/risk'
import { useOrgSettings } from '@/lib/settings'
import { formatNumber, formatPct, pctOf } from '@/lib/format'
import { cn } from '@/lib/utils'
import { exportCsv, fileDate } from '@/components/analytics/csv'
import { riskCsvColumns, riskLabel, useRisks } from '@/components/analytics/risk-data'
import { AnalysisTabs, AXIS_TICK, BandStack, ChartTooltip, FigureStrip, Headline, HeadlineCell, SeriesLegend, SplitBar } from './kit'

type Which = 'inherent' | 'residual'

const scoreOf = (r: Risk, which: Which) => (which === 'inherent' ? r.inherentScore : r.residualScore)
const avgOf = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Where risks are rated: inherent on the inherent assessment, residual after controls (Controls & mitigation). */
const RATE_HREF: Record<Which, string> = {
  inherent: '/assessments/inherent',
  residual: '/rcsa/mitigation',
}

export function RatingAnalytics({ which, title, description }: { which: Which; title: string; description: string }) {
  const { bands, money, settings } = useOrgSettings()
  const { hasPermission } = useAuth()
  const canRate = hasPermission('update')
  const risksQ = useRisks()
  const all = risksQ.data
  const risks = useMemo(() => (all ?? []).filter(r => r.isActive), [all])
  const [mode, setMode] = useState<HeatmapMode>(which)
  const [cell, setCell] = useState<CellRef | null>(null)
  const [allMoves, setAllMoves] = useState(false)

  const stats = useMemo(() => {
    const rated = risks.filter(r => scoreOf(r, which) != null)
    const scores = rated.map(r => scoreOf(r, which) ?? 0)
    const counts = bandCounts(
      risks.map(r => scoreOf(r, which)),
      bands,
    )
    const withSle = rated.filter(r => r.sle != null)
    // Residual only: risks that have an inherent rating but are still waiting for a residual one.
    const awaitingResidual = which === 'residual' ? risks.filter(r => r.inherentScore != null && r.residualScore == null).length : 0
    const both = risks.filter(r => r.inherentScore != null && r.residualScore != null)
    const deltas = both.map(r => (r.residualScore ?? 0) - (r.inherentScore ?? 0))
    const byCategory = new Map<string, Risk[]>()
    for (const r of rated) {
      const k = r.category ?? 'Not specified'
      byCategory.set(k, [...(byCategory.get(k) ?? []), r])
    }
    const bandSle = Object.fromEntries(
      BANDS.map(b => {
        const inBand = rated.filter(r => bandOf(scoreOf(r, which), bands) === b)
        const sle = inBand.filter(r => r.sle != null)
        return [b, sle.length ? sle.reduce((s, r) => s + (r.sle ?? 0), 0) : null]
      }),
    ) as Record<Band, number | null>
    return {
      rated,
      unrated: risks.length - rated.length,
      awaitingResidual,
      neverRated: risks.filter(r => r.inherentScore == null && r.residualScore == null).length,
      avg: avgOf(scores),
      counts,
      inherentCounts: bandCounts(
        risks.map(r => r.inherentScore),
        bands,
      ),
      residualCounts: bandCounts(
        risks.map(r => r.residualScore),
        bands,
      ),
      bandSle,
      highOrCritical: counts.High + counts.Critical,
      sle: withSle.length ? withSle.reduce((s, r) => s + (r.sle ?? 0), 0) : null,
      sleN: withSle.length,
      movement: {
        n: both.length,
        reduced: deltas.filter(d => d < 0).length,
        unchanged: deltas.filter(d => d === 0).length,
        increased: deltas.filter(d => d > 0).length,
        avgChange: avgOf(deltas),
        avgInherent: avgOf(both.map(r => r.inherentScore ?? 0)),
        rows: [...both].sort((a, b) => (a.residualScore ?? 0) - (a.inherentScore ?? 0) - ((b.residualScore ?? 0) - (b.inherentScore ?? 0)) || (b.inherentScore ?? 0) - (a.inherentScore ?? 0)),
      },
      categories: [...byCategory.entries()]
        .map(([name, list]) => {
          const s = list.map(r => scoreOf(r, which) ?? 0)
          const inh = list.map(r => r.inherentScore).filter((x): x is number => x != null)
          return {
            name,
            n: list.length,
            avg: s.reduce((a, b) => a + b, 0) / s.length,
            max: Math.max(...s),
            inherentAvg: avgOf(inh),
            sle: list.reduce((a, r) => a + (r.sle ?? 0), 0),
            sleN: list.filter(r => r.sle != null).length,
          }
        })
        .sort((a, b) => b.max - a.max || b.avg - a.avg),
      top: [...rated].sort((a, b) => (scoreOf(b, which) ?? 0) - (scoreOf(a, which) ?? 0) || (b.sle ?? -1) - (a.sle ?? -1)).slice(0, 10),
    }
  }, [risks, which, bands])

  const label = which === 'inherent' ? 'Inherent' : 'Residual'
  const onExport = () =>
    exportCsv({
      filename: `${which}-risk-${fileDate()}`,
      entity: 'per_trn_identify_risk',
      description: `Exported ${which} risk analytics (risk register)`,
      rows: risks,
      columns: riskCsvColumns(bands, settings.currency),
    })

  const unratedForMode =
    mode === 'inherent'
      ? risks.filter(r => r.inherentScore == null).length
      : mode === 'residual'
        ? risks.filter(r => r.residualScore == null).length
        : risks.filter(r => r.inherentScore == null || r.residualScore == null).length
  const avgBand = stats.avg == null ? null : bandOf(Math.round(stats.avg), bands)
  const moves = allMoves ? stats.movement.rows : stats.movement.rows.slice(0, 8)

  return (
    <div className="space-y-6">
      <AnalysisTabs />
      <PageHeader
        eyebrow={which === 'residual' ? 'Analytics · Residual, after controls' : 'Analytics · Inherent, before controls'}
        title={title}
        description={description}
        actions={
          <>
            <Button variant="secondary" onClick={onExport} disabled={!risksQ.isSuccess || risks.length === 0}>
              <FileDown aria-hidden="true" />
              Export CSV
            </Button>
            {canRate && (
              <Button asChild>
                <Link href={RATE_HREF[which]}>{which === 'residual' ? 'Rate residual risk' : 'Rate inherent risk'}</Link>
              </Button>
            )}
          </>
        }
      />

      <DataState
        query={risksQ}
        empty={risks.length === 0}
        emptyTitle="No risks in the register yet"
        emptyDescription="Analytics appear once risks are identified and rated."
        emptyAction={
          hasPermission('create') ? (
            <Button asChild>
              <Link href="/rcsa/identification?new=1">Identify a risk</Link>
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <Headline>
              <HeadlineCell
                label={`${label} rated`}
                value={<CountUp value={stats.rated.length} />}
                suffix={`of ${risks.length}`}
                context={
                  which === 'residual'
                    ? `${formatPct(pctOf(stats.rated.length, risks.length))} · ${stats.awaitingResidual} awaiting · ${stats.neverRated} not rated`
                    : `${formatPct(pctOf(stats.rated.length, risks.length))} of active risks · ${stats.unrated} not rated`
                }
              >
                <SplitBar
                  label={`${label} rating coverage`}
                  parts={
                    which === 'residual'
                      ? [
                          {
                            value: stats.rated.length,
                            className: 'bg-foreground/75',
                            label: 'rated',
                          },
                          {
                            value: stats.awaitingResidual,
                            className: 'bg-status-warning',
                            label: 'awaiting residual',
                          },
                          {
                            value: stats.neverRated,
                            className: 'hatch bg-risk-unrated-bg shadow-[inset_0_0_0_1px_var(--risk-unrated-border)]',
                            label: 'not rated',
                          },
                        ]
                      : [
                          {
                            value: stats.rated.length,
                            className: 'bg-foreground/75',
                            label: 'rated',
                          },
                          {
                            value: stats.unrated,
                            className: 'hatch bg-risk-unrated-bg shadow-[inset_0_0_0_1px_var(--risk-unrated-border)]',
                            label: 'not rated',
                          },
                        ]
                  }
                />
              </HeadlineCell>
              <HeadlineCell
                label={`Average ${which} score`}
                value={stats.avg == null ? '—' : <CountUp value={stats.avg} format={v => formatNumber(v, 1)} />}
                suffix={stats.avg == null ? undefined : '/ 25'}
                tone={avgBand ? BAND_STYLES[avgBand].text : undefined}
                context={
                  stats.avg == null
                    ? 'No ratings yet'
                    : which === 'residual' && stats.movement.avgInherent != null
                      ? `${avgBand} band · ${formatNumber(stats.movement.avgInherent, 1)} before controls`
                      : `${avgBand} band, across ${plural(stats.rated.length, 'rated risk')}`
                }
              />
              {which === 'residual' ? (
                <HeadlineCell
                  label="Lower after controls"
                  value={<CountUp value={stats.movement.reduced} />}
                  suffix={stats.movement.n ? `of ${stats.movement.n}` : undefined}
                  context={stats.movement.n === 0 ? 'No risk has both ratings yet' : `${stats.movement.unchanged} unchanged · ${stats.movement.increased} higher than inherent`}
                >
                  {stats.movement.avgChange != null && (
                    <p
                      className={cn(
                        'inline-flex items-center gap-1 text-body-sm font-medium tabular-nums',
                        stats.movement.avgChange < 0 ? 'text-status-success-fg' : stats.movement.avgChange > 0 ? 'text-status-danger-fg' : 'text-muted-foreground',
                      )}
                    >
                      {stats.movement.avgChange < 0 && <ArrowDown className="size-3.5" aria-hidden="true" />}
                      {stats.movement.avgChange === 0
                        ? 'No average change'
                        : `${formatNumber(Math.abs(stats.movement.avgChange), 1)} points ${stats.movement.avgChange < 0 ? 'lower' : 'higher'} on average`}
                    </p>
                  )}
                </HeadlineCell>
              ) : (
                <HeadlineCell
                  label="Not yet assessed"
                  value={<CountUp value={stats.unrated} />}
                  tone={stats.unrated ? 'text-risk-unrated-text' : undefined}
                  context={`No ${which} likelihood and impact yet`}
                />
              )}
              <HeadlineCell
                label="High & critical"
                value={<CountUp value={stats.highOrCritical} />}
                tone={stats.counts.Critical ? 'text-risk-critical-text' : stats.highOrCritical ? 'text-risk-high-text' : undefined}
                context={`${stats.counts.Critical} critical · ${stats.counts.High} high ${which}`}
              />
            </Headline>
            <FigureStrip
              items={[
                {
                  figure: money(stats.sle, { compact: true }),
                  text: `recorded SLE of ${which}-rated risks · ${stats.sleN} of ${stats.rated.length} have one`,
                },
                which === 'residual'
                  ? {
                      figure: formatNumber(stats.inherentCounts.High + stats.inherentCounts.Critical),
                      text: 'high or critical before controls',
                    }
                  : {
                      figure: formatNumber(risks.length - stats.residualCounts['Not rated']),
                      text: 'also rated residual · see Residual analysis',
                    },
                {
                  figure: formatNumber(stats.categories.length),
                  text: stats.categories.length === 1 ? 'category with rated risks' : 'categories with rated risks',
                },
              ]}
            />
          </div>

          {stats.unrated > 0 && (
            <Callout
              hatch
              action={
                canRate ? (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={RATE_HREF[which]}>{which === 'residual' ? 'Rate residual risk' : 'Rate risks'}</Link>
                  </Button>
                ) : (
                  <Link href="/rcsa/identification" className="rounded-xs text-body-sm font-medium text-primary hover:underline focus-ring">
                    Open the register
                  </Link>
                )
              }
            >
              {which === 'residual' ? (
                <>
                  <strong className="font-medium text-foreground">{plural(stats.awaitingResidual, 'risk')} awaiting a residual rating</strong> after controls
                  {stats.neverRated > 0 && <>, and {stats.neverRated} with no rating at all</>}. They are left out of the residual figures.
                </>
              ) : (
                <>
                  {stats.unrated} of {risks.length} active risks have no inherent rating, so they are missing from the matrix and band totals.
                </>
              )}
            </Callout>
          )}

          {stats.rated.length === 0 ? (
            <Panel title={`${label} ratings`}>
              <p className="py-8 text-center text-body-sm text-muted-foreground">No risk has a {which} likelihood and impact rating yet, so there is nothing to analyse.</p>
            </Panel>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                <Panel
                  title={mode === 'movement' ? 'Inherent → residual' : `${mode === 'inherent' ? 'Inherent' : 'Residual'} risk matrix`}
                  actions={
                    which === 'residual' ? (
                      <Segmented
                        label="Matrix view"
                        value={mode}
                        onChange={m => {
                          setMode(m)
                          setCell(null)
                        }}
                        options={[
                          { value: 'residual', label: 'Residual' },
                          { value: 'movement', label: 'Movement' },
                          { value: 'inherent', label: 'Inherent' },
                        ]}
                      />
                    ) : undefined
                  }
                >
                  <div className="relative overflow-x-auto">
                    <div className="min-w-[440px]">
                      <RiskHeatmap risks={risks} mode={mode} selected={cell} onSelect={setCell} />
                    </div>
                  </div>
                  <HeatmapLegend className="mt-4" unrated={unratedForMode} rateHref={canRate ? RATE_HREF[mode === 'inherent' ? 'inherent' : 'residual'] : undefined} />
                  {mode === 'movement' && (
                    <p className="mt-2 text-caption text-muted-foreground">
                      Outlined cells are where risks started (inherent); arrows end at their residual position. Only risks with both ratings are shown.
                    </p>
                  )}
                </Panel>

                {which === 'residual' ? (
                  <Panel title="Movement after controls" meta={plural(stats.movement.n, 'risk') + ' with both ratings'}>
                    {stats.movement.n === 0 ? (
                      <p className="py-6 text-body-sm text-muted-foreground">No risk has both an inherent and a residual rating yet.</p>
                    ) : (
                      <>
                        <MovementSummary reduced={stats.movement.reduced} unchanged={stats.movement.unchanged} increased={stats.movement.increased} />
                        <MovementList rows={moves} />
                        {stats.movement.rows.length > 8 && (
                          <Button variant="link" className="mt-3" onClick={() => setAllMoves(v => !v)}>
                            {allMoves ? 'Show the largest 8' : `Show all ${stats.movement.rows.length}`}
                          </Button>
                        )}
                      </>
                    )}
                  </Panel>
                ) : (
                  <Panel title="Where the exposure sits" meta={`${stats.rated.length} rated risks`} bodyClassName="p-0 pt-2">
                    <BandTable counts={stats.counts} sle={stats.bandSle} total={stats.rated.length} money={v => money(v, { compact: true })} />
                    <div className="px-6 pt-5 pb-6">
                      <p className="label-caps mb-3">Inherent and residual, all active risks</p>
                      <BandStack
                        rows={[
                          { label: 'Inherent', counts: stats.inherentCounts },
                          { label: 'Residual', counts: stats.residualCounts },
                        ]}
                      />
                    </div>
                  </Panel>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                {which === 'residual' ? (
                  <Panel title="Inherent and residual, by band" meta={`${risks.length} active risks`}>
                    <BandStack
                      rows={[
                        { label: 'Inherent', counts: stats.inherentCounts },
                        { label: 'Residual', counts: stats.residualCounts },
                      ]}
                    />
                    <div className="mt-6 border-t pt-2">
                      <BandTable counts={stats.counts} sle={stats.bandSle} total={stats.rated.length} money={v => money(v, { compact: true })} flush />
                    </div>
                  </Panel>
                ) : null}
                <Panel
                  title={`${label} score by category`}
                  meta={plural(stats.categories.length, 'category', 'categories')}
                  className={which === 'inherent' ? 'xl:col-span-2' : undefined}
                  bodyClassName="p-0"
                >
                  <div className="px-6 pt-2 pb-4">
                    <CategoryChart which={which} data={stats.categories} />
                  </div>
                  <div className="relative overflow-x-auto border-t">
                    <table className="enterprise-table">
                      <thead>
                        <tr>
                          <th className="pl-6">Category</th>
                          <th data-numeric>Rated</th>
                          <th data-numeric>Average</th>
                          <th>Highest</th>
                          <th data-numeric className="pr-6">
                            SLE
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.categories.map(c => (
                          <tr key={c.name}>
                            <td className="pl-6 font-medium">{c.name}</td>
                            <td data-numeric>{c.n}</td>
                            <td data-numeric>{formatNumber(c.avg, 1)}</td>
                            <td>
                              <BandBadge score={c.max} />
                            </td>
                            <td data-numeric className="pr-6">
                              {c.sleN ? money(c.sle) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>

              <Panel title={`Highest ${which} scores`} meta={`Top ${stats.top.length} of ${stats.rated.length} rated`} bodyClassName="p-0 pt-2">
                <div className="relative overflow-x-auto">
                  <table className="enterprise-table min-w-[760px]">
                    <thead>
                      <tr>
                        <th className="w-[38%] pl-6">Risk</th>
                        <th>Owner</th>
                        {which === 'residual' && <th>Inherent</th>}
                        <th>{which === 'residual' ? 'Residual · change' : 'Inherent'}</th>
                        <th data-numeric>SLE</th>
                        <th className="w-12 pr-6">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.top.map(r => (
                        <tr key={r.uuid}>
                          <td className="max-w-0 py-2 pl-6">
                            <span className="block truncate font-medium" title={riskLabel(r)}>
                              {r.statement ?? 'No statement recorded'}
                            </span>
                            <span className="block truncate font-mono text-caption text-muted-foreground" title={[riskRef(r), r.process].filter(Boolean).join(' · ')}>
                              {riskRef(r)}
                              {r.process && <span className="font-sans"> · {r.process}</span>}
                            </span>
                          </td>
                          <td>
                            <Person name={r.owner} />
                          </td>
                          {which === 'residual' && (
                            <td>
                              <BandBadge score={r.inherentScore} kind="Inherent" />
                            </td>
                          )}
                          <td>{which === 'residual' ? <RiskMovement inherent={r.inherentScore} residual={r.residualScore} /> : <BandBadge score={r.inherentScore} kind="Inherent" />}</td>
                          <td data-numeric>{money(r.sle)}</td>
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
              </Panel>
            </>
          )}
        </div>
      </DataState>
    </div>
  )
}

// ── Movement ─────────────────────────────────────────────────────────────────

function MovementSummary({ reduced, unchanged, increased }: { reduced: number; unchanged: number; increased: number }) {
  return (
    <dl className="mb-4 grid grid-cols-3 gap-px overflow-hidden rounded-md bg-border shadow-[0_0_0_1px_var(--border)]">
      {[
        {
          label: 'Lower',
          value: reduced,
          tone: reduced ? 'text-status-success-fg' : undefined,
        },
        { label: 'Unchanged', value: unchanged },
        {
          label: 'Higher',
          value: increased,
          tone: increased ? 'text-status-danger-fg' : undefined,
        },
      ].map(i => (
        <div key={i.label} className="bg-surface-sunken px-4 py-2.5">
          <dt className="label-caps">{i.label}</dt>
          <dd className={`figure text-figure-sm ${i.tone ?? 'text-foreground'}`}>{i.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Dumbbell rows on a 0–25 track with band zones: hollow marker = inherent, solid = residual. */
function MovementList({ rows }: { rows: Risk[] }) {
  const { bands, band } = useOrgSettings()
  const ranges = bandRanges(bands)
  const pos = (s: number) => `${(s / 25) * 100}%`
  return (
    <div>
      <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_96px] gap-4 pb-1.5 sm:grid" aria-hidden="true">
        <span className="label-caps">Risk</span>
        <span className="relative h-4">
          {ranges.map(r => (
            <span key={r.band} className="absolute top-0 -translate-x-1/2 text-[11px] text-muted-foreground" style={{ left: `${((r.from - 1 + r.to) / 2 / 25) * 100}%` }}>
              {r.band === 'Moderate' ? 'Mod.' : r.band}
            </span>
          ))}
        </span>
        <span className="label-caps text-right">Change</span>
      </div>
      <ul className="divide-y border-y">
        {rows.map(r => {
          const a = r.inherentScore ?? 0
          const b = r.residualScore ?? 0
          const ba = band(a)
          const bb = band(b)
          const lo = Math.min(a, b)
          const hi = Math.max(a, b)
          return (
            <li key={r.uuid} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_96px]">
              <div className="min-w-0">
                <Link href={`/risks/${r.uuid}`} className="block truncate rounded-xs text-body-sm text-foreground hover:underline focus-ring" title={r.statement ?? riskRef(r)}>
                  {r.statement ?? 'No statement recorded'}
                </Link>
                <span className="block truncate font-mono text-caption text-muted-foreground">{riskRef(r)}</span>
              </div>
              <div className="relative order-3 col-span-2 h-5 sm:order-none sm:col-span-1" role="img" aria-label={`Inherent ${a} (${ba}) to residual ${b} (${bb})`}>
                <div className="absolute inset-x-0 top-1/2 flex h-1.5 -translate-y-1/2 gap-px overflow-hidden rounded-full">
                  {ranges.map(z => (
                    <span key={z.band} className={cn('h-full', BAND_STYLES[z.band].bg)} style={{ width: `${((z.to - z.from + 1) / 25) * 100}%` }} />
                  ))}
                </div>
                <span className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-foreground/45" style={{ left: pos(lo), width: `${((hi - lo) / 25) * 100}%` }} />
                {ba && (
                  <span
                    className={cn('absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-card', BAND_STYLES[ba].border)}
                    style={{ left: pos(a) }}
                    title={`Inherent ${a}`}
                  />
                )}
                {bb && (
                  <span
                    className={cn('absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_2px_var(--card)]', BAND_STYLES[bb].dot)}
                    style={{ left: pos(b) }}
                    title={`Residual ${b}`}
                  />
                )}
              </div>
              <div className="justify-self-end">
                <RiskMovement inherent={r.inherentScore} residual={r.residualScore} compact />
              </div>
            </li>
          )
        })}
      </ul>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption text-foreground-secondary" aria-hidden="true">
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border-2 border-foreground-secondary bg-card" /> Inherent
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-foreground-secondary" /> Residual
        </li>
        <li>Track runs 1–25; shading shows the band zones from settings.</li>
      </ul>
    </div>
  )
}

// ── Bands and categories ─────────────────────────────────────────────────────

function BandTable({
  counts,
  sle,
  total,
  money,
  flush,
}: {
  counts: Record<Band | 'Not rated', number>
  sle: Record<Band, number | null>
  total: number
  money: (v: number | null) => string
  flush?: boolean
}) {
  const pad = flush ? '' : 'pl-6'
  const padR = flush ? '' : 'pr-6'
  return (
    <div className="relative overflow-x-auto">
      <table className="enterprise-table">
        <thead>
          <tr>
            <th className={pad}>Band</th>
            <th data-numeric>Risks</th>
            <th className="w-[34%]">Share of rated</th>
            <th data-numeric className={padR}>
              SLE
            </th>
          </tr>
        </thead>
        <tbody>
          {[...BANDS].reverse().map(b => (
            <tr key={b}>
              <td className={pad}>
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className={cn('size-2.5 rounded-[3px]', BAND_STYLES[b].dot)} />
                  {b}
                </span>
              </td>
              <td data-numeric className="font-medium">
                {counts[b]}
              </td>
              <td>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <span className={cn('block h-full rounded-full', BAND_STYLES[b].dot)} style={{ width: `${pctOf(counts[b], total) ?? 0}%` }} />
                  </span>
                  <span className="w-9 text-right text-caption text-muted-foreground tabular-nums">{formatPct(pctOf(counts[b], total))}</span>
                </span>
              </td>
              <td data-numeric className={padR}>
                {money(sle[b])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CategoryChart({
  which,
  data,
}: {
  which: Which
  data: {
    name: string
    n: number
    avg: number
    max: number
    inherentAvg: number | null
  }[]
}) {
  const { bands } = useOrgSettings()
  const rows = data.map(d => ({
    name: d.name,
    value: Number(d.avg.toFixed(1)),
    inherent: d.inherentAvg == null ? null : Number(d.inherentAvg.toFixed(1)),
    n: d.n,
    max: d.max,
  }))
  const twoSeries = which === 'residual'
  const height = Math.max(140, rows.length * (twoSeries ? 46 : 34) + 28)
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <p className="text-caption text-muted-foreground">Average score of rated risks, out of 25. Lines mark the band thresholds.</p>
        {twoSeries && (
          <SeriesLegend
            items={[
              { label: 'Inherent', color: 'var(--chart-5)' },
              { label: 'Residual', color: 'var(--chart-1)' },
            ]}
          />
        )}
      </div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 18, right: 36, bottom: 0, left: 0 }} barGap={2} barCategoryGap={twoSeries ? 10 : 8}>
            <CartesianGrid horizontal={false} vertical={false} />
            <XAxis type="number" domain={[0, 25]} hide />
            <YAxis type="category" dataKey="name" width={112} tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
            {[
              { x: bands.moderate, label: 'Mod.' },
              { x: bands.high, label: 'High' },
              { x: bands.critical, label: 'Crit.' },
            ].map(t => (
              <ReferenceLine
                key={t.label}
                x={t.x}
                stroke="var(--chart-grid)"
                strokeWidth={1}
                label={{
                  value: `${t.label} ${t.x}`,
                  position: 'top',
                  fontSize: 11,
                  fill: 'var(--chart-axis)',
                }}
              />
            ))}
            <Tooltip
              cursor={{ fill: 'var(--hover)' }}
              content={
                <ChartTooltip
                  footer={p => {
                    const d = p[0]?.payload as { n?: number; max?: number } | undefined
                    return d ? `${d.n} rated · highest ${d.max}` : null
                  }}
                />
              }
            />
            {twoSeries && (
              <Bar dataKey="inherent" name="Inherent avg" fill="var(--chart-5)" fillOpacity={0.45} radius={[0, 3, 3, 0]} barSize={10} isAnimationActive={false}>
                <LabelList dataKey="inherent" position="right" style={{ fontSize: 11, fill: 'var(--chart-axis)' }} />
              </Bar>
            )}
            <Bar dataKey="value" name={twoSeries ? 'Residual avg' : 'Inherent avg'} fill="var(--chart-1)" radius={[0, 3, 3, 0]} barSize={twoSeries ? 10 : 12} isAnimationActive={false}>
              <LabelList
                dataKey="value"
                position="right"
                style={{
                  fontSize: 12,
                  fill: 'var(--foreground)',
                  fontWeight: 500,
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
