import React from 'react'
import { Check, Circle, Clock, Info, OctagonAlert, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StatusType = 'critical' | 'high' | 'medium' | 'low' | 'success' | 'warning' | 'info' | 'pending' | 'completed' | 'on-track' | 'at-risk' | 'open' | 'in-review' | 'approved' | 'rejected'

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const TONE: Record<Tone, { cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  success: { cls: 'bg-status-success-bg text-status-success-fg', Icon: Check },
  warning: { cls: 'bg-status-warning-bg text-status-warning-fg', Icon: TriangleAlert },
  danger: { cls: 'bg-status-danger-bg text-status-danger-fg', Icon: OctagonAlert },
  info: { cls: 'bg-status-info-bg text-status-info-fg', Icon: Info },
  neutral: { cls: 'bg-muted text-foreground-secondary shadow-[inset_0_0_0_1px_var(--border)]', Icon: Circle },
}

const STATUS_TONE: Record<string, Tone> = {
  critical: 'danger', 'at-risk': 'danger', rejected: 'danger', overdue: 'danger', breach: 'danger',
  high: 'warning', medium: 'warning', warning: 'warning', 'due-soon': 'warning',
  low: 'success', success: 'success', completed: 'success', 'on-track': 'success', approved: 'success', active: 'success', closed: 'success',
  info: 'info', 'in-review': 'info', submitted: 'info', investigating: 'info',
  pending: 'neutral', open: 'neutral', draft: 'neutral', retired: 'neutral',
}

interface StatusBadgeProps {
  status: string
  label?: string
  className?: string
  /** Override the colour family; otherwise derived from `status`. */
  tone?: Tone
  /** Hide the icon (only where the word itself is the whole meaning). Defaults to showing it. */
  icon?: boolean
}

/** Status chip: colour is always paired with an icon and a word, never colour alone. */
export function StatusBadge({ status, label, className, tone, icon = true }: StatusBadgeProps) {
  const normalized = (status || 'pending').toLowerCase().replace(/[\s_]+/g, '-')
  const t = TONE[tone ?? STATUS_TONE[normalized] ?? 'neutral']
  const Icon = normalized === 'rejected' ? X : normalized === 'pending' || normalized === 'in-review' ? Clock : t.Icon
  return (
    <span className={cn('inline-flex h-badge items-center gap-1.5 rounded-sm px-2 text-caption font-medium whitespace-nowrap', t.cls, className)}>
      {icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
      {label || status}
    </span>
  )
}
