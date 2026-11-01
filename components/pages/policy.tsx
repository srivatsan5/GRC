'use client'

import React, { useDeferredValue, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CountUp, DueChip, FilterChip, Meter, PageHeader, Panel, Person, SearchField } from '@/components/charter/primitives'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState } from '@/components/data-state'
import { Pager, useClampPage } from '@/components/pager'
import { useCreateRow, useDeleteRow, useRowPage, useRows, useUpdateRow, type Row } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { DASH, daysUntil, formatDate, formatNumber, toDateInput } from '@/lib/format'
import { Field, exportCsv, selectClass, textOrNull } from '@/components/controls/form-bits'
import {
  CountButton,
  ExportCsvButton,
  FormSection,
  HatchChip,
  Headline,
  HeadlineCell,
  LifecycleChip,
  Muted,
  NameCell,
  RowActions,
  ScoreMeter,
  Toolbar,
  useQueryParamSearch,
} from '@/components/controls/charter-bits'
import { PolicyControlsDialog } from '@/components/controls/policy-controls-dialog'

const TABLE = 'erm_mst_policy'
const LINKS = 'erm_lnk_policy_control'
const PAGE_SIZE = 25
const STATUSES = ['Draft', 'Active', 'Retired'] as const
/** Reviews due within this many days are flagged as "due soon". */
const DUE_SOON_DAYS = 30

const str = (v: unknown) => (v == null ? '' : String(v))
const pct = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

