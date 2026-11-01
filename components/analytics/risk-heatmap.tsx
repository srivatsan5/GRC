'use client'

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { BAND_STYLES, IMPACT_LABELS, LIKELIHOOD_LABELS, heatmapCells, type Risk } from '@/lib/risk'
import { useOrgSettings } from '@/lib/settings'

export interface HeatmapSelection {
  likelihood: number
  impact: number
  score: number
  risks: Risk[]
}

/**
 * 5×5 likelihood × impact matrix of real ratings. Cell colour comes from the
 * organisation's risk bands. Unrated risks are not placed; the caller shows their count.
 */
export function RiskHeatmap({
  risks,
  which,
  onSelect,
  selected,
  compact = false,
}: {
  risks: Risk[]
  which: 'inherent' | 'residual'
  onSelect?: (cell: HeatmapSelection) => void
  selected?: { likelihood: number; impact: number } | null
  compact?: boolean
}) {
  const { band } = useOrgSettings()
  const { cells } = useMemo(() => heatmapCells(risks, which), [risks, which])

  return (
    <div className="w-full">
      <div className="flex">
        {!compact && (
          <div className="w-5 flex items-center justify-center mr-1">
            <span className="text-[10px] font-medium text-slate-500 -rotate-90 whitespace-nowrap uppercase tracking-wider">Likelihood</span>
          </div>
        )}
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map(l => (
            <div key={l} className="flex items-center gap-1">
              <span className={cn('text-[10px] text-slate-500 text-right pr-1.5 truncate', compact ? 'w-4' : 'w-24')} title={LIKELIHOOD_LABELS[l - 1]}>
                {compact ? l : `${l} · ${LIKELIHOOD_LABELS[l - 1]}`}
              </span>
              <div className="flex-1 grid grid-cols-5 gap-1">
                {[1, 2, 3, 4, 5].map(i => {
                  const list = cells[l - 1]![i - 1]!
                  const score = l * i
                  const b = band(score)
                  const style = b ? BAND_STYLES[b] : null
                  const isSel = selected?.likelihood === l && selected?.impact === i
                  const label = `Likelihood ${l} (${LIKELIHOOD_LABELS[l - 1]}) × impact ${i} (${IMPACT_LABELS[i - 1]}), score ${score}${b ? ` ${b}` : ''}: ${list.length} risk${list.length === 1 ? '' : 's'}`
                  const cls = cn(
                    'rounded border flex flex-col items-center justify-center',
                    compact ? 'h-8' : 'h-14 sm:h-16',
                    style?.cell,
                    style?.border,
                    style?.text,
                    isSel && 'ring-2 ring-slate-900 ring-offset-1',
                  )
                  const body = (
                    <>
                      {!compact && <span className="text-[10px] opacity-60 tabular-nums">{score}</span>}
                      <span className={cn('font-semibold tabular-nums', compact ? 'text-xs' : 'text-base')}>{list.length > 0 ? list.length : ''}</span>
                    </>
                  )
                  return onSelect && list.length > 0 ? (
                    <button key={i} type="button" aria-label={label} title={label} className={cn(cls, 'hover:brightness-95')} onClick={() => onSelect({ likelihood: l, impact: i, score, risks: list })}>
                      {body}
                    </button>
                  ) : (
                    <div key={i} aria-label={label} title={label} role="img" className={cls}>
                      {body}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <div className="flex items-start gap-1 pt-1">
            <span className={compact ? 'w-4' : 'w-24'} />
            <div className="flex-1 grid grid-cols-5 gap-1 text-center">
              {IMPACT_LABELS.map((lab, idx) => (
                <span key={lab} className="text-[10px] text-slate-500 truncate" title={lab}>
                  {compact ? idx + 1 : `${idx + 1} · ${lab}`}
                </span>
              ))}
            </div>
          </div>
          <div className="text-center text-[10px] font-medium text-slate-500 uppercase tracking-wider">Impact</div>
        </div>
      </div>
    </div>
  )
}

/** Legend of the organisation's bands with their score ranges. */
export function BandLegend() {
  const { bands } = useOrgSettings()
  const items = [
    { b: 'Low' as const, range: `1–${bands.moderate - 1}` },
    { b: 'Moderate' as const, range: `${bands.moderate}–${bands.high - 1}` },
    { b: 'High' as const, range: `${bands.high}–${bands.critical - 1}` },
    { b: 'Critical' as const, range: `${bands.critical}–25` },
  ]
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
      {items.map(({ b, range }) => (
        <span key={b} className="inline-flex items-center gap-1.5">
          <span className={cn('h-2.5 w-2.5 rounded-full', BAND_STYLES[b].dot)} aria-hidden="true" />
          {b} ({range})
        </span>
      ))}
    </div>
  )
}
