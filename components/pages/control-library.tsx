'use client'

import React, { useDeferredValue, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Search, Link2, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/ui/status-badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { fetchAllRows, useCreateRow, useDeleteRow, useRowPage, useRows, useUpdateRow, type Row } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { DASH, formatDate, formatNumber, daysUntil, toDateInput } from '@/lib/format'
import { Field, Stat, exportCsv, selectClass, textOrNull } from '@/components/controls/form-bits'
import { ControlRisksDialog } from '@/components/controls/control-risks-dialog'

const TABLE = 'erm_mst_control'
const LINKS = 'erm_lnk_control_risk'
const PAGE_SIZE = 25

export const CONTROL_TYPES = ['Preventive', 'Detective', 'Corrective', 'Compensating'] as const
export const CONTROL_NATURES = ['Manual', 'Automated', 'Hybrid'] as const
export const CONTROL_FREQUENCIES = ['Continuous', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual', 'Event-driven'] as const
export const CONTROL_STATUSES = ['Draft', 'Active', 'Retired'] as const

const str = (v: unknown) => (v == null ? '' : String(v))
const rating = (v: unknown): number | null => {
  const n = Number(v)
  return v != null && v !== '' && Number.isInteger(n) && n >= 1 && n <= 5 ? n : null
}
export const frameworksOf = (row: Row): string[] =>
  str(row.frameworks)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

export function ControlLibraryPage() {
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [typeFilter, setTypeFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [editing, setEditing] = useState<Row | 'new' | null>(null)
  const [linking, setLinking] = useState<Row | null>(null)

  const filter = useMemo(() => {
    const f: Record<string, string> = {}
    if (typeFilter !== 'All') f.control_type = typeFilter
    if (statusFilter !== 'All') f.status = statusFilter
    return f
  }, [typeFilter, statusFilter])

  const pageQ = useRowPage(TABLE, { page, pageSize: PAGE_SIZE, search: deferredSearch, sort: 'control_code', order: 'asc', filter })
  const allQ = useRows(TABLE)
  const linksQ = useRows(LINKS)
  const del = useDeleteRow(TABLE, { alsoInvalidate: [LINKS, 'erm_lnk_policy_control'] })

  const linkCount = useMemo(() => {
    const m = new Map<number, number>()
    for (const l of linksQ.data ?? []) m.set(Number(l.control_uuid), (m.get(Number(l.control_uuid)) ?? 0) + 1)
    return m
  }, [linksQ.data])

  const stats = useMemo(() => {
    const all = allQ.data ?? []
    const effs = all.flatMap(c => [rating(c.design_effectiveness), rating(c.operating_effectiveness)]).filter((n): n is number => n != null)
    return {
      total: all.length,
      active: all.filter(c => c.status === 'Active').length,
      preventive: all.filter(c => c.control_type === 'Preventive').length,
      avgEff: effs.length ? effs.reduce((s, n) => s + n, 0) / effs.length : null,
    }
  }, [allQ.data])

  const handleDelete = async (c: Row) => {
    // A control that is applied to risks can't be deleted (the applications would point at nothing).
    try {
      const applied = await fetchAllRows('per_trn_control_implementation', { control_id: c.uuid })
      if (applied.length) {
        toast.error(`${str(c.control_code)} is applied to ${applied.length} risk${applied.length === 1 ? '' : 's'}. Set its status to Retired instead, or remove it from those risks first.`)
        return
      }
    } catch (err) {
      toast.error(apiErrorMessage(err))
      return
    }
    const ok = await confirm({
      title: `Delete ${str(c.control_code)}?`,
      description: `This removes "${str(c.control_name)}" from the library, along with its links to risks and policies.`,
      confirmLabel: 'Delete control',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await del.mutateAsync(c.uuid)
      toast.success(`Control ${str(c.control_code)} deleted`)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const handleExport = () => {
    const rows = allQ.data ?? []
    exportCsv(
      'control-library.csv',
      ['Code', 'Name', 'Description', 'Type', 'Nature', 'Frequency', 'Owner', 'Frameworks', 'Design effectiveness', 'Operating effectiveness', 'Last tested', 'Status', 'Linked risks'],
      rows.map(c => [
        c.control_code, c.control_name, c.description, c.control_type, c.control_nature, c.frequency, c.owner_name, c.frameworks,
        c.design_effectiveness, c.operating_effectiveness, toDateInput(c.last_tested_on), c.status, linkCount.get(Number(c.uuid)) ?? 0,
      ]),
      'Control',
    )
  }

  const items = pageQ.data?.items ?? []
  const filtered = Boolean(deferredSearch.trim()) || typeFilter !== 'All' || statusFilter !== 'All'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Control Library</h1>
          <p className="text-xs text-slate-500">Central register of internal controls, effectiveness ratings and the risks they mitigate</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!allQ.data?.length}>
            <Download className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            Export CSV
          </Button>
          {hasPermission('create') && (
            <Button onClick={() => setEditing('new')} size="sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
              New control
            </Button>
          )}
        </div>
      </div>

      <DataState query={allQ} compact>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Total controls" value={stats.total} />
          <Stat label="Active controls" value={stats.active} tone="green" />
          <Stat label="Preventive controls" value={stats.preventive} tone="blue" />
          <Stat
            label="Average effectiveness"
            value={
              stats.avgEff == null ? (
                DASH
              ) : (
                <>
                  {formatNumber(stats.avgEff, 1)} <span className="text-xs text-slate-400 font-normal">/ 5</span>
                </>
              )
            }
          />
        </div>
      </DataState>

      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-end justify-between">
        <div className="relative w-full lg:w-72">
          <label htmlFor="control-search" className="sr-only">
            Search controls
          </label>
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <Input
            id="control-search"
            placeholder="Search code, name, owner, framework…"
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-8 h-8 text-xs bg-white"
          />
        </div>
        <div className="flex gap-3">
          <div>
            <label htmlFor="control-type-filter" className="block text-[11px] text-slate-500 mb-0.5">
              Type
            </label>
            <select
              id="control-type-filter"
              className={`${selectClass} w-40`}
              value={typeFilter}
              onChange={e => {
                setTypeFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="All">All types</option>
              {CONTROL_TYPES.map(t => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="control-status-filter" className="block text-[11px] text-slate-500 mb-0.5">
              Status
            </label>
            <select
              id="control-status-filter"
              className={`${selectClass} w-36`}
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="All">All statuses</option>
              {CONTROL_STATUSES.map(t => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <DataState
          query={pageQ}
          empty={items.length === 0}
          emptyTitle={filtered ? 'No controls match these filters' : 'No controls in the library yet'}
          emptyDescription={filtered ? 'Try a different search or filter.' : 'Add the internal controls your organisation relies on.'}
          emptyAction={
            !filtered && hasPermission('create') ? (
              <Button size="sm" onClick={() => setEditing('new')}>
                <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                New control
              </Button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th className="w-[28%]">Control name &amp; description</th>
                  <th>Type</th>
                  <th>Owner</th>
                  <th>Frequency</th>
                  <th>Effectiveness</th>
                  <th>Last tested</th>
                  <th>Status</th>
                  <th>Risks</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(c => {
                  const n = linkCount.get(Number(c.uuid)) ?? 0
                  const testedDays = daysUntil(c.last_tested_on)
                  return (
                    <tr key={c.uuid}>
                      <td className="font-mono text-slate-500">{str(c.control_code)}</td>
                      <td>
                        <div className="font-medium text-slate-900">{str(c.control_name)}</div>
                        {c.description && <div className="text-slate-500 text-[11px] line-clamp-1">{str(c.description)}</div>}
                        {frameworksOf(c).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {frameworksOf(c).map(f => (
                              <span key={f} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 rounded border border-slate-200">
                                {f}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        {c.control_type ? (
                          <StatusBadge
                            status={c.control_type === 'Preventive' ? 'info' : c.control_type === 'Detective' ? 'warning' : c.control_type === 'Corrective' ? 'critical' : 'pending'}
                            label={str(c.control_type)}
                          />
                        ) : (
                          DASH
                        )}
                        {c.control_nature && <div className="text-[11px] text-slate-500 mt-0.5">{str(c.control_nature)}</div>}
                      </td>
                      <td className="text-slate-600">{str(c.owner_name) || DASH}</td>
                      <td className="text-slate-600">{str(c.frequency) || DASH}</td>
                      <td>
                        <span className="font-medium text-slate-900 tabular-nums whitespace-nowrap">
                          D: {rating(c.design_effectiveness) ?? DASH}/5 · O: {rating(c.operating_effectiveness) ?? DASH}/5
                        </span>
                      </td>
                      <td className="text-slate-600 whitespace-nowrap">
                        {formatDate(c.last_tested_on)}
                        {testedDays != null && testedDays > 0 && <div className="text-[11px] text-amber-700">Date is in the future</div>}
                      </td>
                      <td>
                        <StatusBadge status={c.status === 'Active' ? 'success' : c.status === 'Retired' ? 'pending' : 'open'} label={str(c.status) || DASH} />
                      </td>
                      <td>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setLinking(c)} aria-label={`Linked risks for ${str(c.control_code)}: ${n}`}>
                          <Link2 className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                          {linksQ.isLoading ? '…' : n}
                        </Button>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {hasPermission('update') && (
                            <Button variant="ghost" size="icon" onClick={() => setEditing(c)} className="h-7 w-7" aria-label={`Edit ${str(c.control_code)}`}>
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            </Button>
                          )}
                          {hasPermission('delete') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(c)}
                              className="h-7 w-7 text-red-600 hover:bg-red-50"
                              aria-label={`Delete ${str(c.control_code)}`}
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

      {editing && <ControlDialog initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {linking && <ControlRisksDialog control={linking} canEdit={hasPermission('update')} onClose={() => setLinking(null)} />}
    </div>
  )
}

interface Draft {
  control_code: string
  control_name: string
  description: string
  control_type: string
  control_nature: string
  frequency: string
  owner_name: string
  frameworks: string
  design_effectiveness: string
  operating_effectiveness: string
  last_tested_on: string
  status: string
}

function toDraft(row: Row | null): Draft {
  return {
    control_code: str(row?.control_code),
    control_name: str(row?.control_name),
    description: str(row?.description),
    control_type: str(row?.control_type),
    control_nature: str(row?.control_nature),
    frequency: str(row?.frequency),
    owner_name: str(row?.owner_name),
    frameworks: row ? frameworksOf(row).join(', ') : '',
    design_effectiveness: str(row?.design_effectiveness),
    operating_effectiveness: str(row?.operating_effectiveness),
    last_tested_on: toDateInput(row?.last_tested_on),
    status: str(row?.status) || 'Draft',
  }
}

function validate(d: Draft): Partial<Record<keyof Draft, string>> {
  const e: Partial<Record<keyof Draft, string>> = {}
  if (!d.control_code.trim()) e.control_code = 'Control code is required'
  else if (d.control_code.trim().length > 50) e.control_code = 'Keep the code to 50 characters or fewer'
  if (!d.control_name.trim()) e.control_name = 'Control name is required'
  for (const k of ['design_effectiveness', 'operating_effectiveness'] as const) {
    if (d[k] !== '' && rating(d[k]) == null) e[k] = 'Choose a rating from 1 to 5'
  }
  if (d.last_tested_on) {
    const days = daysUntil(d.last_tested_on)
    if (days == null) e.last_tested_on = 'Enter a valid date'
    else if (days > 0) e.last_tested_on = 'The last test date can’t be in the future'
  }
  return e
}

function ControlDialog({ initial, onClose }: { initial: Row | null; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial))
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({})
  const create = useCreateRow(TABLE)
  const update = useUpdateRow(TABLE)
  const busy = create.isPending || update.isPending
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setDraft(d => ({ ...d, [k]: e.target.value }))

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e = validate(draft)
    setErrors(e)
    if (Object.keys(e).length) return
    const frameworks = Array.from(new Set(draft.frameworks.split(',').map(s => s.trim()).filter(Boolean))).join(', ')
    const values: Row = {
      control_code: draft.control_code.trim(),
      control_name: draft.control_name.trim(),
      description: textOrNull(draft.description),
      control_type: draft.control_type || null,
      control_nature: draft.control_nature || null,
      frequency: draft.frequency || null,
      owner_name: textOrNull(draft.owner_name),
      frameworks: frameworks || null,
      design_effectiveness: draft.design_effectiveness === '' ? null : Number(draft.design_effectiveness),
      operating_effectiveness: draft.operating_effectiveness === '' ? null : Number(draft.operating_effectiveness),
      last_tested_on: draft.last_tested_on || null,
      status: draft.status,
    }
    try {
      if (initial) {
        await update.mutateAsync({ id: initial.uuid, values })
        toast.success(`Control ${values.control_code} updated`)
      } else {
        await create.mutateAsync(values)
        toast.success(`Control ${values.control_code} created`)
      }
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const err = (k: keyof Draft) => (errors[k] ? { 'aria-invalid': true, 'aria-describedby': `ctl-${k}-error` } : {})

  return (
    <Dialog open onOpenChange={o => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">{initial ? `Edit ${str(initial.control_code)}` : 'New control'}</DialogTitle>
          <DialogDescription className="text-xs">Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 text-xs" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="ctl-control_code" label="Control code" required error={errors.control_code}>
              <Input id="ctl-control_code" value={draft.control_code} onChange={set('control_code')} placeholder="e.g. CTL-IT-001" className="h-8 text-xs" {...err('control_code')} />
            </Field>
            <Field id="ctl-owner_name" label="Owner">
              <Input id="ctl-owner_name" value={draft.owner_name} onChange={set('owner_name')} placeholder="e.g. CISO" className="h-8 text-xs" />
            </Field>
          </div>
          <Field id="ctl-control_name" label="Control name" required error={errors.control_name}>
            <Input id="ctl-control_name" value={draft.control_name} onChange={set('control_name')} className="h-8 text-xs" {...err('control_name')} />
          </Field>
          <Field id="ctl-description" label="Description">
            <Textarea id="ctl-description" value={draft.description} onChange={set('description')} rows={2} className="text-xs" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Field id="ctl-control_type" label="Type">
              <select id="ctl-control_type" className={selectClass} value={draft.control_type} onChange={set('control_type')}>
                <option value="">Not set</option>
                {CONTROL_TYPES.map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field id="ctl-control_nature" label="Nature">
              <select id="ctl-control_nature" className={selectClass} value={draft.control_nature} onChange={set('control_nature')}>
                <option value="">Not set</option>
                {CONTROL_NATURES.map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field id="ctl-frequency" label="Frequency">
              <select id="ctl-frequency" className={selectClass} value={draft.frequency} onChange={set('frequency')}>
                <option value="">Not set</option>
                {CONTROL_FREQUENCIES.map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field id="ctl-status" label="Status">
              <select id="ctl-status" className={selectClass} value={draft.status} onChange={set('status')}>
                {CONTROL_STATUSES.map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field id="ctl-frameworks" label="Frameworks" hint="Comma-separated, e.g. ISO 27001, SOX">
            <Input id="ctl-frameworks" value={draft.frameworks} onChange={set('frameworks')} className="h-8 text-xs" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field id="ctl-design_effectiveness" label="Design effectiveness (1–5)" error={errors.design_effectiveness}>
              <select id="ctl-design_effectiveness" className={selectClass} value={draft.design_effectiveness} onChange={set('design_effectiveness')}>
                <option value="">Not rated</option>
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="ctl-operating_effectiveness" label="Operating effectiveness (1–5)" error={errors.operating_effectiveness}>
              <select id="ctl-operating_effectiveness" className={selectClass} value={draft.operating_effectiveness} onChange={set('operating_effectiveness')}>
                <option value="">Not rated</option>
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="ctl-last_tested_on" label="Last tested on" error={errors.last_tested_on}>
              <Input id="ctl-last_tested_on" type="date" value={draft.last_tested_on} onChange={set('last_tested_on')} className="h-8 text-xs" {...err('last_tested_on')} />
            </Field>
          </div>
          <DialogFooter className="pt-2 border-t border-slate-200">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Saving…' : 'Save control'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
