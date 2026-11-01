'use client'

/**
 * The 5×5 risk matrix (Charter). One component everywhere: dashboard, heatmaps page, risk detail.
 *
 *  - Likelihood 5 at the top, impact 1 on the left. Occupied cells are solid with the count as a
 *    serif figure; empty cells keep the band wash so the zones stay readable.
 *  - Modes: inherent · residual · movement (inherent outline → residual solid, dashed arrows).
 *  - Cells are buttons with full aria-labels and roving tabindex (arrow keys move).
 *  - Selection detail renders BELOW the grid (never a tooltip over the data).
 *  - Bands come from organisation settings, so thresholds are never hard-coded.
 */
import Link from 'next/link'
import React, { useMemo, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BAND_STYLES, IMPACT_LABELS, LIKELIHOOD_LABELS, bandOf, type Band, type Risk, type RiskBands } from '@/lib/risk'
import { useOrgSettings } from '@/lib/settings'
import { BandBadge } from '@/components/band-badge'

export type HeatmapMode = 'inherent' | 'residual' | 'movement'
export interface CellRef {
  l: number
  i: number
}

function coords(r: Risk, which: 'inherent' | 'residual'): CellRef | null {
  const l = which === 'inherent' ? r.inherentLikelihood : r.residualLikelihood
  const i = which === 'inherent' ? r.inherentImpact : r.residualImpact
  return l != null && i != null ? { l, i } : null
}

/** Risks placed on the grid for a mode (movement places by residual and needs both ratings). */
export function risksInCell(risks: Risk[], mode: HeatmapMode, cell: CellRef): Risk[] {
  return risks.filter(r => {
    const c = coords(r, mode === 'inherent' ? 'inherent' : 'residual')
    if (!c || (mode === 'movement' && !coords(r, 'inherent'))) return false
    return c.l === cell.l && c.i === cell.i
  })
}

export function riskRef(r: Risk): string {
  return r.referenceNumber ?? `#${r.uuid}`
}

