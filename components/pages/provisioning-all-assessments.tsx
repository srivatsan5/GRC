'use client'

/** /rcsa/provisioning — RCSA assessment cycles (erm_trn_assessment_cycle). */
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState } from '@/components/data-state'
import { Pager, useClampPage } from '@/components/pager'
import { LifecycleStepper } from '@/components/charter/lifecycle-stepper'
import { Callout, CountUp, DueChip, FilterChip, Meter, PageHeader, Panel, SearchField, Stat, ViewTabs } from '@/components/charter/primitives'
import { useDeleteRow, useRowPage, useRows, type Row } from '@/lib/data'
import { toRisk } from '@/lib/risk'
import { daysUntil, formatDate } from '@/lib/format'
import { apiErrorMessage } from '@/lib/apiClient'
import { cn } from '@/lib/utils'
import { useDebounced } from '@/components/rcsa/shared'
import { CYCLE_STATUSES, CycleDialog } from '@/components/rcsa/cycle-dialog'
import { CYCLE_TABLE, RISK_TABLE } from '@/components/rcsa/risk-dialog'
import { CycleStatusChip, CycleTimeline } from '@/components/cycles/cycle-bits'

const PAGE_SIZE = 25
const OPEN = new Set(['In Progress', 'Under Review'])

interface CycleCounts {
  risks: number
  rated: number
  approved: number
}

const SORTS = [
  { value: 'submission_deadline:asc', label: 'Deadline' },
  { value: 'cycle_start_date:desc', label: 'Latest start' },
  { value: 'cycle_name:asc', label: 'Name' },
  { value: 'cycle_reference:asc', label: 'Reference' },
]

