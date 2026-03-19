'use client'

import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface LoadingSkeletonProps {
  rows?: number
  className?: string
}

/**
 * Loading skeleton for tables and lists
 */
export function LoadingTableSkeleton({ rows = 5, className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-20" />
        </div>
      ))}
    </div>
  )
}

/**
 * Loading skeleton for cards
 */
export function LoadingCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-4 ${className}`}>
      <Skeleton className="h-48 w-full rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}

/**
 * Loading skeleton for dashboard grid
 */
export function LoadingDashboardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  )
}

/**
 * Loading state with spinner
 */
export function LoadingState({
  message = 'Loading...',
  size = 'md',
}: {
  message?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClass = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }[size]

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div className={`${sizeClass} animate-spin border-4 border-muted border-t-primary rounded-full`} />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