export function RiskHeatmap({
  risks,
  mode,
  selected,
  onSelect,
  size = 'lg',
  showDetail = true,
  riskHref = r => `/risks/${r.uuid}`,
  className,
}: {
  risks: Risk[]
  mode: HeatmapMode
  selected?: CellRef | null
  onSelect?: (cell: CellRef | null) => void
  size?: 'lg' | 'sm'
  /** Show the selection strip under the grid (lg only) */
  showDetail?: boolean
  riskHref?: (r: Risk) => string
  className?: string
}) {
  const { bands } = useOrgSettings()
  const [focus, setFocus] = useState<CellRef>({ l: 5, i: 1 })
  const gridRef = useRef<HTMLDivElement>(null)
  const small = size === 'sm'

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of risks) {
      const c = coords(r, mode === 'inherent' ? 'inherent' : 'residual')
      if (!c || (mode === 'movement' && !coords(r, 'inherent'))) continue
      const k = `${c.l}-${c.i}`
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [risks, mode])

  // Movement: aggregated paths from inherent cell to residual cell
  const paths = useMemo(() => {
    if (mode !== 'movement') return []
    const m = new Map<string, { from: CellRef; to: CellRef; n: number }>()
    for (const r of risks) {
      const a = coords(r, 'inherent')
      const b = coords(r, 'residual')
      if (!a || !b || (a.l === b.l && a.i === b.i)) continue
      const k = `${a.l}${a.i}-${b.l}${b.i}`
      const cur = m.get(k) ?? { from: a, to: b, n: 0 }
      cur.n++
      m.set(k, cur)
    }
    return [...m.values()]
  }, [risks, mode])
  const origins = useMemo(() => new Set(paths.map(p => `${p.from.l}-${p.from.i}`)), [paths])
  const maxPath = Math.max(1, ...paths.map(p => p.n))

  const move = (e: React.KeyboardEvent, cell: CellRef) => {
    const d: Record<string, [number, number]> = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    const step = d[e.key]
    if (!step) return
    e.preventDefault()
    const next = { l: Math.min(5, Math.max(1, cell.l + step[0])), i: Math.min(5, Math.max(1, cell.i + step[1])) }
    setFocus(next)
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${next.l}-${next.i}"]`)?.focus()
  }

  const selectedRisks = selected ? risksInCell(risks, mode, selected) : []

  return (
    <div className={cn('min-w-0', className)}>
      <div className={cn('grid', small ? 'grid-cols-[16px_minmax(0,1fr)] gap-x-2' : 'grid-cols-[96px_minmax(0,1fr)] gap-x-3')}>
        {/* Y axis */}
        <div className={cn('grid', small ? 'gap-1' : 'gap-1')} style={{ gridTemplateRows: `repeat(5, ${small ? '28px' : 'minmax(64px, 76px)'})` }} aria-hidden="true">
          {[5, 4, 3, 2, 1].map(l => (
            <div key={l} className="flex flex-col items-end justify-center text-right leading-tight">
              <span className={cn('font-display text-foreground-secondary', small ? 'text-caption' : 'text-body-lg')}>{l}</span>
              {!small && <span className="text-caption text-foreground-secondary">{LIKELIHOOD_LABELS[l - 1]}</span>}
            </div>
          ))}
        </div>

        {/* Grid + movement overlay */}
        <div className="relative min-w-0">
          <div
            ref={gridRef}
            role="grid"
            aria-label={`${mode === 'movement' ? 'Inherent to residual movement' : mode === 'inherent' ? 'Inherent' : 'Residual'} risk matrix, likelihood by impact`}
            className="grid grid-cols-5 gap-1"
            style={{ gridTemplateRows: `repeat(5, ${small ? '28px' : 'minmax(64px, 76px)'})` }}
          >
            {[5, 4, 3, 2, 1].map(l =>
              [1, 2, 3, 4, 5].map(i => {
                const score = l * i
                const b = bandOf(score, bands) as Band
                const s = BAND_STYLES[b]
                const n = counts.get(`${l}-${i}`) ?? 0
                const isSel = selected?.l === l && selected?.i === i
                const isOrigin = origins.has(`${l}-${i}`)
                const label = `${LIKELIHOOD_LABELS[l - 1]} × ${IMPACT_LABELS[i - 1]}, score ${score}, ${b}, ${n} ${n === 1 ? 'risk' : 'risks'}`
                return (
                  <button
                    key={`${l}-${i}`}
                    type="button"
                    role="gridcell"
                    data-cell={`${l}-${i}`}
                    aria-label={label}
                    aria-selected={isSel}
                    tabIndex={focus.l === l && focus.i === i ? 0 : -1}
                    onFocus={() => setFocus({ l, i })}
                    onKeyDown={e => move(e, { l, i })}
                    onClick={() => onSelect?.(isSel ? null : { l, i })}
                    disabled={!onSelect}
                    className={cn(
                      'relative flex min-w-0 flex-col justify-between rounded-sm text-left transition-shadow duration-(--duration-fast) ease-out focus-ring disabled:cursor-default',
                      small ? 'p-1' : 'p-2 px-2.5',
                      n > 0 ? cn(s.solid, 'shadow-[inset_0_1px_0_oklch(1_0_0/0.18),inset_0_-1px_0_oklch(0_0_0/0.06)]') : s.cell,
                      onSelect && 'cursor-pointer hover:shadow-[inset_0_0_0_2px_var(--foreground)]',
                      isOrigin && n === 0 && 'shadow-[inset_0_0_0_2px_currentColor]',
                      isSel && 'z-[2] shadow-[0_0_0_2px_var(--card),0_0_0_4px_var(--foreground)]',
                    )}
                  >
                    <span className={cn('tabular-nums opacity-90', small ? 'text-[10px] leading-none' : 'text-[11px] leading-3')}>{score}</span>
                    {n > 0 && !small && <span className="self-end font-display text-[38px] leading-none font-medium tracking-[-0.02em] [font-variant-numeric:lining-nums_tabular-nums]">{n}</span>}
                    {n > 0 && small && <span className="sr-only">{n}</span>}
                  </button>
                )
              }),
            )}
          </div>
          {mode === 'movement' && paths.length > 0 && (
            <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 5 5" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <marker id="hm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                  <path d="M0 0 10 5 0 10z" fill="var(--foreground)" />
                </marker>
              </defs>
              {paths.map(p => {
                const x1 = p.from.i - 0.5
                const y1 = 5 - p.from.l + 0.5
                const x2 = p.to.i - 0.5
                const y2 = 5 - p.to.l + 0.5
                return (
                  <line
                    key={`${p.from.l}${p.from.i}-${p.to.l}${p.to.i}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="var(--foreground)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    vectorEffect="non-scaling-stroke"
                    markerEnd="url(#hm-arrow)"
                    opacity={0.35 + 0.65 * (p.n / maxPath)}
                  />
                )
              })}
            </svg>
          )}
        </div>

        {/* X axis */}
        <div aria-hidden="true" className={cn('flex flex-col justify-start pt-2 text-right', small && 'hidden')}>
          <span className="label-caps leading-tight">Likelihood ↑</span>
          <span className="label-caps leading-tight">Impact →</span>
        </div>
        <div aria-hidden="true" className="grid grid-cols-5 gap-1 pt-2 text-center">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="leading-tight">
              <div className={cn('font-display text-foreground-secondary', small ? 'text-caption' : 'text-body-lg')}>{i}</div>
              {!small && <div className="text-caption text-foreground-secondary">{IMPACT_LABELS[i - 1]}</div>}
            </div>
          ))}
        </div>
      </div>

      {showDetail && !small && (
        <div className="mt-4 min-h-14 rounded-lg bg-surface-sunken px-4 py-3 shadow-[inset_0_0_0_1px_var(--border)]" aria-live="polite">
          {!selected && <p className="py-1.5 text-body-sm text-muted-foreground">Select a cell to see its risks. Use the arrow keys to move between cells.</p>}
          {selected && selectedRisks.length === 0 && (
            <p className="py-1.5 text-body-sm text-muted-foreground">
              {LIKELIHOOD_LABELS[selected.l - 1]} × {IMPACT_LABELS[selected.i - 1]} · score {selected.l * selected.i} · no risks here.
            </p>
          )}
          {selected && selectedRisks.length > 0 && (
            <ul className="divide-y divide-border">
              {selectedRisks.slice(0, 4).map(r => (
                <li key={r.uuid} className="flex items-center gap-3 py-1.5">
                  <BandBadge score={selected.l * selected.i} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-caption text-muted-foreground">
                      {LIKELIHOOD_LABELS[selected.l - 1]} × {IMPACT_LABELS[selected.i - 1]} · <span className="font-mono">{riskRef(r)}</span>
                    </span>
                    <span className="block truncate font-display text-body-lg text-foreground">{r.statement ?? 'No statement recorded'}</span>
                  </span>
                  <Link href={riskHref(r)} className="inline-flex shrink-0 items-center gap-1 text-body-sm font-medium text-primary hover:underline focus-ring rounded-xs">
                    Open risk <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
              {selectedRisks.length > 4 && <li className="pt-2 text-caption text-muted-foreground">+ {selectedRisks.length - 4} more in this cell</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/** Legend: band swatches with ranges from settings, plus the hatched "N not rated · Rate now". */
export function HeatmapLegend({ unrated, rateHref, className }: { unrated?: number; rateHref?: string; className?: string }) {
  const { bands } = useOrgSettings()
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-caption text-foreground-secondary', className)}>
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {bandRanges(bands).map(r => (
          <li key={r.band} className="inline-flex items-center gap-2">
            <span aria-hidden="true" className={cn('size-3 rounded-[3px]', BAND_STYLES[r.band].dot)} />
            {r.band} {r.from}–{r.to}
          </li>
        ))}
      </ul>
      {unrated != null && unrated > 0 && (
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="hatch size-3 rounded-[3px] bg-risk-unrated-bg shadow-[inset_0_0_0_1px_var(--risk-unrated-border)]" />
          {unrated} not rated
          {rateHref && (
            <>
              <span aria-hidden="true">·</span>
              <Link href={rateHref} className="font-medium text-primary hover:underline focus-ring rounded-xs">
                Rate now
              </Link>
            </>
          )}
        </span>
      )}
    </div>
  )
}

export function bandRanges(b: RiskBands): { band: Band; from: number; to: number }[] {
  return [
    { band: 'Low', from: 1, to: b.moderate - 1 },
    { band: 'Moderate', from: b.moderate, to: b.high - 1 },
    { band: 'High', from: b.high, to: b.critical - 1 },
    { band: 'Critical', from: b.critical, to: 25 },
  ]
}
