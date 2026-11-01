'use client'

/**
 * Maker–checker approvals, enforced server-side by /api/workflow.
 * The server decides who may act on each request (can_decide / blocked_reason);
 * this page only shows that decision and never hides why an action is unavailable.
 */
import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Check, Plus, Trash2, Undo2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DataState } from '@/components/data-state'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { workflowApi, apiErrorMessage, type ApiWorkflowItem, type ApiWorkflowStep } from '@/lib/apiClient'
import { useOrgSettings } from '@/lib/settings'
import { DASH, formatDate, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

type Tab = 'to-decide' | 'submitted' | 'all'
type ApproverRole = ApiWorkflowStep['approver_role']
type RequestType = NonNullable<ApiWorkflowItem['request_type']>

const TABS: { id: Tab; label: string }[] = [
  { id: 'to-decide', label: 'Waiting for me' },
  { id: 'submitted', label: 'My requests' },
  { id: 'all', label: 'All' },
]
const REQUEST_TYPES: RequestType[] = ['Risk Assessment', 'Mitigation Plan', 'Control Change', 'Policy Update', 'Risk Acceptance']
const APPROVER_ROLES: ApproverRole[] = ['Risk Manager', 'Administrator']
const OPEN_STATUSES = new Set(['Pending', 'In Review'])

const STATUS_TONE: Record<ApiWorkflowItem['status'], string> = {
  Pending: 'bg-amber-50 text-amber-800 border-amber-200',
  'In Review': 'bg-blue-50 text-blue-800 border-blue-200',
  Approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Rejected: 'bg-red-50 text-red-800 border-red-200',
  Withdrawn: 'bg-slate-50 text-slate-600 border-slate-200',
}

export function WorkflowPage() {
  const { hasPermission, user } = useAuth()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [tab, setTab] = useState<Tab>('to-decide')
  const [submitOpen, setSubmitOpen] = useState(false)
  const [rejecting, setRejecting] = useState<ApiWorkflowItem | null>(null)

  const query = useQuery({
    queryKey: ['workflow', tab],
    queryFn: () => workflowApi.list(tab === 'all' ? {} : { mine: tab }),
  })
  const items = query.data?.items ?? []

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['workflow'] })

  const decide = useMutation({
    mutationFn: (v: { id: number; decision: 'Approved' | 'Rejected'; comment?: string }) => workflowApi.decide(v.id, v.decision, v.comment),
    onSuccess: (item, v) => {
      toast.success(`${v.decision} — ${item.title ?? `request #${item.uuid}`}`)
      return invalidate()
    },
    onError: err => toast.error(apiErrorMessage(err)),
  })

  const withdraw = useMutation({
    mutationFn: (id: number) => workflowApi.withdraw(id),
    onSuccess: item => {
      toast.success(`Withdrawn — ${item.title ?? `request #${item.uuid}`}`)
      return invalidate()
    },
    onError: err => toast.error(apiErrorMessage(err)),
  })

  const onApprove = (item: ApiWorkflowItem) => decide.mutate({ id: item.uuid, decision: 'Approved' })

  const onWithdraw = async (item: ApiWorkflowItem) => {
    const ok = await confirm({
      title: 'Withdraw this request?',
      description: `"${item.title ?? `Request #${item.uuid}`}" will be closed as Withdrawn and can no longer be approved.`,
      confirmLabel: 'Withdraw',
      tone: 'danger',
    })
    if (ok) withdraw.mutate(item.uuid)
  }

  const myEmail = user?.email?.toLowerCase()

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Workflow &amp; maker–checker approvals</h1>
          <p className="text-xs text-slate-500">
            Ordered approval chains. You can never approve a request you submitted, and each step needs a different approver.
          </p>
        </div>
        {hasPermission('create') && (
          <Button onClick={() => setSubmitOpen(true)} size="sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            Submit request
          </Button>
        )}
      </div>

      <div role="tablist" aria-label="Request filter" className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-2.5 py-1 rounded text-xs transition-colors',
              tab === t.id ? 'bg-white font-medium text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <DataState
        query={query}
        empty={items.length === 0}
        emptyTitle={tab === 'to-decide' ? 'Nothing is waiting for your decision' : tab === 'submitted' ? 'You have not submitted any requests' : 'No approval requests yet'}
        emptyAction={
          tab !== 'to-decide' && hasPermission('create') ? (
            <Button size="sm" variant="outline" onClick={() => setSubmitOpen(true)}>
              Submit a request
            </Button>
          ) : undefined
        }
      >
        <ul className="space-y-3">
          {items.map(item => (
            <RequestCard
              key={item.uuid}
              item={item}
              isMine={!!myEmail && item.submitted_by.toLowerCase() === myEmail}
              busy={decide.isPending || withdraw.isPending}
              onApprove={() => onApprove(item)}
              onReject={() => setRejecting(item)}
              onWithdraw={() => onWithdraw(item)}
            />
          ))}
        </ul>
      </DataState>

      <SubmitDialog open={submitOpen} onOpenChange={setSubmitOpen} onSubmitted={invalidate} />

      <RejectDialog
        key={rejecting?.uuid ?? 'none'}
        item={rejecting}
        busy={decide.isPending}
        onCancel={() => setRejecting(null)}
        onReject={comment => {
          if (!rejecting) return
          decide.mutate({ id: rejecting.uuid, decision: 'Rejected', comment }, { onSuccess: () => setRejecting(null) })
        }}
      />
    </div>
  )
}

