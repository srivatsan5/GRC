'use client'

import React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'

type AlertVariant = 'default' | 'destructive'

interface ErrorAlertProps {
  title?: string
  message?: string
  error?: Error | null
  variant?: AlertVariant
  onDismiss?: () => void
  onRetry?: () => void
  showDetails?: boolean
  className?: string
}

/**
 * User-friendly error alert component with optional retry button
 */
export function ErrorAlert({
  title = 'Error',
  message = 'An error occurred while loading this data',
  error,
  variant = 'destructive',
  onDismiss,
  onRetry,
  showDetails = false,
  className = '',
}: ErrorAlertProps) {
  const icons = {
    default: <AlertCircle className="h-4 w-4" />,
    destructive: <AlertTriangle className="h-4 w-4" />,
  }

  const finalTitle = error?.message ? `${title}: ${error.message}` : title

  return (
    <Alert variant={variant} className={className}>
      {icons[variant]}
      <AlertTitle>{finalTitle}</AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p className="text-sm">{message}</p>
        {showDetails && error?.stack && (
          <details className="text-xs bg-muted p-2 rounded cursor-pointer hover:bg-muted/80 transition-colors">
            <summary className="font-mono font-semibold mb-2">Technical Details</summary>
            <pre className="overflow-auto max-h-40 font-mono text-xs whitespace-pre-wrap break-words">
              {error.stack}
            </pre>
          </details>
        )}
        <div className="flex gap-2 pt-2">
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              Try Again
            </Button>
          )}
          {onDismiss && (
            <Button size="sm" variant="outline" onClick={onDismiss} className="gap-2">
              <X className="h-3 w-3" />
              Dismiss
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}

/**
 * Inline error message (less intrusive than Alert)
 */
export function ErrorMessage({
  message,
  icon = true,
  className = '',
}: {
  message: string
  icon?: boolean
  className?: string
}) {
  return (
    <div className={`flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive ${className}`}>
      {icon && <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
      <p>{message}</p>
    </div>
  )
}

/**
 * Toast-like error notification
 */
export function ErrorNotification({
  title,
  message,
  autoClose = true,
  duration = 5000,
  onClose,
}: {
  title?: string
  message: string
  autoClose?: boolean
  duration?: number
  onClose?: () => void
}) {
  const [isVisible, setIsVisible] = React.useState(true)

  React.useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        onClose?.()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [autoClose, duration, onClose])

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4">
      <Alert variant="destructive" className="max-w-sm shadow-lg">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{title || 'Error'}</AlertTitle>
        <AlertDescription className="mt-2 flex items-center justify-between">
          <p className="text-sm">{message}</p>
          <button
            onClick={() => setIsVisible(false)}
            className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </AlertDescription>
      </Alert>
    </div>
  )
}
