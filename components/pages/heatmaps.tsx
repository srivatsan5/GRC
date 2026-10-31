'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { oracleService } from '@/lib/oracleService'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type View = 'inherent' | 'residual' | 'velocity'

const LIKELIHOOD_LABELS = [
  { level: 5, label: '5 - Almost Certain' },
  { level: 4, label: '4 - Likely' },
  { level: 3, label: '3 - Possible' },
  { level: 2, label: '2 - Unlikely' },
  { level: 1, label: '1 - Rare' },
]

const IMPACT_LABELS = [
  { level: 1, label: '1 - Insignificant' },
  { level: 2, label: '2 - Minor' },
  { level: 3, label: '3 - Moderate' },
  { level: 4, label: '4 - Major' },
  { level: 5, label: '5 - Severe' },
]

export function HeatmapsPage() {
  const [view, setView] = useState<View>('inherent')
  const [selectedCell, setSelectedCell] = useState<{ prob: number; impact: number; score: number; count: number; risks: any[] } | null>(null)

  const { data: rawRisks = [], isLoading } = useQuery({
    queryKey: ['heatmaps', 'risks'],
    queryFn: () => oracleService.getIdentifyRisks(),
  })

  const risks = useMemo(() => {
    return oracleService.parseAllRisks(rawRisks)
  }, [rawRisks])

  const cells = useMemo(() => {
    return Array.from({ length: 25 }, (_, i) => {
      const row = Math.floor(i / 5)
      const col = i % 5
      const prob = 5 - row
      const impact = col + 1
      const score = prob * impact

      const matchedRisks = risks.filter((r) => {
        let rProb = r.likelihood
        let rImpact = r.impact

        if (view === 'residual') {
          rProb = Math.max(1, rProb - 1)
          rImpact = Math.max(1, rImpact - 1)
        }
        if (view === 'velocity') {
          rProb = Math.min(5, rProb + 1)
        }

        return rProb === prob && rImpact === impact
      })

      return { prob, impact, score, count: matchedRisks.length, risks: matchedRisks }
    })
  }, [risks, view])

  const stats = useMemo(() => ({
    total: risks.length,
    critical: cells.filter(c => c.score >= 16).reduce((s, c) => s + c.count, 0),
    high: cells.filter(c => c.score >= 12 && c.score < 16).reduce((s, c) => s + c.count, 0),
    medium: cells.filter(c => c.score >= 8 && c.score < 12).reduce((s, c) => s + c.count, 0),
    low: cells.filter(c => c.score < 8).reduce((s, c) => s + c.count, 0),
  }), [cells, risks])

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">5×5 Risk Heatmap</h1>
          <p className="text-xs text-slate-500">Likelihood &times; Impact distribution</p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
          {(['inherent', 'residual', 'velocity'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'px-2.5 py-1 rounded text-xs transition-colors',
                view === v
                  ? 'bg-white font-medium text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              {v === 'inherent' ? 'Inherent' : v === 'residual' ? 'Residual' : 'Trend'}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded border border-slate-200">
          <span className="text-[11px] text-slate-500 block">Total risks</span>
          <span className="text-xl font-semibold text-slate-900 tabular-nums">{stats.total}</span>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <span className="text-[11px] text-rose-600 block">Critical (16–25)</span>
          <span className="text-xl font-semibold text-slate-900 tabular-nums">{stats.critical}</span>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <span className="text-[11px] text-amber-600 block">High (12–15)</span>
          <span className="text-xl font-semibold text-slate-900 tabular-nums">{stats.high}</span>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <span className="text-[11px] text-emerald-600 block">Low / Med (1–10)</span>
          <span className="text-xl font-semibold text-slate-900 tabular-nums">{stats.medium + stats.low}</span>
        </div>
      </div>

      {/* 5x5 Matrix Board */}
      <div className="p-6 bg-white rounded border border-slate-200">
        <div className="flex flex-col items-center justify-center">
          <div className="w-full max-w-2xl">
            {/* Top X-Axis Label */}
            <div className="text-center font-medium text-xs text-slate-500 mb-2 uppercase tracking-wider">
              Impact Magnitude &rarr;
            </div>

            {/* Matrix Coordinate Grid */}
            <div className="flex items-center">
              {/* Likelihood Y-Axis Label */}
              <div className="w-6 flex items-center justify-center mr-1">
                <span className="text-[11px] font-medium text-slate-500 -rotate-90 whitespace-nowrap uppercase tracking-wider">
                  &larr; Likelihood
                </span>
              </div>

              {/* 5x5 Grid Cells */}
              <div className="flex-1 space-y-1.5">
                {[5, 4, 3, 2, 1].map((probLevel) => {
                  const rowCells = cells.filter(c => c.prob === probLevel)
                  return (
                    <div key={probLevel} className="flex items-center gap-1.5">
                      {/* Left Row Label */}
                      <span className="w-24 text-[11px] text-slate-500 text-right pr-2 truncate">
                        {LIKELIHOOD_LABELS.find(l => l.level === probLevel)?.label.split(' - ')[1]}
                      </span>

                      {/* 5 Cell Boxes */}
                      <div className="flex-1 grid grid-cols-5 gap-1.5">
                        {rowCells.map((cell, idx) => {
                          const tone = cell.score >= 16
                            ? 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
                            : cell.score >= 12
                            ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                            : cell.score >= 8
                            ? 'bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                if (cell.count > 0) setSelectedCell(cell)
                              }}
                              className={cn(
                                'h-14 sm:h-16 rounded border flex flex-col items-center justify-center transition-colors p-1',
                                tone,
                                cell.count > 0 ? 'cursor-pointer font-medium' : 'cursor-default'
                              )}
                            >
                              <span className="text-[10px] opacity-60">S={cell.score}</span>
                              <span className="text-base font-semibold tabular-nums">
                                {cell.count > 0 ? cell.count : '—'}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {/* Bottom X-Axis Column Labels */}
                <div className="flex items-center gap-1.5 pt-1.5">
                  <span className="w-24" />
                  <div className="flex-1 grid grid-cols-5 gap-1.5 text-center">
                    {IMPACT_LABELS.map(imp => (
                      <span key={imp.level} className="text-[10px] text-slate-500 truncate px-0.5">
                        {imp.label.split(' - ')[1]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Matrix Legend */}
      <div className="p-4 bg-white rounded border border-slate-200 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Critical (16–25)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>High (12–15)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span>Moderate (8–10)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Low (1–6)</span>
          </div>
        </div>
      </div>

      {/* Cell Inspect Dialog */}
      {selectedCell && (
        <Dialog open={!!selectedCell} onOpenChange={() => setSelectedCell(null)}>
          <DialogContent className="max-w-md bg-white rounded-lg border-slate-200">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold text-slate-900">
                Risks at Likelihood {selectedCell.prob} &times; Impact {selectedCell.impact} (Score: {selectedCell.score})
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-2 max-h-60 overflow-y-auto py-2">
              {selectedCell.risks.map((r, i) => (
                <div key={i} className="p-2.5 rounded border border-slate-200 bg-slate-50 text-xs space-y-1">
                  <div className="font-medium text-slate-900">{r.risk_statement || r.process_name}</div>
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>{r.process_name || 'General Operations'}</span>
                    <span className="tabular-nums">${Number(r.inherent_sle || 40000).toLocaleString()} SLE</span>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
