'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { authApi, apiErrorMessage } from '@/lib/apiClient'
import { useAuth } from '@/components/providers/auth-provider'

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { refresh } = useAuth()
  const { toast } = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setCurrent('')
    setNext('')
    setConfirm('')
    setError(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next !== confirm) {
      setError('The new passwords do not match')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await authApi.changePassword(current, next)
      await refresh()
      toast({ title: 'Password changed', description: 'You have been signed out of your other sessions.' })
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not change the password'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>At least 12 characters, with letters and numbers.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {error && <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>}
          <div>
            <label htmlFor="pw-current" className="text-xs font-medium text-slate-700">Current password</label>
            <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} className="mt-1 h-9" required />
          </div>
          <div>
            <label htmlFor="pw-new" className="text-xs font-medium text-slate-700">New password</label>
            <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} className="mt-1 h-9" required minLength={12} />
          </div>
          <div>
            <label htmlFor="pw-confirm" className="text-xs font-medium text-slate-700">Confirm new password</label>
            <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-1 h-9" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !current || !next || !confirm}>{saving ? 'Saving…' : 'Change password'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
