'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { useCreateRow, useDeleteRow, useRowPage, useRows, useUpdateRow, type Row } from '@/lib/data'
import { DASH, formatDate, formatNumber, toDateInput } from '@/lib/format'
import { apiErrorMessage } from '@/lib/apiClient'
import {
  DueChip,
  ExportButton,
  Field,
  FilterTabs,
  Kpi,
  SearchBox,
  dueState,
  exportCsv,
  hasErrors,
  num,
  orNull,
  parseNum,
  selectClass,
  str,
  textareaClass,
  todayInput,
  useDebounced,
} from '@/components/resilience/shared'

const TABLE = 'erm_mst_bcp_plan'
const PAGE_SIZE = 25
const STATUSES = ['Draft', 'Active', 'Retired'] as const
type Status = (typeof STATUSES)[number]
/** Tests due within this many days are flagged as "due soon". */
const DUE_SOON_DAYS = 30
const STATUS_BADGE: Record<string, string> = { Draft: 'pending', Active: 'success', Retired: 'open' }

interface Form {
  plan_name: string
  scope: string
  rto_hours: string
  rpo_hours: string
  owner_name: string
  last_tested_on: string
  next_test_on: string
  status: Status
}

function toForm(r: Row | null): Form {
  return {
    plan_name: str(r?.plan_name) ?? '',
    scope: str(r?.scope) ?? '',
    rto_hours: num(r?.rto_hours)?.toString() ?? '',
    rpo_hours: num(r?.rpo_hours)?.toString() ?? '',
    owner_name: str(r?.owner_name) ?? '',
    last_tested_on: toDateInput(r?.last_tested_on),
    next_test_on: toDateInput(r?.next_test_on),
    status: (STATUSES as readonly string[]).includes(r?.status) ? r!.status : 'Draft',
  }
}

function validate(f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {}
  if (!f.plan_name.trim()) e.plan_name = 'Plan name is required.'
  const rto = parseNum(f.rto_hours)
  const rpo = parseNum(f.rpo_hours)
  if (rto === null) e.rto_hours = 'RTO is required.'
  else if (!Number.isFinite(rto) || rto <= 0) e.rto_hours = 'RTO must be more than 0 hours.'
  if (rpo === null) e.rpo_hours = 'RPO is required.'
  else if (!Number.isFinite(rpo) || rpo < 0) e.rpo_hours = 'RPO must be 0 hours or more.'
  else if (rto !== null && Number.isFinite(rto) && rpo > rto) e.rpo_hours = 'RPO can’t be longer than the RTO.'
  if (f.last_tested_on && f.next_test_on && f.next_test_on < f.last_tested_on) e.next_test_on = 'Next test can’t be before the last test.'
  return e
}

function toValues(f: Form): Row {
  return {
    plan_name: f.plan_name.trim(),
    scope: orNull(f.scope),
    rto_hours: parseNum(f.rto_hours),
    rpo_hours: parseNum(f.rpo_hours),
    owner_name: orNull(f.owner_name),
    last_tested_on: orNull(f.last_tested_on),
    next_test_on: orNull(f.next_test_on),
    status: f.status,
  }
}

const hours = (v: unknown) => {
  const n = num(v)
  return n === null ? DASH : `${formatNumber(n, 1)}h`
}

