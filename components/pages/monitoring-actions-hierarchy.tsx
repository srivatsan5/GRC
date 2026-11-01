'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, ChevronRight, ChevronsDownUp, ChevronsUpDown, Clock, Loader2, Minus, Pause, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { LifecycleStepper } from '@/components/charter/lifecycle-stepper'
import { Chip, DueChip, Meter, PageHeader, Panel, SearchField } from '@/components/charter/primitives'
import { DataState } from '@/components/data-state'
import { useCreateRow, useDeleteRow, useRows, useUpdateRow, type Row } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { DASH, daysUntil, formatDate, toDateInput } from '@/lib/format'
import { CheckboxField, FieldError, FormSection, helpCls, labelCls, numOrNull, rowId, selectCls, text } from '@/components/treatment/shared'

const INDENT = 28

const PLANS = 'per_trn_mitigation_plans'
const STATUS_OPTIONS = ['Not Started', 'In Progress', 'On Hold', 'Completed', 'Cancelled'] as const

interface Node {
  row: Row
  id: number
  children: Node[]
}

const isDone = (r: Row) => String(r.overall_status ?? '').trim().toLowerCase() === 'completed'

function StatusChip({ value }: { value: unknown }) {
  const label = text(value)
  const s = (label ?? '').toLowerCase()
  if (s === 'completed') return <Chip tone="success" icon={Check}>Completed</Chip>
  if (s === 'in progress') return <Chip tone="info" icon={Clock}>In progress</Chip>
  if (s === 'on hold') return <Chip tone="warning" icon={Pause}>On hold</Chip>
  if (s === 'cancelled') return <Chip tone="neutral" icon={X}>Cancelled</Chip>
  return <Chip tone="neutral" icon={Minus}>{label ?? 'No status'}</Chip>
}

function buildTree(rows: Row[]): { roots: Node[]; byId: Map<number, Node> } {
  const byId = new Map<number, Node>()
  for (const row of rows) {
    const id = rowId(row)
    if (id != null) byId.set(id, { row, id, children: [] })
  }
  const roots: Node[] = []
  for (const node of byId.values()) {
    const parentId = numOrNull(node.row.parent_plan_uuid)
    // Walk up to make sure the parent chain doesn't loop back to this node.
    let ok = parentId != null && parentId !== node.id && byId.has(parentId)
    if (ok) {
      const seen = new Set([node.id])
      let cur = parentId
      while (cur != null) {
        if (seen.has(cur)) {
          ok = false
          break
        }
        seen.add(cur)
        cur = numOrNull(byId.get(cur)?.row.parent_plan_uuid)
        if (cur != null && !byId.has(cur)) break
      }
    }
    if (ok) byId.get(parentId!)!.children.push(node)
    else roots.push(node)
  }
  const sort = (list: Node[]) => {
    list.sort((a, b) => String(a.row.plan_statement ?? '').localeCompare(String(b.row.plan_statement ?? '')) || a.id - b.id)
    list.forEach(n => sort(n.children))
  }
  sort(roots)
  return { roots, byId }
}

function descendants(node: Node): Node[] {
  return node.children.flatMap(c => [c, ...descendants(c)])
}

// ----------------------------------------------------------------------------- dialog

interface FormState {
  statement: string
  type: string
  activities: string
  start: string
  end: string
  parent: string
  status: string
  active: boolean
  approval: string
}

function initial(row: Row | null, parentId: number | null): FormState {
  return {
    statement: text(row?.plan_statement) ?? '',
    type: text(row?.plan_type) ?? '',
    activities: text(row?.plan_activities) ?? '',
    start: toDateInput(text(row?.plan_start_date)),
    end: toDateInput(text(row?.plan_end_date)),
    parent: String(numOrNull(row?.parent_plan_uuid) ?? parentId ?? ''),
    status: text(row?.overall_status) ?? 'Not Started',
    active: row ? row.is_active !== 'N' : true,
    approval: text(row?.approval_details) ?? '',
  }
}

