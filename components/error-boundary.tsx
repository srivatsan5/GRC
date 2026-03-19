'use client'

import React, { ReactNode, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorCount: number
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorCount: 0,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Error info:', errorInfo)

    // Call optional error handler
    this.props.onError?.(error, errorInfo)

    // Increment error count
    this.setState(prev => ({
      errorCount: prev.errorCount + 1,
    }))
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorCount: 0,
    })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="w-full h-full flex items-center justify-center p-4 min-h-96">
          <Alert variant="destructive" className="max-w-md">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-lg font-semibold">Something went wrong</AlertTitle>
            <AlertDescription className="mt-4 space-y-3">
              <p className="text-sm">
                {this.state.error?.message || 'An unexpected error occurred while loading this section.'}
              </p>
              {process.env.NODE_ENV === 'development' && (
                <details className="text-xs bg-muted p-2 rounded cursor-pointer hover:bg-muted/80 transition-colors">
                  <summary className="font-mono font-semibold mb-2">Error Details</summary>
                  <pre className="overflow-auto max-h-40 font-mono text-xs whitespace-pre-wrap break-words">
                    {this.state.error?.stack}
                  </pre>
                </details>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={this.resetError}
                  className="gap-2"
                  variant="outline"
                >
                  <RefreshCw className="h-3 w-3" />
                  Try Again
                </Button>
                <Button
                  size="sm"
                  onClick={() => window.location.reload()}
                  variant="outline"
                >
                  Reload Page
                </Button>
              </div>
              {this.state.errorCount > 2 && (
                <p className="text-xs text-muted-foreground italic mt-2">
                  Multiple errors detected. Consider refreshing the page or checking your connection.
                </p>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )
    }

    return this.props.children
  }
}