export function BcpPage() {
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Status | 'All'>('All')
  const [editing, setEditing] = useState<{ row: Row | null } | null>(null)
  const [testing, setTesting] = useState<Row | null>(null)
  const debounced = useDebounced(search)

  useEffect(() => setPage(1), [debounced, status])

  const filter = useMemo<Record<string, string>>(() => (status === 'All' ? ({} as Record<string, string>) : { status: status as string }), [status])
  const pageQ = useRowPage(TABLE, { page, pageSize: PAGE_SIZE, search: debounced, sort: 'next_test_on', order: 'asc', filter })
  const allQ = useRows(TABLE)
  const del = useDeleteRow(TABLE)

  const all = useMemo(() => allQ.data ?? [], [allQ.data])
  const stats = useMemo(() => {
    const live = all.filter(p => p.status !== 'Retired')
    const rtos = all.map(p => num(p.rto_hours)).filter((n): n is number => n !== null)
    return {
      total: all.length,
      active: all.filter(p => p.status === 'Active').length,
      overdue: live.filter(p => dueState(p.next_test_on).state === 'overdue').length,
      dueSoon: live.filter(p => dueState(p.next_test_on, DUE_SOON_DAYS).state === 'due-soon').length,
      neverTested: live.filter(p => !p.last_tested_on).length,
      unscheduled: live.filter(p => !p.next_test_on).length,
      avgRto: rtos.length ? rtos.reduce((s, n) => s + n, 0) / rtos.length : null,
    }
  }, [all])

  const remove = async (p: Row) => {
    const ok = await confirm({ title: `Delete ${p.plan_name}?`, description: 'This permanently deletes the continuity plan.', confirmLabel: 'Delete plan', tone: 'danger' })
    if (!ok) return
    try {
      await del.mutateAsync(p.uuid)
      toast.success('Plan deleted')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const doExport = () =>
    exportCsv(
      'continuity-plans.csv',
      [
        { key: 'plan_name', label: 'Plan' },
        { key: 'scope', label: 'Scope' },
        { key: 'rto_hours', label: 'RTO (hours)' },
        { key: 'rpo_hours', label: 'RPO (hours)' },
        { key: 'owner_name', label: 'Owner' },
        { key: 'last_tested_on', label: 'Last tested' },
        { key: 'next_test_on', label: 'Next test' },
        { key: 'status', label: 'Status' },
      ],
      all,
      'Continuity plan',
    )

  const items = pageQ.data?.items ?? []
  const filtered = !!debounced.trim() || status !== 'All'

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Business Continuity Planning (BCP)</h1>
          <p className="text-xs text-slate-500">Recovery Time Objective (RTO) and Recovery Point Objective (RPO) plans</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={doExport} disabled={all.length === 0} />
          {hasPermission('create') && (
            <Button onClick={() => setEditing({ row: null })} size="sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
              New plan
            </Button>
          )}
        </div>
      </div>

      <DataState query={allQ} compact>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi label="Continuity plans" value={stats.total} />
          <Kpi label="Active plans" value={stats.active} tone="success" />
          <Kpi label="Tests overdue" value={stats.overdue} tone="danger" hint={`${stats.dueSoon} due in the next ${DUE_SOON_DAYS} days`} />
          <Kpi label="Never tested" value={stats.neverTested} tone="warning" hint={stats.unscheduled ? `${stats.unscheduled} with no test scheduled` : undefined} />
          <Kpi label="Average RTO" value={stats.avgRto === null ? DASH : `${formatNumber(stats.avgRto, 1)} h`} />
        </div>
      </DataState>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <SearchBox id="bcp-search" value={search} onChange={setSearch} placeholder="Search plans…" />
        <FilterTabs label="Filter by status" options={STATUSES} value={status} onChange={setStatus} />
      </div>

      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <DataState
          query={pageQ}
          empty={items.length === 0}
          emptyTitle={filtered ? 'No plans match these filters' : 'No continuity plans yet'}
          emptyDescription={filtered ? 'Try a different search or filter.' : 'Create a plan to record its recovery objectives and test cadence.'}
          emptyAction={
            !filtered && hasPermission('create') ? (
              <Button size="sm" onClick={() => setEditing({ row: null })}>
                <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                New plan
              </Button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Owner</th>
                  <th className="text-right">RTO</th>
                  <th className="text-right">RPO</th>
                  <th>Last tested</th>
                  <th>Next test</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(p => (
                  <tr key={p.uuid}>
                    <td>
                      <div className="font-medium text-slate-900">{p.plan_name}</div>
                      <div className="text-slate-400 text-[11px]">{str(p.scope) ?? DASH}</div>
                    </td>
                    <td className="text-xs text-slate-600">{str(p.owner_name) ?? DASH}</td>
                    <td className="text-right tabular-nums text-xs">{hours(p.rto_hours)}</td>
                    <td className="text-right tabular-nums text-xs">{hours(p.rpo_hours)}</td>
                    <td className="text-xs text-slate-600">{p.last_tested_on ? formatDate(p.last_tested_on) : <span className="text-amber-700">Never tested</span>}</td>
                    <td>
                      <div className="text-xs text-slate-700">{formatDate(p.next_test_on)}</div>
                      {p.status !== 'Retired' && <DueChip date={p.next_test_on} soonDays={DUE_SOON_DAYS} overdueLabel="Test overdue" />}
                    </td>
                    <td>
                      <StatusBadge status={STATUS_BADGE[p.status] ?? 'pending'} label={p.status ?? DASH} />
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {hasPermission('update') && p.status !== 'Retired' && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setTesting(p)}>
                            <ClipboardCheck className="w-3 h-3 mr-1" aria-hidden="true" />
                            Record test
                          </Button>
                        )}
                        {hasPermission('update') && (
                          <Button variant="ghost" size="icon" onClick={() => setEditing({ row: p })} className="h-7 w-7" aria-label={`Edit ${p.plan_name}`}>
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          </Button>
                        )}
                        {hasPermission('delete') && (
                          <Button variant="ghost" size="icon" onClick={() => remove(p)} className="h-7 w-7 text-red-600 hover:bg-red-50" aria-label={`Delete ${p.plan_name}`}>
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={pageQ.data?.total ?? 0} onPage={setPage} busy={pageQ.isFetching} />
        </DataState>
      </div>

      <PlanDialog editing={editing} onClose={() => setEditing(null)} />
      <RecordTestDialog plan={testing} onClose={() => setTesting(null)} />
    </div>
  )
}

function PlanDialog({ editing, onClose }: { editing: { row: Row | null } | null; onClose: () => void }) {
  const row = editing?.row ?? null
  const [form, setForm] = useState<Form>(() => toForm(row))
  const [submitted, setSubmitted] = useState(false)
  const create = useCreateRow(TABLE)
  const update = useUpdateRow(TABLE)

  useEffect(() => {
    if (editing) {
      setForm(toForm(editing.row))
      setSubmitted(false)
    }
  }, [editing])

  const errors = submitted ? validate(form) : {}
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }))
  const busy = create.isPending || update.isPending
  const describedBy = (k: keyof Form) => (errors[k] ? `b-${k}-error` : undefined)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (hasErrors(validate(form))) return
    try {
      if (row) {
        await update.mutateAsync({ id: row.uuid, values: toValues(form) })
        toast.success('Plan updated')
      } else {
        await create.mutateAsync(toValues(form))
        toast.success('Plan created')
      }
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  return (
    <Dialog open={!!editing} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">{row ? `Edit ${row.plan_name}` : 'New continuity plan'}</DialogTitle>
          <DialogDescription className="text-xs">Fields marked * are required. RPO must not exceed RTO.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-3 text-xs">
          <Field id="b-plan_name" label="Plan name" required error={errors.plan_name}>
            <Input id="b-plan_name" value={form.plan_name} onChange={e => set('plan_name', e.target.value)} className="h-8 text-xs" aria-invalid={!!errors.plan_name} aria-describedby={describedBy('plan_name')} />
          </Field>
          <Field id="b-scope" label="Scope">
            <textarea id="b-scope" value={form.scope} onChange={e => set('scope', e.target.value)} className={textareaClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="b-rto_hours" label="RTO (hours)" required error={errors.rto_hours}>
              <Input
                id="b-rto_hours"
                type="number"
                min={0}
                step="0.5"
                value={form.rto_hours}
                onChange={e => set('rto_hours', e.target.value)}
                className="h-8 text-xs"
                aria-invalid={!!errors.rto_hours}
                aria-describedby={describedBy('rto_hours')}
              />
            </Field>
            <Field id="b-rpo_hours" label="RPO (hours)" required error={errors.rpo_hours}>
              <Input
                id="b-rpo_hours"
                type="number"
                min={0}
                step="0.5"
                value={form.rpo_hours}
                onChange={e => set('rpo_hours', e.target.value)}
                className="h-8 text-xs"
                aria-invalid={!!errors.rpo_hours}
                aria-describedby={describedBy('rpo_hours')}
              />
            </Field>
            <Field id="b-owner_name" label="Owner">
              <Input id="b-owner_name" value={form.owner_name} onChange={e => set('owner_name', e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field id="b-status" label="Status">
              <select id="b-status" value={form.status} onChange={e => set('status', e.target.value as Status)} className={selectClass}>
                {STATUSES.map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field id="b-last_tested_on" label="Last tested">
              <Input id="b-last_tested_on" type="date" value={form.last_tested_on} onChange={e => set('last_tested_on', e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field id="b-next_test_on" label="Next test" error={errors.next_test_on}>
              <Input
                id="b-next_test_on"
                type="date"
                value={form.next_test_on}
                onChange={e => set('next_test_on', e.target.value)}
                className="h-8 text-xs"
                aria-invalid={!!errors.next_test_on}
                aria-describedby={describedBy('next_test_on')}
              />
            </Field>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Saving…' : row ? 'Save changes' : 'Create plan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Stamps today as the last test date and asks when the next test is due. */
function RecordTestDialog({ plan, onClose }: { plan: Row | null; onClose: () => void }) {
  const [next, setNext] = useState('')
  const [error, setError] = useState<string | undefined>()
  const update = useUpdateRow(TABLE)
  const today = todayInput()

  useEffect(() => {
    if (plan) {
      setNext('')
      setError(undefined)
    }
  }, [plan])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!plan) return
    if (!next) return setError('Choose when the next test is due.')
    if (next <= today) return setError('The next test must be after today.')
    try {
      await update.mutateAsync({ id: plan.uuid, values: { last_tested_on: today, next_test_on: next } })
      toast.success(`Test recorded for ${plan.plan_name}`)
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  return (
    <Dialog open={!!plan} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Record test{plan ? `: ${plan.plan_name}` : ''}</DialogTitle>
          <DialogDescription className="text-xs">
            Sets the last tested date to today ({formatDate(today)}). Previously tested: {formatDate(plan?.last_tested_on)}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-3 text-xs">
          <Field id="bt-next" label="Next test due" required error={error}>
            <Input
              id="bt-next"
              type="date"
              min={today}
              value={next}
              onChange={e => {
                setNext(e.target.value)
                setError(undefined)
              }}
              className="h-8 text-xs"
              aria-invalid={!!error}
              aria-describedby={error ? 'bt-next-error' : undefined}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={update.isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Record test'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