function PlanDialog({
  open,
  onOpenChange,
  row,
  parentId,
  tree,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  row: Row | null
  parentId: number | null
  tree: { roots: Node[]; byId: Map<number, Node> }
}) {
  const { hasPermission } = useAuth()
  const canApprove = hasPermission('approve')
  const create = useCreateRow(PLANS)
  const update = useUpdateRow(PLANS)
  const saving = create.isPending || update.isPending
  const [form, setForm] = useState<FormState>(() => initial(row, parentId))
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setForm(initial(row, parentId))
      setErrors({})
    }
  }, [open, row, parentId])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }))
  const selfId = rowId(row)

  // A plan can't be moved under itself or one of its own sub-plans.
  const parentOptions = useMemo(() => {
    const excluded = new Set<number>()
    if (selfId != null) {
      excluded.add(selfId)
      const node = tree.byId.get(selfId)
      if (node) descendants(node).forEach(d => excluded.add(d.id))
    }
    const out: { id: number; label: string }[] = []
    const walk = (list: Node[], depth: number) => {
      for (const n of list) {
        if (excluded.has(n.id)) continue
        out.push({ id: n.id, label: `${'— '.repeat(depth)}${(text(n.row.plan_statement) ?? `Plan #${n.id}`).slice(0, 80)}` })
        walk(n.children, depth + 1)
      }
    }
    walk(tree.roots, 0)
    return out
  }, [tree, selfId])

  const statusOptions = form.status && !STATUS_OPTIONS.includes(form.status as (typeof STATUS_OPTIONS)[number]) ? [form.status, ...STATUS_OPTIONS] : [...STATUS_OPTIONS]

  const submit = async () => {
    const e: Record<string, string> = {}
    if (!form.statement.trim()) e.statement = 'A plan statement is required.'
    if (form.start && form.end && form.end < form.start) e.end = 'End date must be on or after the start date.'
    setErrors(e)
    if (Object.keys(e).length) return
    const values: Row = {
      plan_statement: form.statement.trim(),
      plan_type: form.type.trim(),
      plan_activities: form.activities.trim(),
      plan_start_date: form.start,
      plan_end_date: form.end,
      parent_plan_uuid: form.parent ? Number(form.parent) : null,
      overall_status: form.status,
      is_active: form.active ? 'Y' : 'N',
    }
    if (canApprove) values.approval_details = form.approval.trim()
    try {
      if (selfId != null) await update.mutateAsync({ id: selfId, values })
      else await create.mutateAsync(values)
      toast.success(selfId != null ? 'Plan updated' : 'Plan created')
      onOpenChange(false)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{selfId != null ? 'Edit mitigation plan' : parentId != null ? 'New sub-plan' : 'New mitigation plan'}</DialogTitle>
          <DialogDescription>Plans can be nested: choose a parent plan to make this a sub-plan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <FormSection title="Plan">
            <div>
              <label htmlFor="mp-statement" className={labelCls}>
                Plan statement <span className="text-status-danger-fg" aria-hidden="true">*</span>
              </label>
              <Textarea
                id="mp-statement"
                rows={2}
                value={form.statement}
                onChange={e => set('statement', e.target.value)}
                aria-required="true"
                aria-invalid={!!errors.statement}
                aria-describedby={errors.statement ? 'mp-statement-error' : undefined}
              />
              <FieldError id="mp-statement-error" message={errors.statement} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="mp-parent" className={labelCls}>
                  Parent plan
                </label>
                <select id="mp-parent" className={selectCls} value={form.parent} onChange={e => set('parent', e.target.value)} aria-describedby="mp-parent-help">
                  <option value="">None (top level)</option>
                  {parentOptions.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p id="mp-parent-help" className={helpCls}>
                  A plan can’t sit under itself or its own sub-plans.
                </p>
              </div>
              <div>
                <label htmlFor="mp-type" className={labelCls}>
                  Plan type
                </label>
                <Input id="mp-type" value={form.type} onChange={e => set('type', e.target.value)} placeholder="e.g. Remediation, Programme, Task" />
              </div>
            </div>
            <div>
              <label htmlFor="mp-activities" className={labelCls}>
                Activities
              </label>
              <Textarea id="mp-activities" rows={3} value={form.activities} onChange={e => set('activities', e.target.value)} placeholder="The steps this plan involves" />
            </div>
          </FormSection>

          <FormSection title="Schedule & status">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="mp-start" className={labelCls}>
                  Start date
                </label>
                <Input id="mp-start" type="date" value={form.start} onChange={e => set('start', e.target.value)} />
              </div>
              <div>
                <label htmlFor="mp-end" className={labelCls}>
                  End date
                </label>
                <Input
                  id="mp-end"
                  type="date"
                  value={form.end}
                  onChange={e => set('end', e.target.value)}
                  aria-invalid={!!errors.end}
                  aria-describedby={errors.end ? 'mp-end-error' : undefined}
                />
                <FieldError id="mp-end-error" message={errors.end} />
              </div>
              <div>
                <label htmlFor="mp-status" className={labelCls}>
                  Overall status
                </label>
                <select id="mp-status" className={selectCls} value={form.status} onChange={e => set('status', e.target.value)}>
                  {statusOptions.map(s => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="sm:pt-[30px]">
                <CheckboxField id="mp-active" checked={form.active} onChange={v => set('active', v)} label="Active" help="Inactive plans can be hidden from the tree." />
              </div>
            </div>
          </FormSection>

          <FormSection title="Approval">
            <div>
              <label htmlFor="mp-approval" className={labelCls}>
                Approval details
              </label>
              <Textarea id="mp-approval" rows={2} value={form.approval} onChange={e => set('approval', e.target.value)} disabled={!canApprove} aria-describedby="mp-approval-help" />
              <p id="mp-approval-help" className={helpCls}>
                {canApprove ? 'Recorded against the plan; only approvers can change it.' : 'Only Risk Managers and Administrators can edit approval details.'}
              </p>
            </div>
          </FormSection>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {selfId != null ? 'Save changes' : 'Create plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ----------------------------------------------------------------------------- page

export function MonitoringactionshierarchyPage() {
  const { hasPermission } = useAuth()
  const confirm = useConfirm()
  const plansQ = useRows(PLANS)
  const del = useDeleteRow(PLANS)
  const tree = useMemo(() => buildTree(plansQ.data ?? []), [plansQ.data])

  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(true)
  const [dialog, setDialog] = useState<{ open: boolean; row: Row | null; parentId: number | null }>({ open: false, row: null, parentId: null })

  const toggle = (id: number) =>
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const expandAll = () => setExpanded(new Set([...tree.byId.values()].filter(n => n.children.length).map(n => n.id)))

  const handleDelete = async (node: Node) => {
    if (node.children.length) {
      toast.error('This plan has sub-plans. Move or delete them first.')
      return
    }
    const ok = await confirm({
      title: 'Delete this plan?',
      description: `“${text(node.row.plan_statement) ?? `Plan #${node.id}`}” will be permanently deleted.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await del.mutateAsync(node.id)
      toast.success('Plan deleted')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const term = search.trim().toLowerCase()
  const matches = (n: Node) =>
    [text(n.row.plan_statement), text(n.row.plan_type), text(n.row.plan_activities), text(n.row.overall_status)].some(v => v && v.toLowerCase().includes(term))
  const visible = (n: Node): boolean => (showInactive || n.row.is_active !== 'N') && (!term || matches(n) || n.children.some(visible))

  const total = tree.byId.size
  const completed = [...tree.byId.values()].filter(n => isDone(n.row)).length

  const canWrite = hasPermission('create') || hasPermission('update') || hasPermission('delete')
  // Desktop columns (lg+): plan · status · sub-plans · due · actions. Below lg the cells stack.
  const gridStyle = { ['--tree-cols' as string]: `minmax(0,1fr) 130px 200px 150px${canWrite ? ' 112px' : ''}` } as React.CSSProperties

  const renderNode = (node: Node, depth: number): React.ReactNode => {
    if (!visible(node)) return null
    const r = node.row
    const desc = descendants(node)
    const doneDesc = desc.filter(d => isDone(d.row)).length
    const isOpen = expanded.has(node.id) || (!!term && node.children.some(visible))
    const cancelled = String(r.overall_status ?? '').trim().toLowerCase() === 'cancelled'
    const title = text(r.plan_statement) ?? `Plan #${node.id}`
    const inactive = r.is_active === 'N'
    const indent = 24 + depth * INDENT
    return (
      <li key={node.id}>
        <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2 lg:grid lg:grid-cols-(--tree-cols) lg:gap-x-6 border-b py-3 pr-6 transition-colors duration-(--duration-fast) ease-out hover:bg-hover " style={{ paddingLeft: indent, ...gridStyle }}>
          {/* hairline guides for each ancestor level */}
          {Array.from({ length: depth }, (_, k) => (
            <span key={k} aria-hidden="true" className="absolute inset-y-0 w-px bg-border-strong" style={{ left: 24 + k * INDENT + 14 }} />
          ))}
          {depth > 0 && <span aria-hidden="true" className="absolute top-1/2 h-px w-3 bg-border-strong" style={{ left: 24 + (depth - 1) * INDENT + 14 }} />}

          <div className="flex w-full min-w-0 items-start gap-2 lg:col-start-1 lg:row-start-1 lg:w-auto">
            {node.children.length ? (
              <Button
                variant="ghost"
                size="icon"
                className="relative z-[1] -my-0.5 size-7 shrink-0 bg-card"
                onClick={() => toggle(node.id)}
                aria-expanded={isOpen}
                aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title}`}
              >
                <ChevronRight className={'transition-transform duration-(--duration-fast) ease-out ' + (isOpen ? 'rotate-90' : '')} aria-hidden="true" />
              </Button>
            ) : (
              <span className="relative z-[1] inline-flex size-7 shrink-0 items-center justify-center" aria-hidden="true">
                <span className="size-1.5 rounded-full bg-border-strong" />
              </span>
            )}
            <div className="min-w-0">
              <p className={'text-body font-medium ' + (inactive ? 'text-muted-foreground' : 'text-foreground')}>{title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
                {text(r.plan_type) && <span>{text(r.plan_type)}</span>}
                {text(r.plan_type) && <span aria-hidden="true">·</span>}
                <span className="tabular-nums">
                  {formatDate(text(r.plan_start_date))} – {formatDate(text(r.plan_end_date))}
                </span>
                {node.children.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      {node.children.length} sub-plan{node.children.length === 1 ? '' : 's'}
                    </span>
                  </>
                )}
                {inactive && (
                  <Chip tone="neutral" icon={null} className="ml-1">
                    Inactive
                  </Chip>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pl-9 lg:contents">
          <div className="lg:col-start-2 lg:row-start-1">
            <StatusChip value={r.overall_status} />
          </div>

          <div className={'lg:col-start-4 lg:row-start-1 ' + (isDone(r) ? 'max-lg:hidden' : '')}>
            {cancelled ? <span className="text-caption text-muted-foreground">{DASH}</span> : <DueChip date={text(r.plan_end_date)} done={isDone(r)} doneLabel="Completed" />}
          </div>

          </div>

          <div className={'order-last w-full pl-9 lg:order-none lg:col-start-3 lg:row-start-1 lg:w-auto lg:pl-0 ' + (desc.length ? '' : 'max-lg:hidden')}>
            {desc.length ? (
              <div className="max-w-64 space-y-1">
                <Meter value={(doneDesc / desc.length) * 100} label={`${doneDesc} of ${desc.length} sub-plans completed`} tone={doneDesc === desc.length ? 'bg-status-success' : 'bg-primary'} />
                <p className="text-caption tabular-nums text-muted-foreground">
                  {doneDesc} of {desc.length} sub-plan{desc.length === 1 ? '' : 's'} done
                </p>
              </div>
            ) : (
              <span className="text-caption text-muted-foreground">No sub-plans</span>
            )}
          </div>

          {canWrite && (
          <div className="ml-auto flex items-center gap-0.5 lg:col-start-5 lg:row-start-1 lg:ml-0 lg:justify-end">
            {hasPermission('create') && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Add sub-plan to ${title}`}
                onClick={() => {
                  setExpanded(prev => new Set(prev).add(node.id))
                  setDialog({ open: true, row: null, parentId: node.id })
                }}
              >
                <Plus aria-hidden="true" />
              </Button>
            )}
            {hasPermission('update') && (
              <Button variant="ghost" size="icon" aria-label={`Edit ${title}`} onClick={() => setDialog({ open: true, row: r, parentId: null })}>
                <Pencil aria-hidden="true" />
              </Button>
            )}
            {hasPermission('delete') && (
              <Button variant="ghost" size="icon" className="hover:bg-status-danger-bg hover:text-status-danger-fg" aria-label={`Delete ${title}`} disabled={del.isPending} onClick={() => handleDelete(node)}>
                <Trash2 aria-hidden="true" />
              </Button>
            )}
          </div>
          )}
        </div>
        {isOpen && node.children.length > 0 && <ul>{node.children.map(c => renderNode(c, depth + 1))}</ul>}
      </li>
    )
  }

  const anyVisible = tree.roots.some(visible)
  const all = [...tree.byId.values()]
  const overdue = all.filter(n => {
    const d = daysUntil(text(n.row.plan_end_date))
    return !isDone(n.row) && d != null && d < 0 && String(n.row.overall_status ?? '').toLowerCase() !== 'cancelled'
  }).length
  const newTop = () => setDialog({ open: true, row: null, parentId: null })

  return (
    <div className="space-y-6">
      <LifecycleStepper current="monitoring" />

      <PageHeader
        eyebrow="RCSA · Step 5 · Treatment"
        title="Mitigation plan hierarchy"
        description="Programmes and their sub-plans, with status, progress of the plans beneath and due dates."
        actions={
          hasPermission('create') ? (
            <Button onClick={newTop}>
              <Plus aria-hidden="true" />
              New plan
            </Button>
          ) : undefined
        }
      />

      {plansQ.data && total > 0 && (
        <p className="flex flex-wrap items-baseline gap-x-8 gap-y-2 text-body-sm text-foreground-secondary">
          <span>
            <span className="figure mr-1.5 text-figure-sm text-foreground">{total}</span>plans · {tree.roots.length} top level
          </span>
          <span>
            <span className="figure mr-1.5 text-figure-sm text-foreground">{completed}</span>completed
          </span>
          <span>
            <span className={'figure mr-1.5 text-figure-sm ' + (overdue ? 'text-status-danger-fg' : 'text-foreground')}>{overdue}</span>
            <span className={overdue ? 'text-status-danger-fg' : undefined}>overdue</span>
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={search} onChange={setSearch} label="Search plans" placeholder="Statement, type, activities, status…" />
        <label className="inline-flex h-control cursor-pointer items-center gap-2 rounded-md px-3 text-body-sm text-foreground hover:bg-hover">
          <input type="checkbox" className="size-4 accent-primary" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Show inactive plans
        </label>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={expandAll} disabled={!total}>
            <ChevronsUpDown aria-hidden="true" />
            Expand all
          </Button>
          <Button variant="ghost" onClick={() => setExpanded(new Set())} disabled={!total}>
            <ChevronsDownUp aria-hidden="true" />
            Collapse all
          </Button>
        </div>
      </div>

      <Panel bodyClassName="p-0">
        <DataState
          query={plansQ}
          empty={!anyVisible}
          emptyTitle={total === 0 ? 'No mitigation plans yet' : 'No plans match'}
          emptyDescription={total === 0 ? 'Create a top-level plan, then add sub-plans under it.' : 'Clear the search or show inactive plans.'}
          emptyAction={
            total === 0 && hasPermission('create') ? (
              <Button onClick={newTop}>
                <Plus aria-hidden="true" />
                New plan
              </Button>
            ) : undefined
          }
        >
          <div className="hidden items-center gap-x-6 border-b border-border-strong py-0 pr-6 pl-6 lg:grid lg:grid-cols-(--tree-cols)" style={{ height: 'var(--row-height-header)', ...gridStyle }} aria-hidden="true">
            <span className="label-caps">Plan</span>
            <span className="label-caps">Status</span>
            <span className="label-caps">Sub-plans</span>
            <span className="label-caps">Due</span>
            {canWrite && <span />}
          </div>
          <ul aria-label="Mitigation plans">
            {tree.roots.map(n => renderNode(n, 0))}
          </ul>
        </DataState>
      </Panel>

      <PlanDialog open={dialog.open} onOpenChange={o => setDialog(d => ({ ...d, open: o }))} row={dialog.row} parentId={dialog.parentId} tree={tree} />
    </div>
  )
}
