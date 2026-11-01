'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DataState } from '@/components/data-state'
import { BandBadge } from '@/components/band-badge'
import { bandCounts } from '@/lib/risk'
import { useOrgSettings } from '@/lib/settings'
import { formatNumber } from '@/lib/format'
import { IMPACT_LABELS, LIKELIHOOD_LABELS } from '@/lib/risk'
import { riskLabel, useRisks } from '@/components/analytics/risk-data'
import { BandLegend, RiskHeatmap, type HeatmapSelection } from '@/components/analytics/risk-heatmap'
import { Panel } from '@/components/analytics/widgets'

type View = 'inherent' | 'residual' | 'movement'

const VIEW_LABELS: Record<View, string> = { inherent: 'Inherent', residual: 'Residual', movement: 'Inherent → residual' }

export function HeatmapsPage() {
  const [view, setView] = useState<View>('inherent')
  const [selected, setSelected] = useState<(HeatmapSelection & { which: 'inherent' | 'residual' }) | null>(null)
  const { money, bands } = useOrgSettings()
  const risksQ = useRisks()
  const allRisks = risksQ.data
  const risks = useMemo(() => (allRisks ?? []).filter(r => r.isActive), [allRisks])

  const which = view === 'residual' ? 'residual' : 'inherent'
  const counts = useMemo(
    () => bandCounts(risks.map(r => (which === 'inherent' ? r.inherentScore : r.residualScore)), bands),
    [risks, which, bands],
  )
  const rated = risks.length - counts['Not rated']

  const movement = useMemo(() => {
    const both = risks.filter(r => r.inherentScore != null && r.residualScore != null)
    const rows = both
      .map(r => ({ risk: r, delta: (r.residualScore ?? 0) - (r.inherentScore ?? 0) }))
      .sort((a, b) => a.delta - b.delta)
    return {
      rows,
      reduced: rows.filter(r => r.delta < 0).length,
      unchanged: rows.filter(r => r.delta === 0).length,
      increased: rows.filter(r => r.delta > 0).length,
      inherentOnly: risks.filter(r => r.inherentScore != null && r.residualScore == null).length,
    }
  }, [risks])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">5×5 risk heatmaps</h1>
          <p className="text-xs text-slate-500">Likelihood × impact from the ratings recorded on each active risk</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs" role="tablist" aria-label="Heatmap view">
          {(Object.keys(VIEW_LABELS) as View[]).map(v => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn('px-2.5 py-1 rounded text-xs transition-colors', view === v ? 'bg-white font-medium text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900')}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      <DataState query={risksQ} empty={risks.length === 0} emptyTitle="No risks in the register yet" emptyAction={<Link href="/rcsa/identification" className="text-xs text-blue-700 hover:underline">Identify a risk</Link>}>
        {view !== 'movement' ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <Metric label="Active risks" value={risks.length} />
              <Metric label={`Rated (${which})`} value={rated} />
              <Metric label="Critical" value={counts.Critical} className="text-red-700" />
              <Metric label="High" value={counts.High} className="text-orange-700" />
              <Metric label="Moderate" value={counts.Moderate} className="text-amber-700" />
              <Metric label="Low" value={counts.Low} className="text-emerald-700" />
            </div>

            {counts['Not rated'] > 0 && (
              <div className="p-3 rounded border border-slate-200 bg-slate-50 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {counts['Not rated']} of {risks.length} active risks have no {which} rating and are not on this map.
                </span>
                <Link href={which === 'inherent' ? '/assessments/inherent' : '/rcsa/mitigation'} className="font-medium text-blue-700 hover:underline">
                  {which === 'inherent' ? 'Rate inherent risk' : 'Assess residual risk'} &rarr;
                </Link>
              </div>
            )}

            <Panel title={`${VIEW_LABELS[view]} risk matrix`} action={<BandLegend />}>
              {rated === 0 ? (
                <p className="py-10 text-center text-xs text-slate-500">No risks have {which} likelihood and impact ratings yet.</p>
              ) : (
                <div className="max-w-2xl mx-auto">
                  <RiskHeatmap risks={risks} which={which} onSelect={cell => setSelected({ ...cell, which })} selected={selected?.which === which ? selected : null} />
                  <p className="mt-3 text-center text-[11px] text-slate-500">Select a cell to list its risks.</p>
                </div>
              )}
            </Panel>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Metric label="Rated inherent and residual" value={movement.rows.length} />
              <Metric label="Score reduced" value={movement.reduced} className="text-emerald-700" />
              <Metric label="Unchanged" value={movement.unchanged} />
              <Metric label="Score increased" value={movement.increased} className="text-red-700" />
              <Metric label="Residual not assessed" value={movement.inherentOnly} />
            </div>
            <Panel title="Inherent → residual movement" bodyClassName="p-0">
              {movement.rows.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-500">
                  No risk has both an inherent and a residual rating yet, so there is no movement to show.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="enterprise-table">
                    <thead>
                      <tr>
                        <th className="w-[45%]">Risk</th>
                        <th>Inherent</th>
                        <th>Residual</th>
                        <th className="text-right">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movement.rows.map(({ risk, delta }) => (
                        <tr key={risk.uuid}>
                          <td>
                            <span className="font-medium text-slate-900">{riskLabel(risk)}</span>
                            <span className="block text-[11px] text-slate-400">{risk.process ?? '—'}</span>
                          </td>
                          <td><BandBadge score={risk.inherentScore} /></td>
                          <td><BandBadge score={risk.residualScore} /></td>
                          <td className={cn('text-right tabular-nums font-medium', delta < 0 ? 'text-emerald-700' : delta > 0 ? 'text-red-700' : 'text-slate-500')}>
                            {delta > 0 ? `+${delta}` : delta}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </>
        )}
      </DataState>

      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-lg bg-white rounded-lg border-slate-200">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold text-slate-900">
                  {selected.risks.length} risk{selected.risks.length === 1 ? '' : 's'} at {LIKELIHOOD_LABELS[selected.likelihood - 1]} × {IMPACT_LABELS[selected.impact - 1]}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {selected.which === 'inherent' ? 'Inherent' : 'Residual'} likelihood {selected.likelihood} × impact {selected.impact} = score {selected.score}
                </DialogDescription>
              </DialogHeader>
              <ul className="space-y-2 max-h-80 overflow-y-auto py-1">
                {selected.risks.map(r => (
                  <li key={r.uuid} className="p-2.5 rounded border border-slate-200 bg-slate-50 text-xs space-y-1">
                    <div className="font-medium text-slate-900">{riskLabel(r)}</div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500 text-[11px]">
                      <span>{r.process ?? 'Process not specified'}{r.owner ? ` · ${r.owner}` : ''}</span>
                      <span className="tabular-nums">SLE {money(r.sle)}</span>
                    </div>
                    <div className="flex gap-2 text-[11px] text-slate-500">
                      <span>Inherent <BandBadge score={r.inherentScore} /></span>
                      <span>Residual <BandBadge score={r.residualScore} /></span>
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

function Metric({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="p-3 bg-white rounded border border-slate-200">
      <span className="text-[11px] text-slate-500 block">{label}</span>
      <span className={cn('text-xl font-semibold text-slate-900 tabular-nums', className)}>{formatNumber(value)}</span>
    </div>
  )
}
