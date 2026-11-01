'use client'

/**
 * Charter design-system building blocks shared by every page.
 * Rules: token classes only (no palette colours), serif (font-display) for titles and figures only,
 * every status colour travels with an icon or a word, actions always visible.
 */
import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, CircleCheck, Clock, Info, OctagonAlert, Search, Send, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { daysUntil, formatDate } from '@/lib/format'

// ── Page header ──────────────────────────────────────────────────────────────

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  size = 'default',
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  /** 'hero' = 44 px title (dashboard); default = 36 px */
  size?: 'default' | 'hero'
  className?: string
}) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow && <p className="label-caps">{eyebrow}</p>}
        <h1 className={cn('font-display text-foreground', size === 'hero' ? 'text-title-lg' : 'text-title')}>{title}</h1>
        {description && <p className="max-w-3xl text-body text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </header>
  )
}

// ── Panel ────────────────────────────────────────────────────────────────────

export function Panel({
  title,
  meta,
  actions,
  children,
  className,
  bodyClassName,
  as: Tag = 'section',
  id,
}: {
  title?: React.ReactNode
  /** Small caption to the right of the title (e.g. "20 active risks") */
  meta?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  as?: 'section' | 'div' | 'article'
  id?: string
}) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <Tag className={cn('surface-panel min-w-0', className)} aria-labelledby={title ? headingId : undefined} id={id}>
      {(title || actions || meta) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2 px-6 pt-5">
          {title && (
            <h2 id={headingId} className="font-display text-section text-foreground">
              {title}
            </h2>
          )}
          <div className="flex items-center gap-3">
            {meta && <span className="text-caption text-muted-foreground">{meta}</span>}
            {actions}
          </div>
        </div>
      )}
      <div className={cn('px-6 pt-4 pb-6', bodyClassName)}>{children}</div>
    </Tag>
  )
}

// ── Figures ──────────────────────────────────────────────────────────────────

