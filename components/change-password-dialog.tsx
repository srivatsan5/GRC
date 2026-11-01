'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { FormError, FormField } from '@/components/controls/charter-bits'
import { authApi, apiErrorMessage } from '@/lib/apiClient'
import { useAuth } from '@/components/providers/auth-provider'

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { refresh } = useAuth()
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
      toast.success('Password changed', { description: 'You have been signed out of your other sessions.' })
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
          <DialogDescription>Changing your password signs you out of your other sessions.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <FormError>{error}</FormError>}
          <FormField id="pw-current" label="Current password" required>
            <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required />
          </FormField>
          <FormField id="pw-new" label="New password" required hint="At least 12 characters, with letters and numbers.">
            <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} required minLength={12} />
          </FormField>
          <FormField id="pw-confirm" label="Confirm new password" required error={confirm && next !== confirm ? 'The new passwords do not match' : undefined}>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              aria-invalid={!!confirm && next !== confirm}
              aria-describedby={confirm && next !== confirm ? 'pw-confirm-error' : undefined}
            />
          </FormField>
          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !current || !next || !confirm}>
              {saving ? 'Saving…' : 'Change password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
