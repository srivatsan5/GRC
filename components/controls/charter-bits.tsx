'use client'

/**
 * Charter pieces shared by the library, enterprise-risk and administration pages
 * (controls, policies, vendors, incidents, continuity, scenarios, processes, audit, users).
 * Built only on tokens and the Charter kit in components/charter/primitives.
 */
import React, { useEffect } from 'react'
import { Archive, CircleCheck, Download, Link2, OctagonAlert, PenLine, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fieldBase } from '@/components/ui/input'
import { Chip, Stat } from '@/components/charter/primitives'
import { cn } from '@/lib/utils'
import { BAND_STYLES } from '@/lib/risk'
import { BandPips } from '@/components/band-badge'

// ── Headline figures: ONE panel split into cells by hairlines ────────────────

const LG_COLS: Record<number, string> = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' }

/**
 * A single surface panel split into 2–5 cells by hairlines (never a grid of equal cards).
 * Mobile: a 2-column grid; an odd last cell spans the row.
 */
export function Headline({ children, label = 'Headline figures', className }: { children: React.ReactNode; label?: string; className?: string }) {
  const cells = React.Children.toArray(children).filter(Boolean)
  const odd = cells.length % 2 === 1
  return (
    <section
      aria-label={label}
      className={cn(
        // gap-px over a hairline-tinted card = 1 px rules between cells, in both themes
        'surface-panel grid grid-cols-2 gap-px overflow-hidden bg-[linear-gradient(var(--border),var(--border))]',
        LG_COLS[cells.length] ?? 'lg:grid-cols-4',
        className,
      )}
    >
      {cells.map((c, i) => (
        <div key={i} className={cn('min-w-0 bg-card', odd && i === cells.length - 1 && 'col-span-2 lg:col-span-1')}>
          {c}
        </div>
      ))}
    </section>
  )
}

/** One headline cell: label caps + serif figure + context line (+ optional bar/badge). */
export function HeadlineCell({
  label,
  value,
  suffix,
  context,
  tone,
  loading,
  children,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  suffix?: React.ReactNode
  context?: React.ReactNode
  tone?: string
  loading?: boolean
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('h-full px-5 py-4 sm:px-6 sm:py-5', className)}>
      <Stat label={label} value={value} suffix={suffix} context={context} tone={tone} loading={loading} size="md">
        {children}
      </Stat>
    </div>
  )
}

// ── Toolbar ──────────────────────────────────────────────────────────────────

/** Search + filter chips on the left, secondary tools on the right; wraps on small screens. */
export function Toolbar({ children, end }: { children: React.ReactNode; end?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      {end && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{end}</div>}
    </div>
  )
}

export function ExportCsvButton({ onClick, disabled, label = 'Export CSV' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <Button variant="secondary" onClick={onClick} disabled={disabled}>
      <Download aria-hidden="true" />
      {label}
    </Button>
  )
}

/**
 * Prefills a search box from `?q=` once on mount (the ⌘K palette deep-links here).
 * Reads window.location so the route needs no Suspense boundary.
 */
export function useQueryParamSearch(onValue: (q: string) => void) {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (q) onValue(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

// ── Table cells ──────────────────────────────────────────────────────────────

/** First-column cell: name, then a mono reference / detail line, both truncated with a title. */
export function NameCell({ name, code, detail, maxWidth = 'max-w-[340px]' }: { name: React.ReactNode; code?: string | null; detail?: string | null; maxWidth?: string }) {
  const line = [code, detail].filter(Boolean).join(' · ')
  return (
    <div className={cn('min-w-0 py-1.5', maxWidth)}>
      <div className="truncate font-medium text-foreground" title={typeof name === 'string' ? name : undefined}>
        {name}
      </div>
      {line && (
        <div className="truncate text-caption text-muted-foreground" title={line}>
          {code && <span className="font-mono">{code}</span>}
          {code && detail && ' · '}
          {detail}
        </div>
      )}
    </div>
  )
}

/** Muted secondary text in a cell, or the dash. */
export function Muted({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('text-foreground-secondary', className)}>{children}</span>
}

/** Hatched "designed empty" chip: "Never tested", "Not scored", "Not scheduled". */
export function HatchChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'hatch inline-flex h-badge items-center rounded-sm bg-risk-unrated-bg px-2 text-caption font-medium whitespace-nowrap text-risk-unrated-text shadow-[inset_0_0_0_1px_var(--risk-unrated-border)]',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Record lifecycle status (Draft / Active / Retired, or similar) — always icon + word. */
export function LifecycleChip({ status }: { status: string | null | undefined }) {
  if (!status) return <Muted>—</Muted>
  const s = status.toLowerCase()
  if (s === 'active') return <Chip tone="success" icon={CircleCheck}>{status}</Chip>
  if (s === 'retired' || s === 'exited') return <Chip tone="neutral" icon={Archive}>{status}</Chip>
  return <Chip tone="neutral" icon={PenLine}>{status}</Chip>
}

/** 1–5 rating as five dots plus the number; hatched "Not rated" when empty. */
export function RatingDots({ value, label }: { value: number | null; label: string }) {
  if (value == null) return <HatchChip>Not rated</HatchChip>
  return (
    <span className="inline-flex items-center gap-2" role="img" aria-label={`${label} ${value} of 5`}>
      <span aria-hidden="true" className="inline-flex gap-[3px]">
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} className={cn('size-[7px] rounded-full', i <= value ? 'bg-foreground-secondary' : 'bg-transparent shadow-[inset_0_0_0_1px_var(--border-strong)]')} />
        ))}
      </span>
      <span aria-hidden="true" className="tabular-nums text-foreground">
        {value}
      </span>
    </span>
  )
}

