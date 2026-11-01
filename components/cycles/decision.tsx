'use client'

/**
 * Compact submit / approve / reject for one risk row in a cycle (same rules as the register's
 * RiskDecisionButtons): approvers decide undecided risks; others may submit a Draft or Rejected risk.
 * Rejecting needs a reason. Icon buttons with tooltips and aria-labels keep the row calm.
 */
import React, { useState } from 'react'
import { toast } from 'sonner'
import { Check, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { useUpdateRow, type Row } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { RISK_TABLE } from '@/components/rcsa/risk-dialog'
import { FormField, describedBy } from './form'

function IconAction({ label, onClick, disabled, children, className }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="secondary" size="icon" className={`size-8 ${className ?? ''}`} aria-label={label} disabled={disabled} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label.split(':')[0]}</TooltipContent>
    </Tooltip>
  )
}

export function CycleRiskDecision({ risk }: { risk: Row }) {
  const { hasPermission } = useAuth()
  const confirm = useConfirm()
  const update = useUpdateRow(RISK_TABLE)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState<string | undefined>()
  const status = String(risk.approval_status ?? 'DRAFT').toUpperCase()
  const id = risk.uuid ?? risk.id
  const label = String(risk.risk_statement ?? `risk ${id}`).slice(0, 80)
  const canApprove = hasPermission('approve')
  const canSubmit = hasPermission('update') && (status === 'DRAFT' || status === 'REJECTED')
  const undecided = status !== 'APPROVED' && status !== 'REJECTED'

  async function setStatus(approval_status: string, extra: Row, msg: string) {
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

  if (!(canApprove && undecided) && !(canSubmit && !canApprove)) return null

  return (
    <>
      {canSubmit && !canApprove && (
        <IconAction label={`Submit for approval: ${label}`} disabled={update.isPending} onClick={() => setStatus('SUBMITTED', {}, 'Submitted for review')}>
          <Send aria-hidden="true" />
        </IconAction>
      )}
      {canApprove && undecided && (
        <span className="inline-flex items-center gap-1">
          <IconAction label={`Approve: ${label}`} disabled={update.isPending} onClick={approve} className="hover:text-status-success-fg">
            <Check aria-hidden="true" />
          </IconAction>
          <IconAction
            label={`Reject: ${label}`}
            disabled={update.isPending}
            className="hover:text-status-danger-fg"
            onClick={() => {
              setCommentError(undefined)
              setRejectOpen(true)
            }}
          >
            <X aria-hidden="true" />
          </IconAction>
        </span>
      )}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject risk</DialogTitle>
            <DialogDescription>{label}</DialogDescription>
          </DialogHeader>
          <form onSubmit={reject} noValidate className="space-y-5">
            <FormField id={`reject-comment-${id}`} label="Reason" required error={commentError} hint="The owner sees this reason and can resubmit.">
              <Textarea
                id={`reject-comment-${id}`}
                rows={3}
                value={comment}
                onChange={e => setComment(e.target.value)}
                aria-invalid={!!commentError || undefined}
                aria-describedby={describedBy(`reject-comment-${id}`, commentError, true)}
              />
            </FormField>
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
