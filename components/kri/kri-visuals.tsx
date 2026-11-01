'use client'

/**
 * KRI visual language (Charter), shared by /kri, /kri/matrix and /kri/configuration and matching the
 * dashboard's KRI breach tile:
 *  - LightPill: status pill with its icon (never colour-only); `solid` for the loud breach badge
 *  - ThresholdStrip: green / amber / red zones with an ink marker at the reading
 *  - KriDelta: direction-aware change vs the previous reading
 *  - KriTrendChart: Recharts line over shaded threshold zones, latest point emphasised
 */
import React from 'react'
import { ArrowDown, ArrowUp, CircleCheck, Minus, OctagonAlert, TriangleAlert } from 'lucide-react'
import { Area, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'
import { formatDate, formatNumber } from '@/lib/format'
import { LIGHT_STYLES, kriLight, type KriDefinition, type KriLight, type KriReading } from '@/lib/kri'

export const LIGHT_ICON: Record<KriLight, React.ComponentType<{ className?: string }>> = {
  GREEN: CircleCheck,
  AMBER: TriangleAlert,
  RED: OctagonAlert,
}

/** CSS variables per light, for SVG fills and strips. */
export const LIGHT_VAR: Record<KriLight, { solid: string; wash: string; ink: string }> = {
  GREEN: { solid: 'var(--kri-green)', wash: 'var(--kri-green-bg)', ink: 'var(--kri-green-fg)' },
  AMBER: { solid: 'var(--kri-amber)', wash: 'var(--kri-amber-bg)', ink: 'var(--kri-amber-fg)' },
  RED: { solid: 'var(--kri-red)', wash: 'var(--kri-red-bg)', ink: 'var(--kri-red-fg)' },
}

export const fmt = (v: number | null | undefined) => formatNumber(v, 2)

/** Status pill: icon + word. `solid` = the loud filled "Breach" badge used on breach tiles. */
export function LightPill({ light, solid, compact, className }: { light: KriLight | null; solid?: boolean; compact?: boolean; className?: string }) {
  if (!light)
    return (
      <span className={cn('inline-flex h-badge items-center gap-1.5 rounded-sm bg-muted px-2 text-caption font-medium whitespace-nowrap text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]', className)}>
        <Minus className="size-3.5" aria-hidden="true" />
        No reading
      </span>
    )
  const s = LIGHT_STYLES[light]
  const Icon = LIGHT_ICON[light]
  const loud = solid && light === 'RED'
  return (
    <span
      className={cn(
        'inline-flex h-badge items-center gap-1.5 rounded-sm px-2 text-caption font-medium whitespace-nowrap',
        loud ? 'bg-risk-critical text-risk-critical-fg' : [s.bg, s.text],
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {compact ? <span className="sr-only">{s.label}</span> : s.label}
    </span>
  )
}

// ── Scale ────────────────────────────────────────────────────────────────────

type Thresholds = Pick<KriDefinition, 'amber' | 'red' | 'direction'> & { green?: number | null }

export interface Zone {
  light: KriLight
  from: number
  to: number
}

/** Scale (lo..hi) and the three zones, in value order, for a KRI and the values to show on it. */
export function kriScale(kri: Thresholds, values: number[]): { lo: number; hi: number; zones: Zone[] } | null {
  const { amber, red, direction } = kri
  if (amber == null || red == null) return null
  const gap = Math.abs(red - amber) || Math.abs(red) || 1
  const all = [amber, red, ...values, ...(kri.green != null ? [kri.green] : [])]
  if (direction === 'HIGHER_WORSE') {
    const lo = Math.min(0, ...all)
    const hi = Math.max(red + gap, ...values.map(v => v + gap * 0.25))
    return { lo, hi, zones: [{ light: 'GREEN', from: lo, to: amber }, { light: 'AMBER', from: amber, to: red }, { light: 'RED', from: red, to: hi }] }
  }
  let lo = Math.min(red - gap, ...values.map(v => v - gap * 0.25))
  if (Math.min(...all) >= 0) lo = Math.max(0, lo)
  const hi = Math.max(amber + gap, ...all)
  return { lo, hi, zones: [{ light: 'RED', from: lo, to: red }, { light: 'AMBER', from: red, to: amber }, { light: 'GREEN', from: amber, to: hi }] }
}

/** "Within appetite < 8" · "Warning ≥ 8" · "Breach ≥ 12" (in left-to-right order). */
export function zoneLabels(kri: Thresholds): string[] {
  if (kri.amber == null || kri.red == null) return []
  if (kri.direction === 'HIGHER_WORSE') return [`Within appetite < ${fmt(kri.amber)}`, `Warning ≥ ${fmt(kri.amber)}`, `Breach ≥ ${fmt(kri.red)}`]
  return [`Breach ≤ ${fmt(kri.red)}`, `Warning ≤ ${fmt(kri.amber)}`, `Within appetite > ${fmt(kri.amber)}`]
}

/**
 * The dashboard's threshold strip: three zones with 2 px gaps and an ink marker at the reading.
 * `ring` is the colour behind the strip, so the marker reads as cut out of it.
 */
export function ThresholdStrip({
  kri,
  value,
  ring = 'var(--card)',
  labels = true,
  className,
}: {
  kri: Thresholds
  value: number | null | undefined
  ring?: string
  labels?: boolean
  className?: string
}) {
  const scale = kriScale(kri, value != null ? [value] : [])
  if (!scale) return <p className={cn('text-caption text-muted-foreground', className)}>Thresholds not set</p>
  const { lo, hi, zones } = scale
  const span = hi - lo || 1
  const pos = value != null ? ((value - lo) / span) * 100 : null
  const light = kriLight(value ?? null, kri)
  const names = zoneLabels(kri)
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div
        className="relative flex h-1.5 gap-0.5"
        role="img"
        aria-label={`${value != null ? `Reading ${fmt(value)}` : 'No reading'} against amber at ${fmt(kri.amber)} and red at ${fmt(kri.red)}${light ? `, ${LIGHT_STYLES[light].label}` : ''}`}
      >
        {zones.map((z, i) => (
          <span
            key={z.light}
            className={cn(i === 0 && 'rounded-l-full', i === zones.length - 1 && 'rounded-r-full')}
            style={{ flexGrow: Math.max(0.0001, z.to - z.from), flexBasis: 0, background: LIGHT_VAR[z.light].solid }}
          />
        ))}
        {pos != null && (
          <span
            aria-hidden="true"
            className="absolute -top-[5px] h-4 w-[3px] -translate-x-1/2 rounded-full bg-foreground"
            style={{ left: `${Math.max(0, Math.min(100, pos))}%`, boxShadow: `0 0 0 2px ${ring}` }}
          />
        )}
      </div>
      {labels && (
        <div className="flex justify-between gap-2 text-[11px] leading-4 text-foreground-secondary tabular-nums">
          {names.map(n => (
            <span key={n} className="whitespace-nowrap">
              {n}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Delta ────────────────────────────────────────────────────────────────────

/** "▲ +5.8 vs 31 May" — red when it moved the wrong way for the KRI's direction, green when it improved. */
export function KriDelta({ kri, latest, previous, className }: { kri: Pick<KriDefinition, 'direction'>; latest: KriReading | null; previous: KriReading | null; className?: string }) {
  if (!latest || !previous) return <span className={cn('text-caption text-muted-foreground', className)}>{latest ? 'First reading' : 'No readings yet'}</span>
  const delta = latest.value - previous.value
  const when = formatDate(previous.date, { day: 'numeric', month: 'short' })
  if (delta === 0)
    return (
      <span className={cn('inline-flex items-center gap-1 text-caption text-muted-foreground tabular-nums', className)}>
        <Minus className="size-3.5" aria-hidden="true" /> No change vs {when}
      </span>
    )
  const worse = kri.direction === 'HIGHER_WORSE' ? delta > 0 : delta < 0
  const Icon = delta > 0 ? ArrowUp : ArrowDown
  return (
    <span className={cn('inline-flex items-center gap-1 text-caption font-medium tabular-nums', worse ? 'text-status-danger-fg' : 'text-status-success-fg', className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {delta > 0 ? '+' : '−'}
      {fmt(Math.abs(delta))} vs {when}
      <span className="sr-only">{worse ? ' (worsening)' : ' (improving)'}</span>
    </span>
  )
}

// ── Chart ────────────────────────────────────────────────────────────────────

interface Point {
  date: string
  label: string
  value: number
  light: KriLight | null
  last: boolean
}

function ChartTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: Point }[]; unit: string | null }) {
  const p = active ? payload?.[0]?.payload : undefined
  if (!p) return null
  return (
    <div className="rounded-md bg-popover px-3 py-2 text-caption text-popover-foreground shadow-popover">
      <p className="text-muted-foreground">{formatDate(p.date)}</p>
      <p className="mt-0.5 flex items-center gap-2">
        <span className="font-medium text-foreground tabular-nums">
          {fmt(p.value)}
          {unit ? ` ${unit}` : ''}
        </span>
        {p.light && <LightPill light={p.light} />}
      </p>
    </div>
  )
}

export function KriTrendChart({ kri, readings, height = 132, showAxis = true }: { kri: KriDefinition; readings: KriReading[]; height?: number; showAxis?: boolean }) {
  const scale = kriScale(
    kri,
    readings.map(r => r.value),
  )
  const data: Point[] = readings.map((r, i) => ({
    date: r.date,
    label: formatDate(r.date, { month: 'short' }),
    value: r.value,
    light: kriLight(r.value, kri),
    last: i === readings.length - 1,
  }))
  const latest = data[data.length - 1]
  const lo = scale?.lo ?? Math.min(...data.map(d => d.value))
  const hi = scale?.hi ?? Math.max(...data.map(d => d.value))
  const ticks = kri.amber != null && kri.red != null ? [kri.amber, kri.red].sort((a, b) => a - b) : undefined

  return (
    <div
      style={{ height }}
      className="w-full"
      role="img"
      aria-label={`${kri.name}: ${readings.length} readings from ${formatDate(readings[0]?.date)} to ${formatDate(latest?.date)}${latest ? `, latest ${fmt(latest.value)}${kri.unit ? ` ${kri.unit}` : ''}` : ''}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 14, right: 26, left: 0, bottom: 0 }}>
          {scale?.zones.map(z => (
            <ReferenceArea key={z.light} y1={z.from} y2={z.to} fill={LIGHT_VAR[z.light].wash} fillOpacity={1} stroke="none" ifOverflow="hidden" />
          ))}
          <XAxis
            dataKey="label"
            hide={!showAxis}
            tick={{ fontSize: 12, fill: 'var(--chart-axis)' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={8}
            dy={4}
          />
          <YAxis
            hide={!showAxis}
            domain={[lo, hi]}
            ticks={ticks}
            interval={0}
            tick={{ fontSize: 12, fill: 'var(--chart-axis)' }}
            tickFormatter={v => fmt(v)}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip content={<ChartTooltip unit={kri.unit} />} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }} isAnimationActive={false} />
          <Area type="linear" dataKey="value" stroke="none" fill="var(--chart-1)" fillOpacity={0.06} isAnimationActive={false} activeDot={false} />
          <Line
            type="linear"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={2}
            isAnimationActive={false}
            activeDot={{ r: 4, fill: 'var(--chart-1)', stroke: 'var(--card)', strokeWidth: 2 }}
            dot={(props: { cx?: number; cy?: number; index?: number; payload?: Point }) => {
              const { cx, cy, payload, index } = props
              if (cx == null || cy == null || !payload) return <g key={index} />
              if (!payload.last) return <circle key={index} cx={cx} cy={cy} r={2.5} fill="var(--card)" stroke="var(--chart-1)" strokeWidth={1.5} />
              const color = payload.light ? LIGHT_VAR[payload.light].solid : 'var(--chart-1)'
              return (
                <g key={index}>
                  <circle cx={cx} cy={cy} r={9} fill={color} fillOpacity={0.22} />
                  <circle cx={cx} cy={cy} r={5} fill={color} stroke="var(--card)" strokeWidth={2} />
                </g>
              )
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

