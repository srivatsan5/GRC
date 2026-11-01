'use client'

import * as React from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Reusable confirm dialog primarily for destructive actions.
 * Renders a clear "this action cannot be undone" warning to satisfy
 * REC-06 from the QA report.
 */

export type ConfirmTone = 'danger' | 'warning' | 'info'

export interface ConfirmDialogState {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmTone
  loading?: boolean
  onConfirm?: () => void | Promise<void>
}

const initialState: ConfirmDialogState = {
  open: false,
  title: 'Are you sure?',
  description: 'This action cannot be undone.',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  tone: 'danger',
  loading: false,
}

interface ConfirmContextValue {
  confirm: (opts: Omit<ConfirmDialogState, 'open' | 'loading'>) => Promise<boolean>
}

const ConfirmContext = React.createContext<ConfirmContextValue | undefined>(undefined)

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ConfirmDialogState>(initialState)
  const resolverRef = React.useRef<(v: boolean) => void>(() => { /* noop */ })

  const confirm = React.useCallback<ConfirmContextValue['confirm']>((opts) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setState({ ...initialState, ...opts, open: true })
    })
  }, [])

  const handleClose = () => {
    setState(s => ({ ...s, open: false }))
    resolverRef.current(false)
  }

  const handleConfirm = async () => {
    setState(s => ({ ...s, loading: true }))
    try {
      await state.onConfirm?.()
      resolverRef.current(true)
    } catch {
      resolverRef.current(false)
    } finally {
      setState(s => ({ ...s, open: false, loading: false }))
    }
  }

  const danger = state.tone !== 'warning' && state.tone !== 'info'
  const iconWrap = state.tone === 'warning' ? 'bg-status-warning-bg text-status-warning-fg' : state.tone === 'info' ? 'bg-status-info-bg text-status-info-fg' : 'bg-status-danger-bg text-status-danger-fg'

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog open={state.open} onOpenChange={(o) => { if (!o) handleClose() }}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader className="flex-row items-start gap-4 text-left">
            <span className={cn('mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md', iconWrap)}>
              <AlertTriangle className="size-4.5" aria-hidden="true" />
            </span>
            <div className="space-y-1.5">
              <AlertDialogTitle className="font-display text-section">{state.title}</AlertDialogTitle>
              <AlertDialogDescription className="text-body-sm text-muted-foreground">
                {state.description || 'This action cannot be undone.'}
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={state.loading} className={buttonVariants({ variant: 'secondary' })}>
              {state.cancelLabel || 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={state.loading}
              onClick={(e) => { e.preventDefault(); handleConfirm() }}
              className={buttonVariants({ variant: danger ? 'destructive' : 'primary' })}
            >
              {state.loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {state.confirmLabel || 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmDialogProvider')
  return ctx.confirm
}