function RequestCard({
  item,
  isMine,
  busy,
  onApprove,
  onReject,
  onWithdraw,
}: {
  item: ApiWorkflowItem
  isMine: boolean
  busy: boolean
  onApprove: () => void
  onReject: () => void
  onWithdraw: () => void
}) {
  const { money } = useOrgSettings()
  const open = OPEN_STATUSES.has(item.status)
  const blockedId = `wf-blocked-${item.uuid}`

  return (
    <li className="p-4 bg-white rounded border border-slate-200 space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-slate-400">#{item.uuid}</span>
            {item.request_type && (
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 rounded border border-slate-200">{item.request_type}</span>
            )}
            {item.business_unit && <span className="text-[10px] text-slate-500">{item.business_unit}</span>}
            <span className={cn('text-[10px] px-1.5 rounded border font-medium', STATUS_TONE[item.status])}>{item.status}</span>
          </div>
          <h3 className="text-sm font-semibold text-slate-900 mt-1">{item.title ?? DASH}</h3>
          <p className="text-[11px] text-slate-500">
            Submitted by {item.submitted_name || item.submitted_by || DASH} on {formatDate(item.submitted_on)}
            {item.closed_on ? ` · closed ${formatDate(item.closed_on)}` : ''}
            {item.amount != null ? ` · amount ${money(item.amount)}` : ''}
          </p>
          {item.details && <p className="text-xs text-slate-700 mt-2 whitespace-pre-wrap">{item.details}</p>}
        </div>

        {open && (
          <div className="flex flex-col items-start lg:items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                onClick={onApprove}
                disabled={!item.can_decide || busy}
                aria-describedby={!item.can_decide && item.blocked_reason ? blockedId : undefined}
                className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                <Check className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onReject}
                disabled={!item.can_decide || busy}
                aria-describedby={!item.can_decide && item.blocked_reason ? blockedId : undefined}
                className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50"
              >
                <X className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Reject
              </Button>
              {isMine && (
                <Button size="sm" variant="outline" onClick={onWithdraw} disabled={busy} className="h-7 text-xs">
                  <Undo2 className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Withdraw
                </Button>
              )}
            </div>
            {!item.can_decide && item.blocked_reason && (
              <p id={blockedId} className="text-[11px] text-slate-500 max-w-xs lg:text-right">
                {item.blocked_reason}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-slate-100">
        <p className="text-[11px] font-medium text-slate-500 mb-1.5">Approval chain</p>
        {item.steps.length === 0 ? (
          <p className="text-[11px] text-slate-400">No approval steps recorded.</p>
        ) : (
          <ol className="space-y-1.5">
            {item.steps.map(step => (
              <li
                key={step.uuid}
                className={cn(
                  'flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded border px-2 py-1.5 text-[11px]',
                  step.decision === 'Approved'
                    ? 'bg-emerald-50 border-emerald-200'
                    : step.decision === 'Rejected'
                      ? 'bg-red-50 border-red-200'
                      : open && item.next_step === step.step_no
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-slate-50 border-slate-200',
                )}
              >
                <span className="font-semibold text-slate-700">Step {step.step_no}</span>
                <span className="text-slate-600">{step.approver_role}</span>
                <span
                  className={cn(
                    'font-medium',
                    step.decision === 'Approved' ? 'text-emerald-800' : step.decision === 'Rejected' ? 'text-red-800' : 'text-slate-500',
                  )}
                >
                  {step.decision ?? (open && item.next_step === step.step_no ? 'Awaiting decision' : 'Not yet decided')}
                </span>
                {step.decision && (
                  <span className="text-slate-500">
                    by {step.decided_name || step.decided_by || DASH} · {formatDateTime(step.decided_on)}
                  </span>
                )}
                {step.comments && <span className="basis-full text-slate-700">“{step.comments}”</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </li>
  )
}

interface Draft {
  title: string
  request_type: RequestType
  business_unit: string
  amount: string
  details: string
  approver_roles: ApproverRole[]
}

const EMPTY_DRAFT: Draft = { title: '', request_type: 'Risk Assessment', business_unit: '', amount: '', details: '', approver_roles: ['Risk Manager'] }

function validate(d: Draft): Partial<Record<keyof Draft, string>> {
  const errors: Partial<Record<keyof Draft, string>> = {}
  const title = d.title.trim()
  if (title.length < 3) errors.title = 'Enter a title of at least 3 characters.'
  else if (title.length > 300) errors.title = 'Keep the title under 300 characters.'
  if (d.business_unit.trim().length > 100) errors.business_unit = 'Keep the business unit under 100 characters.'
  if (d.amount.trim() !== '') {
    const n = Number(d.amount)
    if (!Number.isFinite(n) || n < 0) errors.amount = 'Enter a positive number, or leave it empty.'
  }
  if (d.details.trim().length > 4000) errors.details = 'Keep the details under 4000 characters.'
  if (d.approver_roles.length < 1 || d.approver_roles.length > 3) errors.approver_roles = 'Choose between 1 and 3 approval steps.'
  return errors
}

function SubmitDialog({ open, onOpenChange, onSubmitted }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmitted: () => unknown }) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [touched, setTouched] = useState(false)
  const errors = validate(draft)
  const shown = touched ? errors : {}

  const submit = useMutation({
    mutationFn: () =>
      workflowApi.submit({
        title: draft.title.trim(),
        request_type: draft.request_type,
        business_unit: draft.business_unit.trim() || undefined,
        amount: draft.amount.trim() === '' ? undefined : Number(draft.amount),
        details: draft.details.trim() || undefined,
        approver_roles: draft.approver_roles,
      }),
    onSuccess: item => {
      toast.success(`Submitted for approval — ${item.title ?? `request #${item.uuid}`}`)
      setDraft(EMPTY_DRAFT)
      setTouched(false)
      onOpenChange(false)
      return onSubmitted()
    },
    onError: err => toast.error(apiErrorMessage(err)),
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(errors).length) return
    submit.mutate()
  }

  const setRole = (i: number, role: ApproverRole) =>
    setDraft(d => ({ ...d, approver_roles: d.approver_roles.map((r, j) => (j === i ? role : r)) }))
  const move = (i: number, dir: -1 | 1) =>
    setDraft(d => {
      const roles = [...d.approver_roles]
      const j = i + dir
      if (j < 0 || j >= roles.length) return d
      ;[roles[i], roles[j]] = [roles[j]!, roles[i]!]
      return { ...d, approver_roles: roles }
    })
  const remove = (i: number) => setDraft(d => ({ ...d, approver_roles: d.approver_roles.filter((_, j) => j !== i) }))
  const add = () =>
    setDraft(d => (d.approver_roles.length >= 3 ? d : { ...d, approver_roles: [...d.approver_roles, d.approver_roles.at(-1) === 'Risk Manager' ? 'Administrator' : 'Risk Manager'] }))

  const field = 'block text-xs font-medium text-slate-700 mb-1'
  const err = (k: keyof Draft) =>
    shown[k] ? (
      <p id={`wf-${k}-error`} className="mt-1 text-[11px] text-red-600">
        {shown[k]}
      </p>
    ) : null

  return (
    <Dialog
      open={open}
      onOpenChange={o => {
        if (!o) setTouched(false)
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit a request for approval</DialogTitle>
          <DialogDescription>Each step is decided, in order, by someone with that role. You cannot approve your own request.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-3 text-xs">
          <div>
            <label htmlFor="wf-title" className={field}>
              Title *
            </label>
            <Input
              id="wf-title"
              value={draft.title}
              onChange={e => setDraft({ ...draft, title: e.target.value })}
              aria-invalid={!!shown.title}
              aria-describedby={shown.title ? 'wf-title-error' : undefined}
              className="h-8 text-xs"
            />
            {err('title')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="wf-type" className={field}>
                Request type *
              </label>
              <select
                id="wf-type"
                value={draft.request_type}
                onChange={e => setDraft({ ...draft, request_type: e.target.value as RequestType })}
                className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white"
              >
                {REQUEST_TYPES.map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="wf-bu" className={field}>
                Business unit
              </label>
              <Input
                id="wf-bu"
                value={draft.business_unit}
                onChange={e => setDraft({ ...draft, business_unit: e.target.value })}
                aria-invalid={!!shown.business_unit}
                aria-describedby={shown.business_unit ? 'wf-business_unit-error' : undefined}
                className="h-8 text-xs"
              />
              {err('business_unit')}
            </div>
          </div>
          <div>
            <label htmlFor="wf-amount" className={field}>
              Amount (optional)
            </label>
            <Input
              id="wf-amount"
              type="number"
              min={0}
              inputMode="decimal"
              value={draft.amount}
              onChange={e => setDraft({ ...draft, amount: e.target.value })}
              aria-invalid={!!shown.amount}
              aria-describedby={shown.amount ? 'wf-amount-error' : undefined}
              className="h-8 text-xs"
            />
            {err('amount')}
          </div>
          <div>
            <label htmlFor="wf-details" className={field}>
              Details
            </label>
            <Textarea
              id="wf-details"
              rows={3}
              value={draft.details}
              onChange={e => setDraft({ ...draft, details: e.target.value })}
              aria-invalid={!!shown.details}
              aria-describedby={shown.details ? 'wf-details-error' : undefined}
              className="text-xs"
            />
            {err('details')}
          </div>
          <fieldset>
            <legend className={field}>Approval steps (in order, 1–3) *</legend>
            <ol className="space-y-1.5">
              {draft.approver_roles.map((role, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <label htmlFor={`wf-step-${i}`} className="w-12 text-[11px] text-slate-500">
                    Step {i + 1}
                  </label>
                  <select
                    id={`wf-step-${i}`}
                    value={role}
                    onChange={e => setRole(i, e.target.value as ApproverRole)}
                    className="flex-1 h-8 px-2 border border-slate-200 rounded text-xs bg-white"
                  >
                    {APPROVER_ROLES.map(r => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                  <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move step ${i + 1} up`}>
                    <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => move(i, 1)}
                    disabled={i === draft.approver_roles.length - 1}
                    aria-label={`Move step ${i + 1} down`}
                  >
                    <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => remove(i)}
                    disabled={draft.approver_roles.length <= 1}
                    aria-label={`Remove step ${i + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ol>
            {draft.approver_roles.length < 3 && (
              <Button type="button" size="sm" variant="ghost" className="mt-1.5 h-7 text-xs" onClick={add}>
                <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Add step
              </Button>
            )}
            {err('approver_roles')}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submit.isPending}>
              {submit.isPending ? 'Submitting…' : 'Submit request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RejectDialog({
  item,
  busy,
  onCancel,
  onReject,
}: {
  item: ApiWorkflowItem | null
  busy: boolean
  onCancel: () => void
  onReject: (comment: string) => void
}) {
  const [comment, setComment] = useState('')
  const [touched, setTouched] = useState(false)
  const error = comment.trim() === '' ? 'A comment is required when rejecting.' : comment.trim().length > 2000 ? 'Keep the comment under 2000 characters.' : null

  const close = () => {
    setComment('')
    setTouched(false)
    onCancel()
  }

  return (
    <Dialog open={item !== null} onOpenChange={o => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject request</DialogTitle>
          <DialogDescription>{item?.title ?? ''} — tell the submitter why, so they can fix and resubmit.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={e => {
            e.preventDefault()
            setTouched(true)
            if (error) return
            onReject(comment.trim())
          }}
          className="space-y-3"
        >
          <div>
            <label htmlFor="wf-reject-comment" className="block text-xs font-medium text-slate-700 mb-1">
              Reason for rejection *
            </label>
            <Textarea
              id="wf-reject-comment"
              rows={4}
              value={comment}
              onChange={e => setComment(e.target.value)}
              aria-invalid={touched && !!error}
              aria-describedby={touched && error ? 'wf-reject-error' : undefined}
              className="text-xs"
            />
            {touched && error && (
              <p id="wf-reject-error" className="mt-1 text-[11px] text-red-600">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="destructive" disabled={busy}>
              {busy ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
