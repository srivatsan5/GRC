import React from 'react'
import { cn } from '@/lib/utils'

type StatusType = 'critical' | 'high' | 'medium' | 'low' | 'success' | 'warning' | 'info' | 'pending' | 'completed' | 'on-track' | 'at-risk'

const statusStyles: Record<StatusType, { bg: string; text: string }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-500' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-500' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-500' },
  low: { bg: 'bg-green-500/10', text: 'text-green-500' },
  success: { bg: 'bg-green-500/10', text: 'text-green-500' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  info: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
  pending: { bg: 'bg-gray-500/10', text: 'text-gray-500' },
  completed: { bg: 'bg-green-500/10', text: 'text-green-500' },
  'on-track': { bg: 'bg-green-500/10', text: 'text-green-500' },
  'at-risk': { bg: 'bg-red-500/10', text: 'text-red-500' },
}

interface StatusBadgeProps {
  status: StatusType
  label: string
  className?: string
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const styles = statusStyles[status]

  return (
    <span
      className={cn(
        'inline-block px-2 py-1 rounded text-xs font-medium',
        styles.bg,
        styles.text,
        className
      )}
    >
      {label}
    </span>
  )
}
