import React from 'react'
import { Button } from './button'

interface EmptyStateProps {
  title?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({
  title = 'No records found',
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="py-12 px-4 text-center">
      <h3 className="text-xs font-medium text-slate-900">{title}</h3>
      {description && <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{description}</p>}
      {action && (
        <div className="mt-4">
          <Button onClick={action.onClick} size="sm" variant="outline">
            {action.label}
          </Button>
        </div>
      )}
    </div>
  )
}
