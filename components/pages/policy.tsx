'use client'

import React, { useDeferredValue, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Search, Link2, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { cn } from '@/lib/utils'
import { useCreateRow, useDeleteRow, useRowPage, useRows, useUpdateRow, type Row } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { DASH, daysUntil, formatDate, formatPct, toDateInput } from '@/lib/format'
import { Field, Stat, exportCsv, selectClass, textOrNull } from '@/components/controls/form-bits'
import { PolicyControlsDialog } from '@/components/controls/policy-controls-dialog'

const TABLE = 'erm_mst_policy'
const LINKS = 'erm_lnk_policy_control'
const PAGE_SIZE = 25
const STATUSES = ['Draft', 'Active', 'Retired'] as const
/** Reviews due within this many days are flagged as "due soon". */
const DUE_SOON_DAYS = 30

const str = (v: unknown) => (v == null ? '' : String(v))
const pct = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

function ReviewStatus({ date }: { date: unknown }) {
  const d = daysUntil(date as string | null)
  if (d == null) return <span className="text-slate-400">No review date</span>
  if (d < 0) return <span className="text-red-700 font-medium">Review overdue by {-d} day{d === -1 ? '' : 's'}</span>
  if (d === 0) return <span className="text-amber-700 font-medium">Review due today</span>
  return <span className={d <= DUE_SOON_DAYS ? 'text-amber-700 font-medium' : 'text-slate-500'}>Due in {d} day{d === 1 ? '' : 's'}</span>
}

export function PolicyPage() {
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [statusFilter, setStatusFilter] = useState('All')
  const [editing, setEditing] = useState<Row | 'new' | null>(null)
  const [linking, setLinking] = useState<Row | null>(null)

  const filter = useMemo(() => (statusFilter === 'All' ? undefined : { status: statusFilter }), [statusFilter])
  const pageQ = useRowPage(TABLE, { page, pageSize: PAGE_SIZE, search: deferredSearch, sort: 'policy_code', order: 'asc', filter })
  const allQ = useRows(TABLE)
  const linksQ = useRows(LINKS)
  const del = useDeleteRow(TABLE, { alsoInvalidate: [LINKS] })

  const linkCount = useMemo(() => {
    const m = new Map<number, number>()
    for (const l of linksQ.data ?? []) m.set(Number(l.policy_uuid), (m.get(Number(l.policy_uuid)) ?? 0) + 1)
    return m
  }, [linksQ.data])

  const stats = useMemo(() => {
    const all = allQ.data ?? []
    const acks = all.map(p => pct(p.acknowledged_pct)).filter((n): n is number => n != null)
    return {
      total: all.length,
      active: all.filter(p => p.status === 'Active').length,
      avgAck: acks.length ? acks.reduce((s, n) => s + n, 0) / acks.length : null,
      overdue: all.filter(p => p.status !== 'Retired' && (daysUntil(p.next_review_date) ?? 0) < 0).length,
    }
  }, [allQ.data])

  const remove = async (p: Row) => {
    const ok = await confirm({
      title: `Delete ${str(p.policy_code)}?`,
      description: `This removes "${str(p.title)}" and its links to controls.`,
      confirmLabel: 'Delete policy',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await del.mutateAsync(p.uuid)
      toast.success(`Policy ${str(p.policy_code)} deleted`)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const handleExport = () => {
    const rows = allQ.data ?? []
    exportCsv(
      'policies.csv',
      ['Code', 'Title', 'Category', 'Version', 'Owner', 'Effective date', 'Next review date', 'Acknowledged %', 'Status', 'Linked controls'],
      rows.map(p => [
        p.policy_code, p.title, p.category, p.version_label, p.owner_name, toDateInput(p.effective_date), toDateInput(p.next_review_date),
        p.acknowledged_pct, p.status, linkCount.get(Number(p.uuid)) ?? 0,
      ]),
      'Policy',
    )
  }

  const items = pageQ.data?.items ?? []
  const filtered = Boolean(deferredSearch.trim()) || statusFilter !== 'All'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Policy Management</h1>
          <p className="text-xs text-slate-500">Governance policies, versions, review dates, acknowledgment and linked controls</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!allQ.data?.length}>
            <Download className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            Export CSV
          </Button>
          {hasPermission('create') && (
            <Button onClick={() => setEditing('new')} size="sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
              New policy
            </Button>
          )}
        </div>
      </div>

      <DataState query={allQ} compact>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Total policies" value={stats.total} />
          <Stat label="Active policies" value={stats.active} tone="green" />
          <Stat label="Average acknowledgment" value={formatPct(stats.avgAck)} />
          <Stat label="Reviews overdue" value={stats.overdue} tone={stats.overdue > 0 ? 'red' : undefined} />
        </div>
      </DataState>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end justify-between">
        <div className="relative w-full sm:w-72">
          <label htmlFor="policy-search" className="sr-only">
            Search policies
          </label>
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <Input
            id="policy-search"
            placeholder="Search code, title, category, owner…"
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-8 h-8 text-xs bg-white"
          />
        </div>
        <div>
          <label htmlFor="policy-status-filter" className="block text-[11px] text-slate-500 mb-0.5">
            Status
          </label>
          <select
            id="policy-status-filter"
            className={`${selectClass} w-36`}
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="All">All statuses</option>
            {STATUSES.map(s => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <DataState
          query={pageQ}
          empty={items.length === 0}
          emptyTitle={filtered ? 'No policies match these filters' : 'No policies yet'}
          emptyDescription={filtered ? 'Try a different search or status.' : 'Record your governance policies and their review cycle.'}
          emptyAction={
            !filtered && hasPermission('create') ? (
              <Button size="sm" onClick={() => setEditing('new')}>
                <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                New policy
              </Button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th className="w-[24%]">Policy title</th>
                  <th>Category</th>
                  <th>Version</th>
                  <th>Owner</th>
                  <th>Effective</th>
                  <th>Next review</th>
                  <th>Acknowledgment</th>
                  <th>Status</th>
                  <th>Controls</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(p => {
                  const ack = pct(p.acknowledged_pct)
                  const n = linkCount.get(Number(p.uuid)) ?? 0
                  return (
                    <tr key={p.uuid}>
                      <td className="font-mono text-slate-500">{str(p.policy_code)}</td>
                      <td className="font-medium text-slate-900">{str(p.title)}</td>
                      <td>
                        {p.category ? (
                          <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 rounded border border-slate-200">{str(p.category)}</span>
                        ) : (
                          DASH
                        )}
                      </td>
                      <td className="font-mono text-xs text-slate-600">{p.version_label ? `v${str(p.version_label)}` : DASH}</td>
                      <td className="text-slate-600">{str(p.owner_name) || DASH}</td>
                      <td className="text-slate-600 whitespace-nowrap">{formatDate(p.effective_date)}</td>
                      <td className="whitespace-nowrap">
                        <div className="text-slate-600">{formatDate(p.next_review_date)}</div>
                        <div className="text-[11px]">{p.status === 'Retired' ? <span className="text-slate-400">Retired</span> : <ReviewStatus date={p.next_review_date} />}</div>
                      </td>
                      <td>
                        {ack == null ? (
                          DASH
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded overflow-hidden" aria-hidden="true">
                              <div className={cn('h-full rounded', ack >= 90 ? 'bg-emerald-600' : 'bg-amber-500')} style={{ width: `${Math.min(100, Math.max(0, ack))}%` }} />
                            </div>
                            <span className="text-xs font-medium tabular-nums">{formatPct(ack)}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={p.status === 'Active' ? 'success' : p.status === 'Retired' ? 'pending' : 'open'} label={str(p.status) || DASH} />
                      </td>
                      <td>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setLinking(p)} aria-label={`Linked controls for ${str(p.policy_code)}: ${n}`}>
                          <Link2 className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                          {linksQ.isLoading ? '…' : n}
                        </Button>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {hasPermission('update') && (
                            <Button variant="ghost" size="icon" onClick={() => setEditing(p)} className="h-7 w-7" aria-label={`Edit ${str(p.policy_code)}`}>
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            </Button>
                          )}
                          {hasPermission('delete') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(p)}
                              className="h-7 w-7 text-red-600 hover:bg-red-50"
                              aria-label={`Delete ${str(p.policy_code)}`}
                              disabled={del.isPending}
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={pageQ.data?.total ?? 0} onPage={setPage} busy={pageQ.isFetching} />
        </DataState>
      </div>

      {editing && <PolicyDialog initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {linking && <PolicyControlsDialog policy={linking} canEdit={hasPermission('update')} onClose={() => setLinking(null)} />}
    </div>
  )
}

interface Draft {
  policy_code: string
  title: string
  category: string
  version_label: string
  owner_name: string
  effective_date: string
  next_review_date: string
  acknowledged_pct: string
  status: string
}

function toDraft(row: Row | null): Draft {
  return {
    policy_code: str(row?.policy_code),
    title: str(row?.title),
    category: str(row?.category),
    version_label: str(row?.version_label),
    owner_name: str(row?.owner_name),
    effective_date: toDateInput(row?.effective_date),
    next_review_date: toDateInput(row?.next_review_date),
    acknowledged_pct: str(row?.acknowledged_pct),
    status: str(row?.status) || 'Draft',
  }
}

function validate(d: Draft): Partial<Record<keyof Draft, string>> {
  const e: Partial<Record<keyof Draft, string>> = {}
  if (!d.policy_code.trim()) e.policy_code = 'Policy code is required'
  else if (d.policy_code.trim().length > 50) e.policy_code = 'Keep the code to 50 characters or fewer'
  if (!d.title.trim()) e.title = 'Title is required'
  if (d.version_label.trim().length > 20) e.version_label = 'Keep the version to 20 characters or fewer'
  if (d.acknowledged_pct.trim() !== '') {
    const n = Number(d.acknowledged_pct)
    if (!Number.isFinite(n) || n < 0 || n > 100) e.acknowledged_pct = 'Enter a percentage from 0 to 100'
  }
  if (d.effective_date && d.next_review_date && d.next_review_date < d.effective_date) e.next_review_date = 'Next review must be on or after the effective date'
  return e
}

function PolicyDialog({ initial, onClose }: { initial: Row | null; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial))
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({})
  const create = useCreateRow(TABLE)
  const update = useUpdateRow(TABLE)
  const busy = create.isPending || update.isPending
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft(d => ({ ...d, [k]: e.target.value }))
  const err = (k: keyof Draft) => (errors[k] ? { 'aria-invalid': true, 'aria-describedby': `pol-${k}-error` } : {})

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e = validate(draft)
    setErrors(e)
    if (Object.keys(e).length) return
    const values: Row = {
      policy_code: draft.policy_code.trim(),
      title: draft.title.trim(),
      category: textOrNull(draft.category),
      version_label: textOrNull(draft.version_label),
      owner_name: textOrNull(draft.owner_name),
      effective_date: draft.effective_date || null,
      next_review_date: draft.next_review_date || null,
      acknowledged_pct: draft.acknowledged_pct.trim() === '' ? null : Number(draft.acknowledged_pct),
      status: draft.status,
    }
    try {
      if (initial) {
        await update.mutateAsync({ id: initial.uuid, values })
        toast.success(`Policy ${values.policy_code} updated`)
      } else {
        await create.mutateAsync(values)
        toast.success(`Policy ${values.policy_code} created`)
      }
      onClose()
    } catch (er) {
      toast.error(apiErrorMessage(er))
    }
  }

  return (
    <Dialog open onOpenChange={o => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">{initial ? `Edit ${str(initial.policy_code)}` : 'New policy'}</DialogTitle>
          <DialogDescription className="text-xs">Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 text-xs" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="pol-policy_code" label="Policy code" required error={errors.policy_code}>
              <Input id="pol-policy_code" value={draft.policy_code} onChange={set('policy_code')} placeholder="e.g. POL-IT-001" className="h-8 text-xs" {...err('policy_code')} />
            </Field>
            <Field id="pol-version_label" label="Version" error={errors.version_label}>
              <Input id="pol-version_label" value={draft.version_label} onChange={set('version_label')} placeholder="e.g. 1.0" className="h-8 text-xs" {...err('version_label')} />
            </Field>
          </div>
          <Field id="pol-title" label="Title" required error={errors.title}>
            <Input id="pol-title" value={draft.title} onChange={set('title')} className="h-8 text-xs" {...err('title')} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="pol-owner_name" label="Owner">
              <Input id="pol-owner_name" value={draft.owner_name} onChange={set('owner_name')} className="h-8 text-xs" />
            </Field>
            <Field id="pol-category" label="Category">
              <Input id="pol-category" value={draft.category} onChange={set('category')} className="h-8 text-xs" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="pol-effective_date" label="Effective date">
              <Input id="pol-effective_date" type="date" value={draft.effective_date} onChange={set('effective_date')} className="h-8 text-xs" />
            </Field>
            <Field id="pol-next_review_date" label="Next review date" error={errors.next_review_date}>
              <Input id="pol-next_review_date" type="date" value={draft.next_review_date} onChange={set('next_review_date')} className="h-8 text-xs" {...err('next_review_date')} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="pol-acknowledged_pct" label="Acknowledged (%)" error={errors.acknowledged_pct} hint="Share of staff who have acknowledged this policy">
              <Input
                id="pol-acknowledged_pct"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={draft.acknowledged_pct}
                onChange={set('acknowledged_pct')}
                className="h-8 text-xs"
                {...err('acknowledged_pct')}
              />
            </Field>
            <Field id="pol-status" label="Status">
              <select id="pol-status" className={selectClass} value={draft.status} onChange={set('status')}>
                {STATUSES.map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
          <DialogFooter className="pt-2 border-t border-slate-200">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Saving…' : 'Save policy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
