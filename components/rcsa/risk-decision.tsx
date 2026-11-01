'use client'

/** Submit / approve / reject actions for one risk-register row. */
import React, { useState } from 'react'
import { toast } from 'sonner'
import { Check, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useUpdateRow, type Row } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { useAuth } from '@/components/providers/auth-provider'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { Field, textareaClass } from './shared'
import { RISK_TABLE } from './risk-dialog'

export function RiskDecisionButtons({ risk, compact }: { risk: Row; compact?: boolean }) {
  const { hasPermission } = useAuth()
  const confirm = useConfirm()
  const update = useUpdateRow(RISK_TABLE)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState<string | null>(null)
  const status = String(risk.approval_status ?? 'DRAFT').toUpperCase()
  const id = risk.uuid ?? risk.id
  const label = String(risk.risk_statement ?? `risk ${id}`).slice(0, 60)
  const canApprove = hasPermission('approve')
  const canSubmit = hasPermission('update') && (status === 'DRAFT' || status === 'REJECTED')
  const undecided = status !== 'APPROVED' && status !== 'REJECTED'

  async function setStatus(approval_status: string, extra: Row = {}, msg: string) {
    try {
      await update.mutateAsync({ id, values: { approval_status, ...extra } })
      toast.success(msg)
      return true
    } catch (err) {
      toast.error(apiErrorMessage(err))
      return false
    }
  }

  async function approve() {
    const ok = await confirm({ title: 'Approve this risk?', description: label, confirmLabel: 'Approve', tone: 'info' })
    if (ok) await setStatus('APPROVED', {}, 'Risk approved')
  }

  async function reject(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim()) {
      setCommentError('Explain why the risk is rejected.')
      return
    }
    if (await setStatus('REJECTED', { approver_comments: comment.trim() }, 'Risk rejected')) {
      setRejectOpen(false)
      setComment('')
    }
  }

  const size = compact ? 'sm' : 'default'
  return (
    <>
      {canSubmit && !canApprove && (
        <Button size={size} variant="outline" disabled={update.isPending} onClick={() => setStatus('SUBMITTED', {}, 'Submitted for review')}>
          <Send className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
          Submit
        </Button>
      )}
      {canApprove && undecided && (
        <>
          <Button size={size} variant="outline" className="text-emerald-800" disabled={update.isPending} onClick={approve}>
            <Check className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            Approve
          </Button>
          <Button
            size={size}
            variant="outline"
            className="text-red-700"
            disabled={update.isPending}
            onClick={() => {
              setCommentError(null)
              setRejectOpen(true)
            }}
          >
            <X className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            Reject
          </Button>
        </>
      )}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md bg-white border-slate-200 rounded-lg p-5 text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-slate-900">Reject risk</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">{label}</DialogDescription>
          </DialogHeader>
          <form onSubmit={reject} noValidate className="space-y-3">
            <Field id={`reject-comment-${id}`} label="Reason" required error={commentError ?? undefined}>
              <textarea id={`reject-comment-${id}`} rows={3} value={comment} onChange={e => setComment(e.target.value)} className={textareaClass} aria-invalid={!!commentError || undefined} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" size="sm" disabled={update.isPending}>
                Reject risk
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