/** A small count button that opens a link dialog ("3 risks"). */
export function CountButton({ count, noun, onClick, label, loading }: { count: number; noun: [string, string]; onClick: () => void; label: string; loading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'inline-flex h-badge items-center gap-1.5 rounded-sm px-2 text-caption font-medium whitespace-nowrap transition-colors duration-(--duration-fast) ease-out focus-ring',
        count > 0 ? 'text-primary hover:bg-accent' : 'text-muted-foreground hover:bg-hover hover:text-foreground',
      )}
    >
      <Link2 className="size-3.5" aria-hidden="true" />
      {loading ? '…' : <span className="tabular-nums">{count}</span>}
      <span className="sr-only">{count === 1 ? noun[0] : noun[1]}</span>
    </button>
  )
}

/** Always-visible edit / delete icon buttons with aria-labels. */
export function RowActions({
  name,
  onEdit,
  onDelete,
  deleteLabel = 'Delete',
  busy,
  children,
}: {
  name: string
  onEdit?: () => void
  onDelete?: () => void
  deleteLabel?: string
  busy?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {children}
      {onEdit && (
        <Button variant="ghost" size="icon" className="size-8" onClick={onEdit} aria-label={`Edit ${name}`} title="Edit">
          <Pencil aria-hidden="true" />
        </Button>
      )}
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:bg-status-danger-bg hover:text-status-danger-fg"
          onClick={onDelete}
          disabled={busy}
          aria-label={`${deleteLabel} ${name}`}
          title={deleteLabel}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}

/** A horizontal 0–100 meter + number (vendor risk score, acknowledgment). */
export function ScoreMeter({ value, max = 100, tone, suffix, label }: { value: number; max?: number; tone: string; suffix?: string; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <span className="inline-flex items-center gap-2.5">
      <span role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="relative h-1.5 w-16 overflow-hidden rounded-full bg-muted shadow-[inset_0_0_0_1px_var(--border)]">
        <span className={cn('absolute inset-y-0 left-0 rounded-full', tone)} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular-nums text-foreground">
        {value}
        {suffix && <span className="text-muted-foreground">{suffix}</span>}
      </span>
    </span>
  )
}

// ── Forms ────────────────────────────────────────────────────────────────────

export const nativeSelectClass = cn(fieldBase, 'h-control cursor-pointer py-0 pr-8')
export const nativeTextareaClass = cn(fieldBase, 'min-h-20 py-2 leading-relaxed')

/** Label + control + help text or an inline error (icon + words). */
export function FormField({
  id,
  label,
  required,
  error,
  hint,
  className,
  children,
}: {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <label htmlFor={id} className="block text-body-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="text-muted-foreground" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="text-caption text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-caption text-status-danger-fg">
          <OctagonAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

/** Inline form-level error block (dialogs). */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md bg-status-danger-bg px-3 py-2 text-body-sm text-status-danger-fg">
      <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

/** A captioned group inside a dialog form ("Ratings", "Dates"). */
export function FormSection({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <fieldset className={cn('space-y-3 border-t pt-4', className)}>
      <legend className="label-caps float-left mb-3 w-full">{title}</legend>
      <div className="clear-both space-y-3">{children}</div>
    </fieldset>
  )
}

// ── Tier / severity on the risk scale ────────────────────────────────────────

const TIER_BAND: Record<string, 'Low' | 'Moderate' | 'High' | 'Critical'> = { low: 'Low', medium: 'Moderate', moderate: 'Moderate', high: 'High', critical: 'Critical' }

/**
 * Vendor tier or incident severity as a soft risk-scale chip with the 1–4 signal glyph
 * (Low · Medium · High · Critical), so it never relies on colour alone.
 */
export function TierChip({ value, solid }: { value: string | null | undefined; solid?: boolean }) {
  const band = value ? TIER_BAND[value.toLowerCase()] : undefined
  if (!value || !band) return <Muted>{value || '—'}</Muted>
  const st = BAND_STYLES[band]
  return (
    <span
      className={cn(
        'inline-flex h-badge items-center gap-1.5 rounded-sm px-2 text-caption font-medium whitespace-nowrap',
        solid ? st.solid : cn(st.bg, st.text, 'shadow-[inset_0_0_0_1px_var(--border)]'),
      )}
    >
      <BandPips level={st.level as 1 | 2 | 3 | 4} />
      {value}
    </span>
  )
}
