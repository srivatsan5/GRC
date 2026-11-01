'use client'

/**
 * Approvals inbox — maker–checker approvals, enforced server-side by /api/workflow.
 * The server decides who may act on each request (can_decide / blocked_reason); this page only shows
 * that decision and never hides why an action is unavailable.
 * Desktop (≥1280 px): list + detail panes. Below that: full request cards with large touch targets.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ClipboardCheck,
  Clock,
  FileCog,
  FileText,
  Info,
  Plus,
  Send,
  ShieldCheck,
  ShieldQuestion,
  Trash2,
  Undo2,
  Wallet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DataState, EmptyState } from '@/components/data-state'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { ApprovalBadge, Chip, Facts, FilterChip, PageHeader, Person, ViewTabs } from '@/components/charter/primitives'
import { Field, FieldError, Select, invalid } from '@/components/governance/form'
import { workflowApi, apiErrorMessage, type ApiWorkflowItem, type ApiWorkflowStep } from '@/lib/apiClient'
import { useOrgSettings } from '@/lib/settings'
import { DASH, formatDate, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

type Tab = 'to-decide' | 'submitted' | 'all'
type ApproverRole = ApiWorkflowStep['approver_role']
type RequestType = NonNullable<ApiWorkflowItem['request_type']>

const REQUEST_TYPES: RequestType[] = ['Risk Assessment', 'Mitigation Plan', 'Control Change', 'Policy Update', 'Risk Acceptance']
const APPROVER_ROLES: ApproverRole[] = ['Risk Manager', 'Administrator']
const OPEN_STATUSES = new Set(['Pending', 'In Review'])
const STATUSES: ApiWorkflowItem['status'][] = ['Pending', 'In Review', 'Approved', 'Rejected', 'Withdrawn']

const TYPE_ICON: Record<RequestType, React.ComponentType<{ className?: string }>> = {
  'Risk Assessment': ClipboardCheck,
  'Mitigation Plan': ShieldCheck,
  'Control Change': FileCog,
  'Policy Update': FileText,
  'Risk Acceptance': ShieldQuestion,
}

const shortDate = (d: string | null | undefined) => formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' })

/** True on desktop widths, where the inbox shows list + detail side by side. */
function useIsWide(query = '(min-width: 1280px)') {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setWide(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return wide
}

function TypeChip({ type }: { type: ApiWorkflowItem['request_type'] }) {
  if (!type) return null
  return (
    <Chip tone="neutral" icon={TYPE_ICON[type] ?? FileText}>
      {type}
    </Chip>
  )
}

const stepLabel = (item: ApiWorkflowItem) =>
  item.steps.length === 0 ? 'No steps' : OPEN_STATUSES.has(item.status) && item.next_step ? `Step ${item.next_step} of ${item.steps.length}` : `${item.steps.length} step${item.steps.length === 1 ? '' : 's'}`

export function WorkflowPage() {
  const { hasPermission, user } = useAuth()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const router = useRouter()
  const params = useSearchParams()
  const wide = useIsWide()
  const canApprove = hasPermission('approve')
  const canCreate = hasPermission('create')
  const [tab, setTab] = useState<Tab>(() => (canApprove ? 'to-decide' : canCreate ? 'submitted' : 'all'))
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [rejecting, setRejecting] = useState<ApiWorkflowItem | null>(null)

  // ?new=1 (from the ⌘K palette) opens the submit dialog, then the param is cleared.
  const wantsNew = params.get('new') === '1'
  useEffect(() => {
    if (!wantsNew) return
    if (canCreate) setSubmitOpen(true)
    router.replace('/workflow', { scroll: false })
  }, [wantsNew, canCreate, router])

  const toDecideQ = useQuery({ queryKey: ['workflow', 'to-decide'], queryFn: () => workflowApi.list({ mine: 'to-decide' }) })
  const submittedQ = useQuery({ queryKey: ['workflow', 'submitted'], queryFn: () => workflowApi.list({ mine: 'submitted' }) })
  const allQ = useQuery({ queryKey: ['workflow', 'all'], queryFn: () => workflowApi.list({}) })
  const query = tab === 'to-decide' ? toDecideQ : tab === 'submitted' ? submittedQ : allQ

  const tabItems = useMemo(() => query.data?.items ?? [], [query.data])
  const items = useMemo(
    () => tabItems.filter(i => (!statusFilter || i.status === statusFilter) && (!typeFilter || i.request_type === typeFilter)),
    [tabItems, statusFilter, typeFilter],
  )
  const selected = items.find(i => i.uuid === selectedId) ?? items[0] ?? null

  const all = allQ.data?.items ?? []
  const summary = {
    open: all.filter(i => OPEN_STATUSES.has(i.status)).length,
    approved: all.filter(i => i.status === 'Approved').length,
    rejected: all.filter(i => i.status === 'Rejected').length,
    withdrawn: all.filter(i => i.status === 'Withdrawn').length,
  }

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
  const isMine = (item: ApiWorkflowItem) => !!myEmail && item.submitted_by.toLowerCase() === myEmail
  const busy = decide.isPending || withdraw.isPending
  const count = (q: typeof allQ) => (q.data ? q.data.items.length : null)
  const filtering = !!statusFilter || !!typeFilter

  const detailProps = (item: ApiWorkflowItem) => ({
    item,
    isMine: isMine(item),
    busy,
    onApprove: () => onApprove(item),
    onReject: () => setRejecting(item),
    onWithdraw: () => onWithdraw(item),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Controls & policy · Maker–checker"
        title="Approvals"
        description="Ordered approval chains. Nobody approves their own request, and each step needs a different approver."
        actions={
          canCreate ? (
            <Button onClick={() => setSubmitOpen(true)}>
              <Plus aria-hidden="true" />
              Submit request
            </Button>
          ) : undefined
        }
      />

      {allQ.data && (
        <p className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-body-sm text-muted-foreground">
          <span>
            <span className="figure mr-1.5 text-figure-sm text-primary">{count(toDecideQ) ?? DASH}</span>
            waiting for you
          </span>
          <span>
            <span className="figure mr-1.5 text-figure-sm text-foreground">{summary.open}</span>
            open
          </span>
          <span>
            <span className="figure mr-1.5 text-figure-sm text-foreground">{summary.approved}</span>
            approved
          </span>
          <span>
            <span className="figure mr-1.5 text-figure-sm text-foreground">{summary.rejected}</span>
            rejected{summary.withdrawn ? ` · ${summary.withdrawn} withdrawn` : ''}
          </span>
        </p>
      )}

      <div className="space-y-3">
        <ViewTabs<Tab>
          label="Requests"
          value={tab}
          onChange={t => {
            setTab(t)
            setSelectedId(null)
          }}
          views={[
            { value: 'to-decide', label: 'Waiting for me', count: count(toDecideQ) },
            { value: 'submitted', label: 'My requests', count: count(submittedQ) },
            { value: 'all', label: 'All', count: count(allQ) },
          ]}
        />
        <div className={cn('flex flex-wrap items-center gap-2', tabItems.length === 0 && !filtering && 'hidden')}>
          <FilterChip label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUSES.map(s => ({ value: s, label: s }))} />
          <FilterChip label="Type" value={typeFilter} onChange={setTypeFilter} options={REQUEST_TYPES.map(t => ({ value: t, label: t }))} />
          {filtering && (
            <Button
              variant="ghost"
              className="h-8 px-2.5"
              onClick={() => {
                setStatusFilter('')
                setTypeFilter('')
              }}
            >
              Clear
            </Button>
          )}
          {query.data && (
            <span className="ml-auto text-caption text-muted-foreground tabular-nums">
              {items.length} of {tabItems.length} request{tabItems.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      <DataState
        query={query}
        empty={tabItems.length === 0}
        emptyTitle={tab === 'to-decide' ? 'Nothing is waiting for your decision' : tab === 'submitted' ? 'You haven’t submitted any requests' : 'No approval requests yet'}
        emptyDescription={
          tab === 'to-decide'
            ? 'Requests that need your role at their current step appear here.'
            : canCreate
              ? 'Submit a request to route it through an ordered approval chain.'
              : 'Requests submitted by your colleagues appear here.'
        }
        emptyAction={
          tab !== 'to-decide' && canCreate ? (
            <Button onClick={() => setSubmitOpen(true)}>
              <Plus aria-hidden="true" />
              Submit a request
            </Button>
          ) : undefined
        }
      >
        {items.length === 0 ? (
          <div className="surface-panel">
            <EmptyState title="No requests match these filters" description="Clear the status or type filter to see every request in this view." compact />
          </div>
        ) : wide ? (
          <div className="grid grid-cols-[minmax(340px,420px)_minmax(0,1fr)] items-start gap-6">
            <section aria-label="Requests" className="surface-panel overflow-hidden">
              <ul role="listbox" aria-label="Requests" className="divide-y">
                {items.map(item => (
                  <RequestRow key={item.uuid} item={item} selected={selected?.uuid === item.uuid} onSelect={() => setSelectedId(item.uuid)} />
                ))}
              </ul>
            </section>
            {selected && (
              <div className="sticky top-4">
                <RequestDetail key={selected.uuid} {...detailProps(selected)} />
              </div>
            )}
          </div>
        ) : (
          <ul className="space-y-4">
            {items.map(item => (
              <li key={item.uuid}>
                <RequestDetail {...detailProps(item)} />
              </li>
            ))}
          </ul>
        )}
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

/** A quiet list row (dashboard "Approvals waiting for you" language). */
function RequestRow({ item, selected, onSelect }: { item: ApiWorkflowItem; selected: boolean; onSelect: () => void }) {
  const { money } = useOrgSettings()
  return (
    <li role="option" aria-selected={selected}>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 px-5 py-3.5 text-left transition-colors duration-(--duration-fast) ease-out focus-ring',
          selected ? 'bg-accent shadow-[inset_3px_0_0_var(--primary)]' : 'hover:bg-hover',
        )}
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            {item.can_decide && <span aria-label="Waiting for your decision" className="size-2 shrink-0 rounded-full bg-primary" />}
            <span className="truncate font-medium text-foreground" title={item.title ?? undefined}>
              {item.title ?? `Request #${item.uuid}`}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-caption text-muted-foreground tabular-nums">
            <span className="font-mono">#{item.uuid}</span> · {stepLabel(item)} · {item.submitted_name || item.submitted_by || DASH} · {shortDate(item.submitted_on)}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <ApprovalBadge status={item.status} />
          {item.amount != null && <span className="text-caption text-foreground-secondary tabular-nums">{money(item.amount, { compact: true })}</span>}
        </span>
      </button>
    </li>
  )
}

function RequestDetail({
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
  const titleId = `wf-title-${item.uuid}`
  const currentStep = item.steps.find(s => s.step_no === item.next_step)

  return (
    <article aria-labelledby={titleId} className={cn('surface-panel flex min-w-0 flex-col', item.can_decide && 'shadow-[inset_0_0_0_1px_var(--primary),var(--elevation-panel)]')}>
      <header className="space-y-3 px-5 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-caption text-muted-foreground">#{item.uuid}</span>
          <TypeChip type={item.request_type} />
          <ApprovalBadge status={item.status} />
          {item.can_decide && (
            <Chip tone="info" icon={Clock} className="bg-primary/8 text-primary">
              Your decision
            </Chip>
          )}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <h2 id={titleId} className="min-w-0 flex-1 font-display text-section text-foreground">
            {item.title ?? `Request #${item.uuid}`}
          </h2>
          {item.amount != null && (
            <div className="text-right">
              <p className="label-caps">Amount</p>
              <p className="figure text-figure-sm text-foreground">{money(item.amount)}</p>
            </div>
          )}
        </div>
      </header>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <Facts
          className="grid-cols-[104px_minmax(0,1fr)] sm:grid-cols-[120px_minmax(0,1fr)]"
          items={[
            { label: 'Submitted by', value: <Person name={item.submitted_name || item.submitted_by || null} detail={item.submitted_name ? item.submitted_by : undefined} /> },
            { label: 'Submitted', value: formatDate(item.submitted_on) },
            { label: 'Business unit', value: item.business_unit || DASH },
            ...(item.closed_on ? [{ label: 'Closed', value: formatDateTime(item.closed_on) }] : []),
          ]}
        />
        {item.details && <p className="rounded-md bg-surface-sunken px-4 py-3 text-body-sm whitespace-pre-wrap text-foreground-secondary shadow-[inset_0_0_0_1px_var(--border)]">{item.details}</p>}

        <section aria-labelledby={`wf-chain-${item.uuid}`} className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id={`wf-chain-${item.uuid}`} className="label-caps">
              Approval chain
            </h3>
            <span className="text-caption text-muted-foreground tabular-nums">{stepLabel(item)}</span>
          </div>
          <Timeline item={item} />
        </section>
      </div>

      {open && (
        <footer className="mt-auto space-y-3 border-t px-5 py-4 sm:px-6">
          {item.can_decide ? (
            <p className="text-caption text-muted-foreground">
              Deciding step {item.next_step} of {item.steps.length}
              {currentStep ? ` as ${currentStep.approver_role}` : ''}. Rejecting needs a reason for the submitter.
            </p>
          ) : (
            item.blocked_reason && (
              <p id={blockedId} className="flex items-start gap-2 rounded-md bg-surface-sunken px-3 py-2.5 text-body-sm text-foreground-secondary">
                <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {item.blocked_reason}
              </p>
            )
          )}
          {(item.can_decide || isMine) && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              {isMine && (
                <Button variant="ghost" onClick={onWithdraw} disabled={busy} className="h-11 sm:mr-auto sm:h-control">
                  <Undo2 aria-hidden="true" />
                  Withdraw request
                </Button>
              )}
              {item.can_decide && (
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button variant="secondary" onClick={onReject} disabled={busy} className="h-11 text-status-danger-fg sm:h-control">
                    <X aria-hidden="true" />
                    Reject
                  </Button>
                  <Button onClick={onApprove} disabled={busy} className="h-11 sm:h-control">
                    <Check aria-hidden="true" />
                    Approve
                  </Button>
                </div>
              )}
            </div>
          )}
        </footer>
      )}
    </article>
  )
}

/** Vertical ordered-steps timeline: submitted → each step (numbered) → outcome. The open step is highlighted. */
function Timeline({ item }: { item: ApiWorkflowItem }) {
  const open = OPEN_STATUSES.has(item.status)
  const closedEarly = !open
  type Node = { key: string; node: React.ReactNode; tone: string; body: React.ReactNode; current?: boolean }
  const nodes: Node[] = [
    {
      key: 'submitted',
      tone: 'bg-card text-muted-foreground shadow-[inset_0_0_0_1px_var(--border-strong)]',
      node: <Send className="size-3.5" aria-hidden="true" />,
      body: (
        <>
          <p className="text-body-sm font-medium text-foreground">Submitted</p>
          <p className="text-caption text-muted-foreground">
            {item.submitted_name || item.submitted_by || DASH} · {formatDate(item.submitted_on)}
          </p>
        </>
      ),
    },
    ...item.steps.map<Node>(step => {
      const current = open && item.next_step === step.step_no
      const tone =
        step.decision === 'Approved'
          ? 'bg-status-success-bg text-status-success-fg shadow-[inset_0_0_0_1px_var(--status-success)]'
          : step.decision === 'Rejected'
            ? 'bg-status-danger-bg text-status-danger-fg shadow-[inset_0_0_0_1px_var(--status-danger)]'
            : current
              ? 'bg-primary text-primary-foreground shadow-[0_0_0_4px_var(--selection)]'
              : 'bg-card text-muted-foreground shadow-[inset_0_0_0_1px_var(--border-strong)]'
      const node = step.decision === 'Approved' ? <Check className="size-3.5" aria-hidden="true" /> : step.decision === 'Rejected' ? <X className="size-3.5" aria-hidden="true" /> : <span className="text-caption font-semibold tabular-nums">{step.step_no}</span>
      return {
        key: String(step.uuid),
        tone,
        node,
        current,
        body: (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="text-body-sm font-medium text-foreground">
                <span className="sr-only">Step {step.step_no}: </span>
                {step.approver_role}
              </p>
              {step.decision === 'Approved' ? (
                <Chip tone="success" icon={Check}>
                  Approved
                </Chip>
              ) : step.decision === 'Rejected' ? (
                <Chip tone="danger" icon={X}>
                  Rejected
                </Chip>
              ) : current ? (
                <Chip tone="info" icon={Clock}>
                  Awaiting decision
                </Chip>
              ) : (
                <Chip tone="neutral" icon={null}>
                  {closedEarly ? 'Not reached' : 'Not yet decided'}
                </Chip>
              )}
            </div>
            <p className="text-caption text-muted-foreground">
              Step {step.step_no}
              {step.decision ? ` · ${step.decided_name || step.decided_by || DASH} · ${formatDateTime(step.decided_on)}` : current ? ' · waiting for a decision' : ''}
            </p>
            {step.comments && (
              <blockquote className="mt-2 rounded-md border-l-2 border-border-strong bg-surface-sunken px-3 py-2 text-body-sm text-foreground-secondary">“{step.comments}”</blockquote>
            )}
          </>
        ),
      }
    }),
  ]
  if (item.status === 'Withdrawn')
    nodes.push({
      key: 'withdrawn',
      tone: 'bg-muted text-muted-foreground shadow-[inset_0_0_0_1px_var(--border-strong)]',
      node: <Undo2 className="size-3.5" aria-hidden="true" />,
      body: (
        <>
          <p className="text-body-sm font-medium text-foreground">Withdrawn by the submitter</p>
          <p className="text-caption text-muted-foreground">{formatDateTime(item.closed_on)}</p>
        </>
      ),
    })

  if (item.steps.length === 0) return <p className="text-body-sm text-muted-foreground">No approval steps recorded.</p>

  return (
    <ol className="relative">
      {nodes.map((n, i) => (
        <li key={n.key} className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0">
          {i < nodes.length - 1 && <span aria-hidden="true" className="absolute top-8 bottom-1 left-[13.5px] w-px bg-border-strong" />}
          <span className={cn('relative z-[1] inline-flex size-7 items-center justify-center rounded-full', n.tone)}>{n.node}</span>
          <div className={cn('min-w-0 pt-0.5', n.current && '-mt-1.5 -mr-2 rounded-md bg-primary/8 px-3 pt-2 pb-2.5 shadow-[inset_0_0_0_1px_var(--selection)]')} aria-current={n.current ? 'step' : undefined}>
            {n.body}
          </div>
        </li>
      ))}
    </ol>
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

  const err = (k: keyof Draft) => shown[k]

  return (
    <Dialog
      open={open}
      onOpenChange={o => {
        if (!o) setTouched(false)
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Submit a request for approval</DialogTitle>
          <DialogDescription>Each step is decided, in order, by someone with that role. You can’t approve your own request.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field id="wf-title" label="Title" required error={err('title')}>
            <Input id="wf-title" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} {...invalid('wf-title', err('title'))} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="wf-type" label="Request type" required>
              <Select id="wf-type" value={draft.request_type} onChange={e => setDraft({ ...draft, request_type: e.target.value as RequestType })}>
                {REQUEST_TYPES.map(t => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field id="wf-business_unit" label="Business unit" error={err('business_unit')}>
              <Input id="wf-business_unit" value={draft.business_unit} onChange={e => setDraft({ ...draft, business_unit: e.target.value })} {...invalid('wf-business_unit', err('business_unit'))} />
            </Field>
          </div>
          <Field id="wf-amount" label="Amount" error={err('amount')} hint="Optional. Shown in the organisation’s currency.">
            <div className="relative sm:w-56">
              <Wallet className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="wf-amount"
                type="number"
                min={0}
                inputMode="decimal"
                className="pl-9 tabular-nums"
                value={draft.amount}
                onChange={e => setDraft({ ...draft, amount: e.target.value })}
                {...invalid('wf-amount', err('amount'))}
              />
            </div>
          </Field>
          <Field id="wf-details" label="Details" error={err('details')}>
            <Textarea id="wf-details" rows={3} value={draft.details} onChange={e => setDraft({ ...draft, details: e.target.value })} {...invalid('wf-details', err('details'))} />
          </Field>
          <fieldset className="space-y-3 rounded-lg bg-surface-sunken p-4 shadow-[inset_0_0_0_1px_var(--border)]">
            <legend className="sr-only">Approval steps, in order (1 to 3)</legend>
            <div className="flex items-baseline justify-between gap-3" aria-hidden="true">
              <span className="label-caps">Approval steps</span>
              <span className="text-caption text-muted-foreground">In order · 1 to 3</span>
            </div>
            <ol className="space-y-2">
              {draft.approver_roles.map((role, i) => (
                <li key={i} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2">
                  <span aria-hidden="true" className="inline-flex size-7 items-center justify-center rounded-full bg-card text-caption font-semibold text-foreground-secondary shadow-[inset_0_0_0_1px_var(--border-strong)] tabular-nums">
                    {i + 1}
                  </span>
                  <span>
                    <label htmlFor={`wf-step-${i}`} className="sr-only">
                      Step {i + 1} approver role
                    </label>
                    <Select id={`wf-step-${i}`} value={role} onChange={e => setRole(i, e.target.value as ApproverRole)}>
                      {APPROVER_ROLES.map(r => (
                        <option key={r}>{r}</option>
                      ))}
                    </Select>
                  </span>
                  <span className="flex gap-0.5">
                    <Button type="button" size="icon" variant="ghost" className="size-9" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move step ${i + 1} up`}>
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="size-9" onClick={() => move(i, 1)} disabled={i === draft.approver_roles.length - 1} aria-label={`Move step ${i + 1} down`}>
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="size-9" onClick={() => remove(i)} disabled={draft.approver_roles.length <= 1} aria-label={`Remove step ${i + 1}`}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </span>
                </li>
              ))}
            </ol>
            {draft.approver_roles.length < 3 && (
              <Button type="button" variant="ghost" className="h-8 px-2.5 text-primary" onClick={add}>
                <Plus aria-hidden="true" /> Add step
              </Button>
            )}
            {err('approver_roles') && <FieldError>{err('approver_roles')}</FieldError>}
          </fieldset>
          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submit.isPending}>
              <Send aria-hidden="true" />
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
  const error = comment.trim() === '' ? 'A reason is required when rejecting.' : comment.trim().length > 2000 ? 'Keep the reason under 2000 characters.' : null

  const close = () => {
    setComment('')
    setTouched(false)
    onCancel()
  }

  return (
    <Dialog open={item !== null} onOpenChange={o => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <p className="font-mono text-caption text-muted-foreground">#{item?.uuid}</p>
          <DialogTitle>Reject this request?</DialogTitle>
          <DialogDescription>
            <span className="text-foreground">{item?.title ?? ''}</span> — tell the submitter why, so they can fix it and resubmit.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={e => {
            e.preventDefault()
            setTouched(true)
            if (error) return
            onReject(comment.trim())
          }}
          className="space-y-4"
        >
          <Field id="wf-reject-comment" label="Reason for rejection" required error={touched ? error : null} hint="Visible to the submitter and kept in the approval history.">
            <Textarea id="wf-reject-comment" rows={4} autoFocus value={comment} onChange={e => setComment(e.target.value)} {...invalid('wf-reject-comment', touched ? error : null)} />
          </Field>
          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              <X aria-hidden="true" />
              {busy ? 'Rejecting…' : 'Reject request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
