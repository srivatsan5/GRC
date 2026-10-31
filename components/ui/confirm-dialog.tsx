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

  const toneClasses = state.tone === 'warning'
    ? 'bg-amber-500 hover:bg-amber-600 text-white'
    : state.tone === 'info'
      ? 'bg-blue-600 hover:bg-blue-700 text-white'
      : 'bg-red-600 hover:bg-red-700 text-white'

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog open={state.open} onOpenChange={(o) => { if (!o) handleClose() }}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <div className={cn(
              'mx-auto w-12 h-12 rounded-2xl flex items-center justify-center mb-2',
              state.tone === 'warning' ? 'bg-amber-50 text-amber-600' : state.tone === 'info' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
            )}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <AlertDialogTitle className="text-center text-lg font-black tracking-tight">{state.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-[13px] text-muted-foreground font-medium">
              {state.description || 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={state.loading} className="rounded-xl font-bold text-xs uppercase tracking-widest">
              {state.cancelLabel || 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={state.loading}
              onClick={(e) => { e.preventDefault(); handleConfirm() }}
              className={cn('rounded-xl font-black text-xs uppercase tracking-widest', toneClasses)}
            >
              {state.loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
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
