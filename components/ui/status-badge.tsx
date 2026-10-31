import React from 'react'
import { cn } from '@/lib/utils'

export type StatusType = 'critical' | 'high' | 'medium' | 'low' | 'success' | 'warning' | 'info' | 'pending' | 'completed' | 'on-track' | 'at-risk' | 'open' | 'in-review' | 'approved' | 'rejected'

const statusStyles: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  high: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  medium: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' },
  low: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  success: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'on-track': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'at-risk': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  rejected: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  info: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'in-review': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  pending: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
  open: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
}

interface StatusBadgeProps {
  status: string
  label?: string
  className?: string
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const normalized = (status || 'pending').toLowerCase().replace(/\s+/g, '-')
  const style = statusStyles[normalized] || statusStyles.pending

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border',
        style.bg,
        style.text,
        style.border,
        className
      )}
    >
      {label || status}
    </span>
  )
}