export function PolicyPage() {
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState<Row | 'new' | null>(null)
  const [linking, setLinking] = useState<Row | null>(null)
  useQueryParamSearch(setSearch)

  const filter = useMemo(() => (statusFilter ? { status: statusFilter } : undefined), [statusFilter])
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
    const live = all.filter(p => p.status !== 'Retired')
    return {
      total: all.length,
      active: all.filter(p => p.status === 'Active').length,
      draft: all.filter(p => p.status === 'Draft').length,
      retired: all.filter(p => p.status === 'Retired').length,
      avgAck: acks.length ? acks.reduce((s, n) => s + n, 0) / acks.length : null,
      ackCount: acks.length,
      overdue: live.filter(p => (daysUntil(p.next_review_date) ?? 0) < 0).length,
      dueSoon: live.filter(p => {
        const d = daysUntil(p.next_review_date)
        return d != null && d >= 0 && d <= DUE_SOON_DAYS
      }).length,
      noDate: live.filter(p => !p.next_review_date).length,
      linked: all.filter(p => (linkCount.get(Number(p.uuid)) ?? 0) > 0).length,
    }
  }, [allQ.data, linkCount])

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
  const filtered = Boolean(deferredSearch.trim()) || !!statusFilter
  const canCreate = hasPermission('create')
  const loadingAll = allQ.isLoading

  useClampPage(page, pageQ.data?.total, PAGE_SIZE, setPage)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Controls & policy"
        title="Policies"
        description="Governance policies with their version, review cycle, staff acknowledgment and the controls that implement them."
        actions={
          <>
            <ExportCsvButton onClick={handleExport} disabled={!allQ.data?.length} />
            {canCreate && (
              <Button onClick={() => setEditing('new')}>
                <Plus aria-hidden="true" />
                New policy
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
        <Headline label="Policy figures">
          <HeadlineCell
            label="Policies"
            loading={loadingAll}
            value={<CountUp value={stats.total} />}
            context={stats.total ? `${stats.active} active · ${stats.draft} draft · ${stats.retired} retired` : 'None recorded yet'}
          />
          <HeadlineCell
            label="Acknowledgment"
            loading={loadingAll}
            value={stats.avgAck == null ? DASH : formatNumber(stats.avgAck, 0)}
            suffix={stats.avgAck == null ? undefined : '%'}
            context={stats.ackCount ? `Average across ${stats.ackCount} polic${stats.ackCount === 1 ? 'y' : 'ies'} with a figure` : 'No acknowledgment recorded'}
          >
            <Meter value={stats.avgAck} tone="bg-foreground-secondary" label="Average acknowledgment" className="max-w-[180px]" />
          </HeadlineCell>
          <HeadlineCell
            label="Reviews overdue"
            loading={loadingAll}
            value={<CountUp value={stats.overdue} />}
            tone={stats.overdue > 0 ? 'text-status-danger-fg' : undefined}
            context={`${stats.dueSoon} due in the next ${DUE_SOON_DAYS} days${stats.noDate ? ` · ${stats.noDate} unscheduled` : ''}`}
          />
          <HeadlineCell
            label="Linked to controls"
            loading={loadingAll}
            value={<CountUp value={stats.linked} />}
            context={stats.total ? `of ${stats.total} policies have at least one control` : 'No policies yet'}
          />
        </Headline>
      )}

      <Toolbar>
        <SearchField
          label="Search policies"
          placeholder="Code, title, category, owner…"
          value={search}
          onChange={v => {
            setSearch(v)
            setPage(1)
          }}
        />
        <FilterChip
          label="Status"
          value={statusFilter}
          onChange={v => {
            setStatusFilter(v)
            setPage(1)
          }}
          options={STATUSES.map(s => ({ value: s, label: s }))}
        />
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('')
              setStatusFilter('')
              setPage(1)
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
          emptyTitle={filtered ? 'No policies match these filters' : 'No policies yet'}
          emptyDescription={filtered ? 'Try a different search or status.' : 'Record your governance policies and their review cycle, then link the controls that implement them.'}
          emptyAction={
            !filtered && canCreate ? (
              <Button onClick={() => setEditing('new')}>
                <Plus aria-hidden="true" />
                New policy
              </Button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table min-w-[900px]">
              <thead>
                <tr>
                  <th scope="col" className="pl-6">Policy</th>
                  <th scope="col">Version</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Next review</th>
                  <th scope="col">Acknowledged</th>
                  <th scope="col">Status</th>
                  <th scope="col">Controls</th>
                  <th scope="col" className="pr-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map(p => {
                  const ack = pct(p.acknowledged_pct)
                  const n = linkCount.get(Number(p.uuid)) ?? 0
                  const code = str(p.policy_code)
                  return (
                    <tr key={p.uuid}>
                      <td className="pl-6">
                        <NameCell name={str(p.title) || DASH} code={code} detail={str(p.category) || null} maxWidth="max-w-[190px]" />
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="py-1.5">
                          <div className="font-mono text-caption text-foreground">{p.version_label ? `v${str(p.version_label)}` : DASH}</div>
                          <div className="text-caption text-muted-foreground">{p.effective_date ? `From ${formatDate(p.effective_date)}` : 'No effective date'}</div>
                        </div>
                      </td>
                      <td>
                        <Person name={str(p.owner_name) || null} className="max-w-[120px]" />
                      </td>
                      <td>
                        {p.status === 'Retired' ? <Muted>{DASH}</Muted> : <DueChip date={p.next_review_date} soonDays={DUE_SOON_DAYS} noDateLabel="No review date" />}
                      </td>
                      <td>
                        {ack == null ? (
                          <HatchChip>Not recorded</HatchChip>
                        ) : (
                          <ScoreMeter value={Math.round(ack)} suffix="%" tone="bg-foreground-secondary" label={`${str(p.title)} acknowledged`} />
                        )}
                      </td>
                      <td>
                        <LifecycleChip status={str(p.status) || null} />
                      </td>
                      <td>
                        <CountButton count={n} noun={['control', 'controls']} loading={linksQ.isLoading} onClick={() => setLinking(p)} label={`Linked controls for ${code}: ${n}. Open`} />
                      </td>
                      <td className="pr-4">
                        <RowActions
                          name={code}
                          onEdit={hasPermission('update') ? () => setEditing(p) : undefined}
                          onDelete={hasPermission('delete') ? () => remove(p) : undefined}
                          busy={del.isPending}
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          {initial && <p className="font-mono text-caption text-muted-foreground">{str(initial.policy_code)}</p>}
          <DialogTitle>{initial ? str(initial.title) || 'Edit policy' : 'New policy'}</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="pol-policy_code" label="Policy code" required error={errors.policy_code}>
              <Input id="pol-policy_code" value={draft.policy_code} onChange={set('policy_code')} placeholder="POL-IT-001" className="font-mono" {...err('policy_code')} />
            </Field>
            <Field id="pol-version_label" label="Version" error={errors.version_label}>
              <Input id="pol-version_label" value={draft.version_label} onChange={set('version_label')} placeholder="1.0" {...err('version_label')} />
            </Field>
          </div>
          <Field id="pol-title" label="Title" required error={errors.title}>
            <Input id="pol-title" value={draft.title} onChange={set('title')} {...err('title')} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="pol-owner_name" label="Owner">
              <Input id="pol-owner_name" value={draft.owner_name} onChange={set('owner_name')} />
            </Field>
            <Field id="pol-category" label="Category">
              <Input id="pol-category" value={draft.category} onChange={set('category')} />
            </Field>
          </div>
          <FormSection title="Review cycle">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="pol-effective_date" label="Effective date">
                <Input id="pol-effective_date" type="date" value={draft.effective_date} onChange={set('effective_date')} />
              </Field>
              <Field id="pol-next_review_date" label="Next review date" error={errors.next_review_date}>
                <Input id="pol-next_review_date" type="date" value={draft.next_review_date} onChange={set('next_review_date')} {...err('next_review_date')} />
              </Field>
              <Field id="pol-acknowledged_pct" label="Acknowledged (%)" error={errors.acknowledged_pct} hint="Share of staff who have acknowledged this policy">
                <Input id="pol-acknowledged_pct" type="number" min={0} max={100} step="0.01" value={draft.acknowledged_pct} onChange={set('acknowledged_pct')} {...err('acknowledged_pct')} />
              </Field>
              <Field id="pol-status" label="Status">
                <select id="pol-status" className={selectClass} value={draft.status} onChange={set('status')}>
                  {STATUSES.map(s => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
          </FormSection>
          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : initial ? 'Save changes' : 'Create policy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
