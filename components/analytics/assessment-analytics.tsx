'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DataState } from '@/components/data-state'
import { BandBadge } from '@/components/band-badge'
import { bandCounts, bandOf, IMPACT_LABELS, LIKELIHOOD_LABELS, type Risk } from '@/lib/risk'
import { useOrgSettings } from '@/lib/settings'
import { formatNumber, formatPct, pctOf } from '@/lib/format'
import { exportCsv, fileDate } from './csv'
import { riskCsvColumns, riskLabel, useRisks } from './risk-data'
import { BandLegend, RiskHeatmap, type HeatmapSelection } from './risk-heatmap'
import { BandCountTable, Panel } from './widgets'

type Which = 'inherent' | 'residual'

const scoreOf = (r: Risk, which: Which) => (which === 'inherent' ? r.inherentScore : r.residualScore)

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="p-4 bg-white rounded border border-slate-200">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 tabular-nums ${tone ?? 'text-slate-900'}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}

/**
 * Analytics for one rating (inherent or residual) over the active risk register:
 * coverage of the rating, heatmap, band counts, scores by category and the top-scored risks.
 * Every figure counts only risks that actually carry that rating.
 */
export function AssessmentAnalytics({ which, title, description }: { which: Which; title: string; description: string }) {
  const { bands, money, settings } = useOrgSettings()
  const risksQ = useRisks()
  const all = risksQ.data
  const risks = useMemo(() => (all ?? []).filter(r => r.isActive), [all])
  const [cell, setCell] = useState<HeatmapSelection | null>(null)

  const stats = useMemo(() => {
    const rated = risks.filter(r => scoreOf(r, which) != null)
    const scores = rated.map(r => scoreOf(r, which) ?? 0)
    const counts = bandCounts(risks.map(r => scoreOf(r, which)), bands)
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
    return {
      rated,
      unrated: risks.length - rated.length,
      awaitingResidual,
      neverRated: risks.filter(r => r.inherentScore == null && r.residualScore == null).length,
      avg: scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : null,
      counts,
      highOrCritical: counts.High + counts.Critical,
      sle: withSle.length ? withSle.reduce((s, r) => s + (r.sle ?? 0), 0) : null,
      sleN: withSle.length,
      movement: {
        n: both.length,
        reduced: deltas.filter(d => d < 0).length,
        unchanged: deltas.filter(d => d === 0).length,
        increased: deltas.filter(d => d > 0).length,
        avgChange: deltas.length ? deltas.reduce((s, d) => s + d, 0) / deltas.length : null,
      },
      categories: [...byCategory.entries()]
        .map(([name, list]) => {
          const s = list.map(r => scoreOf(r, which) ?? 0)
          return { name, n: list.length, avg: s.reduce((a, b) => a + b, 0) / s.length, max: Math.max(...s), sle: list.reduce((a, r) => a + (r.sle ?? 0), 0), sleN: list.filter(r => r.sle != null).length }
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onExport} disabled={!risksQ.isSuccess || risks.length === 0}>
          <FileDown className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      <DataState query={risksQ} empty={risks.length === 0} emptyTitle="No risks in the register yet" emptyAction={<Link href="/rcsa/identification" className="text-xs text-blue-700 hover:underline">Identify a risk</Link>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label={`${label} rated`} value={formatNumber(stats.rated.length)} sub={`${formatPct(pctOf(stats.rated.length, risks.length))} of ${risks.length} active risks`} />
          <Tile
            label="Not yet assessed"
            value={formatNumber(stats.unrated)}
            sub={which === 'residual' ? `${stats.awaitingResidual} rated inherent, awaiting residual · ${stats.neverRated} not rated at all` : `No ${which} likelihood and impact`}
            tone={stats.unrated ? 'text-amber-700' : undefined}
          />
          <Tile
            label={`Average ${which} score`}
            value={stats.avg == null ? '—' : formatNumber(stats.avg, 1)}
            sub={stats.avg == null ? 'No ratings yet' : `${bandOf(Math.round(stats.avg), bands)} band, out of 25`}
          />
          <Tile label="High and critical" value={formatNumber(stats.highOrCritical)} sub={`${stats.counts.Critical} critical`} tone={stats.counts.Critical ? 'text-red-700' : undefined} />
        </div>

        {stats.unrated > 0 && (
          <div className="p-3 rounded border border-slate-200 bg-slate-50 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
            <span>{stats.unrated} active risk{stats.unrated === 1 ? ' has' : 's have'} no {which} rating and {stats.unrated === 1 ? 'is' : 'are'} excluded from the figures below.</span>
            <Link href="/assessments/inherent" className="font-medium text-blue-700 hover:underline">Rate risks in the register &rarr;</Link>
          </div>
        )}

        {stats.rated.length === 0 ? (
          <Panel title={`${label} ratings`}>
            <p className="py-8 text-center text-xs text-slate-500">No risk has a {which} likelihood and impact rating yet, so there is nothing to analyse.</p>
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Panel title={`${label} heatmap`} className="lg:col-span-2" action={<BandLegend />}>
                <div className="max-w-xl mx-auto">
                  <RiskHeatmap risks={risks} which={which} onSelect={setCell} selected={cell} />
                </div>
              </Panel>
              <div className="space-y-4">
                <Panel title="By band" bodyClassName="p-0">
                  <BandCountTable columns={[{ label: label, counts: stats.counts }]} />
                </Panel>
                {which === 'residual' && (
                  <Panel title="Inherent → residual">
                    {stats.movement.n === 0 ? (
                      <p className="text-xs text-slate-500">No risk has both ratings yet.</p>
                    ) : (
                      <dl className="space-y-1.5 text-xs">
                        <Fig label="Risks with both ratings" value={formatNumber(stats.movement.n)} />
                        <Fig label="Score reduced" value={formatNumber(stats.movement.reduced)} />
                        <Fig label="Unchanged" value={formatNumber(stats.movement.unchanged)} />
                        <Fig label="Score increased" value={formatNumber(stats.movement.increased)} />
                        <Fig label="Average change" value={formatNumber(stats.movement.avgChange, 1)} />
                      </dl>
                    )}
                  </Panel>
                )}
                <Panel title="Recorded SLE of rated risks">
                  <div className="text-xl font-semibold text-slate-900 tabular-nums">{money(stats.sle)}</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{stats.sleN} of {stats.rated.length} rated risks have an SLE</p>
                </Panel>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel title={`Highest ${which} scores`} bodyClassName="p-0">
                <div className="overflow-x-auto">
                  <table className="enterprise-table">
                    <thead>
                      <tr>
                        <th className="w-[50%]">Risk</th>
                        <th>{label}</th>
                        {which === 'residual' && <th>Inherent</th>}
                        <th className="text-right">SLE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.top.map(r => (
                        <tr key={r.uuid}>
                          <td>
                            <span className="font-medium text-slate-900">{riskLabel(r)}</span>
                            <span className="block text-[11px] text-slate-400">{[r.process, r.owner].filter(Boolean).join(' · ') || '—'}</span>
                          </td>
                          <td><BandBadge score={scoreOf(r, which)} /></td>
                          {which === 'residual' && <td><BandBadge score={r.inherentScore} /></td>}
                          <td className="text-right tabular-nums">{money(r.sle)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel title={`${label} score by category`} bodyClassName="p-0">
                <div className="overflow-x-auto">
                  <table className="enterprise-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th className="text-right">Rated risks</th>
                        <th className="text-right">Average</th>
                        <th>Highest</th>
                        <th className="text-right">SLE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.categories.map(c => (
                        <tr key={c.name}>
                          <td className="font-medium text-slate-900">{c.name}</td>
                          <td className="text-right tabular-nums">{c.n}</td>
                          <td className="text-right tabular-nums">{formatNumber(c.avg, 1)}</td>
                          <td><BandBadge score={c.max} /></td>
                          <td className="text-right tabular-nums">{c.sleN ? money(c.sle) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          </>
        )}
      </DataState>

      <Dialog open={!!cell} onOpenChange={open => !open && setCell(null)}>
        <DialogContent className="max-w-lg bg-white rounded-lg border-slate-200">
          {cell && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold text-slate-900">
                  {cell.risks.length} risk{cell.risks.length === 1 ? '' : 's'} at {LIKELIHOOD_LABELS[cell.likelihood - 1]} × {IMPACT_LABELS[cell.impact - 1]}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {label} likelihood {cell.likelihood} × impact {cell.impact} = score {cell.score}
                </DialogDescription>
              </DialogHeader>
              <ul className="space-y-2 max-h-80 overflow-y-auto py-1">
                {cell.risks.map(r => (
                  <li key={r.uuid} className="p-2.5 rounded border border-slate-200 bg-slate-50 text-xs">
                    <div className="font-medium text-slate-900">{riskLabel(r)}</div>
                    <div className="flex justify-between gap-2 text-[11px] text-slate-500 mt-1">
                      <span>{r.process ?? 'Process not specified'}</span>
                      <span className="tabular-nums">SLE {money(r.sle)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  )
}