/** Counts up once on first render (600 ms); instant under prefers-reduced-motion. */
export function CountUp({ value, format = v => String(Math.round(v)) }: { value: number; format?: (v: number) => string }) {
  const [shown, setShown] = useState(value)
  const done = useRef(false)
  useEffect(() => {
    if (done.current) {
      setShown(value)
      return
    }
    done.current = true
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || value === 0) {
      setShown(value)
      return
    }
    const start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 600)
      setShown(value * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{format(shown)}</>
}

/** A labelled figure: "ACTIVE RISKS / 20 / 13 rated · 7 not rated". */
export function Stat({
  label,
  value,
  suffix,
  context,
  size = 'md',
  tone,
  href,
  loading,
  children,
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  suffix?: React.ReactNode
  context?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Colour of the figure (token text class), e.g. 'text-risk-critical-text' */
  tone?: string
  href?: string
  loading?: boolean
  children?: React.ReactNode
  className?: string
}) {
  const fig = size === 'lg' ? 'text-figure-lg' : size === 'md' ? 'text-figure' : 'text-figure-sm'
  const body = (
    <>
      <p className="label-caps">{label}</p>
      {loading ? (
        <span className={cn('skeleton block w-20', size === 'lg' ? 'h-14' : size === 'md' ? 'h-10' : 'h-6')} aria-label="Loading" />
      ) : (
        <p className={cn('figure text-foreground', fig, tone)}>
          {value}
          {suffix && <span className="ml-0.5 text-[0.5em] text-muted-foreground">{suffix}</span>}
        </p>
      )}
      {children}
      {context && <p className="text-body-sm text-muted-foreground">{context}</p>}
    </>
  )
  if (href) {
    return (
      <Link href={href} className={cn('group flex min-w-0 flex-col gap-2 rounded-md focus-ring hover:[&_p.label-caps]:text-foreground', className)}>
        {body}
      </Link>
    )
  }
  return <div className={cn('flex min-w-0 flex-col gap-2', className)}>{body}</div>
}

/** A thin progress bar (primary by default). value 0–100, or null for "not available". */
export function Meter({ value, className, tone = 'bg-primary', label }: { value: number | null; className?: string; tone?: string; label?: string }) {
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted shadow-[inset_0_0_0_1px_var(--border)]', className)}
    >
      {value != null && <div className={cn('h-full rounded-full transition-[width] duration-(--duration-slow) ease-out', tone)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />}
    </div>
  )
}

// ── Segmented control ────────────────────────────────────────────────────────

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode; count?: number }[]
  label: string
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex gap-0.5 rounded-[9px] bg-surface-sunken p-[3px] shadow-[inset_0_0_0_1px_var(--border)]', className)}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-7 rounded-[6px] px-3 text-caption font-medium text-foreground-secondary transition-[background-color,box-shadow] duration-(--duration-fast) ease-out focus-ring',
            value === o.value ? 'bg-card text-foreground shadow-panel' : 'hover:text-foreground',
          )}
        >
          {o.label}
          {o.count != null && <span className="ml-1.5 tabular-nums text-muted-foreground">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

/** Underlined view tabs with counts ("All risks 25 · Needs rating 11 …"). */
export function ViewTabs<T extends string>({
  value,
  onChange,
  views,
  label,
  trailing,
}: {
  value: T
  onChange: (v: T) => void
  views: { value: T; label: string; count?: number | null }[]
  label: string
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-1 border-b" role="tablist" aria-label={label}>
      {views.map(v => (
        <button
          key={v.value}
          role="tab"
          type="button"
          aria-selected={value === v.value}
          onClick={() => onChange(v.value)}
          className={cn(
            '-mb-px inline-flex h-10 items-center gap-2 border-b-2 px-3 text-body-sm font-medium transition-colors focus-ring',
            value === v.value ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {v.label}
          {v.count != null && <span className="tabular-nums text-muted-foreground">{v.count}</span>}
        </button>
      ))}
      {trailing}
    </div>
  )
}

// ── Toolbar pieces ───────────────────────────────────────────────────────────

export function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  label,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  label: string
  className?: string
}) {
  return (
    <label className={cn('relative block w-full sm:w-72', className)}>
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-control w-full rounded-md border border-input bg-card pr-8 pl-9 text-body text-foreground placeholder:text-muted-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_var(--selection)] [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-hover hover:text-foreground focus-ring">
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </label>
  )
}

/**
 * Filter chip backed by a native select (accessible, works everywhere):
 * shows "Inherent any" until a value is picked, then "Inherent High" with the chip highlighted.
 */
export function FilterChip({
  label,
  value,
  onChange,
  options,
  anyLabel = 'any',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  anyLabel?: string
}) {
  const current = options.find(o => o.value === value)
  return (
    <label
      className={cn(
        'relative inline-flex h-control items-center gap-1.5 rounded-md px-3 text-body-sm transition-colors focus-within:shadow-[0_0_0_2px_var(--ring)]',
        value ? 'bg-accent text-foreground shadow-[inset_0_0_0_1px_var(--primary)]' : 'bg-card text-foreground shadow-[inset_0_0_0_1px_var(--border-strong)] hover:bg-surface-sunken',
      )}
    >
      <span className="font-medium">{label}</span>
      <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{current?.label ?? anyLabel}</span>
      <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
      <select value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={`Filter by ${label.toLowerCase()}`}>
        <option value="">{`${label}: ${anyLabel}`}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

// ── Status chips ─────────────────────────────────────────────────────────────

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-status-success-bg text-status-success-fg',
  warning: 'bg-status-warning-bg text-status-warning-fg',
  danger: 'bg-status-danger-bg text-status-danger-fg',
  info: 'bg-status-info-bg text-status-info-fg',
  neutral: 'bg-muted text-foreground-secondary shadow-[inset_0_0_0_1px_var(--border)]',
}
const TONE_ICON: Record<Tone, React.ComponentType<{ className?: string }>> = { success: CircleCheck, warning: TriangleAlert, danger: OctagonAlert, info: Info, neutral: Clock }

export function Chip({ tone = 'neutral', icon, children, className }: { tone?: Tone; icon?: React.ComponentType<{ className?: string }> | null; children: React.ReactNode; className?: string }) {
  const Icon = icon === null ? null : icon ?? TONE_ICON[tone]
  return (
    <span className={cn('inline-flex h-badge items-center gap-1.5 rounded-sm px-2 text-caption font-medium whitespace-nowrap', TONE_CLASS[tone], className)}>
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  )
}

/**
 * Due-date chip derived from a date: "32 days overdue" (danger, clock), "Due in 5 days" (warning),
 * "Due 15 Oct 2026" (neutral), or "No date" / custom `doneLabel` when complete.
 */
export function DueChip({ date, done, doneLabel = 'Done', soonDays = 14, noDateLabel = 'No due date' }: { date: string | null | undefined; done?: boolean; doneLabel?: string; soonDays?: number; noDateLabel?: string }) {
  if (done) return <Chip tone="success" icon={Check}>{doneLabel}</Chip>
  const d = daysUntil(date)
  if (d == null) return <Chip tone="neutral" icon={null} className="hatch">{noDateLabel}</Chip>
  if (d < 0) return <Chip tone="danger" icon={Clock}>{`${-d} day${d === -1 ? '' : 's'} overdue`}</Chip>
  if (d === 0) return <Chip tone="warning" icon={Clock}>Due today</Chip>
  if (d <= soonDays) return <Chip tone="warning" icon={Clock}>{`Due in ${d} day${d === 1 ? '' : 's'}`}</Chip>
  return <Chip tone="neutral" icon={null}>{`Due ${formatDate(date)}`}</Chip>
}

const APPROVAL: Record<string, { label: string; tone: Tone; icon: React.ComponentType<{ className?: string }> }> = {
  DRAFT: { label: 'Draft', tone: 'neutral', icon: Clock },
  SUBMITTED: { label: 'Submitted', tone: 'info', icon: Send },
  IN_REVIEW: { label: 'In review', tone: 'info', icon: Clock },
  PENDING: { label: 'Pending', tone: 'info', icon: Clock },
  APPROVED: { label: 'Approved', tone: 'success', icon: Check },
  REJECTED: { label: 'Rejected', tone: 'danger', icon: X },
  // workflow request statuses
  'IN REVIEW': { label: 'In review', tone: 'info', icon: Clock },
  WITHDRAWN: { label: 'Withdrawn', tone: 'neutral', icon: X },
}

/** Approval status of a record or request, always icon + word. */
export function ApprovalBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return <Chip tone="neutral" icon={null} className={className}>Not set</Chip>
  const a = APPROVAL[status.toUpperCase()] ?? { label: status, tone: 'neutral' as Tone, icon: Clock }
  return (
    <Chip tone={a.tone} icon={a.icon} className={className}>
      {a.label}
    </Chip>
  )
}

// ── People ───────────────────────────────────────────────────────────────────

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '—'
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '')).toUpperCase()
}

