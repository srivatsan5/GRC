'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, CircleDot, Link2, Plus, Search as SearchIcon, ShieldCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Chip, CountUp, FilterChip, PageHeader, Panel, Person, SearchField } from '@/components/charter/primitives'
import { Headline, HeadlineCell, Muted, NameCell, RowActions, TierChip, Toolbar, useQueryParamSearch } from '@/components/controls/charter-bits'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState, LoadingState, ErrorState } from '@/components/data-state'
import { Pager, useClampPage } from '@/components/pager'
import { BandBadge } from '@/components/band-badge'
import { useCreateRow, useDeleteRow, useRowPage, useRows, useUpdateRow, type Row } from '@/lib/data'
import { DASH, daysUntil, formatDate, formatNumber, toDateInput } from '@/lib/format'
import { useOrgSettings } from '@/lib/settings'
import { apiErrorMessage } from '@/lib/apiClient'
import { currentScore, toRisk, type Risk } from '@/lib/risk'
import {
  ExportButton,
  Field,
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
  useQueryParamSearch(setSearch)

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
  const canCreate = hasPermission('create')
  const loadingAll = allQ.isLoading

  // Risks linked to the incidents on this page, to show their current band.
  const pageLinks = useMemo(() => {
    const ids = new Set(items.map(i => Number(i.uuid)))
    const m = new Map<number, number[]>()
    for (const l of linksQ.data ?? []) {
      const iid = Number(l.incident_uuid)
      if (!ids.has(iid)) continue
      m.set(iid, [...(m.get(iid) ?? []), Number(l.risk_uuid)])
    }
    return m
  }, [items, linksQ.data])
  const pageRiskIds = useMemo(() => Array.from(new Set(Array.from(pageLinks.values()).flat())), [pageLinks])
  const pageRisksQ = useRows(RISKS, { filter: { uuid: pageRiskIds }, enabled: pageRiskIds.length > 0 })
  const riskById = useMemo(() => new Map((pageRisksQ.data ?? []).map(r => [Number(r.uuid), toRisk(r)])), [pageRisksQ.data])

  useClampPage(page, pageQ.data?.total, PAGE_SIZE, setPage)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Enterprise risk"
        title="Incidents"
        description="Loss events and incidents: severity, investigation status, time to close, losses and the risks they relate to."
        actions={
          <>
            <ExportButton onClick={doExport} disabled={all.length === 0} />
            {canCreate && (
              <Button onClick={() => setEditing({ row: null })}>
                <Plus aria-hidden="true" />
                Report incident
              </Button>
            )}
          </>
        }
      />

      {allQ.isError ? (
        <DataState query={allQ} compact>
          {null}
        </DataState>
      ) : (
        <Headline label="Incident figures">
          <HeadlineCell label="Incidents logged" loading={loadingAll} value={<CountUp value={stats.total} />} context={`${stats.total - stats.open} closed or mitigated`} />
          <HeadlineCell
            label="Open"
            loading={loadingAll}
            value={<CountUp value={stats.open} />}
            context={`${stats.openBySeverity.High} high · ${stats.openBySeverity.Medium} medium · ${stats.openBySeverity.Low} low`}
          />
          <HeadlineCell
            label="Open critical"
            loading={loadingAll}
            value={<CountUp value={stats.openBySeverity.Critical} />}
            tone={stats.openBySeverity.Critical > 0 ? 'text-risk-critical-text' : undefined}
            context={stats.openBySeverity.Critical > 0 ? 'Needs immediate attention' : 'None open'}
          />
          <HeadlineCell
            label="Mean time to close"
            loading={loadingAll}
            value={stats.mttc === null ? DASH : formatNumber(stats.mttc, 1)}
            suffix={stats.mttc === null ? undefined : 'days'}
            context={stats.closedCount ? `Reported to closed, ${stats.closedCount} resolved` : 'No resolved incidents with dates'}
          />
          <HeadlineCell
            label="Recorded losses"
            loading={loadingAll}
            value={money(stats.losses, { compact: true })}
            context={stats.lossCount ? `${stats.lossCount} of ${stats.total} incidents have a loss` : 'No loss amounts recorded'}
          />
        </Headline>
      )}

      <Toolbar>
        <SearchField label="Search incidents" placeholder="Title, reference, category…" value={search} onChange={setSearch} />
        <FilterChip label="Status" value={status === 'All' ? '' : status} onChange={v => setStatus((v || 'All') as Status | 'All')} options={STATUSES.map(t => ({ value: t, label: t }))} />
        <FilterChip label="Severity" value={severity === 'All' ? '' : severity} onChange={v => setSeverity((v || 'All') as Severity | 'All')} options={SEVERITIES.map(t => ({ value: t, label: t }))} />
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('')
              setStatus('All')
              setSeverity('All')
            }}
          >
            Clear
          </Button>
        )}
      </Toolbar>

      <Panel bodyClassName="p-0" className="overflow-hidden">
        <DataState
          query={pageQ}
          empty={items.length === 0}
          emptyTitle={filtered ? 'No incidents match these filters' : 'No incidents logged'}
          emptyDescription={filtered ? 'Try a different search or filter.' : 'Report an incident or loss event to start tracking it against your risks.'}
          emptyAction={
            !filtered && canCreate ? (
              <Button onClick={() => setEditing({ row: null })}>
                <Plus aria-hidden="true" />
                Report incident
              </Button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table min-w-[960px]">
              <thead>
                <tr>
                  <th scope="col" className="pl-6">Incident</th>
                  <th scope="col">Severity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Reported</th>
                  <th scope="col">Assigned to</th>
                  <th scope="col" data-numeric>Loss</th>
                  <th scope="col">Linked risks</th>
                  <th scope="col" className="pr-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map(i => {
                  const resolved = isResolved(i.status)
                  const age = resolved ? daysBetween(i.reported_on, i.closed_on) : daysUntil(i.reported_on)
                  const linked = (pageLinks.get(Number(i.uuid)) ?? []).map(id => ({ id, risk: riskById.get(id) }))
                  const worst = linked
                    .map(l => l.risk)
                    .filter((r): r is Risk => !!r)
                    .sort((a, b) => (currentScore(b) ?? -1) - (currentScore(a) ?? -1))[0]
                  const loss = num(i.loss_amount)
                  return (
                    <tr key={i.uuid}>
                      <td className="pl-6">
                        <NameCell name={i.title ?? DASH} code={str(i.incident_ref)} detail={str(i.category)} maxWidth="max-w-[250px]" />
                      </td>
                      <td>
                        <TierChip value={i.severity} />
                      </td>
                      <td>
                        <IncidentStatus status={i.status} />
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="py-1.5">
                          <div className="text-foreground">{formatDate(i.reported_on)}</div>
                          <div className={resolved || age === null ? 'text-caption text-muted-foreground' : 'text-caption text-status-warning-fg'}>
                            {resolved
                              ? age !== null
                                ? `Closed in ${age} day${age === 1 ? '' : 's'}`
                                : `Closed ${formatDate(i.closed_on)}`
                              : age !== null
                                ? `Open ${Math.max(0, -age)} day${-age === 1 ? '' : 's'}`
                                : 'No report date'}
                          </div>
                        </div>
                      </td>
                      <td>
                        <Person name={str(i.assigned_to)} className="max-w-[130px]" />
                      </td>
                      <td data-numeric className="tabular-nums">
                        {loss === null ? <Muted>{DASH}</Muted> : money(loss)}
                      </td>
                      <td>
                        {!linksQ.isSuccess ? (
                          <Muted>{DASH}</Muted>
                        ) : linked.length === 0 ? (
                          <span className="text-caption text-muted-foreground">None linked</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            {worst ? (
                              <Link href={`/risks/${worst.uuid}`} className="rounded-sm focus-ring" title={worst.statement ?? undefined} aria-label={`Open risk ${worst.referenceNumber ?? worst.uuid}`}>
                                <BandBadge score={currentScore(worst)} />
                              </Link>
                            ) : (
                              <span className="text-caption text-muted-foreground">{pageRisksQ.isLoading ? '…' : `${linked.length} risk${linked.length === 1 ? '' : 's'}`}</span>
                            )}
                            {worst && linked.length > 1 && <span className="text-caption text-muted-foreground tabular-nums">+{linked.length - 1}</span>}
                          </span>
                        )}
                      </td>
                      <td className="pr-4">
                        <RowActions
                          name={i.title}
                          onEdit={hasPermission('update') ? () => setEditing({ row: i }) : undefined}
                          onDelete={hasPermission('delete') ? () => remove(i) : undefined}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={pageQ.data?.total ?? 0} onPage={setPage} busy={pageQ.isFetching} />
        </DataState>
      </Panel>

      <IncidentDialog editing={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function IncidentStatus({ status }: { status: string | null | undefined }) {
  if (status === 'Open') return <Chip tone="warning" icon={CircleDot}>Open</Chip>
  if (status === 'Investigating') return <Chip tone="info" icon={SearchIcon}>Investigating</Chip>
  if (status === 'Mitigated') return <Chip tone="success" icon={ShieldCheck}>Mitigated</Chip>
  if (status === 'Closed') return <Chip tone="neutral" icon={Check}>Closed</Chip>
  return <Muted>{status ?? DASH}</Muted>
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{row ? `Edit ${str(row.incident_ref) ?? 'incident'}` : 'Report incident'}</DialogTitle>
          <DialogDescription>Fields marked * are required. The closed date is set when an incident is closed or mitigated and cleared if it is reopened.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field id="i-incident_ref" label="Reference">
              <Input id="i-incident_ref" value={form.incident_ref} onChange={e => set('incident_ref', e.target.value)} className="font-mono" placeholder="e.g. INC-005" />
            </Field>
            <Field id="i-title" label="Title" required error={errors.title} className="sm:col-span-2">
              <Input id="i-title" value={form.title} onChange={e => set('title', e.target.value)} aria-invalid={!!errors.title} aria-describedby={describedBy('title')} />
            </Field>
          </div>
          <Field id="i-description" label="Description">
            <textarea id="i-description" value={form.description} onChange={e => set('description', e.target.value)} className={textareaClass} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
              <Input id="i-category" value={form.category} onChange={e => set('category', e.target.value)} />
            </Field>
            <Field id="i-reported_by" label="Reported by">
              <Input id="i-reported_by" value={form.reported_by} onChange={e => set('reported_by', e.target.value)} />
            </Field>
            <Field id="i-assigned_to" label="Assigned to">
              <Input id="i-assigned_to" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} />
            </Field>
            <Field id="i-loss_amount" label="Loss amount" error={errors.loss_amount}>
              <Input
                id="i-loss_amount"
                type="number"
                min={0}
                step="any"
                value={form.loss_amount}
                onChange={e => set('loss_amount', e.target.value)}
               
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

          <fieldset className="space-y-3 border-t pt-4">
            <legend className="label-caps float-left mb-3 w-full">Linked risks</legend>
            <div className="clear-both" />
            {row && existingLinksQ.isError ? (
              <ErrorState error={existingLinksQ.error} onRetry={() => existingLinksQ.refetch()} compact />
            ) : !linksReady ? (
              <LoadingState compact label="Loading linked risks…" />
            ) : (
              <RiskLinker selected={selected} onChange={setSelected} />
            )}
          </fieldset>

          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !linksReady}>
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
    <div className="space-y-3">
      {selected.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">No risks linked yet. Search the risk register below to link one.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-md shadow-[inset_0_0_0_1px_var(--border)]">
          {selected.map(id => {
            const r = lookup.get(id)
            return (
              <li key={id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-body-sm font-medium text-foreground">{r?.statement ?? (selectedQ.isLoading ? 'Loading…' : 'No statement recorded')}</div>
                  <div className="truncate font-mono text-caption text-muted-foreground">{[r ? riskLabel(r) : `Risk #${id}`, r?.category, r?.process].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {r && <BandBadge score={currentScore(r)} />}
                  <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => drop(id)} aria-label={`Unlink ${r ? riskLabel(r) : `risk ${id}`}`}>
                    <X aria-hidden="true" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="space-y-1.5">
        <label htmlFor="i-risk-search" className="block text-body-sm font-medium text-foreground">
          Find a risk to link
        </label>
        <Input id="i-risk-search" type="search" value={term} onChange={e => setTerm(e.target.value)} placeholder="Statement, process, category, owner or reference…" />
      </div>
      {debounced.trim() && (
        <div className="max-h-56 overflow-y-auto rounded-md shadow-[inset_0_0_0_1px_var(--border)]">
          {resultsQ.isError ? (
            <ErrorState error={resultsQ.error} onRetry={() => resultsQ.refetch()} compact />
          ) : resultsQ.isLoading ? (
            <LoadingState compact label="Searching risks…" />
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-body-sm text-muted-foreground">No risks match “{debounced}”.</p>
          ) : (
            <ul className="divide-y">
              {results.map(r => {
                const linked = selected.includes(r.uuid)
                return (
                  <li key={r.uuid} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-body-sm text-foreground">{r.statement ?? 'No statement recorded'}</div>
                      <div className="truncate font-mono text-caption text-muted-foreground">{[riskLabel(r), r.category, r.process].filter(Boolean).join(' · ')}</div>
                    </div>
                    <Button type="button" variant={linked ? 'ghost' : 'secondary'} size="sm" className="shrink-0" disabled={linked} onClick={() => add(r)}>
                      {linked ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
                      {linked ? 'Linked' : 'Link'}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          {resultsQ.data && resultsQ.data.total > results.length && (
            <p className="border-t px-4 py-2 text-caption text-muted-foreground">
              Showing {results.length} of {resultsQ.data.total} matches. Refine the search to narrow it down.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
