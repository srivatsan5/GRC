'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState } from '@/components/data-state'
import { useCreateRow, useDeleteRow, useRows, useUpdateRow, type Row } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { daysUntil, formatDate, toDateInput } from '@/lib/format'
import { cn } from '@/lib/utils'
import { FieldError, ProgressBar, labelCls, numOrNull, rowId, selectCls, text } from '@/components/treatment/shared'

const PLANS = 'per_trn_mitigation_plans'
const STATUS_OPTIONS = ['Not Started', 'In Progress', 'On Hold', 'Completed', 'Cancelled'] as const

interface Node {
  row: Row
  id: number
  children: Node[]
}

const isDone = (r: Row) => String(r.overall_status ?? '').trim().toLowerCase() === 'completed'

function statusTone(v: unknown) {
  const s = String(v ?? '').trim().toLowerCase()
  if (s === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (s === 'in progress') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (s === 'on hold') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (s === 'cancelled') return 'border-slate-200 bg-slate-100 text-slate-500'
  return 'border-slate-200 bg-slate-50 text-slate-600'
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
      <DialogContent className="max-w-xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base text-slate-900">{selfId != null ? 'Edit mitigation plan' : 'New mitigation plan'}</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">Plans can be nested: choose a parent plan to make this a sub-plan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="mp-statement" className={labelCls}>
              Plan statement *
            </label>
            <Textarea
              id="mp-statement"
              rows={2}
              value={form.statement}
              onChange={e => set('statement', e.target.value)}
              aria-invalid={!!errors.statement}
              aria-describedby={errors.statement ? 'mp-statement-error' : undefined}
            />
            <FieldError id="mp-statement-error" message={errors.statement} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="mp-parent" className={labelCls}>
                Parent plan
              </label>
              <select id="mp-parent" className={selectCls} value={form.parent} onChange={e => set('parent', e.target.value)}>
                <option value="">None (top level)</option>
                {parentOptions.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mp-type" className={labelCls}>
                Plan type
              </label>
              <Input id="mp-type" value={form.type} onChange={e => set('type', e.target.value)} placeholder="e.g. Remediation, Programme, Task" />
            </div>
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
            <div className="flex items-center gap-2 pt-5">
              <input id="mp-active" type="checkbox" className="h-4 w-4" checked={form.active} onChange={e => set('active', e.target.checked)} />
              <label htmlFor="mp-active" className="text-sm text-slate-700">
                Active
              </label>
            </div>
          </div>
          <div>
            <label htmlFor="mp-activities" className={labelCls}>
              Activities
            </label>
            <Textarea id="mp-activities" rows={3} value={form.activities} onChange={e => set('activities', e.target.value)} />
          </div>
          <div>
            <label htmlFor="mp-approval" className={labelCls}>
              Approval details {!canApprove && '(approvers only)'}
            </label>
            <Textarea id="mp-approval" rows={2} value={form.approval} onChange={e => set('approval', e.target.value)} disabled={!canApprove} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" aria-hidden="true" />}
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

  const renderNode = (node: Node, depth: number): React.ReactNode => {
    if (!visible(node)) return null
    const r = node.row
    const desc = descendants(node)
    const doneDesc = desc.filter(d => isDone(d.row)).length
    const isOpen = expanded.has(node.id) || (!!term && node.children.some(visible))
    const due = daysUntil(text(r.plan_end_date))
    const overdue = !isDone(r) && due != null && due < 0 && String(r.overall_status ?? '').toLowerCase() !== 'cancelled'
    const title = text(r.plan_statement) ?? `Plan #${node.id}`
    return (
      <li key={node.id}>
        <div className={cn('flex flex-wrap items-center gap-3 px-3 py-2.5 border-b border-slate-100 hover:bg-slate-50', r.is_active === 'N' && 'opacity-70')} style={{ paddingLeft: 12 + depth * 24 }}>
          {node.children.length ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => toggle(node.id)}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title}`}
            >
              {isOpen ? <ChevronDown className="w-4 h-4" aria-hidden="true" /> : <ChevronRight className="w-4 h-4" aria-hidden="true" />}
            </Button>
          ) : (
            <span className="w-6" aria-hidden="true" />
          )}
          <div className="flex-1 min-w-[200px]">
            <span className="text-sm font-medium text-slate-900">{title}</span>
            <span className="block text-[11px] text-slate-500">
              {[text(r.plan_type), `${formatDate(text(r.plan_start_date))} – ${formatDate(text(r.plan_end_date))}`, r.is_active === 'N' ? 'Inactive' : null]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
          <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium', statusTone(r.overall_status))}>
            {text(r.overall_status) ?? 'No status'}
          </span>
          {overdue && <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium border-red-200 bg-red-50 text-red-700">Overdue</span>}
          <div className="w-44">
            {desc.length ? (
              <>
                <ProgressBar value={(doneDesc / desc.length) * 100} />
                <span className="block text-[10px] text-slate-500">
                  {doneDesc} of {desc.length} sub-plan{desc.length === 1 ? '' : 's'} completed
                </span>
              </>
            ) : (
              <span className="text-[11px] text-slate-400">No sub-plans</span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {hasPermission('create') && (
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Add sub-plan to ${title}`} onClick={() => {
                  setExpanded(prev => new Set(prev).add(node.id))
                  setDialog({ open: true, row: null, parentId: node.id })
                }}>
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
            )}
            {hasPermission('update') && (
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit ${title}`} onClick={() => setDialog({ open: true, row: r, parentId: null })}>
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
            )}
            {hasPermission('delete') && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-600 hover:bg-red-50"
                aria-label={`Delete ${title}`}
                disabled={del.isPending}
                onClick={() => handleDelete(node)}
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
        {isOpen && node.children.length > 0 && <ul>{node.children.map(c => renderNode(c, depth + 1))}</ul>}
      </li>
    )
  }

  const anyVisible = tree.roots.some(visible)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Mitigation plan hierarchy</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Parent plans and their sub-plans.{' '}
            {plansQ.data && total > 0 && (
              <>
                {completed} of {total} plan{total === 1 ? '' : 's'} completed.
              </>
            )}
          </p>
        </div>
        {hasPermission('create') && (
          <Button size="sm" onClick={() => setDialog({ open: true, row: null, parentId: null })}>
            <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            New plan
          </Button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded">
        <div className="p-3 border-b border-slate-200 flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <label htmlFor="mp-search" className={labelCls}>
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <Input id="mp-search" className="pl-8 h-9" placeholder="Statement, type, activities, status…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2 h-9">
            <input id="mp-inactive" type="checkbox" className="h-4 w-4" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            <label htmlFor="mp-inactive" className="text-xs text-slate-700">
              Show inactive plans
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-9" onClick={expandAll} disabled={!total}>
              Expand all
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => setExpanded(new Set())} disabled={!total}>
              Collapse all
            </Button>
          </div>
        </div>

        <DataState
          query={plansQ}
          empty={!anyVisible}
          emptyTitle={total === 0 ? 'No mitigation plans yet' : 'No plans match'}
          emptyDescription={total === 0 ? 'Create a top-level plan, then add sub-plans under it.' : 'Clear the search or show inactive plans.'}
          emptyAction={
            total === 0 && hasPermission('create') ? (
              <Button size="sm" onClick={() => setDialog({ open: true, row: null, parentId: null })}>
                <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                New plan
              </Button>
            ) : undefined
          }
        >
          <ul aria-label="Mitigation plans">{tree.roots.map(n => renderNode(n, 0))}</ul>
        </DataState>
      </div>

      <PlanDialog
        open={dialog.open}
        onOpenChange={o => setDialog(d => ({ ...d, open: o }))}
        row={dialog.row}
        parentId={dialog.parentId}
        tree={tree}
      />
    </div>
  )
}
