'use client'

/**
 * /rcsa/identification and /risk-identification — the risk register (per_trn_identify_risk), Charter §7.
 *
 * Saved views and the process / cycle / owner chips filter on the server; the band chips and sorting by a
 * computed score (likelihood × impact) load the server-filtered rows and finish here. Rows open the detail
 * sheet; approvals live in the sheet footer (and bulk approve for approvers), not on the rows.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, CircleCheck, Columns3, Download, Ellipsis, FileSpreadsheet, OctagonAlert, Pencil, Plus, Rows3, Rows4, ShieldCheck, SquareArrowOutUpRight, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { BandBadge, RiskMovement } from '@/components/band-badge'
import { LifecycleStepper } from '@/components/charter/lifecycle-stepper'
import { Callout, FilterChip, PageHeader, Panel, Person, SearchField, Segmented, ViewTabs } from '@/components/charter/primitives'
import { riskRef } from '@/components/charter/heatmap'
import { fetchAllRows, useCreateRow, useDeleteRow, useRowPage, useRows, useUpdateRow, type PageParams, type Row } from '@/lib/data'
import { BANDS, toRisk, type Risk } from '@/lib/risk'
import { formatDate } from '@/lib/format'
import { useOrgSettings } from '@/lib/settings'
import { useDensity } from '@/lib/preferences'
import { apiErrorMessage } from '@/lib/apiClient'
import { recordAudit } from '@/lib/auditLog'
import { cn } from '@/lib/utils'
import { ApprovalBadge, SortHeader, approvalLabel, downloadCsv, parseCsv, textareaClass, useDebounced, type SortState } from '@/components/rcsa/shared'
import { CYCLE_TABLE, RISK_TABLE, RiskDialog } from '@/components/rcsa/risk-dialog'
import { AWAITING_STATUSES } from '@/components/rcsa/risk-decision'
import { RiskDetailSheet } from '@/components/risk/risk-detail-sheet'
import { CycleLink, inherentRateHref, riskControlsHref } from '@/components/risk/risk-sections'

/** Columns the API searches for this table (kept in step with the client-side fallback). */
const SEARCH_COLS = ['risk_statement', 'process_name', 'sub_process_name', 'risk_type', 'risk_owner', 'assessment_reference_number']
const NONE = '__none__'
const NOT_RATED = 'Not rated'

// CSV import template — exactly the columns the import reads.
const CSV_COLUMNS = ['Risk statement', 'Category', 'Business process', 'Sub-process', 'Risk owner', 'Risk champion', 'Inherent likelihood (1-5)', 'Inherent impact (1-5)', 'SLE', 'Cycle reference'] as const

type ImportRow = { line: number; values: Row; errors: string[] }
type ImportResult = { ok: number; failed: { line: number; message: string }[] }
type Filter = NonNullable<PageParams['filter']>

// ── Saved views ──────────────────────────────────────────────────────────────

type View = 'all' | 'unrated' | 'awaiting' | 'draft' | 'approved'
const VIEWS: { value: View; label: string; filter?: Filter }[] = [
  { value: 'all', label: 'All risks' },
  { value: 'unrated', label: 'Needs rating', filter: { inherent_likelihood: null } },
  { value: 'awaiting', label: 'Awaiting approval', filter: { approval_status: [...AWAITING_STATUSES] } },
  { value: 'draft', label: 'Draft', filter: { approval_status: ['DRAFT', null] } },
  { value: 'approved', label: 'Approved', filter: { approval_status: 'APPROVED' } },
]
const isView = (v: string | null): v is View => VIEWS.some(x => x.value === v)

/** Real totals per saved view, from the server (one tiny page each). */
function useViewCounts(): Record<View, number | null> {
  const q = {
    all: useRowPage(RISK_TABLE, { page: 1, pageSize: 1 }),
    unrated: useRowPage(RISK_TABLE, { page: 1, pageSize: 1, filter: VIEWS[1]!.filter }),
    awaiting: useRowPage(RISK_TABLE, { page: 1, pageSize: 1, filter: VIEWS[2]!.filter }),
    draft: useRowPage(RISK_TABLE, { page: 1, pageSize: 1, filter: VIEWS[3]!.filter }),
    approved: useRowPage(RISK_TABLE, { page: 1, pageSize: 1, filter: VIEWS[4]!.filter }),
  }
  return {
    all: q.all.data?.total ?? null,
    unrated: q.unrated.data?.total ?? null,
    awaiting: q.awaiting.data?.total ?? null,
    draft: q.draft.data?.total ?? null,
    approved: q.approved.data?.total ?? null,
  }
}

// ── Columns ──────────────────────────────────────────────────────────────────

