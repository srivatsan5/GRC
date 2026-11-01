'use client'

import React, { useDeferredValue, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Chip, CountUp, FilterChip, PageHeader, Panel, Person, SearchField } from '@/components/charter/primitives'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { fetchAllRows, useCreateRow, useDeleteRow, useRowPage, useRows, useUpdateRow, type Row } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { DASH, formatDate, formatNumber, daysUntil, toDateInput } from '@/lib/format'
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
  RatingDots,
  RowActions,
  Toolbar,
  useQueryParamSearch,
} from '@/components/controls/charter-bits'
import { ControlRisksDialog } from '@/components/controls/control-risks-dialog'

const TABLE = 'erm_mst_control'
const LINKS = 'erm_lnk_control_risk'
const PAGE_SIZE = 25

export const CONTROL_TYPES = ['Preventive', 'Detective', 'Corrective', 'Compensating'] as const
export const CONTROL_NATURES = ['Manual', 'Automated', 'Hybrid'] as const
export const CONTROL_FREQUENCIES = ['Continuous', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual', 'Event-driven'] as const
export const CONTROL_STATUSES = ['Draft', 'Active', 'Retired'] as const
const EFFECTIVENESS_LABELS = ['Ineffective', 'Weak', 'Adequate', 'Strong', 'Fully effective'] as const

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
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState<Row | 'new' | null>(null)
  const [linking, setLinking] = useState<Row | null>(null)
  useQueryParamSearch(setSearch)

  const filter = useMemo(() => {
    const f: Record<string, string> = {}
    if (typeFilter) f.control_type = typeFilter
    if (statusFilter) f.status = statusFilter
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
    const avg = (ns: (number | null)[]) => {
      const v = ns.filter((n): n is number => n != null)
      return { value: v.length ? v.reduce((s, n) => s + n, 0) / v.length : null, rated: v.length }
    }
    return {
      total: all.length,
      active: all.filter(c => c.status === 'Active').length,
      draft: all.filter(c => c.status === 'Draft').length,
      retired: all.filter(c => c.status === 'Retired').length,
      design: avg(all.map(c => rating(c.design_effectiveness))),
      operating: avg(all.map(c => rating(c.operating_effectiveness))),
      neverTested: all.filter(c => c.status !== 'Retired' && !c.last_tested_on).length,
      live: all.filter(c => c.status !== 'Retired').length,
      linked: all.filter(c => (linkCount.get(Number(c.uuid)) ?? 0) > 0).length,
    }
  }, [allQ.data, linkCount])

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
  const filtered = Boolean(deferredSearch.trim()) || !!typeFilter || !!statusFilter
  const canCreate = hasPermission('create')
  const loadingAll = allQ.isLoading

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Controls & policy"
        title="Control library"
        description="Every internal control, how well it is designed and operating, when it was last tested, and the risks it mitigates."
        actions={
          <>
            <ExportCsvButton onClick={handleExport} disabled={!allQ.data?.length} />
            {canCreate && (
              <Button onClick={() => setEditing('new')}>
                <Plus aria-hidden="true" />
                New control
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
        <Headline label="Control library figures">
          <HeadlineCell
            label="Controls"
            loading={loadingAll}
            value={<CountUp value={stats.total} />}
            context={stats.total ? `${stats.linked} linked to at least one risk` : 'None recorded yet'}
          />
          <HeadlineCell
            label="Active"
            loading={loadingAll}
            value={<CountUp value={stats.active} />}
            context={`${stats.draft} draft · ${stats.retired} retired`}
          />
          <HeadlineCell
            label="Design"
            loading={loadingAll}
            value={stats.design.value == null ? DASH : formatNumber(stats.design.value, 1)}
            suffix={stats.design.value == null ? undefined : '/5'}
            context={stats.design.rated ? `Average design effectiveness, ${stats.design.rated} rated` : 'No control is rated yet'}
          >
            <AvgPips value={stats.design.value} label="Average design effectiveness" />
          </HeadlineCell>
          <HeadlineCell
            label="Operating"
            loading={loadingAll}
            value={stats.operating.value == null ? DASH : formatNumber(stats.operating.value, 1)}
            suffix={stats.operating.value == null ? undefined : '/5'}
            context={stats.operating.rated ? `Average operating effectiveness, ${stats.operating.rated} rated` : 'No control is rated yet'}
          >
            <AvgPips value={stats.operating.value} label="Average operating effectiveness" />
          </HeadlineCell>
          <HeadlineCell
            label="Never tested"
            loading={loadingAll}
            value={
              <span className={stats.neverTested > 0 ? 'text-status-warning-fg' : undefined}>
                <CountUp value={stats.neverTested} />
              </span>
            }
            context={stats.live ? `of ${stats.live} draft and active controls` : 'No live controls'}
          />
        </Headline>
      )}

      <Toolbar end={null}>
        <SearchField
          label="Search controls"
          placeholder="Code, name, owner, framework…"
          value={search}
          onChange={v => {
            setSearch(v)
            setPage(1)
          }}
        />
        <FilterChip
          label="Type"
          value={typeFilter}
          onChange={v => {
            setTypeFilter(v)
            setPage(1)
          }}
          options={CONTROL_TYPES.map(t => ({ value: t, label: t }))}
        />
        <FilterChip
          label="Status"
          value={statusFilter}
          onChange={v => {
            setStatusFilter(v)
            setPage(1)
          }}
          options={CONTROL_STATUSES.map(t => ({ value: t, label: t }))}
        />
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('')
              setTypeFilter('')
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
          emptyTitle={filtered ? 'No controls match these filters' : 'No controls in the library yet'}
          emptyDescription={filtered ? 'Try a different search or filter.' : 'Add the internal controls your organisation relies on, then link them to the risks they mitigate.'}
          emptyAction={
            !filtered && canCreate ? (
              <Button onClick={() => setEditing('new')}>
                <Plus aria-hidden="true" />
                New control
              </Button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table min-w-[940px]">
              <thead>
                <tr>
                  <th scope="col" className="pl-6">Control</th>
                  <th scope="col">Type</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Effectiveness</th>
                  <th scope="col">Last tested</th>
                  <th scope="col">Status</th>
                  <th scope="col">Risks</th>
                  <th scope="col" className="pr-6 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map(c => {
                  const n = linkCount.get(Number(c.uuid)) ?? 0
                  const testedDays = daysUntil(c.last_tested_on)
                  const code = str(c.control_code)
                  const fw = frameworksOf(c).join(', ')
                  return (
                    <tr key={c.uuid}>
                      <td className="pl-6">
                        <NameCell name={str(c.control_name) || DASH} code={code} detail={fw || null} maxWidth="max-w-[230px]" />
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="py-1.5">
                          <div className="text-foreground">{str(c.control_type) || DASH}</div>
                          <div className="text-caption text-muted-foreground">
                            {str(c.control_nature) || 'Nature not set'} · {str(c.frequency) || 'No frequency'}
                          </div>
                        </div>
                      </td>
                      <td>
                        <Person name={str(c.owner_name) || null} className="max-w-[130px]" />
                      </td>
                      <td>
                        <div className="flex flex-col gap-0.5 py-1.5 text-caption">
                          <span className="flex items-center gap-2">
                            <span className="w-3 text-muted-foreground" title="Design effectiveness">D</span>
                            <RatingDots value={rating(c.design_effectiveness)} label="Design effectiveness" />
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="w-3 text-muted-foreground" title="Operating effectiveness">O</span>
                            <RatingDots value={rating(c.operating_effectiveness)} label="Operating effectiveness" />
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        {!c.last_tested_on ? (
                          <HatchChip>Never tested</HatchChip>
                        ) : testedDays != null && testedDays > 0 ? (
                          <Chip tone="warning">Future date · {formatDate(c.last_tested_on)}</Chip>
                        ) : (
                          <div className="py-1.5">
                            <div className="text-foreground">{formatDate(c.last_tested_on)}</div>
                            {testedDays != null && <div className="text-caption text-muted-foreground">{testedDays === 0 ? 'Today' : `${-testedDays} day${testedDays === -1 ? '' : 's'} ago`}</div>}
                          </div>
                        )}
                      </td>
                      <td>
                        <LifecycleChip status={str(c.status) || null} />
                      </td>
                      <td>
                        <CountButton count={n} noun={['risk', 'risks']} loading={linksQ.isLoading} onClick={() => setLinking(c)} label={`Linked risks for ${code}: ${n}. Open`} />
                      </td>
                      <td className="pr-6">
                        <RowActions
                          name={code}
                          onEdit={hasPermission('update') ? () => setEditing(c) : undefined}
                          onDelete={hasPermission('delete') ? () => handleDelete(c) : undefined}
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

      {editing && <ControlDialog initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {linking && <ControlRisksDialog control={linking} canEdit={hasPermission('update')} onClose={() => setLinking(null)} />}
    </div>
  )
}

/** Five segments filled to an average 1–5 rating (e.g. 3.4 → three full, one 40 %). */
function AvgPips({ value, label }: { value: number | null; label: string }) {
  if (value == null) return <span className="hatch block h-1.5 w-[136px] rounded-full bg-risk-unrated-bg shadow-[inset_0_0_0_1px_var(--risk-unrated-border)]" aria-hidden="true" />
  return (
    <span role="meter" aria-label={label} aria-valuemin={1} aria-valuemax={5} aria-valuenow={Number(value.toFixed(1))} className="flex gap-1">
      {[0, 1, 2, 3, 4].map(i => {
        const fill = Math.max(0, Math.min(1, value - i))
        return (
          <span key={i} className="relative h-1.5 w-6 overflow-hidden rounded-full bg-muted shadow-[inset_0_0_0_1px_var(--border)]">
            <span className="absolute inset-y-0 left-0 rounded-full bg-foreground-secondary" style={{ width: `${fill * 100}%` }} />
          </span>
        )
      })}
    </span>
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

  const ratingOptions = (
    <>
      <option value="">Not rated</option>
      {[1, 2, 3, 4, 5].map(n => (
        <option key={n} value={n}>
          {n} · {EFFECTIVENESS_LABELS[n - 1]}
        </option>
      ))}
    </>
  )

  return (
    <Dialog open onOpenChange={o => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          {initial && <p className="font-mono text-caption text-muted-foreground">{str(initial.control_code)}</p>}
          <DialogTitle>{initial ? str(initial.control_name) || 'Edit control' : 'New control'}</DialogTitle>
          <DialogDescription>Fields marked * are required. Ratings run from 1 (ineffective) to 5 (fully effective).</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr]">
            <Field id="ctl-control_code" label="Control code" required error={errors.control_code}>
              <Input id="ctl-control_code" value={draft.control_code} onChange={set('control_code')} placeholder="CTL-IT-001" className="font-mono" {...err('control_code')} />
            </Field>
            <Field id="ctl-control_name" label="Control name" required error={errors.control_name}>
              <Input id="ctl-control_name" value={draft.control_name} onChange={set('control_name')} {...err('control_name')} />
            </Field>
          </div>
          <Field id="ctl-description" label="Description">
            <Textarea id="ctl-description" value={draft.description} onChange={set('description')} rows={2} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="ctl-owner_name" label="Owner">
              <Input id="ctl-owner_name" value={draft.owner_name} onChange={set('owner_name')} placeholder="e.g. CISO" />
            </Field>
            <Field id="ctl-frameworks" label="Frameworks" hint="Comma-separated, e.g. ISO 27001, SOX">
              <Input id="ctl-frameworks" value={draft.frameworks} onChange={set('frameworks')} />
            </Field>
          </div>

          <FormSection title="Classification">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
          </FormSection>

          <FormSection title="Effectiveness and testing">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field id="ctl-design_effectiveness" label="Design effectiveness" error={errors.design_effectiveness}>
                <select id="ctl-design_effectiveness" className={selectClass} value={draft.design_effectiveness} onChange={set('design_effectiveness')}>
                  {ratingOptions}
                </select>
              </Field>
              <Field id="ctl-operating_effectiveness" label="Operating effectiveness" error={errors.operating_effectiveness}>
                <select id="ctl-operating_effectiveness" className={selectClass} value={draft.operating_effectiveness} onChange={set('operating_effectiveness')}>
                  {ratingOptions}
                </select>
              </Field>
              <Field id="ctl-last_tested_on" label="Last tested on" error={errors.last_tested_on} hint="Leave empty if never tested">
                <Input id="ctl-last_tested_on" type="date" value={draft.last_tested_on} onChange={set('last_tested_on')} {...err('last_tested_on')} />
              </Field>
            </div>
          </FormSection>

          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : initial ? 'Save changes' : 'Create control'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
