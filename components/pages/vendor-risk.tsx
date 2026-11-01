'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
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
import { DASH, formatDate, formatNumber, toDateInput } from '@/lib/format'
import { useOrgSettings } from '@/lib/settings'
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
  useDebounced,
} from '@/components/resilience/shared'

const TABLE = 'erm_mst_vendor'
const PAGE_SIZE = 25
const TIERS = ['Critical', 'High', 'Medium', 'Low'] as const
const STATUSES = ['Onboarding', 'Active', 'Offboarding', 'Exited'] as const
type Tier = (typeof TIERS)[number]
type Status = (typeof STATUSES)[number]
/** Reviews due within this many days are flagged as "due soon". */
const DUE_SOON_DAYS = 30

const TIER_BADGE: Record<string, string> = { Critical: 'critical', High: 'high', Medium: 'warning', Low: 'low' }

interface Form {
  vendor_name: string
  category: string
  tier: Tier
  status: Status
  country_code: string
  contract_value: string
  risk_score: string
  last_assessment_on: string
  next_review_on: string
  contact_email: string
  open_findings: string
}

function toForm(r: Row | null): Form {
  return {
    vendor_name: str(r?.vendor_name) ?? '',
    category: str(r?.category) ?? '',
    tier: (TIERS as readonly string[]).includes(r?.tier) ? r!.tier : 'Medium',
    status: (STATUSES as readonly string[]).includes(r?.status) ? r!.status : 'Active',
    country_code: str(r?.country_code) ?? '',
    contract_value: num(r?.contract_value)?.toString() ?? '',
    risk_score: num(r?.risk_score)?.toString() ?? '',
    last_assessment_on: toDateInput(r?.last_assessment_on),
    next_review_on: toDateInput(r?.next_review_on),
    contact_email: str(r?.contact_email) ?? '',
    open_findings: num(r?.open_findings)?.toString() ?? '',
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {}
  if (!f.vendor_name.trim()) e.vendor_name = 'Vendor name is required.'
  if (f.contact_email.trim() && !EMAIL_RE.test(f.contact_email.trim())) e.contact_email = 'Enter a valid e-mail address.'
  if (f.country_code.trim() && !/^[A-Za-z]{2}$/.test(f.country_code.trim())) e.country_code = 'Use a 2-letter country code (e.g. GB).'
  const score = parseNum(f.risk_score)
  if (score !== null && (!Number.isInteger(score) || score < 1 || score > 100)) e.risk_score = 'Risk score must be a whole number from 1 to 100.'
  const value = parseNum(f.contract_value)
  if (value !== null && (!Number.isFinite(value) || value < 0)) e.contract_value = 'Contract value must be 0 or more.'
  const findings = parseNum(f.open_findings)
  if (findings !== null && (!Number.isInteger(findings) || findings < 0)) e.open_findings = 'Open findings must be a whole number, 0 or more.'
  if (f.last_assessment_on && f.next_review_on && f.next_review_on < f.last_assessment_on) e.next_review_on = 'Next review can’t be before the last assessment.'
  return e
}

function toValues(f: Form): Row {
  return {
    vendor_name: f.vendor_name.trim(),
    category: orNull(f.category),
    tier: f.tier,
    status: f.status,
    country_code: f.country_code.trim() ? f.country_code.trim().toUpperCase() : null,
    contract_value: parseNum(f.contract_value),
    risk_score: parseNum(f.risk_score),
    last_assessment_on: orNull(f.last_assessment_on),
    next_review_on: orNull(f.next_review_on),
    contact_email: orNull(f.contact_email),
    open_findings: parseNum(f.open_findings),
  }
}

export function VendorRiskPage() {
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const { money } = useOrgSettings()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [tier, setTier] = useState<Tier | 'All'>('All')
  const [status, setStatus] = useState<Status | 'All'>('All')
  const [editing, setEditing] = useState<{ row: Row | null } | null>(null)
  const debounced = useDebounced(search)

  useEffect(() => setPage(1), [debounced, tier, status])

  const filter = useMemo(() => {
    const f: Record<string, string> = {}
    if (tier !== 'All') f.tier = tier
    if (status !== 'All') f.status = status
    return f
  }, [tier, status])

  const pageQ = useRowPage(TABLE, { page, pageSize: PAGE_SIZE, search: debounced, sort: 'vendor_name', order: 'asc', filter })
  const allQ = useRows(TABLE)
  const del = useDeleteRow(TABLE)

  const all = useMemo(() => allQ.data ?? [], [allQ.data])
  const stats = useMemo(() => {
    const byTier = Object.fromEntries(TIERS.map(t => [t, all.filter(v => v.tier === t).length])) as Record<Tier, number>
    const reviewed = all.filter(v => v.status !== 'Exited')
    const overdue = reviewed.filter(v => dueState(v.next_review_on, DUE_SOON_DAYS).state === 'overdue').length
    const dueSoon = reviewed.filter(v => dueState(v.next_review_on, DUE_SOON_DAYS).state === 'due-soon').length
    const values = all.map(v => num(v.contract_value)).filter((n): n is number => n !== null)
    const scores = all.map(v => num(v.risk_score)).filter((n): n is number => n !== null)
    return {
      total: all.length,
      byTier,
      overdue,
      dueSoon,
      contractTotal: values.length ? values.reduce((s, n) => s + n, 0) : null,
      valuesCount: values.length,
      avgScore: scores.length ? scores.reduce((s, n) => s + n, 0) / scores.length : null,
      scoresCount: scores.length,
    }
  }, [all])

  const remove = async (v: Row) => {
    const ok = await confirm({
      title: `Remove ${v.vendor_name}?`,
      description: 'This permanently deletes the vendor record.',
      confirmLabel: 'Remove vendor',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await del.mutateAsync(v.uuid)
      toast.success('Vendor removed')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const doExport = () =>
    exportCsv(
      'vendors.csv',
      [
        { key: 'vendor_name', label: 'Vendor' },
        { key: 'category', label: 'Category' },
        { key: 'tier', label: 'Tier' },
        { key: 'status', label: 'Status' },
        { key: 'country_code', label: 'Country' },
        { key: 'contract_value', label: 'Contract value' },
        { key: 'risk_score', label: 'Risk score' },
        { key: 'last_assessment_on', label: 'Last assessment' },
        { key: 'next_review_on', label: 'Next review' },
        { key: 'contact_email', label: 'Contact e-mail' },
        { key: 'open_findings', label: 'Open findings' },
      ],
      all,
      'Vendor',
    )

  const items = pageQ.data?.items ?? []
  const filtered = !!debounced.trim() || tier !== 'All' || status !== 'All'

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Third-Party Risk Management (TPRM)</h1>
          <p className="text-xs text-slate-500">Tiered vendor risk assessment, contract tracking, and review cadence</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={doExport} disabled={all.length === 0} />
          {hasPermission('create') && (
            <Button onClick={() => setEditing({ row: null })} size="sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
              Onboard vendor
            </Button>
          )}
        </div>
      </div>

      <DataState query={allQ} compact>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi label="Vendors" value={stats.total} hint={`Critical ${stats.byTier.Critical} · High ${stats.byTier.High} · Medium ${stats.byTier.Medium} · Low ${stats.byTier.Low}`} />
          <Kpi label="Critical-tier vendors" value={stats.byTier.Critical} tone="danger" />
          <Kpi label="Reviews overdue" value={stats.overdue} tone="warning" hint={`${stats.dueSoon} due in the next ${DUE_SOON_DAYS} days`} />
          <Kpi
            label="Total contract value"
            value={money(stats.contractTotal, { compact: true })}
            hint={stats.valuesCount < stats.total ? `${stats.valuesCount} of ${stats.total} vendors have a value` : undefined}
          />
          <Kpi
            label="Average risk score"
            value={stats.avgScore === null ? DASH : `${formatNumber(stats.avgScore, 1)}/100`}
            hint={stats.scoresCount < stats.total ? `${stats.scoresCount} of ${stats.total} vendors scored` : undefined}
          />
        </div>
      </DataState>

      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <SearchBox id="vendor-search" value={search} onChange={setSearch} placeholder="Search vendors…" />
        <div className="flex flex-wrap gap-2">
          <FilterTabs label="Filter by tier" options={TIERS} value={tier} onChange={setTier} />
          <FilterTabs label="Filter by status" options={STATUSES} value={status} onChange={setStatus} />
        </div>
      </div>

      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <DataState
          query={pageQ}
          empty={items.length === 0}
          emptyTitle={filtered ? 'No vendors match these filters' : 'No vendors yet'}
          emptyDescription={filtered ? 'Try a different search or filter.' : 'Onboard your first third party to start tracking it.'}
          emptyAction={
            !filtered && hasPermission('create') ? (
              <Button size="sm" onClick={() => setEditing({ row: null })}>
                <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                Onboard vendor
              </Button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Tier</th>
                  <th>Status</th>
                  <th>Country</th>
                  <th className="text-right">Contract value</th>
                  <th>Risk score</th>
                  <th>Next review</th>
                  <th className="text-right">Findings</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(v => {
                  const score = num(v.risk_score)
                  return (
                    <tr key={v.uuid}>
                      <td>
                        <div className="font-medium text-slate-900">{v.vendor_name}</div>
                        <div className="text-slate-400 text-[11px]">{[str(v.category), str(v.contact_email)].filter(Boolean).join(' · ') || DASH}</div>
                      </td>
                      <td>
                        <StatusBadge status={TIER_BADGE[v.tier] ?? 'pending'} label={v.tier ?? DASH} />
                      </td>
                      <td className="text-xs text-slate-600">{v.status ?? DASH}</td>
                      <td className="text-slate-600 font-mono text-xs">{str(v.country_code) ?? DASH}</td>
                      <td className="text-right font-medium tabular-nums text-slate-900">{money(num(v.contract_value))}</td>
                      <td>
                        {score === null ? (
                          <span className="text-[11px] text-slate-500">Not scored</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded overflow-hidden" aria-hidden="true">
                              <div className={cn('h-full rounded', score > 70 ? 'bg-red-600' : score > 50 ? 'bg-amber-500' : 'bg-emerald-600')} style={{ width: `${score}%` }} />
                            </div>
                            <span className="font-medium tabular-nums text-xs">{score}/100</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="text-xs text-slate-700">{formatDate(v.next_review_on)}</div>
                        {v.status !== 'Exited' && <DueChip date={v.next_review_on} soonDays={DUE_SOON_DAYS} />}
                      </td>
                      <td className="text-right tabular-nums text-xs">{formatNumber(num(v.open_findings))}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {hasPermission('update') && (
                            <Button variant="ghost" size="icon" onClick={() => setEditing({ row: v })} className="h-7 w-7" aria-label={`Edit ${v.vendor_name}`}>
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            </Button>
                          )}
                          {hasPermission('delete') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(v)}
                              className="h-7 w-7 text-red-600 hover:bg-red-50"
                              aria-label={`Remove ${v.vendor_name}`}
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

      <VendorDialog editing={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function VendorDialog({ editing, onClose }: { editing: { row: Row | null } | null; onClose: () => void }) {
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (hasErrors(validate(form))) return
    try {
      if (row) {
        await update.mutateAsync({ id: row.uuid, values: toValues(form) })
        toast.success('Vendor updated')
      } else {
        await create.mutateAsync(toValues(form))
        toast.success('Vendor onboarded')
      }
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const describedBy = (k: keyof Form) => (errors[k] ? `v-${k}-error` : undefined)

  return (
    <Dialog open={!!editing} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">{row ? `Edit ${row.vendor_name}` : 'Onboard vendor'}</DialogTitle>
          <DialogDescription className="text-xs">Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-3 text-xs">
          <Field id="v-vendor_name" label="Vendor name" required error={errors.vendor_name}>
            <Input id="v-vendor_name" value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} className="h-8 text-xs" aria-invalid={!!errors.vendor_name} aria-describedby={describedBy('vendor_name')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="v-category" label="Category">
              <Input id="v-category" value={form.category} onChange={e => set('category', e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field id="v-country_code" label="Country (2-letter)" error={errors.country_code}>
              <Input
                id="v-country_code"
                value={form.country_code}
                maxLength={2}
                onChange={e => set('country_code', e.target.value.toUpperCase())}
                className="h-8 text-xs font-mono"
                aria-invalid={!!errors.country_code}
                aria-describedby={describedBy('country_code')}
              />
            </Field>
            <Field id="v-tier" label="Risk tier" required>
              <select id="v-tier" value={form.tier} onChange={e => set('tier', e.target.value as Tier)} className={selectClass}>
                {TIERS.map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field id="v-status" label="Status">
              <select id="v-status" value={form.status} onChange={e => set('status', e.target.value as Status)} className={selectClass}>
                {STATUSES.map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field id="v-contract_value" label="Contract value" error={errors.contract_value}>
              <Input
                id="v-contract_value"
                type="number"
                min={0}
                step="any"
                value={form.contract_value}
                onChange={e => set('contract_value', e.target.value)}
                className="h-8 text-xs"
                aria-invalid={!!errors.contract_value}
                aria-describedby={describedBy('contract_value')}
              />
            </Field>
            <Field id="v-risk_score" label="Risk score (1–100)" error={errors.risk_score}>
              <Input
                id="v-risk_score"
                type="number"
                min={1}
                max={100}
                step={1}
                value={form.risk_score}
                onChange={e => set('risk_score', e.target.value)}
                className="h-8 text-xs"
                aria-invalid={!!errors.risk_score}
                aria-describedby={describedBy('risk_score')}
              />
            </Field>
            <Field id="v-last_assessment_on" label="Last assessment">
              <Input id="v-last_assessment_on" type="date" value={form.last_assessment_on} onChange={e => set('last_assessment_on', e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field id="v-next_review_on" label="Next review" error={errors.next_review_on}>
              <Input
                id="v-next_review_on"
                type="date"
                value={form.next_review_on}
                onChange={e => set('next_review_on', e.target.value)}
                className="h-8 text-xs"
                aria-invalid={!!errors.next_review_on}
                aria-describedby={describedBy('next_review_on')}
              />
            </Field>
            <Field id="v-contact_email" label="Contact e-mail" error={errors.contact_email}>
              <Input
                id="v-contact_email"
                type="email"
                value={form.contact_email}
                onChange={e => set('contact_email', e.target.value)}
                className="h-8 text-xs"
                aria-invalid={!!errors.contact_email}
                aria-describedby={describedBy('contact_email')}
              />
            </Field>
            <Field id="v-open_findings" label="Open findings" error={errors.open_findings}>
              <Input
                id="v-open_findings"
                type="number"
                min={0}
                step={1}
                value={form.open_findings}
                onChange={e => set('open_findings', e.target.value)}
                className="h-8 text-xs"
                aria-invalid={!!errors.open_findings}
                aria-describedby={describedBy('open_findings')}
              />
            </Field>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Saving…' : row ? 'Save changes' : 'Onboard vendor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