type ColKey = 'category' | 'owner' | 'cycle' | 'inherent' | 'residual' | 'sle' | 'approval' | 'created'
const COLUMNS: { key: ColKey; label: string }[] = [
  { key: 'category', label: 'Category' },
  { key: 'owner', label: 'Owner' },
  { key: 'cycle', label: 'Cycle' },
  { key: 'inherent', label: 'Inherent' },
  { key: 'residual', label: 'Residual' },
  { key: 'sle', label: 'SLE' },
  { key: 'approval', label: 'Approval' },
  { key: 'created', label: 'Created' },
]
const TOTAL_COLUMNS = COLUMNS.length + 1 // + Risk, which is always shown

function useColumnPrefs(userId: string | undefined) {
  const key = `pericope_register_columns:${userId ?? 'anon'}`
  const [hidden, setHidden] = useState<ColKey[] | null>(null)
  useEffect(() => {
    try {
      const v = localStorage.getItem(key)
      setHidden(v ? (JSON.parse(v) as ColKey[]) : null)
    } catch {
      setHidden(null)
    }
  }, [key])
  const save = (next: ColKey[]) => {
    setHidden(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      /* private mode */
    }
  }
  return [hidden, save] as const
}

// Computed sort keys (not columns in the table, so the server can't sort on them).
const SCORE_SORTS: Record<string, (r: Risk) => number | null> = {
  inherent_score: r => r.inherentScore,
  residual_score: r => r.residualScore,
}

function matchesBand(score: number | null, wanted: string, band: (s: number | null) => string | null): boolean {
  return !wanted || (band(score) ?? NOT_RATED) === wanted
}