export function ProvisioningAllAssessmentsPage() {
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounced(searchInput)
  const [status, setStatus] = useState('')
  const [sortKey, setSortKey] = useState('')
  const [dialog, setDialog] = useState<{ open: boolean; cycle: Row | null }>({ open: false, cycle: null })

  const [sortCol, sortOrder] = (sortKey || 'created_on:desc').split(':') as [string, 'asc' | 'desc']
  const cycles = useRowPage(CYCLE_TABLE, { page, pageSize: PAGE_SIZE, search, sort: sortCol, order: sortOrder, filter: status ? { status } : undefined })
  const items = cycles.data?.items ?? []

  // Every cycle and every risk: for the headline figures, status counts and per-cycle progress.
  const allCycles = useRows(CYCLE_TABLE)
  const risks = useRows(RISK_TABLE)
  const counts = useMemo(() => {
    const m = new Map<number, CycleCounts>()
    for (const row of risks.data ?? []) {
      const r = toRisk(row)
      if (r.cycleUuid == null) continue
      const c = m.get(r.cycleUuid) ?? { risks: 0, rated: 0, approved: 0 }
      c.risks++
      if (r.inherentScore != null) c.rated++
      if (r.approvalStatus === 'APPROVED') c.approved++
      m.set(r.cycleUuid, c)
    }
    return m
  }, [risks.data])

  const headline = useMemo(() => {
    const all = allCycles.data ?? []
    const open = all.filter(c => OPEN.has(String(c.status)))
    let risksOpen = 0
    let ratedOpen = 0
    let approvedOpen = 0
    for (const c of open) {
      const n = counts.get(Number(c.uuid))
      risksOpen += n?.risks ?? 0
      ratedOpen += n?.rated ?? 0
      approvedOpen += n?.approved ?? 0
    }
    const byStatus = new Map<string, number>()
    for (const c of all) byStatus.set(String(c.status ?? ''), (byStatus.get(String(c.status ?? '')) ?? 0) + 1)
    const next = all
      .filter(c => c.status !== 'Completed' && daysUntil(c.submission_deadline) != null)
      .sort((a, b) => (daysUntil(a.submission_deadline) ?? 0) - (daysUntil(b.submission_deadline) ?? 0))[0]
    return { total: all.length, open: open.length, byStatus, risksOpen, ratedOpen, approvedOpen, next }
  }, [allCycles.data, counts])

  const unassigned = useRowPage(RISK_TABLE, { page: 1, pageSize: 1, filter: { assessment_cycle_uuid: null } })
  const del = useDeleteRow(CYCLE_TABLE)

  async function remove(c: Row) {
    if (!risks.data) {
      toast.error('Still counting this cycle’s risks. Try again in a moment.')
      return
    }
    const n = counts.get(Number(c.uuid))?.risks ?? 0
    if (n > 0) {
      toast.error(`This cycle has ${n} risk${n === 1 ? '' : 's'}. Move or delete them before deleting the cycle.`)
      return
    }
    const ok = await confirm({ title: `Delete ${c.cycle_reference || c.cycle_name}?`, description: 'The cycle record is removed permanently.', confirmLabel: 'Delete cycle', tone: 'danger' })
    if (!ok) return
    try {
      await del.mutateAsync(c.uuid)
      toast.success('Cycle deleted')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const filtered = !!search || !!status
  const canCreate = hasPermission('create')
  const newButton = canCreate ? (
    <Button onClick={() => setDialog({ open: true, cycle: null })}>
      <Plus aria-hidden="true" />
      New assessment cycle
    </Button>
  ) : null

  const pctRated = headline.risksOpen ? Math.round((headline.ratedOpen / headline.risksOpen) * 100) : null
  const headLoading = allCycles.isLoading || risks.isLoading
  const unassignedCount = unassigned.data?.total ?? 0

  useClampPage(page, cycles.data?.total, PAGE_SIZE, setPage)

  return (
    <div className="space-y-6">
      <LifecycleStepper current="cycles" />

      <PageHeader
        eyebrow="RCSA · Step 1"
        title="Assessment cycles"
        description="Plan each RCSA round, its period and deadline, and follow how many of its risks are rated and approved."
        actions={newButton}
      />

      {/* Headline figures: one panel split by hairlines */}
      <section aria-label="Cycle summary" className="surface-panel grid grid-cols-2 lg:grid-cols-4">
        <div className="p-5 lg:p-6">
          <Stat
            label="Cycles in progress"
            loading={headLoading}
            value={<CountUp value={headline.open} />}
            context={headline.total === 0 ? 'No cycles yet' : [`${headline.byStatus.get('Planned') ?? 0} planned`, `${headline.byStatus.get('Completed') ?? 0} completed`].join(' · ')}
          />
        </div>
        <div className="border-l p-5 lg:p-6">
          <Stat
            label="Risks in open cycles"
            loading={headLoading}
            value={<CountUp value={headline.risksOpen} />}
            context={headline.open ? `Across ${headline.open} open cycle${headline.open === 1 ? '' : 's'}` : 'No cycle is in progress'}
          />
        </div>
        <div className="border-t p-5 lg:border-t-0 lg:border-l lg:p-6">
          <Stat
            label="Inherent rated"
            loading={headLoading}
            value={pctRated == null ? '—' : <CountUp value={pctRated} />}
            suffix={pctRated == null ? undefined : '%'}
            context={headline.risksOpen ? `${headline.ratedOpen} of ${headline.risksOpen} rated · ${headline.approvedOpen} approved` : 'No risks in open cycles'}
          >
            <Meter value={pctRated} label="Share of risks in open cycles with an inherent rating" className="mt-1" />
          </Stat>
        </div>
        <div className="border-t border-l p-5 lg:border-t-0 lg:p-6">
          <Stat
            label="Next deadline"
            loading={headLoading}
            value={headline.next ? formatDate(headline.next.submission_deadline, { day: 'numeric', month: 'short' }) : '—'}
            context={
              headline.next ? (
                <Link href={`/rcsa/provisioning/${headline.next.uuid}`} className="rounded-xs hover:text-foreground hover:underline focus-ring">
                  {headline.next.cycle_name}
                </Link>
              ) : (
                'No open cycle has a deadline'
              )
            }
          >
            {headline.next && <DeadlineNote date={headline.next.submission_deadline} />}
          </Stat>
        </div>
      </section>

      {unassignedCount > 0 && (
        <Callout
          tone="info"
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/rcsa/identification">Open the risk register</Link>
            </Button>
          }
        >
          <strong className="font-semibold">
            {unassignedCount} risk{unassignedCount === 1 ? '' : 's'}
          </strong>{' '}
          {unassignedCount === 1 ? "isn't" : "aren't"} in any assessment cycle, so {unassignedCount === 1 ? 'it is' : 'they are'} outside every RCSA round. Assign a cycle from the register.
        </Callout>
      )}

      <div className="space-y-4">
        <ViewTabs
          label="Cycle status"
          value={status}
          onChange={v => {
            setStatus(v)
            setPage(1)
          }}
          views={[
            { value: '', label: 'All cycles', count: allCycles.data ? headline.total : null },
            ...CYCLE_STATUSES.map(s => ({ value: s as string, label: s, count: allCycles.data ? (headline.byStatus.get(s) ?? 0) : null })),
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            label="Search cycles"
            placeholder="Reference, name, period…"
            value={searchInput}
            onChange={v => {
              setSearchInput(v)
              setPage(1)
            }}
          />
          <FilterChip
            label="Sort"
            anyLabel="Newest"
            value={sortKey}
            onChange={v => {
              setSortKey(v)
              setPage(1)
            }}
            options={SORTS}
          />
        </div>
      </div>

      <Panel bodyClassName="p-0">
        <DataState
          query={cycles}
          empty={items.length === 0}
          emptyTitle={filtered ? 'No cycles match these filters' : 'No assessment cycles yet'}
          emptyDescription={filtered ? 'Try another status or clear the search.' : 'Create a cycle to group the risks you assess together in one RCSA round.'}
          emptyAction={filtered ? undefined : newButton}
        >
          <ul aria-label="Assessment cycles" className="divide-y">
            {items.map(c => (
              <CycleRow
                key={c.uuid}
                cycle={c}
                counts={counts.get(Number(c.uuid))}
                countsState={risks.isLoading ? 'loading' : risks.isError ? 'error' : 'ok'}
                canEdit={hasPermission('update')}
                canDelete={hasPermission('delete')}
                deleting={del.isPending}
                onEdit={() => setDialog({ open: true, cycle: c })}
                onDelete={() => remove(c)}
              />
            ))}
          </ul>
          <Pager page={page} pageSize={PAGE_SIZE} total={cycles.data?.total ?? 0} onPage={setPage} busy={cycles.isFetching} />
        </DataState>
      </Panel>

      <CycleDialog open={dialog.open} cycle={dialog.cycle} onOpenChange={open => setDialog(d => ({ ...d, open }))} />
    </div>
  )
}

function CycleRow({
  cycle: c,
  counts,
  countsState,
  canEdit,
  canDelete,
  deleting,
  onEdit,
  onDelete,
}: {
  cycle: Row
  counts: CycleCounts | undefined
  countsState: 'loading' | 'error' | 'ok'
  canEdit: boolean
  canDelete: boolean
  deleting: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const href = `/rcsa/provisioning/${c.uuid}`
  const completed = c.status === 'Completed'
  const n = counts ?? { risks: 0, rated: 0, approved: 0 }
  const meta = [c.cycle_type, c.cycle_period, c.cycle_year].filter(v => v != null && String(v).trim() !== '').join(' · ')
  return (
    <li className="grid grid-cols-1 gap-x-10 gap-y-5 px-5 py-5 transition-colors duration-(--duration-fast) ease-out hover:bg-hover sm:px-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1.1fr)_minmax(0,1fr)_auto] lg:items-center">
      {/* Identity */}
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-caption text-muted-foreground">{c.cycle_reference || 'No reference'}</span>
          <CycleStatusChip status={c.status} />
        </div>
        <h2 className="text-figure-sm leading-tight">
          <Link href={href} className="rounded-xs underline-offset-4 hover:underline focus-ring">
            {c.cycle_name || 'Untitled cycle'}
          </Link>
        </h2>
        {meta && <p className="text-caption text-muted-foreground">{meta}</p>}
      </div>

      {/* Schedule */}
      <div className="min-w-0 space-y-3">
        <CycleTimeline start={c.cycle_start_date} end={c.cycle_end_date} deadline={c.submission_deadline} completed={completed} />
        <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
          <span>Submission deadline</span>
          <DueChip date={c.submission_deadline} done={completed} doneLabel="Cycle completed" noDateLabel="Not set" />
          {!completed && (daysUntil(c.submission_deadline) ?? 99) <= 14 && <span className="tabular-nums text-foreground-secondary">{formatDate(c.submission_deadline)}</span>}
        </div>
      </div>

      {/* Progress */}
      <div className="min-w-0 space-y-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="label-caps">Progress</span>
          <span className="text-body-sm text-foreground-secondary">
            {countsState === 'loading' ? (
              <span className="skeleton inline-block h-3 w-12 align-middle" />
            ) : countsState === 'error' ? (
              '—'
            ) : (
              <>
                <span className="figure text-figure-sm text-foreground">{n.risks}</span> risk{n.risks === 1 ? '' : 's'}
              </>
            )}
          </span>
        </div>
        {countsState === 'ok' && n.risks === 0 ? (
          <p className="text-caption text-muted-foreground">No risks in this cycle yet.</p>
        ) : (
          <>
            <ProgressLine label="Inherent rated" part={n.rated} whole={n.risks} pending={countsState !== 'ok'} />
            <ProgressLine label="Approved" part={n.approved} whole={n.risks} pending={countsState !== 'ok'} />
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 lg:justify-end">
        <Button asChild variant="secondary" size="sm">
          <Link href={href} aria-label={`Open ${c.cycle_name || 'cycle'}`}>
            Open
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        {canEdit && (
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${c.cycle_name || 'cycle'}`} onClick={onEdit}>
            <Pencil aria-hidden="true" />
          </Button>
        )}
        {canDelete && (
          <Button variant="ghost" size="icon" className="size-8 hover:text-status-danger-fg" aria-label={`Delete ${c.cycle_name || 'cycle'}`} disabled={deleting} onClick={onDelete}>
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      </div>
    </li>
  )
}

/** Quiet "in 44 days" for a far deadline; the due chip once it is close or past. */
function DeadlineNote({ date }: { date: string | null | undefined }) {
  const d = daysUntil(date)
  if (d == null) return null
  if (d <= 14) {
    return (
      <span>
        <DueChip date={date} />
      </span>
    )
  }
  return <p className="text-body-sm text-foreground-secondary">{`In ${d} days · ${formatDate(date)}`}</p>
}

function ProgressLine({ label, part, whole, pending, tone }: { label: string; part: number; whole: number; pending?: boolean; tone?: string }) {
  const pct = whole ? Math.round((part / whole) * 100) : null
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
      <span className="text-caption text-foreground-secondary">{label}</span>
      <span className={cn('text-caption tabular-nums', pending ? 'text-muted-foreground' : 'text-foreground')}>{pending ? '—' : `${part} of ${whole}`}</span>
      <Meter value={pending ? null : pct} tone={tone} label={`${label}: ${part} of ${whole}`} className="col-span-2" />
    </div>
  )
}