/** Initials avatar + name, or a muted "Not assigned" (optionally with an action). */
export function Person({ name, detail, emptyLabel = 'Not assigned', action, className }: { name: string | null | undefined; detail?: React.ReactNode; emptyLabel?: string; action?: React.ReactNode; className?: string }) {
  if (!name) {
    return (
      <span className={cn('inline-flex items-center gap-2 text-body-sm text-muted-foreground', className)}>
        {emptyLabel}
        {action}
      </span>
    )
  }
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <span aria-hidden="true" className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-foreground-secondary shadow-[inset_0_0_0_1px_var(--border)]">
        {initials(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-body-sm text-foreground">{name}</span>
        {detail && <span className="block truncate text-caption text-muted-foreground">{detail}</span>}
      </span>
    </span>
  )
}

// ── Definition list (detail sheets) ──────────────────────────────────────────

export function Facts({ items, className }: { items: { label: string; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-body-sm', className)}>
      {items.map(i => (
        <React.Fragment key={i.label}>
          <dt className="text-muted-foreground">{i.label}</dt>
          <dd className="min-w-0 text-foreground">{i.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

/** Callout strip (info / warning / neutral) — e.g. the hatched "11 of 25 risks have no rating" note. */
export function Callout({ tone = 'neutral', children, action, hatch, className }: { tone?: Tone; children: React.ReactNode; action?: React.ReactNode; hatch?: boolean; className?: string }) {
  const Icon = TONE_ICON[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'note'} className={cn('flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3 text-body-sm', tone === 'neutral' ? 'bg-card shadow-panel' : TONE_CLASS[tone], className)}>
      <span className="flex items-center gap-3">
        {hatch ? <span aria-hidden="true" className="hatch inline-block size-5 shrink-0 rounded-xs bg-risk-unrated-bg shadow-[inset_0_0_0_1px_var(--risk-unrated-border)]" /> : <Icon className="size-4 shrink-0" aria-hidden="true" />}
        <span>{children}</span>
      </span>
      {action}
    </div>
  )
}
