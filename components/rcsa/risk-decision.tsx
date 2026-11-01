'use client'

/**
 * Submit / approve / reject actions for one risk-register row.
 *
 *  - `layout="row"` (default, legacy): small secondary buttons for table rows.
 *  - `layout="footer"`: the detail sheet / risk page footer. One primary action for the current status:
 *    "Submit for approval" (DRAFT / REJECTED, users who can update) or Approve + Reject (awaiting a
 *    decision, users who can approve). Rejecting always needs a reason.
 *
 * The server enforces maker-checker (nobody decides a record they created); its message is shown as is.
 */
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

export const AWAITING_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'PENDING'] as const

export function RiskDecisionButtons({
  risk,
  compact,
  layout = 'row',
  onError,
}: {
  risk: Row
  compact?: boolean
  layout?: 'row' | 'footer'
  /** Called with the server's message when a decision fails (e.g. the self-approval rule), so callers can show it inline. */
  onError?: (message: string | null) => void
}) {
  const { hasPermission } = useAuth()
  const confirm = useConfirm()
  const update = useUpdateRow(RISK_TABLE)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState<string | null>(null)
  const status = String(risk.approval_status ?? 'DRAFT').toUpperCase()
  const id = risk.uuid ?? risk.id
  const label = String(risk.risk_statement ?? `Risk ${id}`).slice(0, 120)
  const canApprove = hasPermission('approve')
  const editable = hasPermission('update') && (status === 'DRAFT' || status === 'REJECTED')
  const awaiting = (AWAITING_STATUSES as readonly string[]).includes(status)
  const undecided = status !== 'APPROVED' && status !== 'REJECTED'

  // Legacy row layout: approvers decide any undecided row; others submit drafts.
  const showSubmit = layout === 'footer' ? editable : editable && !canApprove
  const showDecide = layout === 'footer' ? canApprove && awaiting : canApprove && undecided

  async function setStatus(approval_status: string, extra: Row = {}, msg: string) {
    onError?.(null)
    try {
      await update.mutateAsync({ id, values: { approval_status, ...extra } })
      toast.success(msg)
      return true
    } catch (err) {
      const m = apiErrorMessage(err)
      toast.error(m)
      onError?.(m)
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
      setCommentError('Give the reason for rejecting. The maker sees it with the risk.')
      return
    }
    if (await setStatus('REJECTED', { approver_comments: comment.trim() }, 'Risk rejected')) {
      setRejectOpen(false)
      setComment('')
    }
  }

  const footer = layout === 'footer'
  const size = footer ? 'default' : compact ? 'sm' : 'default'
  return (
    <>
      {showSubmit && (
        <Button size={size} variant={footer ? 'primary' : 'secondary'} disabled={update.isPending} onClick={() => setStatus('SUBMITTED', {}, 'Submitted for approval')}>
          <Send aria-hidden="true" />
          {footer ? 'Submit for approval' : 'Submit'}
        </Button>
      )}
      {showDecide && (
        <>
          <Button
            size={size}
            variant="secondary"
            disabled={update.isPending}
            onClick={() => {
              setCommentError(null)
              setRejectOpen(true)
            }}
          >
            <X aria-hidden="true" />
            Reject
          </Button>
          <Button size={size} variant={footer ? 'primary' : 'secondary'} disabled={update.isPending} onClick={approve}>
            <Check aria-hidden="true" />
            Approve
          </Button>
        </>
      )}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject risk</DialogTitle>
            <DialogDescription>{label}</DialogDescription>
          </DialogHeader>
          <form onSubmit={reject} noValidate className="space-y-4">
            <Field id={`reject-comment-${id}`} label="Reason" required error={commentError ?? undefined} hint="Required. It is stored with the risk and in the audit trail.">
              <textarea
                id={`reject-comment-${id}`}
                rows={4}
                value={comment}
                onChange={e => setComment(e.target.value)}
                className={textareaClass}
                aria-invalid={!!commentError || undefined}
                aria-describedby={commentError ? `reject-comment-${id}-error` : undefined}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={update.isPending}>
                Reject risk
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
