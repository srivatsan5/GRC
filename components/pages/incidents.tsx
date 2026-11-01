'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, Link2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState, LoadingState, ErrorState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { BandBadge } from '@/components/band-badge'
import { useCreateRow, useDeleteRow, useRowPage, useRows, useUpdateRow, type Row } from '@/lib/data'
import { DASH, daysUntil, formatDate, formatNumber, toDateInput } from '@/lib/format'
import { useOrgSettings } from '@/lib/settings'
import { apiErrorMessage } from '@/lib/apiClient'
import { currentScore, toRisk, type Risk } from '@/lib/risk'
import {
  ExportButton,
  Field,
  FilterTabs,
  Kpi,
  SearchBox,
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

const TABLE = 'erm_trn_incident'
const LINKS = 'erm_lnk_incident_risk'
const RISKS = 'per_trn_identify_risk'
const PAGE_SIZE = 25
const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const
const STATUSES = ['Open', 'Investigating', 'Mitigated', 'Closed'] as const
type Severity = (typeof SEVERITIES)[number]
type Status = (typeof STATUSES)[number]

const isResolved = (s: unknown) => s === 'Closed' || s === 'Mitigated'
const SEVERITY_BADGE: Record<string, string> = { Critical: 'critical', High: 'high', Medium: 'warning', Low: 'low' }
const STATUS_BADGE: Record<string, string> = { Open: 'open', Investigating: 'in-review', Mitigated: 'success', Closed: 'completed' }

/** Whole days between two date strings, or null. */
function daysBetween(from: unknown, to: unknown): number | null {
  if (!from || !to) return null
  const a = new Date(String(from)).getTime()
  const b = new Date(String(to)).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86_400_000)
}

const riskLabel = (r: Risk) => r.referenceNumber ?? `Risk #${r.uuid}`

interface Form {
  incident_ref: string
  title: string
  description: string
  severity: Severity
  status: Status
  category: string
  reported_by: string
  assigned_to: string
  occurred_on: string
  reported_on: string
  closed_on: string
  root_cause: string
  corrective_action: string
  loss_amount: string
}

function toForm(r: Row | null): Form {
  return {
    incident_ref: str(r?.incident_ref) ?? '',
    title: str(r?.title) ?? '',
    description: str(r?.description) ?? '',
    severity: (SEVERITIES as readonly string[]).includes(r?.severity) ? r!.severity : 'Medium',
    status: (STATUSES as readonly string[]).includes(r?.status) ? r!.status : 'Open',
    category: str(r?.category) ?? '',
    reported_by: str(r?.reported_by) ?? '',
    assigned_to: str(r?.assigned_to) ?? '',
    occurred_on: toDateInput(r?.occurred_on),
    // A new incident is reported today unless the user says otherwise.
    reported_on: r ? toDateInput(r.reported_on) : todayInput(),
    closed_on: toDateInput(r?.closed_on),
    root_cause: str(r?.root_cause) ?? '',
    corrective_action: str(r?.corrective_action) ?? '',
    loss_amount: num(r?.loss_amount)?.toString() ?? '',
  }
}

function validate(f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {}
  if (!f.title.trim()) e.title = 'Title is required.'
  if (!f.reported_on) e.reported_on = 'Reported date is required.'
  if (f.occurred_on && f.reported_on && f.occurred_on > f.reported_on) e.occurred_on = 'Occurred date can’t be after the reported date.'
  if (isResolved(f.status) && !f.closed_on) e.closed_on = 'Enter the date the incident was closed or mitigated.'
  if (f.closed_on && f.reported_on && f.closed_on < f.reported_on) e.closed_on = 'Closed date can’t be before the reported date.'
  const loss = parseNum(f.loss_amount)
  if (loss !== null && (!Number.isFinite(loss) || loss < 0)) e.loss_amount = 'Loss amount must be 0 or more.'
  return e
}

