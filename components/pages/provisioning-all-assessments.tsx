'use client'

/** /rcsa/provisioning — RCSA assessment cycles (erm_trn_assessment_cycle). */
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { useDeleteRow, useRowPage, useRows, type Row } from '@/lib/data'
import { toRisk } from '@/lib/risk'
import { daysUntil, formatDate } from '@/lib/format'
import { apiErrorMessage } from '@/lib/apiClient'
import { RcsaStepper, SortHeader, selectClass, useDebounced, type SortState } from '@/components/rcsa/shared'
import { CYCLE_STATUSES, CycleDialog, CycleStatusBadge } from '@/components/rcsa/cycle-dialog'
import { CYCLE_TABLE, RISK_TABLE } from '@/components/rcsa/risk-dialog'

const PAGE_SIZE = 25

interface CycleCounts {
  risks: number
  rated: number
  approved: number
}

export function ProvisioningAllAssessmentsPage() {
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounced(searchInput)
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState<SortState>({ sort: 'created_on', order: 'desc' })
  const [dialog, setDialog] = useState<{ open: boolean; cycle: Row | null }>({ open: false, cycle: null })

  const cycles = useRowPage(CYCLE_TABLE, { page, pageSize: PAGE_SIZE, search, sort: sort.sort, order: sort.order, filter: status ? { status } : undefined })
  const items = cycles.data?.items ?? []
  const ids = useMemo(() => items.map(c => Number(c.uuid)).filter(Number.isFinite), [items])

  const risks = useRows(RISK_TABLE, { filter: { assessment_cycle_uuid: ids }, enabled: ids.length > 0 })
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

  const unassigned = useRowPage(RISK_TABLE, { page: 1, pageSize: 1, filter: { assessment_cycle_uuid: null } })
  const del = useDeleteRow(CYCLE_TABLE)

  async function remove(c: Row) {
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

  const onSort = (s: SortState) => {
    setSort(s)
    setPage(1)
  }

  const filtered = !!search || !!status
  const newButton = hasPermission('create') ? (
    <Button size="sm" className="h-8" onClick={() => setDialog({ open: true, cycle: null })}>
      <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
      New assessment cycle
    </Button>
  ) : null

  return (
    <div className="space-y-6 font-sans">
      <RcsaStepper active="setup" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Assessment cycles</h1>
          <p className="text-xs text-slate-500">Plan RCSA rounds and track how many of their risks are rated and approved.</p>
        </div>
        {newButton}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="cycle-search" className="block text-xs text-slate-600 mb-1">
              Search
            </label>
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <Input
                id="cycle-search"
                placeholder="Reference, name, period…"
                value={searchInput}
                onChange={e => {
                  setSearchInput(e.target.value)
                  setPage(1)
                }}
                className="pl-8 h-8 text-xs bg-white"
              />
            </div>
          </div>
          <div>
            <label htmlFor="cycle-status-filter" className="block text-xs text-slate-600 mb-1">
              Status
            </label>
            <select
              id="cycle-status-filter"
              value={status}
              onChange={e => {
                setStatus(e.target.value)
                setPage(1)
              }}
              className={`${selectClass} w-44`}
            >
              <option value="">All statuses</option>
              {CYCLE_STATUSES.map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        {unassigned.data && unassigned.data.total > 0 && (
          <p className="text-xs text-slate-500">
            {unassigned.data.total} risk{unassigned.data.total === 1 ? ' is' : 's are'} not in any cycle.{' '}
            <Link href="/rcsa/identification" className="text-blue-800 hover:underline">
              Open the risk register
            </Link>
          </p>
        )}
      </div>

      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <DataState
          query={cycles}
          empty={items.length === 0}
          emptyTitle={filtered ? 'No cycles match these filters' : 'No assessment cycles yet'}
          emptyDescription={filtered ? undefined : 'Create a cycle to group the risks you assess together.'}
          emptyAction={filtered ? undefined : newButton}
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <SortHeader label="Reference" column="cycle_reference" state={sort} onSort={onSort} />
                  <SortHeader label="Name" column="cycle_name" state={sort} onSort={onSort} />
                  <SortHeader label="Start" column="cycle_start_date" state={sort} onSort={onSort} />
                  <SortHeader label="End" column="cycle_end_date" state={sort} onSort={onSort} />
                  <SortHeader label="Deadline" column="submission_deadline" state={sort} onSort={onSort} />
                  <SortHeader label="Status" column="status" state={sort} onSort={onSort} />
                  <th className="text-right">Risks</th>
                  <th>Rated</th>
                  <th>Approved</th>
                  <th className="text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map(c => {
                  const n = counts.get(Number(c.uuid))
                  const due = daysUntil(c.submission_deadline)
                  const overdue = due != null && due < 0 && c.status !== 'Completed'
                  return (
                    <tr key={c.uuid}>
                      <td className="font-mono text-xs text-slate-800">{c.cycle_reference || '—'}</td>
                      <td>
                        <Link href={`/rcsa/provisioning/${c.uuid}`} className="font-medium text-slate-900 hover:underline">
                          {c.cycle_name}
                        </Link>
                        {(c.cycle_period || c.cycle_type) && <span className="block text-[11px] text-slate-500">{[c.cycle_type, c.cycle_period].filter(Boolean).join(' · ')}</span>}
                      </td>
                      <td className="whitespace-nowrap">{formatDate(c.cycle_start_date)}</td>
                      <td className="whitespace-nowrap">{formatDate(c.cycle_end_date)}</td>
                      <td className="whitespace-nowrap">
                        {formatDate(c.submission_deadline)}
                        {overdue && <span className="ml-1 text-[11px] font-medium text-red-700">Overdue</span>}
                      </td>
                      <td>
                        <CycleStatusBadge status={c.status} />
                      </td>
                      <td className="text-right tabular-nums">{risks.isLoading ? '…' : risks.isError ? '—' : (n?.risks ?? 0)}</td>
                      <td>
                        <Progress part={n?.rated ?? 0} whole={n?.risks ?? 0} loading={risks.isLoading} failed={risks.isError} />
                      </td>
                      <td>
                        <Progress part={n?.approved ?? 0} whole={n?.risks ?? 0} loading={risks.isLoading} failed={risks.isError} />
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {hasPermission('update') && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit ${c.cycle_name}`} onClick={() => setDialog({ open: true, cycle: c })}>
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            </Button>
                          )}
                          {hasPermission('delete') && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-50" aria-label={`Delete ${c.cycle_name}`} disabled={del.isPending} onClick={() => remove(c)}>
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </Button>
                          )}
                          <Button asChild size="sm" variant="ghost" className="text-blue-800">
                            <Link href={`/rcsa/provisioning/${c.uuid}`}>Open &rarr;</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={cycles.data?.total ?? 0} onPage={setPage} busy={cycles.isFetching} />
        </DataState>
      </div>

      <CycleDialog open={dialog.open} cycle={dialog.cycle} onOpenChange={open => setDialog(d => ({ ...d, open }))} />
    </div>
  )
}

function Progress({ part, whole, loading, failed }: { part: number; whole: number; loading?: boolean; failed?: boolean }) {
  if (loading) return <span className="text-slate-400">…</span>
  if (failed || whole === 0) return <span className="text-slate-400">—</span>
  const pct = Math.round((part / whole) * 100)
  return (
    <div className="flex items-center gap-2 min-w-[96px]">
      <div className="h-1.5 w-14 rounded bg-slate-100" aria-hidden="true">
        <div className="h-1.5 rounded bg-blue-800" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-slate-600">
        {part}/{whole}
      </span>
    </div>
  )
}
