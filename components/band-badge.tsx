'use client'

/**
 * Risk score badges (Charter design system).
 *
 *   <BandBadge score={16} />                         → [▮▮▮▮ 16 · Critical]   solid
 *   <BandBadge score={12} variant="soft" />          → soft wash + keyline
 *   <BandBadge score={null} rateHref="/assessments/inherent?riskId=42" />
 *                                                    → [Not rated] Rate now
 *   <RiskMovement inherent={20} residual={6} />      → [▮ 6 · Low] ↓14
 *
 * Rules the badge enforces:
 *  - Never colour-only: every band shows its number, its label (unless `compact`) and a 1–4 signal-bar glyph.
 *  - Bands come from organisation settings via useOrgSettings().band, so thresholds are never baked in.
 *  - "Not rated" is a designed state (hatched, neutral) with an optional inline action.
 *  - Height follows the density setting (--badge-height: 22 px comfortable, 20 px compact).
 */
import Link from 'next/link'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BAND_STYLES, UNRATED_STYLE } from '@/lib/risk'
import { useOrgSettings } from '@/lib/settings'

const PIP_HEIGHTS = [4, 6, 8, 10] as const

/** Signal-bar glyph: how many of the four bars are filled encodes the band. */
export function BandPips({ level, className }: { level: 0 | 1 | 2 | 3 | 4; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('inline-flex h-2.5 items-end gap-0.5', className)}>
      {PIP_HEIGHTS.map((h, i) => (
        <span
          key={h}
          className={cn('w-[3px] rounded-[1px] bg-current', i < level ? 'opacity-100' : 'opacity-30')}
          style={{ height: h }}
        />
      ))}
    </span>
  )
}

export interface BandBadgeProps {
  score: number | null | undefined
  /** solid = filled (tables, heatmap); soft = wash + keyline (dense lists, secondary use) */
  variant?: 'solid' | 'soft'
  /** compact hides the label and the glyph and keeps the number: for 32 px rows where the column header names the scale */
  compact?: boolean
  /** Prefix for the accessible name, e.g. "Inherent" or "Residual" */
  kind?: string
  /** When the score is missing, show an inline "Rate now" link to this page */
  rateHref?: string
  rateLabel?: string
  className?: string
}

export function BandBadge({
  score,
  variant = 'solid',
  compact = false,
  kind,
  rateHref,
  rateLabel = 'Rate now',
  className,
}: BandBadgeProps) {
  const { band } = useOrgSettings()
  const b = band(score)

  if (!b) {
    return (
      <span className={cn('inline-flex items-center gap-2', className)}>
        <span
          className={cn(
            'inline-flex h-badge items-center rounded-sm border px-2 text-caption whitespace-nowrap',
            UNRATED_STYLE.bg,
            UNRATED_STYLE.text,
            UNRATED_STYLE.border,
            UNRATED_STYLE.pattern,
          )}
        >
          Not rated
          {kind && <span className="sr-only"> ({kind})</span>}
        </span>
        {rateHref && (
          <Link href={rateHref} className="text-caption font-medium text-primary underline-offset-2 hover:underline focus-ring rounded-xs">
            {rateLabel}
            {kind && <span className="sr-only"> ({kind.toLowerCase()} rating)</span>}
          </Link>
        )}
      </span>
    )
  }

  const s = BAND_STYLES[b]
  return (
    <span
      aria-label={`${kind ? `${kind} ` : ''}${score}, ${b}`}
      className={cn(
        'inline-flex h-badge items-center gap-1.5 rounded-sm px-2 text-caption font-medium whitespace-nowrap tabular-nums',
        variant === 'solid' ? s.solid : cn('border', s.bg, s.text, s.border),
        compact && 'px-1.5',
        className,
      )}
    >
      {!compact && <BandPips level={s.level} />}
      <span aria-hidden="true">
        {score}
        {!compact && <> · {b}</>}
      </span>
    </span>
  )
}

/**
 * Residual badge plus its movement from inherent. A reduction reads in the success colour with a down arrow;
 * an increase (residual above inherent: usually a data problem) reads in danger with an up arrow.
 */
export function RiskMovement({
  inherent,
  residual,
  compact = false,
  rateHref,
  className,
}: {
  inherent: number | null | undefined
  residual: number | null | undefined
  compact?: boolean
  rateHref?: string
  className?: string
}) {
  const delta = inherent != null && residual != null ? residual - inherent : null
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <BandBadge score={residual} kind="Residual" compact={compact} rateHref={rateHref} rateLabel="Rate" />
      {delta != null && delta !== 0 && (
        <span
          className={cn(
            'inline-flex items-center gap-0.5 text-caption font-semibold tabular-nums',
            delta < 0 ? 'text-status-success-fg' : 'text-status-danger-fg',
          )}
          aria-label={`${Math.abs(delta)} points ${delta < 0 ? 'below' : 'above'} inherent`}
        >
          {delta < 0 ? <ArrowDown className="size-3" strokeWidth={2} aria-hidden="true" /> : <ArrowUp className="size-3" strokeWidth={2} aria-hidden="true" />}
          <span aria-hidden="true">{Math.abs(delta)}</span>
        </span>
      )}
      {delta === 0 && <span className="text-caption text-muted-foreground">No change</span>}
    </span>
  )
}