function toValues(f: Form): Row {
  return {
    incident_ref: orNull(f.incident_ref),
    title: f.title.trim(),
    description: orNull(f.description),
    severity: f.severity,
    status: f.status,
    category: orNull(f.category),
    reported_by: orNull(f.reported_by),
    assigned_to: orNull(f.assigned_to),
    occurred_on: orNull(f.occurred_on),
    reported_on: f.reported_on,
    closed_on: isResolved(f.status) ? orNull(f.closed_on) : null,
    root_cause: orNull(f.root_cause),
    corrective_action: orNull(f.corrective_action),
    loss_amount: parseNum(f.loss_amount),
  }
}

export function IncidentsPage() {
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const { money } = useOrgSettings()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Status | 'All'>('All')
  const [severity, setSeverity] = useState<Severity | 'All'>('All')
  const [editing, setEditing] = useState<{ row: Row | null } | null>(null)
  const debounced = useDebounced(search)

  useEffect(() => setPage(1), [debounced, status, severity])

  const filter = useMemo(() => {
    const f: Record<string, string> = {}
    if (status !== 'All') f.status = status
    if (severity !== 'All') f.severity = severity
    return f
  }, [status, severity])

  const pageQ = useRowPage(TABLE, { page, pageSize: PAGE_SIZE, search: debounced, sort: 'reported_on', order: 'desc', filter })
  const allQ = useRows(TABLE)
  const linksQ = useRows(LINKS)
  const del = useDeleteRow(TABLE, { alsoInvalidate: [LINKS] })

  const all = useMemo(() => allQ.data ?? [], [allQ.data])
  const linkCount = useMemo(() => {
    const m = new Map<number, number>()
    for (const l of linksQ.data ?? []) m.set(Number(l.incident_uuid), (m.get(Number(l.incident_uuid)) ?? 0) + 1)
    return m
  }, [linksQ.data])

  const stats = useMemo(() => {
    const open = all.filter(i => !isResolved(i.status))
    const openBySeverity = Object.fromEntries(SEVERITIES.map(s => [s, open.filter(i => i.severity === s).length])) as Record<Severity, number>
    const closeDays = all
      .filter(i => isResolved(i.status))
      .map(i => daysBetween(i.reported_on, i.closed_on))
      .filter((d): d is number => d !== null && d >= 0)
    const losses = all.map(i => num(i.loss_amount)).filter((n): n is number => n !== null)
    return {
      total: all.length,
      open: open.length,
      openBySeverity,
      mttc: closeDays.length ? closeDays.reduce((s, d) => s + d, 0) / closeDays.length : null,
      closedCount: closeDays.length,
      losses: losses.length ? losses.reduce((s, n) => s + n, 0) : null,
      lossCount: losses.length,
    }
  }, [all])

  const remove = async (i: Row) => {
    const ok = await confirm({
      title: `Delete ${str(i.incident_ref) ?? 'this incident'}?`,
      description: `“${i.title}” and its risk links will be permanently removed.`,
      confirmLabel: 'Delete incident',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await del.mutateAsync(i.uuid)
      toast.success('Incident deleted')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const doExport = () =>
    exportCsv(
      'incidents.csv',
      [
        { key: 'incident_ref', label: 'Reference' },
        { key: 'title', label: 'Title' },
        { key: 'severity', label: 'Severity' },
        { key: 'status', label: 'Status' },
        { key: 'category', label: 'Category' },
        { key: 'reported_by', label: 'Reported by' },
        { key: 'assigned_to', label: 'Assigned to' },
        { key: 'occurred_on', label: 'Occurred on' },
        { key: 'reported_on', label: 'Reported on' },
        { key: 'closed_on', label: 'Closed on' },
        { key: 'loss_amount', label: 'Loss amount' },
        { key: 'root_cause', label: 'Root cause' },
        { key: 'corrective_action', label: 'Corrective action' },
      ],
      all,
      'Incident',
    )

  const items = pageQ.data?.items ?? []
  const filtered = !!debounced.trim() || status !== 'All' || severity !== 'All'

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Incident & Loss Event Management</h1>
          <p className="text-xs text-slate-500">Log, investigate, and remediate loss events linked to enterprise risks</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={doExport} disabled={all.length === 0} />
          {hasPermission('create') && (
            <Button onClick={() => setEditing({ row: null })} size="sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
              Report incident
            </Button>
          )}
        </div>
      </div>

      <DataState query={allQ} compact>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi label="Incidents logged" value={stats.total} />
          <Kpi
            label="Open / investigating"
            value={stats.open}
            tone="warning"
            hint={`Critical ${stats.openBySeverity.Critical} · High ${stats.openBySeverity.High} · Medium ${stats.openBySeverity.Medium} · Low ${stats.openBySeverity.Low}`}
          />
          <Kpi label="Open critical" value={stats.openBySeverity.Critical} tone="danger" />
          <Kpi
            label="Mean time to close"
            value={stats.mttc === null ? DASH : `${formatNumber(stats.mttc, 1)} days`}
            hint={stats.closedCount ? `Reported → closed, ${stats.closedCount} resolved` : 'No resolved incidents with dates'}
          />
          <Kpi
            label="Total recorded losses"
            value={money(stats.losses, { compact: true })}
            hint={stats.lossCount ? `${stats.lossCount} of ${stats.total} incidents have a loss amount` : 'No loss amounts recorded'}
          />
        </div>
      </DataState>

      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <SearchBox id="incident-search" value={search} onChange={setSearch} placeholder="Search incidents…" />
        <div className="flex flex-wrap gap-2">
          <FilterTabs label="Filter by status" options={STATUSES} value={status} onChange={setStatus} />
          <FilterTabs label="Filter by severity" options={SEVERITIES} value={severity} onChange={setSeverity} />
        </div>
      </div>

      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <DataState
          query={pageQ}
          empty={items.length === 0}
          emptyTitle={filtered ? 'No incidents match these filters' : 'No incidents logged'}
          emptyDescription={filtered ? 'Try a different search or filter.' : 'Report an incident or loss event to start tracking it.'}
          emptyAction={
            !filtered && hasPermission('create') ? (
              <Button size="sm" onClick={() => setEditing({ row: null })}>
                <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                Report incident
              </Button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Incident</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Reported</th>
                  <th>Closed / age</th>
                  <th>Assigned to</th>
                  <th className="text-right">Loss</th>
                  <th className="text-right">Risks</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(i => {
                  const resolved = isResolved(i.status)
                  const age = resolved ? daysBetween(i.reported_on, i.closed_on) : daysUntil(i.reported_on)
                  return (
                    <tr key={i.uuid}>
                      <td className="font-mono text-slate-500 text-xs">{str(i.incident_ref) ?? DASH}</td>
                      <td>
                        <div className="font-medium text-slate-900">{i.title}</div>
                        <div className="text-slate-400 text-[11px]">{str(i.category) ?? DASH}</div>
                      </td>
                      <td>
                        <StatusBadge status={SEVERITY_BADGE[i.severity] ?? 'pending'} label={i.severity ?? DASH} />
                      </td>
                      <td>
                        <StatusBadge status={STATUS_BADGE[i.status] ?? 'pending'} label={i.status ?? DASH} />
                      </td>
                      <td className="text-xs text-slate-600">{formatDate(i.reported_on)}</td>
                      <td className="text-xs text-slate-600">
                        {resolved ? (
                          <>
                            <div>{formatDate(i.closed_on)}</div>
                            {age !== null && <div className="text-[11px] text-slate-400">{age}d to close</div>}
                          </>
                        ) : age !== null ? (
                          <span className="text-amber-700">Open {Math.max(0, -age)}d</span>
                        ) : (
                          DASH
                        )}
                      </td>
                      <td className="text-xs text-slate-600">{str(i.assigned_to) ?? DASH}</td>
                      <td className="text-right tabular-nums text-xs">{money(num(i.loss_amount))}</td>
                      <td className="text-right tabular-nums text-xs">{linksQ.isSuccess ? linkCount.get(Number(i.uuid)) ?? 0 : DASH}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {hasPermission('update') && (
                            <Button variant="ghost" size="icon" onClick={() => setEditing({ row: i })} className="h-7 w-7" aria-label={`Edit ${i.title}`}>
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            </Button>
                          )}
                          {hasPermission('delete') && (
                            <Button variant="ghost" size="icon" onClick={() => remove(i)} className="h-7 w-7 text-red-600 hover:bg-red-50" aria-label={`Delete ${i.title}`}>
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

      <IncidentDialog editing={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function IncidentDialog({ editing, onClose }: { editing: { row: Row | null } | null; onClose: () => void }) {
  const row = editing?.row ?? null
  const [form, setForm] = useState<Form>(() => toForm(row))
  const [submitted, setSubmitted] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [linksReady, setLinksReady] = useState(false)
  const create = useCreateRow(TABLE)
  const update = useUpdateRow(TABLE)
  const addLink = useCreateRow(LINKS)
  const removeLink = useDeleteRow(LINKS)
  const [saving, setSaving] = useState(false)

  const existingLinksQ = useRows(LINKS, { filter: { incident_uuid: row?.uuid ?? -1 }, enabled: !!editing && !!row })
  const existingLinks = useMemo(() => existingLinksQ.data ?? [], [existingLinksQ.data])

  useEffect(() => {
    if (editing) {
      setForm(toForm(editing.row))
      setSubmitted(false)
      setSelected([])
      setLinksReady(!editing.row)
    }
  }, [editing])

  useEffect(() => {
    if (editing?.row && !linksReady && existingLinksQ.isSuccess) {
      setSelected(existingLinks.map(l => Number(l.risk_uuid)))
      setLinksReady(true)
    }
  }, [editing, linksReady, existingLinksQ.isSuccess, existingLinks])

  const errors = submitted ? validate(form) : {}
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }))

  const setStatus = (s: Status) =>
    setForm(f => ({
      ...f,
      status: s,
      // Closing stamps today's date (editable); reopening clears it.
      closed_on: isResolved(s) ? f.closed_on || todayInput() : '',
    }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (hasErrors(validate(form))) return
    setSaving(true)
    try {
      let id: number
      if (row) {
        await update.mutateAsync({ id: row.uuid, values: toValues(form) })
        id = Number(row.uuid)
      } else {
        const created = await create.mutateAsync(toValues(form))
        id = Number(created.uuid ?? created.id)
      }
      const before = new Set(existingLinks.map(l => Number(l.risk_uuid)))
      const after = new Set(selected)
      const failures: string[] = []
      if (!Number.isFinite(id)) {
        if (after.size) failures.push('the server did not return the new incident’s id')
      } else {
        for (const riskId of after) {
          if (!before.has(riskId)) await addLink.mutateAsync({ incident_uuid: id, risk_uuid: riskId }).catch(err => failures.push(apiErrorMessage(err)))
        }
        for (const l of existingLinks) {
          if (!after.has(Number(l.risk_uuid))) await removeLink.mutateAsync(l.uuid).catch(err => failures.push(apiErrorMessage(err)))
        }
      }
      if (failures.length) toast.error(`Incident saved, but some risk links failed: ${failures[0]}`)
      else toast.success(row ? 'Incident updated' : 'Incident reported')
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const describedBy = (k: keyof Form) => (errors[k] ? `i-${k}-error` : undefined)
  const resolved = isResolved(form.status)

  return (
    <Dialog open={!!editing} onOpenChange={o => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">{row ? `Edit ${str(row.incident_ref) ?? 'incident'}` : 'Report incident'}</DialogTitle>
          <DialogDescription className="text-xs">Fields marked * are required. The closed date is set when an incident is closed or mitigated and cleared if it is reopened.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-3 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <Field id="i-incident_ref" label="Reference">
              <Input id="i-incident_ref" value={form.incident_ref} onChange={e => set('incident_ref', e.target.value)} className="h-8 text-xs font-mono" placeholder="e.g. INC-005" />
            </Field>
            <Field id="i-title" label="Title" required error={errors.title} className="col-span-2">
              <Input id="i-title" value={form.title} onChange={e => set('title', e.target.value)} className="h-8 text-xs" aria-invalid={!!errors.title} aria-describedby={describedBy('title')} />
            </Field>
          </div>
          <Field id="i-description" label="Description">
            <textarea id="i-description" value={form.description} onChange={e => set('description', e.target.value)} className={textareaClass} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field id="i-severity" label="Severity" required>
              <select id="i-severity" value={form.severity} onChange={e => set('severity', e.target.value as Severity)} className={selectClass}>
                {SEVERITIES.map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field id="i-status" label="Status">
              <select id="i-status" value={form.status} onChange={e => setStatus(e.target.value as Status)} className={selectClass}>
                {STATUSES.map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field id="i-category" label="Category">
              <Input id="i-category" value={form.category} onChange={e => set('category', e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field id="i-reported_by" label="Reported by">
              <Input id="i-reported_by" value={form.reported_by} onChange={e => set('reported_by', e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field id="i-assigned_to" label="Assigned to">
              <Input id="i-assigned_to" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field id="i-loss_amount" label="Loss amount" error={errors.loss_amount}>
              <Input
                id="i-loss_amount"
                type="number"
                min={0}
                step="any"
                value={form.loss_amount}
                onChange={e => set('loss_amount', e.target.value)}
                className="h-8 text-xs"
                aria-invalid={!!errors.loss_amount}
                aria-describedby={describedBy('loss_amount')}
              />
            </Field>
            <Field id="i-occurred_on" label="Occurred on" error={errors.occurred_on}>
              <Input
                id="i-occurred_on"
                type="date"
                value={form.occurred_on}
                onChange={e => set('occurred_on', e.target.value)}
                className="h-8 text-xs"
                aria-invalid={!!errors.occurred_on}
                aria-describedby={describedBy('occurred_on')}
              />
            </Field>
            <Field id="i-reported_on" label="Reported on" required error={errors.reported_on}>
              <Input
                id="i-reported_on"
                type="date"
                value={form.reported_on}
                onChange={e => set('reported_on', e.target.value)}
                className="h-8 text-xs"
                aria-invalid={!!errors.reported_on}
                aria-describedby={describedBy('reported_on')}
              />
            </Field>
            <Field id="i-closed_on" label="Closed on" error={errors.closed_on} hint={resolved ? undefined : 'Set when closed or mitigated'}>
              <Input
                id="i-closed_on"
                type="date"
                value={form.closed_on}
                disabled={!resolved}
                onChange={e => set('closed_on', e.target.value)}
                className="h-8 text-xs"
                aria-invalid={!!errors.closed_on}
                aria-describedby={describedBy('closed_on')}
              />
            </Field>
          </div>
          <Field id="i-root_cause" label="Root cause">
            <textarea id="i-root_cause" value={form.root_cause} onChange={e => set('root_cause', e.target.value)} className={textareaClass} />
          </Field>
          <Field id="i-corrective_action" label="Corrective action">
            <textarea id="i-corrective_action" value={form.corrective_action} onChange={e => set('corrective_action', e.target.value)} className={textareaClass} />
          </Field>

          <fieldset className="border-t border-slate-200 pt-3">
            <legend className="text-xs font-semibold text-slate-900">Linked risks</legend>
            {row && existingLinksQ.isError ? (
              <ErrorState error={existingLinksQ.error} onRetry={() => existingLinksQ.refetch()} compact />
            ) : !linksReady ? (
              <LoadingState compact label="Loading linked risks…" />
            ) : (
              <RiskLinker selected={selected} onChange={setSelected} />
            )}
          </fieldset>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || !linksReady}>
              {saving ? 'Saving…' : row ? 'Save changes' : 'Report incident'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Shows the linked risks and a server-searched picker over the risk register. */
function RiskLinker({ selected, onChange }: { selected: number[]; onChange: (ids: number[]) => void }) {
  const [term, setTerm] = useState('')
  const debounced = useDebounced(term)
  const [known, setKnown] = useState<Map<number, Risk>>(new Map())

  const selectedQ = useRows(RISKS, { filter: { uuid: selected }, enabled: selected.length > 0 })
  const resultsQ = useRowPage(RISKS, { page: 1, pageSize: 8, search: debounced, sort: 'created_on', order: 'desc' }, { enabled: debounced.trim().length > 0 })

  const lookup = useMemo(() => {
    const m = new Map(known)
    for (const r of selectedQ.data ?? []) {
      const risk = toRisk(r)
      m.set(risk.uuid, risk)
    }
    return m
  }, [known, selectedQ.data])

  const add = (r: Risk) => {
    if (selected.includes(r.uuid)) return
    setKnown(m => new Map(m).set(r.uuid, r))
    onChange([...selected, r.uuid])
  }
  const drop = (id: number) => onChange(selected.filter(x => x !== id))

  const results = (resultsQ.data?.items ?? []).map(toRisk)

  return (
    <div className="space-y-2 mt-2">
      {selected.length === 0 ? (
        <p className="text-[11px] text-slate-500">No risks linked yet. Search the risk register below to link one.</p>
      ) : (
        <ul className="space-y-1">
          {selected.map(id => {
            const r = lookup.get(id)
            return (
              <li key={id} className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-900 truncate">
                    <span className="font-mono text-slate-500 mr-1.5">{r ? riskLabel(r) : `Risk #${id}`}</span>
                    {r?.statement ?? (selectedQ.isLoading ? 'Loading…' : DASH)}
                  </div>
                  {r && <div className="text-[11px] text-slate-400">{[r.category, r.process].filter(Boolean).join(' · ') || DASH}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r && <BandBadge score={currentScore(r)} />}
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => drop(id)} aria-label={`Unlink ${r ? riskLabel(r) : `risk ${id}`}`}>
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div>
        <label htmlFor="i-risk-search" className="block text-xs text-slate-700 font-medium mb-1">
          Find a risk to link
        </label>
        <Input id="i-risk-search" type="search" value={term} onChange={e => setTerm(e.target.value)} placeholder="Search by statement, process, category, owner or reference…" className="h-8 text-xs" />
      </div>
      {debounced.trim() && (
        <div className="rounded border border-slate-200 max-h-56 overflow-y-auto">
          {resultsQ.isError ? (
            <ErrorState error={resultsQ.error} onRetry={() => resultsQ.refetch()} compact />
          ) : resultsQ.isLoading ? (
            <LoadingState compact label="Searching risks…" />
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-[11px] text-slate-500">No risks match “{debounced}”.</p>
          ) : (
            <ul>
              {results.map(r => {
                const linked = selected.includes(r.uuid)
                return (
                  <li key={r.uuid} className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-slate-100 last:border-b-0">
                    <div className="min-w-0">
                      <div className="text-xs text-slate-900 truncate">
                        <span className="font-mono text-slate-500 mr-1.5">{riskLabel(r)}</span>
                        {r.statement ?? DASH}
                      </div>
                      <div className="text-[11px] text-slate-400">{[r.category, r.process].filter(Boolean).join(' · ') || DASH}</div>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs shrink-0" disabled={linked} onClick={() => add(r)}>
                      <Link2 className="w-3 h-3 mr-1" aria-hidden="true" />
                      {linked ? 'Linked' : 'Link'}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          {resultsQ.data && resultsQ.data.total > results.length && (
            <p className="px-3 py-1.5 text-[11px] text-slate-400 border-t border-slate-100">
              Showing {results.length} of {resultsQ.data.total} matches — refine the search to narrow it down.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
