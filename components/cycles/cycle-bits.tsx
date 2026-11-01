'use client'

/** Small Charter pieces shared by the assessment-cycle screens. */
import React from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, CircleCheck, CirclePlay, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { daysUntil, formatDate } from '@/lib/format'
import { Chip } from '@/components/charter/primitives'

// ── Status ───────────────────────────────────────────────────────────────────

type ChipTone = React.ComponentProps<typeof Chip>['tone']
const STATUS: Record<string, { tone: ChipTone; icon: React.ComponentType<{ className?: string }> }> = {
  Planned: { tone: 'neutral', icon: CalendarClock },
  'In Progress': { tone: 'info', icon: CirclePlay },
  'Under Review': { tone: 'warning', icon: Eye },
  Completed: { tone: 'success', icon: CircleCheck },
}

/** Cycle status, always icon + word. Unknown stored values are shown as-is. */
export function CycleStatusChip({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status)
    return (
      <Chip tone="neutral" icon={null} className={className}>
        No status
      </Chip>
    )
  const s = STATUS[status] ?? { tone: 'neutral' as ChipTone, icon: CalendarClock }
  return (
    <Chip tone={s.tone} icon={s.icon} className={className}>
      {status}
    </Chip>
  )
}

// ── Schedule ─────────────────────────────────────────────────────────────────

/**
 * The cycle's period as a track: elapsed time filled, today as a dot, the submission deadline as an ink tick.
 * Renders a quiet "No dates set" when the cycle has no start/end.
 */
export function CycleTimeline({
  start,
  end,
  deadline,
  completed,
  className,
}: {
  start: string | null | undefined
  end: string | null | undefined
  deadline?: string | null
  completed?: boolean
  className?: string
}) {
  const s = daysUntil(start)
  const e = daysUntil(end)
  const dl = daysUntil(deadline)
  if (s == null || e == null || e < s) {
    return (
      <div className={cn('space-y-2', className)}>
        <p className="text-body-sm text-foreground-secondary">
          {formatDate(start)} – {formatDate(end)}
        </p>
        <div className="h-1.5 rounded-full bg-muted shadow-[inset_0_0_0_1px_var(--border)]" aria-hidden="true" />
        <p className="text-caption text-muted-foreground">{s == null || e == null ? 'Start or end date not set' : 'End date is before the start date'}</p>
      </div>
    )
  }
  const total = e - s + 1
  const elapsed = Math.min(total, Math.max(0, -s + 1))
  const pct = (elapsed / total) * 100
  const deadlinePct = dl != null ? Math.min(100, Math.max(0, ((dl - s + 0.5) / total) * 100)) : null
  const phase = s > 0 ? `Starts in ${s} day${s === 1 ? '' : 's'}` : e < 0 ? 'Period ended' : `Day ${elapsed} of ${total}`
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-body-sm">
        <span className="text-foreground-secondary tabular-nums">
          {formatDate(start)} – {formatDate(end)}
        </span>
        <span className="text-caption text-muted-foreground tabular-nums">{completed ? 'Completed' : phase}</span>
      </div>
      <div
        className="relative h-1.5 rounded-full bg-muted shadow-[inset_0_0_0_1px_var(--border)]"
        role="img"
        aria-label={`${phase}${dl != null ? `, submission deadline ${formatDate(deadline)}` : ''}`}
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-foreground-secondary/45" style={{ width: `${pct}%` }} />
        {deadlinePct != null && (
          <span className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${deadlinePct}%` }} title={`Deadline ${formatDate(deadline)}`} />
        )}
        {s <= 0 && e >= 0 && !completed && (
          <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-card shadow-[0_0_0_2px_var(--foreground)]" style={{ left: `${pct}%` }} title="Today" />
        )}
      </div>
    </div>
  )
}

// ── Table header with server-side sort ───────────────────────────────────────

export interface SortState {
  sort: string
  order: 'asc' | 'desc'
}

export function SortTh({
  label,
  column,
  state,
  onSort,
  numeric,
  className,
}: {
  label: string
  column: string
  state: SortState
  onSort: (s: SortState) => void
  numeric?: boolean
  className?: string
}) {
  const active = state.sort === column
  const Icon = !active ? ArrowUpDown : state.order === 'asc' ? ArrowUp : ArrowDown
  return (
    <th data-numeric={numeric || undefined} aria-sort={active ? (state.order === 'asc' ? 'ascending' : 'descending') : 'none'} className={className}>
      <button
        type="button"
        onClick={() => onSort({ sort: column, order: active && state.order === 'asc' ? 'desc' : 'asc' })}
        className={cn('-mx-1 inline-flex items-center gap-1 rounded-xs px-1 uppercase transition-colors focus-ring hover:text-foreground', active && 'text-foreground')}
      >
        {label}
        <Icon className={cn('size-3', !active && 'opacity-50')} aria-hidden="true" />
      </button>
    </th>
  )
}
