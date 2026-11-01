'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ArrowUp, Loader2, Play, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState } from '@/components/data-state'
import { Pager, useClampPage } from '@/components/pager'
import { useCreateRow, useDeleteRow, useRowPage, useRows, useUpdateRow, type Row } from '@/lib/data'
import { DASH, formatDate, formatPct } from '@/lib/format'
import { CountUp, FilterChip, PageHeader, Panel, SearchField } from '@/components/charter/primitives'
import { HatchChip, Headline, HeadlineCell, Muted, NameCell, RowActions, Toolbar } from '@/components/controls/charter-bits'
import { useOrgSettings } from '@/lib/settings'
import { apiErrorMessage } from '@/lib/apiClient'
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
  useDebounced,
} from '@/components/resilience/shared'

const TABLE = 'erm_mst_scenario'
const PAGE_SIZE = 25
const TYPES = ['Stress Test', 'What-if', 'Reverse Stress', 'Tail Risk'] as const
type ScenarioType = (typeof TYPES)[number]

/** Expected loss = stressed × probability / 100; null when either input is missing. */
export function expectedLoss(stressed: number | null, probabilityPct: number | null): number | null {
  return stressed === null || probabilityPct === null ? null : (stressed * probabilityPct) / 100
}

/** Loss uplift = stressed − baseline; null when either input is missing. */
export function lossUplift(baseline: number | null, stressed: number | null): number | null {
  return baseline === null || stressed === null ? null : stressed - baseline
}

function metrics(r: Row) {
  const baseline = num(r.baseline_loss)
  const stressed = num(r.stressed_loss)
  const probability = num(r.probability_pct)
  return { baseline, stressed, probability, expected: expectedLoss(stressed, probability), uplift: lossUplift(baseline, stressed) }
}

interface Form {
  scenario_name: string
  description: string
  scenario_type: ScenarioType | ''
  category: string
  shock_pct: string
  baseline_loss: string
  stressed_loss: string
  probability_pct: string
  owner_name: string
}

function toForm(r: Row | null): Form {
  return {
    scenario_name: str(r?.scenario_name) ?? '',
    description: str(r?.description) ?? '',
    scenario_type: (TYPES as readonly string[]).includes(r?.scenario_type) ? r!.scenario_type : '',
    category: str(r?.category) ?? '',
    shock_pct: num(r?.shock_pct)?.toString() ?? '',
    baseline_loss: num(r?.baseline_loss)?.toString() ?? '',
    stressed_loss: num(r?.stressed_loss)?.toString() ?? '',
    probability_pct: num(r?.probability_pct)?.toString() ?? '',
    owner_name: str(r?.owner_name) ?? '',
  }
}

function validate(f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {}
  if (!f.scenario_name.trim()) e.scenario_name = 'Scenario name is required.'
  const shock = parseNum(f.shock_pct)
  if (shock !== null && !Number.isFinite(shock)) e.shock_pct = 'Shock must be a number.'
  const base = parseNum(f.baseline_loss)
  if (base !== null && (!Number.isFinite(base) || base < 0)) e.baseline_loss = 'Baseline loss must be 0 or more.'
  const stressed = parseNum(f.stressed_loss)
  if (stressed !== null && (!Number.isFinite(stressed) || stressed < 0)) e.stressed_loss = 'Stressed loss must be 0 or more.'
  const p = parseNum(f.probability_pct)
  if (p !== null && (!Number.isFinite(p) || p < 0 || p > 100)) e.probability_pct = 'Probability must be between 0 and 100.'
  return e
}

function toValues(f: Form): Row {
  return {
    scenario_name: f.scenario_name.trim(),
    description: orNull(f.description),
    scenario_type: f.scenario_type || null,
    category: orNull(f.category),
    shock_pct: parseNum(f.shock_pct),
    baseline_loss: parseNum(f.baseline_loss),
    stressed_loss: parseNum(f.stressed_loss),
    probability_pct: parseNum(f.probability_pct),
    owner_name: orNull(f.owner_name),
  }
}

