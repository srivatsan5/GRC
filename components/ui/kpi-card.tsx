import React from 'react'
import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type ColorType = 'critical' | 'warning' | 'success' | 'info'

const colorStyles: Record<ColorType, { bg: string; text: string; border: string; icon: string }> = {
  critical: {
    bg: 'bg-red-500/10',
    text: 'text-red-500',
    border: 'border-red-500/20',
    icon: 'text-red-500',
  },
  warning: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    border: 'border-amber-500/20',
    icon: 'text-amber-500',
  },
  success: {
    bg: 'bg-green-500/10',
    text: 'text-green-500',
    border: 'border-green-500/20',
    icon: 'text-green-500',
  },
  info: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    border: 'border-blue-500/20',
    icon: 'text-blue-500',
  },
}

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  trend?: 'up' | 'down'
  icon: LucideIcon
  color: ColorType
  description?: string
}

export function KPICard({
  title,
  value,
  change,
  trend,
  icon: Icon,
  color,
  description,
}: KPICardProps) {
  const styles = colorStyles[color]

  return (
    <div className={cn(
      'bg-card border rounded-lg p-6 transition-colors hover:bg-card/80',
      styles.border
    )}>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
        <div className={cn('p-2 rounded-lg', styles.bg)}>
          <Icon className={cn('w-4 h-4', styles.icon)} />
        </div>
      </div>
      
      <p className="text-3xl font-semibold text-foreground mb-3">{value}</p>

      {change !== undefined && trend && (
        <div className="flex items-center gap-1.5 text-xs">
          {trend === 'up' ? (
            <TrendingUp className="w-3.5 h-3.5 text-critical" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-success" />
          )}
          <span className={trend === 'up' ? 'text-critical font-semibold' : 'text-success font-semibold'}>
            {trend === 'up' ? '+' : '-'}{Math.abs(change)}%
          </span>
          <span className="text-muted-foreground">
            vs last month
          </span>
        </div>
      )}
    </div>
  )
}