export function RiskIdentificationPage() {
  const confirm = useConfirm()
  const { hasPermission, user } = useAuth()
  const { money, band } = useOrgSettings()
  const [density, setDensity] = useDensity()
  const compact = density === 'compact'
  const canCreate = hasPermission('create')
  const canUpdate = hasPermission('update')
  const canDelete = hasPermission('delete')
  const canApprove = hasPermission('approve')

  const [view, setView] = useState<View>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounced(searchInput)
  const [sort, setSort] = useState<SortState>({ sort: 'created_on', order: 'desc' })
  const [inherentBand, setInherentBand] = useState('')
  const [residualBand, setResidualBand] = useState('')
  const [process, setProcess] = useState('')
  const [cycle, setCycle] = useState('')
  const [owner, setOwner] = useState('')
  const [dialog, setDialog] = useState<{ open: boolean; risk: Row | null }>({ open: false, risk: null })
  const [importOpen, setImportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [bulk, setBulk] = useState<{ running: boolean; ok: number; failed: { id: number; label: string; message: string }[] } | null>(null)

  // Deep links: ?q= prefills search, ?new=1 opens "Add risk", ?cycle=<uuid> filters, ?view=<view> picks a saved view.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const q = p.get('q')
    if (q) setSearchInput(q)
    const c = p.get('cycle')
    if (c && /^\d+$/.test(c)) setCycle(c)
    const v = p.get('view')
    if (isView(v)) setView(v)
    if (p.get('new') === '1') setDialog({ open: true, risk: null })
  }, [])

  const viewFilter = VIEWS.find(v => v.value === view)?.filter
  const filter = useMemo(() => {
    const f: Filter = { ...(viewFilter ?? {}) }
    if (process) f.process_name = process === NONE ? null : process
    if (owner) f.risk_owner = owner === NONE ? null : owner
    if (cycle === NONE) f.assessment_cycle_uuid = null
    else if (cycle) f.assessment_cycle_uuid = Number(cycle)
    return Object.keys(f).length ? f : undefined
  }, [viewFilter, process, owner, cycle])

  // Bands and score sorts are computed (likelihood × impact): load the server-filtered rows and finish here.
  const clientMode = !!inherentBand || !!residualBand || sort.sort in SCORE_SORTS
  const serverPage = useRowPage(RISK_TABLE, { page, pageSize, search, sort: sort.sort, order: sort.order, filter }, { enabled: !clientMode })
  const clientRows = useRows(RISK_TABLE, { filter, enabled: clientMode })
  const all = useRows(RISK_TABLE) // filter options, category column default, sheet fallback
  const cycles = useRows(CYCLE_TABLE)
  const counts = useViewCounts()

  const clientPage = useMemo(() => {
    if (!clientMode) return null
    const term = search.trim().toLowerCase()
    let rows = (clientRows.data ?? []).filter(r => {
      const k = toRisk(r)
      if (!matchesBand(k.inherentScore, inherentBand, band) || !matchesBand(k.residualScore, residualBand, band)) return false
      return !term || SEARCH_COLS.some(c => r[c] != null && String(r[c]).toLowerCase().includes(term))
    })
    const scoreOf = SCORE_SORTS[sort.sort]
    rows = [...rows].sort((x, y) => {
      const a = scoreOf ? scoreOf(toRisk(x)) : x[sort.sort]
      const b = scoreOf ? scoreOf(toRisk(y)) : y[sort.sort]
      if (a == null || b == null) return a == null && b == null ? 0 : a == null ? 1 : -1 // nulls last
      const d = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
      return sort.order === 'desc' ? -d : d
    })
    return { total: rows.length, items: rows.slice((page - 1) * pageSize, page * pageSize), all: rows }
  }, [clientMode, clientRows.data, inherentBand, residualBand, search, sort, page, pageSize, band])

  const query = clientMode ? clientRows : serverPage
  const items = useMemo(() => (clientMode ? (clientPage?.items ?? []) : (serverPage.data?.items ?? [])), [clientMode, clientPage, serverPage.data])
  const total = clientMode ? (clientPage?.total ?? 0) : (serverPage.data?.total ?? 0)

  const allRisks = useMemo(() => (all.data ?? []).map(toRisk), [all.data])
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b))
  const processes = useMemo(() => uniq(allRisks.map(r => r.process)), [allRisks])
  const owners = useMemo(() => uniq(allRisks.map(r => r.owner)), [allRisks])
  const hasCategory = allRisks.some(r => r.category)
  const cycleById = useMemo(() => new Map((cycles.data ?? []).map(c => [Number(c.uuid), c])), [cycles.data])

  // Columns: Category is hidden by default while no risk has one.
  const [hiddenPref, setHiddenPref] = useColumnPrefs(user?.id)
  const hidden = useMemo(() => new Set<ColKey>(hiddenPref ?? (hasCategory ? [] : ['category'])), [hiddenPref, hasCategory])
  const show = (k: ColKey) => !hidden.has(k)
  const toggleColumn = (k: ColKey, on: boolean) => setHiddenPref(COLUMNS.map(c => c.key).filter(c => (c === k ? !on : hidden.has(c))))

  // Detail sheet: the open row from this page (fresh), else from the full list (e.g. it just left the view).
  const openIndex = items.findIndex(r => Number(r.uuid) === openId)
  const openRow = openId == null ? null : (items[openIndex] ?? all.data?.find(r => Number(r.uuid) === openId) ?? null)

  const del = useDeleteRow(RISK_TABLE)
  const update = useUpdateRow(RISK_TABLE)

  async function remove(r: Risk) {
    const ok = await confirm({ title: 'Delete this risk?', description: `${r.statement ?? `Risk ${r.uuid}`} — removed permanently, together with its applied controls, action plans and assessment records.`, confirmLabel: 'Delete risk', tone: 'danger' })
    if (!ok) return
    try {
      await del.mutateAsync(r.uuid)
      if (openId === r.uuid) setOpenId(null)
      setSelected(s => {
        const n = new Set(s)
        n.delete(r.uuid)
        return n
      })
      toast.success('Risk deleted')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  /** Wrap a filter setter: back to page 1 and clear the selection. */
  const reset = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v)
    setPage(1)
    setSelected(new Set())
  }

  async function exportCsv() {
    setExporting(true)
    try {
      let rows: Row[]
      if (clientMode && clientPage) rows = clientPage.all
      else {
        const term = search.trim().toLowerCase()
        rows = (await fetchAllRows(RISK_TABLE, filter)).filter(r => !term || SEARCH_COLS.some(c => r[c] != null && String(r[c]).toLowerCase().includes(term)))
      }
      const header = ['ID', ...CSV_COLUMNS, 'Inherent score', 'Inherent band', 'Residual likelihood', 'Residual impact', 'Residual score', 'Approval status', 'Created on']
      const data = rows.map(row => {
        const r = toRisk(row)
        const cyc = r.cycleUuid != null ? cycleById.get(r.cycleUuid) : undefined
        return [r.uuid, r.statement, r.category, r.process, r.subProcess, r.owner, r.champion, r.inherentLikelihood, r.inherentImpact, r.sle, cyc?.cycle_reference ?? '', r.inherentScore, band(r.inherentScore) ?? 'Not rated', r.residualLikelihood, r.residualImpact, r.residualScore, approvalLabel(r.approvalStatus), r.createdOn ? r.createdOn.slice(0, 10) : '']
      })
      downloadCsv(`risk-register-${new Date().toISOString().slice(0, 10)}.csv`, header, data)
      recordAudit({ action: 'EXPORT', entity: 'Risk register', description: `Exported ${rows.length} risk${rows.length === 1 ? '' : 's'} to CSV`, result: 'SUCCESS' })
      toast.success(`Exported ${rows.length} risk${rows.length === 1 ? '' : 's'}`)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  // ── Selection + bulk approve ─────────────────────────────────────────────
  const pageIds = items.map(r => Number(r.uuid))
  const allOnPage = pageIds.length > 0 && pageIds.every(id => selected.has(id))
  const someOnPage = pageIds.some(id => selected.has(id))
  const toggle = (id: number, on: boolean) =>
    setSelected(s => {
      const n = new Set(s)
      if (on) n.add(id)
      else n.delete(id)
      return n
    })
  const togglePage = (on: boolean) =>
    setSelected(s => {
      const n = new Set(s)
      for (const id of pageIds) on ? n.add(id) : n.delete(id)
      return n
    })
  const rowById = (id: number) => items.find(r => Number(r.uuid) === id) ?? all.data?.find(r => Number(r.uuid) === id)

  async function bulkApprove() {
    const rows = [...selected].map(rowById).filter((r): r is Row => !!r)
    const targets = rows.filter(r => String(r.approval_status ?? '').toUpperCase() !== 'APPROVED')
    const already = rows.length - targets.length
    if (!targets.length) {
      toast.info('All selected risks are already approved')
      return
    }
    const ok = await confirm({
      title: `Approve ${targets.length} risk${targets.length === 1 ? '' : 's'}?`,
      description: `Each risk is approved separately. Risks you created can't be approved by you (maker-checker); those are reported and left unchanged.${already ? ` ${already} already approved will be skipped.` : ''}`,
      confirmLabel: `Approve ${targets.length}`,
      tone: 'info',
    })
    if (!ok) return
    setBulk({ running: true, ok: 0, failed: [] })
    let done = 0
    const failed: { id: number; label: string; message: string }[] = []
    for (const row of targets) {
      const r = toRisk(row)
      try {
        await update.mutateAsync({ id: r.uuid, values: { approval_status: 'APPROVED' } })
        done++
      } catch (err) {
        failed.push({ id: r.uuid, label: `${riskRef(r)} · ${r.statement ?? 'No statement recorded'}`, message: apiErrorMessage(err) })
      }
      setBulk({ running: true, ok: done, failed: [...failed] })
    }
    setBulk({ running: false, ok: done, failed })
    setSelected(new Set(failed.map(f => f.id)))
    if (!failed.length) toast.success(`Approved ${done} risk${done === 1 ? '' : 's'}`)
    else if (!done) toast.error(`No risks approved — ${failed.length} refused`)
    else toast.warning(`Approved ${done}; ${failed.length} refused`)
  }

  const filtered = !!(search || inherentBand || residualBand || process || cycle || owner || view !== 'all')
  const bandOptions = [...BANDS.map(b => ({ value: b, label: b })), { value: NOT_RATED, label: NOT_RATED }]
  const addButton = canCreate ? (
    <Button onClick={() => setDialog({ open: true, risk: null })}>
      <Plus aria-hidden="true" />
      Add risk
    </Button>
  ) : null

  const visibleCount = TOTAL_COLUMNS - hidden.size

  return (
    <div className="min-w-0 space-y-6">
      <LifecycleStepper current="register" />

      <PageHeader
        title="Risk register"
        description="Every identified risk with its inherent and residual rating and approval status."
        actions={
          <>
            {canCreate && (
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload aria-hidden="true" />
                Import CSV
              </Button>
            )}
            {addButton}
          </>
        }
      />

      <div className="space-y-4">
        <ViewTabs
          label="Saved views"
          value={view}
          onChange={reset(setView)}
          views={VIEWS.map(v => ({ value: v.value, label: v.label, count: counts[v.value] }))}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <SearchField label="Search risks" value={searchInput} onChange={reset(setSearchInput)} placeholder="Statement, reference, owner…" className="sm:w-64" />
            <FilterChip label="Inherent" value={inherentBand} onChange={reset(setInherentBand)} options={bandOptions} />
            <FilterChip label="Residual" value={residualBand} onChange={reset(setResidualBand)} options={bandOptions} />
            <FilterChip label="Process" value={process} onChange={reset(setProcess)} options={[...processes.map(p => ({ value: p, label: p })), { value: NONE, label: 'No process' }]} />
            <FilterChip
              label="Cycle"
              value={cycle}
              onChange={reset(setCycle)}
              options={[...(cycles.data ?? []).map(c => ({ value: String(c.uuid), label: String(c.cycle_reference || c.cycle_name || `#${c.uuid}`) })), { value: NONE, label: 'Not in a cycle' }]}
            />
            <FilterChip label="Owner" value={owner} onChange={reset(setOwner)} options={[...owners.map(o => ({ value: o, label: o })), { value: NONE, label: 'Not assigned' }]} />
            {filtered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchInput('')
                  setInherentBand('')
                  setResidualBand('')
                  setProcess('')
                  setCycle('')
                  setOwner('')
                  setView('all')
                  setPage(1)
                  setSelected(new Set())
                }}
              >
                <X aria-hidden="true" />
                Clear
              </Button>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Segmented
              label="Row density"
              value={density}
              onChange={setDensity}
              options={[
                {
                  value: 'comfortable',
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Rows3 className="size-3.5" aria-hidden="true" />
                      Comfortable
                    </span>
                  ),
                },
                {
                  value: 'compact',
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Rows4 className="size-3.5" aria-hidden="true" />
                      Compact
                    </span>
                  ),
                },
              ]}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  <Columns3 aria-hidden="true" />
                  Columns
                  <span className="tabular-nums text-muted-foreground">
                    {visibleCount} of {TOTAL_COLUMNS}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="label-caps">Show columns</DropdownMenuLabel>
                <DropdownMenuCheckboxItem checked disabled>
                  Risk
                </DropdownMenuCheckboxItem>
                {COLUMNS.map(c => (
                  <DropdownMenuCheckboxItem key={c.key} checked={show(c.key)} onCheckedChange={v => toggleColumn(c.key, !!v)} onSelect={e => e.preventDefault()}>
                    {c.label}
                    {c.key === 'category' && !hasCategory && <span className="ml-auto text-caption text-muted-foreground">no values</span>}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="secondary" onClick={exportCsv} disabled={exporting}>
              <Download aria-hidden="true" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>
        </div>
      </div>

      {counts.unrated != null && counts.unrated > 0 && counts.all != null && (
        <Callout
          hatch
          action={
            view !== 'unrated' && (
              <Button variant="secondary" size="sm" onClick={() => reset(setView)('unrated')}>
                Show the {counts.unrated}
              </Button>
            )
          }
        >
          <strong className="font-semibold text-foreground">
            {counts.unrated} of {counts.all} risks
          </strong>{' '}
          <span className="text-foreground-secondary">have no inherent rating, so they are missing from heatmaps and band totals.</span>
        </Callout>
      )}

      {bulk && !bulk.running && bulk.failed.length > 0 && (
        <Callout
          tone="warning"
          action={
            <Button variant="ghost" size="sm" onClick={() => setBulk(null)}>
              Dismiss
            </Button>
          }
        >
          <span className="block font-medium">
            {bulk.ok > 0 ? `Approved ${bulk.ok}. ` : ''}
            {bulk.failed.length} risk{bulk.failed.length === 1 ? ' was' : 's were'} not approved:
          </span>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {bulk.failed.map(f => (
              <li key={f.id}>
                <span className="font-medium">{f.label}</span> — {f.message}
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <Panel bodyClassName="p-0" className="overflow-hidden">
        {selected.size > 0 && (
          <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-center gap-3 border-b bg-accent px-4 py-2.5 text-body-sm">
            <span className="font-medium text-foreground tabular-nums">{selected.size} selected</span>
            {bulk?.running && (
              <span role="status" className="text-muted-foreground">
                Approving… {bulk.ok + bulk.failed.length} done
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Clear selection
              </Button>
              {canApprove && (
                <Button size="sm" onClick={bulkApprove} disabled={bulk?.running}>
                  <Check aria-hidden="true" />
                  Approve selected
                </Button>
              )}
            </div>
          </div>
        )}
        <DataState
          query={query}
          empty={items.length === 0}
          emptyTitle={filtered ? 'No risks match this view' : 'The risk register is empty'}
          emptyDescription={filtered ? 'Change the view, search or filters to see more risks.' : 'Add a risk or import a CSV to start the register.'}
          emptyAction={filtered ? undefined : addButton}
        >
          <div className="relative max-h-[max(26rem,calc(100dvh-15rem))] overflow-auto [contain:inline-size]">
            <table className="enterprise-table min-w-[1060px]">
              <thead>
                <tr>
                  <th className="w-11 pl-4">
                    <Checkbox
                      checked={allOnPage ? true : someOnPage ? 'indeterminate' : false}
                      onCheckedChange={v => togglePage(v === true)}
                      aria-label="Select all risks on this page"
                      className="align-middle"
                    />
                  </th>
                  <SortHeader label="Risk" column="risk_statement" state={sort} onSort={reset(setSort)} />
                  {show('category') && <SortHeader label="Category" column="risk_type" state={sort} onSort={reset(setSort)} />}
                  {show('owner') && <SortHeader label="Owner" column="risk_owner" state={sort} onSort={reset(setSort)} />}
                  {show('cycle') && <th>Cycle</th>}
                  {show('inherent') && <SortHeader label="Inherent" column="inherent_score" state={sort} onSort={reset(setSort)} />}
                  {show('residual') && <SortHeader label="Residual" column="residual_score" state={sort} onSort={reset(setSort)} />}
                  {show('sle') && <SortHeader label="SLE" column="inherent_sle" state={sort} onSort={reset(setSort)} numeric />}
                  {show('approval') && <SortHeader label="Approval" column="approval_status" state={sort} onSort={reset(setSort)} />}
                  {show('created') && <SortHeader label="Created" column="created_on" state={sort} onSort={reset(setSort)} />}
                  <th className="w-px">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map(row => {
                  const r = toRisk(row)
                  const isOpen = r.uuid === openId
                  const isChecked = selected.has(r.uuid)
                  const statement = r.statement ?? 'No statement recorded'
                  const short = statement.length > 48 ? `${statement.slice(0, 47)}…` : statement
                  return (
                    <tr
                      key={r.uuid}
                      aria-selected={isOpen || isChecked || undefined}
                      onClick={e => {
                        if ((e.target as HTMLElement).closest('a,button,input,label,[role="checkbox"],[role="menuitem"]')) return
                        setOpenId(r.uuid)
                      }}
                      className="cursor-pointer"
                    >
                      <td className={cn('relative w-11 pl-4', isOpen && 'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary')}>
                        <Checkbox checked={isChecked} onCheckedChange={v => toggle(r.uuid, v === true)} aria-label={`Select ${short}`} className="align-middle" />
                      </td>
                      <td>
                        <button type="button" onClick={() => setOpenId(r.uuid)} className={cn('block rounded-xs text-left focus-ring', compact ? 'max-w-[20rem]' : 'max-w-[15rem]')} title={statement} aria-label={`Open details: ${statement}`}>
                          {compact ? (
                            <span className="flex min-w-0 items-baseline gap-2">
                              <span className={cn('truncate font-medium text-foreground', !r.statement && 'font-normal text-muted-foreground')}>{statement}</span>
                              <span className="shrink-0 font-mono text-caption text-muted-foreground">{riskRef(r)}</span>
                            </span>
                          ) : (
                            <>
                              <span className={cn('block truncate font-medium text-foreground', !r.statement && 'font-normal text-muted-foreground')}>{statement}</span>
                              <span className="block truncate text-caption text-muted-foreground">
                                <span className="font-mono">{riskRef(r)}</span>
                                {r.process && <> · {[r.process, r.subProcess].filter(Boolean).join(' · ')}</>}
                              </span>
                            </>
                          )}
                        </button>
                      </td>
                      {show('category') && <td className="whitespace-nowrap text-foreground-secondary">{r.category ?? <span className="text-muted-foreground">—</span>}</td>}
                      {show('owner') && (
                        <td className="max-w-[12rem]">
                          {r.owner ? (
                            <Person name={r.owner} />
                          ) : canUpdate ? (
                            <button type="button" onClick={() => setDialog({ open: true, risk: row })} className="rounded-xs font-medium whitespace-nowrap text-primary hover:underline focus-ring">
                              Assign owner
                            </button>
                          ) : (
                            <span className="whitespace-nowrap text-muted-foreground">Not assigned</span>
                          )}
                        </td>
                      )}
                      {show('cycle') && (
                        <td className="whitespace-nowrap">
                          <CycleLink risk={r} cycle={r.cycleUuid != null ? cycleById.get(r.cycleUuid) : undefined} />
                        </td>
                      )}
                      {show('inherent') && (
                        <td className="whitespace-nowrap">
                          <BandBadge score={r.inherentScore} kind="Inherent" compact={compact} rateHref={canUpdate ? inherentRateHref(r) : undefined} />
                        </td>
                      )}
                      {show('residual') && (
                        <td className="whitespace-nowrap">
                          <RiskMovement inherent={r.inherentScore} residual={r.residualScore} compact={compact} rateHref={canUpdate && r.inherentScore != null ? riskControlsHref(r) : undefined} />
                        </td>
                      )}
                      {show('sle') && (
                        <td data-numeric className="whitespace-nowrap tabular-nums">
                          {money(r.sle)}
                        </td>
                      )}
                      {show('approval') && (
                        <td className="whitespace-nowrap">
                          <ApprovalBadge status={r.approvalStatus} />
                        </td>
                      )}
                      {show('created') && <td className="whitespace-nowrap text-foreground-secondary">{formatDate(r.createdOn)}</td>}
                      <td className="w-px pr-3 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-0.5">
                          {canUpdate && (
                            <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary">
                              <Link href={inherentRateHref(r)}>
                                Assess<span className="sr-only">: {short}</span>
                              </Link>
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8" aria-label={`More actions for ${short}`}>
                                <Ellipsis aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onSelect={() => setOpenId(r.uuid)}>Open details</DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/risks/${r.uuid}`}>
                                  <SquareArrowOutUpRight aria-hidden="true" />
                                  Full page
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={riskControlsHref(r)}>
                                  <ShieldCheck aria-hidden="true" />
                                  Controls
                                </Link>
                              </DropdownMenuItem>
                              {canUpdate && (
                                <DropdownMenuItem onSelect={() => setDialog({ open: true, risk: row })}>
                                  <Pencil aria-hidden="true" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" disabled={del.isPending} onSelect={() => remove(r)}>
                                    <Trash2 aria-hidden="true" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pager
            page={page}
            pageSize={pageSize}
            total={total}
            onPage={p => setPage(p)}
            onPageSize={n => {
              setPageSize(n)
              setPage(1)
            }}
            busy={query.isFetching}
          />
        </DataState>
      </Panel>

      <RiskDetailSheet
        row={openRow}
        cycle={openRow && openRow.assessment_cycle_uuid != null ? cycleById.get(Number(openRow.assessment_cycle_uuid)) : undefined}
        onClose={() => setOpenId(null)}
        onPrev={openIndex > 0 ? () => setOpenId(Number(items[openIndex - 1]!.uuid)) : undefined}
        onNext={openIndex >= 0 && openIndex < items.length - 1 ? () => setOpenId(Number(items[openIndex + 1]!.uuid)) : undefined}
      />
      <RiskDialog open={dialog.open} risk={dialog.risk} onOpenChange={open => setDialog(d => ({ ...d, open }))} cycleUuid={cycle && cycle !== NONE ? cycle : null} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} cycles={cycles.data ?? []} />
    </div>
  )
}

// ── CSV import ───────────────────────────────────────────────────────────────

function normalizeHeader(h: string) {
  return h.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '')
}

const HEADER_KEYS: Record<string, string> = {
  riskstatement: 'risk_statement',
  statement: 'risk_statement',
  category: 'risk_type',
  riskcategory: 'risk_type',
  businessprocess: 'process_name',
  process: 'process_name',
  subprocess: 'sub_process_name',
  riskowner: 'risk_owner',
  owner: 'risk_owner',
  riskchampion: 'risk_champion',
  champion: 'risk_champion',
  inherentlikelihood: 'inherent_likelihood',
  likelihood: 'inherent_likelihood',
  inherentimpact: 'inherent_impact',
  impact: 'inherent_impact',
  sle: 'inherent_sle',
  inherentsle: 'inherent_sle',
  cyclereference: 'cycle_reference',
  cycle: 'cycle_reference',
}

function buildImportRows(text: string, cycles: Row[]): { rows: ImportRow[]; problem: string | null } {
  const table = parseCsv(text)
  if (table.length < 2) return { rows: [], problem: 'The file needs a header row and at least one data row.' }
  const header = table[0]!.map(h => HEADER_KEYS[normalizeHeader(h)] ?? null)
  if (!header.includes('risk_statement')) return { rows: [], problem: `No "Risk statement" column found. Use the template's header row: ${CSV_COLUMNS.join(', ')}.` }
  const byRef = new Map(cycles.filter(c => c.cycle_reference).map(c => [String(c.cycle_reference).trim().toLowerCase(), c]))

  const rows = table.slice(1).map((cells, idx): ImportRow => {
    const raw: Record<string, string> = {}
    header.forEach((key, i) => {
      if (key) raw[key] = (cells[i] ?? '').trim()
    })
    const errors: string[] = []
    const values: Row = {}
    if (!raw.risk_statement) errors.push('Risk statement is empty')
    else if (raw.risk_statement.length > 4000) errors.push('Risk statement is over 4000 characters')
    values.risk_statement = raw.risk_statement ?? ''
    for (const k of ['risk_type', 'process_name', 'sub_process_name', 'risk_owner', 'risk_champion']) if (raw[k]) values[k] = raw[k]
    for (const k of ['inherent_likelihood', 'inherent_impact'] as const) {
      const v = raw[k]
      if (!v) continue
      const n = Number(v)
      if (!Number.isInteger(n) || n < 1 || n > 5) errors.push(`${k === 'inherent_likelihood' ? 'Likelihood' : 'Impact'} "${v}" must be a whole number 1–5`)
      else values[k] = n
    }
    if (!!raw.inherent_likelihood !== !!raw.inherent_impact) errors.push('Give both likelihood and impact, or neither')
    if (raw.inherent_sle) {
      const n = Number(raw.inherent_sle.replace(/[,\s]/g, ''))
      if (!Number.isFinite(n) || n < 0) errors.push(`SLE "${raw.inherent_sle}" is not a positive number`)
      else values.inherent_sle = n
    }
    if (raw.cycle_reference) {
      const c = byRef.get(raw.cycle_reference.toLowerCase())
      if (!c) errors.push(`No cycle with reference "${raw.cycle_reference}"`)
      else values.assessment_cycle_uuid = Number(c.uuid)
    }
    return { line: idx + 2, values, errors }
  })
  return { rows, problem: null }
}

function ImportDialog({ open, onOpenChange, cycles }: { open: boolean; onOpenChange: (o: boolean) => void; cycles: Row[] }) {
  const create = useCreateRow(RISK_TABLE)
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)

  function reset() {
    setText('')
    setFileName(null)
    setRows(null)
    setProblem(null)
    setResult(null)
    setProgress(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  function parse(src: string) {
    const out = buildImportRows(src, cycles)
    setProblem(out.problem)
    setRows(out.problem ? null : out.rows)
    setResult(null)
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    file
      .text()
      .then(t => {
        setText(t)
        parse(t)
      })
      .catch(err => setProblem(`Couldn't read the file: ${(err as Error).message}`))
  }

  function template() {
    downloadCsv('risk-register-import-template.csv', [...CSV_COLUMNS], [])
  }

  const valid = rows?.filter(r => r.errors.length === 0) ?? []
  const invalid = rows?.filter(r => r.errors.length > 0) ?? []

  async function run() {
    if (!valid.length) return
    setImporting(true)
    setProgress(0)
    const failed: ImportResult['failed'] = invalid.map(r => ({ line: r.line, message: r.errors.join('; ') }))
    let ok = 0
    for (const r of valid) {
      try {
        await create.mutateAsync(r.values)
        ok++
      } catch (err) {
        failed.push({ line: r.line, message: apiErrorMessage(err) })
      }
      setProgress(p => p + 1)
    }
    failed.sort((a, b) => a.line - b.line)
    setImporting(false)
    setResult({ ok, failed })
    setRows(null)
    if (failed.length === 0) toast.success(`Imported ${ok} risk${ok === 1 ? '' : 's'}`)
    else if (ok === 0) toast.error(`No risks imported — ${failed.length} row${failed.length === 1 ? '' : 's'} failed`)
    else toast.warning(`Imported ${ok} risk${ok === 1 ? '' : 's'}; ${failed.length} row${failed.length === 1 ? '' : 's'} failed`)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={o => {
        if (importing) return
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import risks from CSV</DialogTitle>
          <DialogDescription>
            Columns: {CSV_COLUMNS.join(', ')}. Only the risk statement is required; ratings are whole numbers 1–5 and need both likelihood and impact. Cycle reference must match an existing cycle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-body-sm">
          <div className="flex flex-wrap items-center gap-2">
            <input id="risk-csv-file" ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" />
            <Button asChild variant="secondary">
              <label htmlFor="risk-csv-file" className="cursor-pointer">
                <FileSpreadsheet aria-hidden="true" />
                Choose CSV file
              </label>
            </Button>
            {fileName && <span className="font-mono text-caption text-foreground-secondary">{fileName}</span>}
            <Button variant="ghost" className="text-primary hover:text-primary" onClick={template}>
              <Download aria-hidden="true" />
              Download template
            </Button>
          </div>

          <div>
            <label htmlFor="risk-csv-text" className="mb-1.5 block text-body-sm font-medium text-foreground">
              Or paste CSV text (including the header row)
            </label>
            <textarea id="risk-csv-text" rows={4} value={text} onChange={e => setText(e.target.value)} className={`${textareaClass} font-mono text-caption`} placeholder={CSV_COLUMNS.join(',')} />
            <Button variant="secondary" className="mt-2" disabled={!text.trim() || importing} onClick={() => parse(text)}>
              Check rows
            </Button>
          </div>

          {problem && (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-status-danger-bg px-3 py-2 text-status-danger-fg">
              <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {problem}
            </p>
          )}

          {rows && (
            <div className="space-y-2">
              <p className="text-foreground-secondary">
                {rows.length} row{rows.length === 1 ? '' : 's'} read: <strong className="text-status-success-fg">{valid.length} ready</strong>
                {invalid.length > 0 && (
                  <>
                    , <strong className="text-status-danger-fg">{invalid.length} with problems (will be skipped)</strong>
                  </>
                )}
                .
              </p>
              <div className="max-h-64 overflow-auto rounded-md shadow-[inset_0_0_0_1px_var(--border)]">
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th>Line</th>
                      <th>Risk statement</th>
                      <th>Category</th>
                      <th>L × I</th>
                      <th>Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.line}>
                        <td className="tabular-nums">{r.line}</td>
                        <td className="max-w-xs truncate" title={String(r.values.risk_statement || '')}>{String(r.values.risk_statement || '—')}</td>
                        <td>{String(r.values.risk_type ?? '—')}</td>
                        <td className="tabular-nums">{r.values.inherent_likelihood && r.values.inherent_impact ? `${r.values.inherent_likelihood} × ${r.values.inherent_impact}` : 'Not rated'}</td>
                        <td className={r.errors.length ? 'text-status-danger-fg' : 'text-status-success-fg'}>
                          <span className="inline-flex items-start gap-1.5">
                            {r.errors.length ? <OctagonAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> : <CircleCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />}
                            {r.errors.length ? r.errors.join('; ') : 'OK'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importing && (
            <p role="status" aria-live="polite" className="text-muted-foreground">
              Importing {progress} of {valid.length}…
            </p>
          )}

          {result && (
            <div role="status" className={`rounded-md px-3 py-2 ${result.failed.length ? 'bg-status-warning-bg text-status-warning-fg' : 'bg-status-success-bg text-status-success-fg'}`}>
              <p className="font-medium">
                Imported {result.ok} risk{result.ok === 1 ? '' : 's'}.{result.failed.length > 0 && ` ${result.failed.length} row${result.failed.length === 1 ? '' : 's'} not imported:`}
              </p>
              {result.failed.length > 0 && (
                <ul className="mt-1 list-disc pl-5 space-y-0.5">
                  {result.failed.map(f => (
                    <li key={f.line}>
                      Line {f.line}: {f.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            disabled={importing}
            onClick={() => {
              reset()
              onOpenChange(false)
            }}
          >
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={run} disabled={importing || valid.length === 0}>
              {importing ? 'Importing…' : `Import ${valid.length} risk${valid.length === 1 ? '' : 's'}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
