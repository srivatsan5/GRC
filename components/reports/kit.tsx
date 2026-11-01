'use client'

/**
 * Charter pieces shared by the reports and analysis screens (owned by components/reports).
 * Token classes only; serif for figures and titles; every colour travels with a number or a word.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'
import { cn } from '@/lib/utils'
import { BAND_STYLES, BANDS, type Band } from '@/lib/risk'
import { formatNumber, formatPct, pctOf } from '@/lib/format'

// ── Analysis sub-navigation ──────────────────────────────────────────────────

const ANALYSIS_VIEWS = [
  { href: '/assessments/residual', label: 'Residual analysis' },
  { href: '/assessments/access', label: 'Assessment analytics' },
  { href: '/risk-assessments/dashboard', label: 'Assessment progress' },
  { href: '/risk-assessment', label: 'Risk overview' },
] as const

/** Underlined link tabs joining the four analysis screens that sit under "Residual analysis" in the nav. */
export function AnalysisTabs() {
  const path = usePathname()
  return (
    <nav aria-label="Analysis views" className="-mx-1 overflow-x-auto px-1 print:hidden">
      <ul className="flex min-w-max items-center gap-x-1 border-b">
        {ANALYSIS_VIEWS.map(v => {
          const current = path === v.href
          return (
            <li key={v.href}>
              <Link
                href={v.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex h-10 items-center border-b-2 px-3 text-body-sm font-medium whitespace-nowrap transition-colors duration-(--duration-fast) ease-out focus-ring',
                  current ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {v.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// ── Headline figures ─────────────────────────────────────────────────────────

/**
 * ONE panel split into cells by hairlines (never a grid of cards). 4 cells → 2×2 below lg.
 * `bare` drops the panel surface (used inside the board-pack page, which is already a panel).
 */
export function Headline({ children, className, bare, cols = 4 }: { children: React.ReactNode; className?: string; bare?: boolean; cols?: 3 | 4 }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden bg-border',
        cols === 4 ? 'lg:grid-cols-4' : 'sm:grid-cols-3 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1',
        bare ? '' : 'rounded-lg shadow-panel print:shadow-none print:outline print:outline-1 print:outline-border',
        // 1 px gaps drop out when printed to PDF: print draws cell borders instead
        'print:gap-0 print:[&>*]:border-l print:[&>*:first-child]:border-l-0',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function HeadlineCell({
  label,
  value,
  suffix,
  context,
  tone,
  tint,
  action,
  children,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  suffix?: React.ReactNode
  context?: React.ReactNode
  /** Figure colour (token text class) */
  tone?: string
  /** Background tint for the one cell that asks for action */
  tint?: string
  action?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0 bg-card', className)}>
      <div className={cn('flex h-full min-w-0 flex-col gap-2 px-5 py-5 sm:px-6', tint)}>
        <p className={cn('label-caps', tint && 'text-foreground-secondary')}>{label}</p>
        <div className="flex items-end justify-between gap-3">
          <p className={`figure text-figure leading-none ${tone ?? 'text-foreground'}`}>
            {value}
            {suffix && <span className="ml-0.5 text-[0.5em] text-muted-foreground">{suffix}</span>}
          </p>
          {action && <span className="print:hidden">{action}</span>}
        </div>
        {children}
        {context && <p className="text-body-sm text-muted-foreground">{context}</p>}
      </div>
    </div>
  )
}

/** Plain-text secondary strip under a headline panel: "$1.3M recorded SLE · 9 of 9 rated". */
export function FigureStrip({ items, className }: { items: { figure: React.ReactNode; text: React.ReactNode; tone?: string }[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-baseline gap-x-8 gap-y-2 px-1 text-body-sm text-foreground-secondary', className)}>
      {items.map((i, n) => (
        <li key={n} className="inline-flex items-baseline gap-2">
          <span className={`figure text-figure-sm ${i.tone ?? 'text-foreground'}`}>{i.figure}</span>
          <span>{i.text}</span>
        </li>
      ))}
    </ul>
  )
}

// ── Bars ─────────────────────────────────────────────────────────────────────

/** Thin split bar: e.g. rated (ink) vs not rated (hatched). Values are counts. */
export function SplitBar({ parts, label, className }: { parts: { value: number; className: string; label: string }[]; label: string; className?: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  return (
    <div role="img" aria-label={`${label}: ${parts.map(p => `${p.value} ${p.label}`).join(', ')}`} className={cn('flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full', className)}>
      {total === 0 ? (
        <span className="h-full w-full rounded-full bg-muted shadow-[inset_0_0_0_1px_var(--border)]" />
      ) : (
        parts.filter(p => p.value > 0).map(p => <span key={p.label} className={cn('h-full rounded-full', p.className)} style={{ flexGrow: p.value, flexBasis: 0 }} />)
      )}
    </div>
  )
}

export type BandCounts = Record<Band | 'Not rated', number>
const STACK_ORDER: (Band | 'Not rated')[] = ['Critical', 'High', 'Moderate', 'Low', 'Not rated']

/**
 * 100% stacked bars by band (as on the dashboard): counts inside the segments, Not rated hatched,
 * a swatch legend underneath. One row per set of counts (Inherent / Residual / Current).
 */
export function BandStack({ rows, className, legend = true }: { rows: { label: string; counts: BandCounts }[]; className?: string; legend?: boolean }) {
  return (
    <div className={cn('space-y-3', className)}>
      <dl className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-4 gap-y-3">
        {rows.map(r => {
          const total = STACK_ORDER.reduce((s, b) => s + r.counts[b], 0)
          return (
            <React.Fragment key={r.label}>
              <dt className="text-body-sm text-foreground-secondary">{r.label}</dt>
              <dd className="flex h-8 min-w-0 gap-0.5" role="img" aria-label={`${r.label}: ${STACK_ORDER.map(b => `${r.counts[b]} ${b}`).join(', ')}`}>
                {total === 0 && <span className="flex-1 rounded-xs bg-muted shadow-[inset_0_0_0_1px_var(--border)]" />}
                {STACK_ORDER.filter(b => r.counts[b] > 0).map(b => (
                  <span
                    key={b}
                    title={`${b}: ${r.counts[b]}`}
                    className={cn(
                      'flex min-w-7 items-center rounded-xs px-2 text-caption font-semibold tabular-nums',
                      b === 'Not rated' ? 'hatch bg-risk-unrated-bg text-risk-unrated-text shadow-[inset_0_0_0_1px_var(--risk-unrated-border)]' : BAND_STYLES[b].solid,
                    )}
                    style={{ flexGrow: r.counts[b], flexBasis: 0 }}
                  >
                    {r.counts[b]}
                  </span>
                ))}
              </dd>
            </React.Fragment>
          )
        })}
      </dl>
      {legend && <BandSwatches className="pl-[88px] max-sm:pl-0" />}
    </div>
  )
}

export function BandSwatches({ className, unrated = true }: { className?: string; unrated?: boolean }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5 text-caption text-foreground-secondary', className)}>
      {[...BANDS].reverse().map(b => (
        <li key={b} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('size-2.5 rounded-[3px]', BAND_STYLES[b].dot)} />
          {b}
        </li>
      ))}
      {unrated && (
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="hatch size-2.5 rounded-[3px] bg-risk-unrated-bg shadow-[inset_0_0_0_1px_var(--risk-unrated-border)]" />
          Not rated
        </li>
      )}
    </ul>
  )
}

/**
 * Ranked horizontal bars with direct labels (name left, value and share right).
 * Bars are scaled to the largest item; colour is the first chart series.
 */
export function RankedBars({
  items,
  total,
  limit,
  valueLabel,
  barClassName = 'bg-chart-1',
  className,
  empty = 'Nothing recorded yet.',
}: {
  items: {
    name: string
    count: number
    barClassName?: string
    icon?: React.ReactNode
  }[]
  total: number
  limit?: number
  valueLabel?: (count: number) => React.ReactNode
  barClassName?: string
  className?: string
  empty?: string
}) {
  if (items.length === 0) return <p className="text-body-sm text-muted-foreground">{empty}</p>
  const shown = limit ? items.slice(0, limit) : items
  const max = Math.max(1, ...shown.map(i => i.count))
  return (
    <ul className={cn('space-y-3', className)}>
      {shown.map(item => (
        <li key={item.name} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-body-sm">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-foreground" title={item.name}>
              {item.icon}
              <span className="truncate">{item.name}</span>
            </span>
            <span className="shrink-0 font-medium whitespace-nowrap text-foreground tabular-nums">
              {valueLabel ? valueLabel(item.count) : formatNumber(item.count)}
              {total > 0 && !valueLabel && <span className="font-normal text-muted-foreground"> · {formatPct(pctOf(item.count, total))}</span>}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className={cn('h-full rounded-full', item.barClassName ?? barClassName)} style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
      {limit && items.length > limit && <li className="text-caption text-muted-foreground">+ {items.length - limit} more</li>}
    </ul>
  )
}

// ── Recharts helpers ─────────────────────────────────────────────────────────

/** Axis tick style for Recharts: 12 px in the axis colour. */
export const AXIS_TICK = { fontSize: 12, fill: 'var(--chart-axis)' } as const

export const BAND_FILL: Record<Band | 'Not rated', string> = {
  Low: 'var(--risk-low)',
  Moderate: 'var(--risk-moderate)',
  High: 'var(--risk-high)',
  Critical: 'var(--risk-critical)',
  'Not rated': 'url(#chart-hatch)',
}

/** SVG <defs> for the hatched "Not rated" fill; place `{CHART_HATCH_DEFS}` directly inside a Recharts chart (Recharts only renders raw <defs>, not wrapper components). */
export const CHART_HATCH_DEFS = (
  <defs>
    <pattern id="chart-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="var(--risk-unrated-bg)" />
      <line x1="0" y1="0" x2="0" y2="6" stroke="var(--border-strong)" strokeWidth="2.5" />
    </pattern>
  </defs>
)

interface TooltipEntry {
  name?: string | number
  value?: string | number | (string | number)[]
  color?: string
  payload?: Record<string, unknown>
}

/**
 * Custom Recharts tooltip, styled as a popover. Pass as `content={<ChartTooltip … />}`;
 * Recharts injects active / payload / label.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  title,
  format = v => formatNumber(typeof v === 'number' ? v : Number(v), 1),
  footer,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  title?: (label: string | number | undefined, payload: TooltipEntry[]) => React.ReactNode
  format?: (v: number | string, entry: TooltipEntry) => React.ReactNode
  footer?: (payload: TooltipEntry[]) => React.ReactNode
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-40 rounded-md bg-popover px-3 py-2.5 text-caption text-popover-foreground shadow-popover">
      <p className="mb-1.5 font-medium text-foreground">{title ? title(label, payload) : label}</p>
      <ul className="space-y-1">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-foreground-secondary">
              <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-medium text-foreground tabular-nums">{p.value == null || Array.isArray(p.value) ? '—' : format(p.value, p)}</span>
          </li>
        ))}
      </ul>
      {footer && <div className="mt-1.5 border-t pt-1.5 text-muted-foreground">{footer(payload)}</div>}
    </div>
  )
}

/** Small swatch legend for a chart's series. */
export function SeriesLegend({ items, className }: { items: { label: string; color: string }[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1 text-caption text-foreground-secondary', className)}>
      {items.map(i => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  )
}