export function ScenarioPage() {
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const { money } = useOrgSettings()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [type, setType] = useState<ScenarioType | 'All'>('All')
  const [editing, setEditing] = useState<{ row: Row | null } | null>(null)
  const [running, setRunning] = useState<number | null>(null)
  const debounced = useDebounced(search)

  useEffect(() => setPage(1), [debounced, type])

  const filter = useMemo<Record<string, string>>(() => (type === 'All' ? ({} as Record<string, string>) : { scenario_type: type as string }), [type])
  const pageQ = useRowPage(TABLE, { page, pageSize: PAGE_SIZE, search: debounced, sort: 'scenario_name', order: 'asc', filter })
  const allQ = useRows(TABLE)
  const del = useDeleteRow(TABLE)
  const update = useUpdateRow(TABLE)

  const all = useMemo(() => allQ.data ?? [], [allQ.data])
  const stats = useMemo(() => {
    const ms = all.map(r => ({ row: r, ...metrics(r) }))
    const expected = ms.map(m => m.expected).filter((n): n is number => n !== null)
    const withStressed = ms.filter(m => m.stressed !== null)
    const worst = withStressed.reduce<(typeof ms)[number] | null>((w, m) => (w === null || m.stressed! > w.stressed! ? m : w), null)
    return {
      total: all.length,
      expectedTotal: expected.length ? expected.reduce((s, n) => s + n, 0) : null,
      expectedCount: expected.length,
      worst,
      neverRun: all.filter(r => !r.last_run_on).length,
    }
  }, [all])

  const run = async (r: Row) => {
    const m = metrics(r)
    if (m.expected === null && m.uplift === null) {
      toast.error('Enter the stressed loss with a baseline loss or probability before running this scenario.')
      return
    }
    setRunning(Number(r.uuid))
    try {
      await update.mutateAsync({ id: r.uuid, values: { last_run_on: new Date().toISOString() } })
      const parts = [m.expected !== null ? `expected loss ${money(m.expected)}` : null, m.uplift !== null ? `uplift ${money(m.uplift)}` : null].filter(Boolean)
      toast.success(`Ran ${r.scenario_name}`, { description: parts.join(' · ') })
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setRunning(null)
    }
  }

  const remove = async (r: Row) => {
    const ok = await confirm({ title: `Delete ${r.scenario_name}?`, description: 'This permanently deletes the scenario.', confirmLabel: 'Delete scenario', tone: 'danger' })
    if (!ok) return
    try {
      await del.mutateAsync(r.uuid)
      toast.success('Scenario deleted')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const doExport = () =>
    exportCsv(
      'scenarios.csv',
      [
        { key: 'scenario_name', label: 'Scenario' },
        { key: 'scenario_type', label: 'Type' },
        { key: 'category', label: 'Category' },
        { key: 'shock_pct', label: 'Shock (%)' },
        { key: 'baseline_loss', label: 'Baseline loss' },
        { key: 'stressed_loss', label: 'Stressed loss' },
        { key: 'probability_pct', label: 'Probability (%)' },
        { key: 'expected_loss', label: 'Expected loss' },
        { key: 'loss_uplift', label: 'Loss uplift' },
        { key: 'owner_name', label: 'Owner' },
        { key: 'last_run_on', label: 'Last run' },
      ],
      all.map(r => {
        const m = metrics(r)
        return { ...r, expected_loss: m.expected, loss_uplift: m.uplift }
      }),
      'Scenario',
    )

  const items = pageQ.data?.items ?? []
  const filtered = !!debounced.trim() || type !== 'All'
  const canCreate = hasPermission('create')
  const loadingAll = allQ.isLoading

  useClampPage(page, pageQ.data?.total, PAGE_SIZE, setPage)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Enterprise risk"
        title="Scenarios"
        description="Stress tests and what-if scenarios. Expected loss = stressed loss × probability; uplift = stressed loss − baseline loss."
        actions={
          <>
            <ExportButton onClick={doExport} disabled={all.length === 0} />
            {canCreate && (
              <Button onClick={() => setEditing({ row: null })}>
                <Plus aria-hidden="true" />
                New scenario
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
        <Headline label="Scenario figures">
          <HeadlineCell label="Scenarios" loading={loadingAll} value={<CountUp value={stats.total} />} context={stats.total ? `${stats.total - stats.neverRun} run at least once` : 'None recorded yet'} />
          <HeadlineCell
            label="Total expected loss"
            loading={loadingAll}
            value={money(stats.expectedTotal, { compact: true })}
            context={stats.expectedCount < stats.total ? `${stats.expectedCount} of ${stats.total} scenarios have stressed loss and probability` : 'Probability-weighted, all scenarios'}
          />
          <HeadlineCell
            label="Worst stressed loss"
            loading={loadingAll}
            value={money(stats.worst?.stressed ?? null, { compact: true })}
            tone={stats.worst ? 'text-risk-critical-text' : undefined}
            context={stats.worst ? str(stats.worst.row.scenario_name) ?? undefined : 'No stressed loss recorded'}
          />
          <HeadlineCell
            label="Never run"
            loading={loadingAll}
            value={<CountUp value={stats.neverRun} />}
            tone={stats.neverRun > 0 ? 'text-status-warning-fg' : undefined}
            context={stats.neverRun ? 'Use Run to evaluate and stamp them' : 'Every scenario has been run'}
          />
        </Headline>
      )}

      <Toolbar>
        <SearchField label="Search scenarios" placeholder="Scenario, category, owner…" value={search} onChange={setSearch} />
        <FilterChip label="Type" value={type === 'All' ? '' : type} onChange={v => setType((v || 'All') as ScenarioType | 'All')} options={TYPES.map(t => ({ value: t, label: t }))} />
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('')
              setType('All')
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
          emptyTitle={filtered ? 'No scenarios match these filters' : 'No scenarios yet'}
          emptyDescription={filtered ? 'Try a different search or filter.' : 'Create a scenario with baseline and stressed losses to see its expected loss.'}
          emptyAction={
            !filtered && canCreate ? (
              <Button onClick={() => setEditing({ row: null })}>
                <Plus aria-hidden="true" />
                New scenario
              </Button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table min-w-[940px]">
              <thead>
                <tr>
                  <th scope="col" className="pl-6">Scenario</th>
                  <th scope="col" data-numeric>Shock</th>
                  <th scope="col" data-numeric>Stressed loss</th>
                  <th scope="col" data-numeric>Uplift</th>
                  <th scope="col" data-numeric>Probability</th>
                  <th scope="col" data-numeric>Expected loss</th>
                  <th scope="col">Last run</th>
                  <th scope="col" className="pr-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map(r => {
                  const m = metrics(r)
                  const isRunning = running === Number(r.uuid)
                  return (
                    <tr key={r.uuid}>
                      <td className="pl-6">
                        <NameCell
                          name={r.scenario_name ?? DASH}
                          detail={[str(r.scenario_type) ?? 'Type not set', str(r.category), str(r.owner_name)].filter(Boolean).join(' · ')}
                          maxWidth="max-w-[215px]"
                        />
                      </td>
                      <td data-numeric className="tabular-nums">{num(r.shock_pct) === null ? <Muted>{DASH}</Muted> : formatPct(num(r.shock_pct), 1)}</td>
                      <td data-numeric className="tabular-nums">
                        <div className="py-1.5">
                          <div className="text-foreground">{money(m.stressed)}</div>
                          <div className="text-caption text-muted-foreground">from {money(m.baseline)}</div>
                        </div>
                      </td>
                      <td data-numeric className="tabular-nums">
                        {m.uplift === null ? (
                          <Muted>{DASH}</Muted>
                        ) : (
                          <span className={m.uplift > 0 ? 'inline-flex items-center gap-1 text-risk-high-text' : 'text-foreground'}>
                            {m.uplift > 0 && <ArrowUp className="size-3.5" aria-hidden="true" />}
                            {money(m.uplift)}
                          </span>
                        )}
                      </td>
                      <td data-numeric className="tabular-nums">{m.probability === null ? <Muted>{DASH}</Muted> : formatPct(m.probability, 1)}</td>
                      <td data-numeric className="tabular-nums font-semibold text-foreground">{money(m.expected)}</td>
                      <td className="whitespace-nowrap">{r.last_run_on ? <Muted>{formatDate(r.last_run_on)}</Muted> : <HatchChip>Never run</HatchChip>}</td>
                      <td className="pr-4">
                        <RowActions
                          name={r.scenario_name}
                          onEdit={hasPermission('update') ? () => setEditing({ row: r }) : undefined}
                          onDelete={hasPermission('delete') ? () => remove(r) : undefined}
                        >
                          {hasPermission('update') && (
                            <Button variant="secondary" size="sm" onClick={() => run(r)} disabled={isRunning} aria-label={`Run ${r.scenario_name}`}>
                              {isRunning ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
                              {isRunning ? 'Running' : 'Run'}
                            </Button>
                          )}
                        </RowActions>
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

      <ScenarioDialog editing={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function ScenarioDialog({ editing, onClose }: { editing: { row: Row | null } | null; onClose: () => void }) {
  const row = editing?.row ?? null
  const { money } = useOrgSettings()
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
  const describedBy = (k: keyof Form) => (errors[k] ? `s-${k}-error` : undefined)

  const finite = (v: string) => {
    const n = parseNum(v)
    return n !== null && Number.isFinite(n) ? n : null
  }
  const previewExpected = expectedLoss(finite(form.stressed_loss), finite(form.probability_pct))
  const previewUplift = lossUplift(finite(form.baseline_loss), finite(form.stressed_loss))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (hasErrors(validate(form))) return
    try {
      if (row) {
        await update.mutateAsync({ id: row.uuid, values: toValues(form) })
        toast.success('Scenario updated')
      } else {
        await create.mutateAsync(toValues(form))
        toast.success('Scenario created')
      }
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const numberInput = (k: 'shock_pct' | 'baseline_loss' | 'stressed_loss' | 'probability_pct', extra: React.ComponentProps<'input'> = {}) => (
    <Input
      id={`s-${k}`}
      type="number"
      step="any"
      value={form[k]}
      onChange={e => set(k, e.target.value)}
     
      aria-invalid={!!errors[k]}
      aria-describedby={describedBy(k)}
      {...extra}
    />
  )

  return (
    <Dialog open={!!editing} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{row ? `Edit ${row.scenario_name}` : 'New scenario'}</DialogTitle>
          <DialogDescription>Fields marked * are required. Use Run on the register to stamp when the scenario was last evaluated.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-5">
          <Field id="s-scenario_name" label="Scenario name" required error={errors.scenario_name}>
            <Input
              id="s-scenario_name"
              value={form.scenario_name}
              onChange={e => set('scenario_name', e.target.value)}
             
              aria-invalid={!!errors.scenario_name}
              aria-describedby={describedBy('scenario_name')}
            />
          </Field>
          <Field id="s-description" label="Description">
            <textarea id="s-description" value={form.description} onChange={e => set('description', e.target.value)} className={textareaClass} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="s-scenario_type" label="Type">
              <select id="s-scenario_type" value={form.scenario_type} onChange={e => set('scenario_type', e.target.value as ScenarioType | '')} className={selectClass}>
                <option value="">Not set</option>
                {TYPES.map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field id="s-category" label="Category">
              <Input id="s-category" value={form.category} onChange={e => set('category', e.target.value)} />
            </Field>
            <Field id="s-owner_name" label="Owner">
              <Input id="s-owner_name" value={form.owner_name} onChange={e => set('owner_name', e.target.value)} />
            </Field>
            <Field id="s-shock_pct" label="Shock (%)" error={errors.shock_pct}>
              {numberInput('shock_pct')}
            </Field>
            <Field id="s-baseline_loss" label="Baseline loss" error={errors.baseline_loss}>
              {numberInput('baseline_loss', { min: 0 })}
            </Field>
            <Field id="s-stressed_loss" label="Stressed loss" error={errors.stressed_loss}>
              {numberInput('stressed_loss', { min: 0 })}
            </Field>
            <Field id="s-probability_pct" label="Probability (%)" error={errors.probability_pct}>
              {numberInput('probability_pct', { min: 0, max: 100 })}
            </Field>
          </div>
          <dl aria-live="polite" className="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-[linear-gradient(var(--border),var(--border))] shadow-[inset_0_0_0_1px_var(--border)]">
            <div className="bg-surface-sunken px-4 py-3">
              <dt className="label-caps">Expected loss</dt>
              <dd className="figure mt-1 text-figure-sm text-foreground">{money(previewExpected)}</dd>
            </div>
            <div className="bg-surface-sunken px-4 py-3">
              <dt className="label-caps">Loss uplift</dt>
              <dd className="figure mt-1 text-figure-sm text-foreground">{money(previewUplift)}</dd>
            </div>
          </dl>
          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : row ? 'Save changes' : 'Create scenario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
