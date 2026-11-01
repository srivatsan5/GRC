'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Download, KanbanSquare, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LifecycleStepper } from '@/components/charter/lifecycle-stepper'
import { DueChip, FilterChip, PageHeader, Panel, Person, SearchField, ViewTabs } from '@/components/charter/primitives'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState } from '@/components/data-state'
import { Pager, useClampPage } from '@/components/pager'
import { useRows, type Row } from '@/lib/data'
import { recordAudit } from '@/lib/auditLog'
import { toRisk, type Risk } from '@/lib/risk'
import { formatDate } from '@/lib/format'
import { ActionPlanDialog, MONITORING, useDeleteActionPlan } from '@/components/treatment/action-plan-dialog'
import { ProgressBar, actionStatus, downloadCsv, numOrNull, pageSlice, riskLabel, riskRefOf, rowId, text } from '@/components/treatment/shared'

const PAGE_SIZE = 25
type Tab = 'all' | 'open' | 'overdue' | 'completed'
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Completed' },
]

function inTab(p: Row, tab: Tab): boolean {
  const s = actionStatus(p)
  if (tab === 'open') return s !== 'Completed'
  if (tab === 'overdue') return s === 'Overdue'
  if (tab === 'completed') return s === 'Completed'
  return true
}

export function MonitoringactionplanPage() {
  const { hasPermission } = useAuth()
  const params = useSearchParams()
  const focusId = numOrNull(params.get('id') ?? params.get('actionId'))

  const plansQ = useRows(MONITORING)
  const risksQ = useRows('per_trn_identify_risk')
  const { remove, isPending: removing } = useDeleteActionPlan()

  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [riskFilter, setRiskFilter] = useState<number | null>(numOrNull(params.get('riskId')))
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  useEffect(() => setPage(1), [tab, search, riskFilter])

  // ?q= and ?riskId= follow the URL when it changes while the page is open.
  const qParam = params.get('q'), riskParam = params.get('riskId')
  useEffect(() => {
    if (qParam) setSearch(qParam)
  }, [qParam])
  useEffect(() => {
    if (riskParam) setRiskFilter(numOrNull(riskParam))
  }, [riskParam])

  // Deep link (?id=) opens that plan for editing once it has loaded (each new id once).
  const [handledId, setHandledId] = useState<number | null>(null)
  useEffect(() => {
    if (focusId == null || handledId === focusId || !plansQ.data) return
    const row = plansQ.data.find(p => rowId(p) === focusId)
    setHandledId(focusId)
    if (row && hasPermission('update')) {
      setEditing(row)
      setDialogOpen(true)
    } else if (row) {
      setSearch(text(row.monitoring_title) ?? '')
    }
  }, [focusId, plansQ.data, handledId, hasPermission])

  const risks = useMemo(() => {
    const m = new Map<number, Risk>()
    for (const r of risksQ.data ?? []) {
      const risk = toRisk(r)
      if (Number.isFinite(risk.uuid)) m.set(risk.uuid, risk)
    }
    return m
  }, [risksQ.data])

  const plans = useMemo(() => plansQ.data ?? [], [plansQ.data])
  const base = useMemo(() => {
    const term = search.trim().toLowerCase()
    return plans.filter(p => {
      if (riskFilter != null && numOrNull(p.identify_risk_uuid) !== riskFilter) return false
      if (!term) return true
      const rid = numOrNull(p.identify_risk_uuid)
      return [text(p.monitoring_title), text(p.monitoring_goal), text(p.root_cause), text(p.mitigation_owner), rid != null ? risks.get(rid)?.statement : null]
        .some(v => v && v.toLowerCase().includes(term))
    })
  }, [plans, search, riskFilter, risks])
  const tabCounts = useMemo(() => Object.fromEntries(TABS.map(t => [t.id, base.filter(p => inTab(p, t.id)).length])) as Record<Tab, number>, [base])
  const shown = useMemo(() => base.filter(p => inTab(p, tab)), [base, tab])

  const openNew = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const exportCsv = () => {
    downloadCsv(
      `action-plans-${new Date().toISOString().slice(0, 10)}.csv`,
      ['ID', 'Title', 'Goal', 'Root cause', 'Risk ID', 'Risk', 'Owner', 'Planned start', 'Target end', 'Actual start', 'Actual end', 'Completion %', 'Status'],
      shown.map(p => {
        const rid = numOrNull(p.identify_risk_uuid)
        return [
          rowId(p),
          text(p.monitoring_title),
          text(p.monitoring_goal),
          text(p.root_cause),
          rid,
          rid != null ? risks.get(rid)?.statement : null,
          text(p.mitigation_owner),
          text(p.estimated_start_date)?.slice(0, 10),
          text(p.estimated_end_date)?.slice(0, 10),
          text(p.actual_start_date)?.slice(0, 10),
          text(p.actual_end_date)?.slice(0, 10),
          numOrNull(p.completion_pct),
          actionStatus(p),
        ]
      }),
    )
    recordAudit({ action: 'EXPORT', entity: 'Action plans', description: `Exported ${shown.length} action plans to CSV`, result: 'SUCCESS' })
  }

  const filtered = !!search || riskFilter != null || tab !== 'all'
  const loaded = !!(plansQ.data && risksQ.data)
  const canCreate = hasPermission('create')
  const newButton = canCreate ? (
    <Button onClick={openNew}>
      <Plus aria-hidden="true" />
      New action plan
    </Button>
  ) : undefined

  useClampPage(page, shown.length, PAGE_SIZE, setPage)

  return (
    <div className="space-y-6">
      <LifecycleStepper current="monitoring" />

      <PageHeader
        eyebrow="RCSA · Step 5 · Treatment"
        title="Action plans"
        description="Treatment actions for risks: owner, target dates and progress."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/risk-response">
                <KanbanSquare aria-hidden="true" />
                Pipeline view
              </Link>
            </Button>
            <Button variant="secondary" onClick={exportCsv} disabled={shown.length === 0}>
              <Download aria-hidden="true" />
              Export CSV
            </Button>
            {newButton}
          </>
        }
      />

      <div className="space-y-4">
        <ViewTabs<Tab> label="Filter by status" value={tab} onChange={setTab} views={TABS.map(t => ({ value: t.id, label: t.label, count: plansQ.data ? tabCounts[t.id] : null }))} />
        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={search} onChange={setSearch} label="Search action plans" placeholder="Title, goal, root cause, owner, risk…" />
          <FilterChip
            label="Risk"
            value={riskFilter != null ? String(riskFilter) : ''}
            onChange={v => setRiskFilter(v ? Number(v) : null)}
            options={[
              ...(riskFilter != null && !risks.has(riskFilter) ? [{ value: String(riskFilter), label: `Risk #${riskFilter}` }] : []),
              ...[...risks.values()].map(r => ({ value: String(r.uuid), label: `${r.referenceNumber ?? `#${r.uuid}`} · ${(r.statement ?? 'No statement recorded').slice(0, 60)}` })),
            ]}
          />
          {(search || riskFilter != null) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('')
                setRiskFilter(null)
              }}
            >
              Clear filters
            </Button>
          )}
          <span className="ml-auto text-caption tabular-nums text-muted-foreground">{loaded ? `${shown.length} of ${plans.length}` : ''}</span>
        </div>
      </div>

      <Panel bodyClassName="p-0">
        <DataState
          query={[plansQ, risksQ]}
          empty={shown.length === 0}
          emptyTitle={filtered ? 'No action plans match' : 'No action plans yet'}
          emptyDescription={filtered ? 'Change the tab, search or risk filter.' : 'Create an action plan for a risk that needs treatment.'}
          emptyAction={!filtered ? newButton : undefined}
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table min-w-[900px]">
              <thead>
                <tr>
                  <th className="pl-6">Action plan</th>
                  <th>Risk</th>
                  <th>Owner</th>
                  <th>Schedule</th>
                  <th>Progress &amp; due</th>
                  <th className="pr-6 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageSlice(shown, page, PAGE_SIZE).map(p => {
                  const id = rowId(p)
                  const rid = numOrNull(p.identify_risk_uuid)
                  const risk = rid != null ? risks.get(rid) : undefined
                  const title = text(p.monitoring_title) ?? `Action plan #${id}`
                  const st = actionStatus(p)
                  const focused = id === focusId
                  const sub = text(p.monitoring_goal) ?? (text(p.root_cause) ? `Root cause: ${text(p.root_cause)}` : null)
                  return (
                    <tr key={id ?? JSON.stringify(p)} aria-selected={focused || undefined}>
                      <td className={'max-w-[250px] py-2 pl-6 ' + (focused ? 'shadow-[inset_3px_0_0_var(--primary)]' : '')}>
                        <span className="block truncate font-medium text-foreground" title={title}>
                          {title}
                        </span>
                        <span className="block truncate text-caption text-muted-foreground" title={sub ?? undefined}>
                          {sub ?? 'No goal recorded'}
                        </span>
                      </td>
                      <td className="max-w-[210px] py-2">
                        {rid != null ? (
                          <>
                            <Link href={`/risks/${rid}`} className="block truncate rounded-xs text-foreground hover:text-primary hover:underline focus-ring" title={riskLabel(risk, rid)}>
                              {riskLabel(risk, rid)}
                            </Link>
                            <span className="block font-mono text-caption text-muted-foreground">{riskRefOf(risk, rid)}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">No risk linked</span>
                        )}
                      </td>
                      <td className="max-w-[150px]">
                        <Person name={text(p.mitigation_owner)} />
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <span className="block tabular-nums text-foreground-secondary">
                          {formatDate(text(p.estimated_start_date), { day: 'numeric', month: 'short' })} – {formatDate(text(p.estimated_end_date), { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="block text-caption tabular-nums text-muted-foreground">
                          {text(p.actual_start_date) || text(p.actual_end_date)
                            ? `Actual ${formatDate(text(p.actual_start_date), { day: 'numeric', month: 'short' })} – ${text(p.actual_end_date) ? formatDate(text(p.actual_end_date), { day: 'numeric', month: 'short', year: 'numeric' }) : 'ongoing'}`
                            : 'No actual dates yet'}
                        </span>
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <span className="flex flex-col items-start gap-1.5">
                          <ProgressBar value={numOrNull(p.completion_pct)} />
                          <DueChip date={text(p.estimated_end_date)} done={st === 'Completed'} doneLabel="Completed" />
                        </span>
                      </td>
                      <td className="pr-6 text-right whitespace-nowrap">
                        {hasPermission('update') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${title}`}
                            onClick={() => {
                              setEditing(p)
                              setDialogOpen(true)
                            }}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                        )}
                        {hasPermission('delete') && (
                          <Button variant="ghost" size="icon" className="hover:bg-status-danger-bg hover:text-status-danger-fg" aria-label={`Delete ${title}`} disabled={removing} onClick={() => remove(p)}>
                            <Trash2 aria-hidden="true" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={shown.length} onPage={setPage} />
        </DataState>
      </Panel>

      <ActionPlanDialog open={dialogOpen} onOpenChange={setDialogOpen} row={editing} defaultRiskId={riskFilter} />
    </div>
  )
}
