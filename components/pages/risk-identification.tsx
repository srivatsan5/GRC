'use client'

/** /rcsa/identification and /risk-identification — the risk register (per_trn_identify_risk). */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Download, FileSpreadsheet, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { BandBadge } from '@/components/band-badge'
import { fetchAllRows, useCreateRow, useDeleteRow, useRowPage, useRows, type Row } from '@/lib/data'
import { BANDS, toRisk, type Risk } from '@/lib/risk'
import { formatDate } from '@/lib/format'
import { useOrgSettings } from '@/lib/settings'
import { apiErrorMessage } from '@/lib/apiClient'
import { recordAudit } from '@/lib/auditLog'
import { APPROVAL_STATUSES, ApprovalBadge, RcsaStepper, SortHeader, approvalLabel, downloadCsv, parseCsv, selectClass, textareaClass, useDebounced, type SortState } from '@/components/rcsa/shared'
import { CYCLE_TABLE, RISK_TABLE, RiskDialog } from '@/components/rcsa/risk-dialog'
import { RiskDecisionButtons } from '@/components/rcsa/risk-decision'

const PAGE_SIZE = 25
/** Columns the API searches for this table (kept in step with the client-side fallback). */
const SEARCH_COLS = ['risk_statement', 'process_name', 'sub_process_name', 'risk_type', 'risk_owner', 'assessment_reference_number']
const NO_CYCLE = '__none__'

// CSV import template — exactly the columns the import reads.
const CSV_COLUMNS = ['Risk statement', 'Category', 'Business process', 'Sub-process', 'Risk owner', 'Risk champion', 'Inherent likelihood (1-5)', 'Inherent impact (1-5)', 'SLE', 'Cycle reference'] as const

type ImportRow = { line: number; values: Row; errors: string[] }
type ImportResult = { ok: number; failed: { line: number; message: string }[] }

export function RiskIdentificationPage() {
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const { money, band } = useOrgSettings()

  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounced(searchInput)
  const [sort, setSort] = useState<SortState>({ sort: 'created_on', order: 'desc' })
  const [category, setCategory] = useState('')
  const [approval, setApproval] = useState('')
  const [cycle, setCycle] = useState('')
  const [rating, setRating] = useState('') // '' | band name | 'Not rated'
  const [dialog, setDialog] = useState<{ open: boolean; risk: Row | null }>({ open: false, risk: null })
  const [importOpen, setImportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  // ?cycle=<uuid> pre-selects a cycle (read once on the client).
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('cycle')
    if (c && /^\d+$/.test(c)) setCycle(c)
  }, [])

  const filter = useMemo(() => {
    const f: Record<string, string | number | null> = {}
    if (category) f.risk_type = category
    if (approval) f.approval_status = approval
    if (cycle === NO_CYCLE) f.assessment_cycle_uuid = null
    else if (cycle) f.assessment_cycle_uuid = Number(cycle)
    return Object.keys(f).length ? f : undefined
  }, [category, approval, cycle])

  // The rating band is computed (likelihood × impact), so the API can't filter on it: when a
  // band is chosen, load the server-filtered rows and filter / search / sort / page them here.
  const clientMode = !!rating
  const serverPage = useRowPage(RISK_TABLE, { page, pageSize: PAGE_SIZE, search, sort: sort.sort, order: sort.order, filter }, { enabled: !clientMode })
  const clientRows = useRows(RISK_TABLE, { filter, enabled: clientMode })
  const all = useRows(RISK_TABLE) // for filter options and the "not rated" prompt
  const cycles = useRows(CYCLE_TABLE)

  const clientPage = useMemo(() => {
    if (!clientMode) return null
    const term = search.trim().toLowerCase()
    let rows = (clientRows.data ?? []).filter(r => {
      const b = band(toRisk(r).inherentScore) ?? 'Not rated'
      if (b !== rating) return false
      return !term || SEARCH_COLS.some(c => r[c] != null && String(r[c]).toLowerCase().includes(term))
    })
    const key = sort.sort
    rows = [...rows].sort((x, y) => {
      const a = x[key]
      const b = y[key]
      if (a == null || b == null) return a == null && b == null ? 0 : a == null ? 1 : -1
      const d = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
      return sort.order === 'desc' ? -d : d
    })
    return { total: rows.length, items: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), all: rows }
  }, [clientMode, clientRows.data, rating, search, sort, page, band])

  const query = clientMode ? clientRows : serverPage
  const items = clientMode ? (clientPage?.items ?? []) : (serverPage.data?.items ?? [])
  const total = clientMode ? (clientPage?.total ?? 0) : (serverPage.data?.total ?? 0)

  const allRisks = useMemo(() => (all.data ?? []).map(toRisk), [all.data])
  const categories = useMemo(() => [...new Set(allRisks.map(r => r.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)), [allRisks])
  const unrated = allRisks.filter(r => r.inherentScore == null).length
  const cycleById = useMemo(() => new Map((cycles.data ?? []).map(c => [Number(c.uuid), c])), [cycles.data])

  const del = useDeleteRow(RISK_TABLE)
  async function remove(r: Risk) {
    const ok = await confirm({ title: 'Delete this risk?', description: `${r.statement ?? `Risk ${r.uuid}`} — removed from the register permanently.`, confirmLabel: 'Delete risk', tone: 'danger' })
    if (!ok) return
    try {
      await del.mutateAsync(r.uuid)
      toast.success('Risk deleted')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v)
    setPage(1)
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

  const filtered = !!(search || category || approval || cycle || rating)
  const addButton = hasPermission('create') ? (
    <Button size="sm" className="h-8" onClick={() => setDialog({ open: true, risk: null })}>
      <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
      Add risk
    </Button>
  ) : null

  return (
    <div className="space-y-6 font-sans">
      <RcsaStepper active="identify" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Risk register</h1>
          <p className="text-xs text-slate-500 mt-0.5">Every identified risk, with its inherent and residual rating and approval status.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={exportCsv} disabled={exporting}>
            <Download className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
          {hasPermission('create') && (
            <Button variant="outline" size="sm" className="h-8" onClick={() => setImportOpen(true)}>
              <Upload className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              Import CSV
            </Button>
          )}
          {addButton}
        </div>
      </div>

      {unrated > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>
            {unrated} of {allRisks.length} risks have no inherent rating yet. Rate likelihood and impact so they appear on heatmaps and in band totals.
          </span>
          {rating !== 'Not rated' && (
            <Button size="sm" variant="outline" onClick={() => (setRating('Not rated'), setPage(1))}>
              Show unrated risks
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="risk-search" className="block text-xs text-slate-600 mb-1">
            Search
          </label>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <Input id="risk-search" placeholder="Statement, process, owner…" className="pl-8 h-8 text-xs bg-white" value={searchInput} onChange={e => resetPage(setSearchInput)(e.target.value)} />
          </div>
        </div>
        <FilterSelect id="f-category" label="Category" value={category} onChange={resetPage(setCategory)} options={categories.map(c => [c, c])} allLabel="All categories" />
        <FilterSelect id="f-rating" label="Inherent rating" value={rating} onChange={resetPage(setRating)} options={[...BANDS.map(b => [b, b] as [string, string]), ['Not rated', 'Not rated']]} allLabel="All ratings" />
        <FilterSelect id="f-approval" label="Approval" value={approval} onChange={resetPage(setApproval)} options={APPROVAL_STATUSES.map(s => [s, approvalLabel(s)])} allLabel="All statuses" />
        <FilterSelect
          id="f-cycle"
          label="Cycle"
          value={cycle}
          onChange={resetPage(setCycle)}
          options={[[NO_CYCLE, 'Not in a cycle'], ...(cycles.data ?? []).map(c => [String(c.uuid), `${c.cycle_reference ? `${c.cycle_reference} · ` : ''}${c.cycle_name}`] as [string, string])]}
          allLabel="All cycles"
        />
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              setSearchInput('')
              setCategory('')
              setApproval('')
              setCycle('')
              setRating('')
              setPage(1)
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <DataState
          query={query}
          empty={items.length === 0}
          emptyTitle={filtered ? 'No risks match these filters' : 'The risk register is empty'}
          emptyDescription={filtered ? undefined : 'Add a risk or import a CSV to start the register.'}
          emptyAction={filtered ? undefined : addButton}
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <SortHeader label="Risk" column="risk_statement" state={sort} onSort={resetPage(setSort)} className="w-[32%]" />
                  <SortHeader label="Category" column="risk_type" state={sort} onSort={resetPage(setSort)} />
                  <SortHeader label="Owner" column="risk_owner" state={sort} onSort={resetPage(setSort)} />
                  <th>Cycle</th>
                  <th>Inherent</th>
                  <th>Residual</th>
                  <SortHeader label="SLE" column="inherent_sle" state={sort} onSort={resetPage(setSort)} className="text-right" />
                  <SortHeader label="Approval" column="approval_status" state={sort} onSort={resetPage(setSort)} />
                  <SortHeader label="Created" column="created_on" state={sort} onSort={resetPage(setSort)} />
                  <th className="text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map(row => {
                  const r = toRisk(row)
                  const cyc = r.cycleUuid != null ? cycleById.get(r.cycleUuid) : undefined
                  const controlsHref = r.cycleUuid != null ? `/rcsa/provisioning/${r.cycleUuid}/controls/${r.uuid}` : `/rcsa/mitigation/${r.uuid}`
                  return (
                    <tr key={r.uuid}>
                      <td>
                        <span className="font-medium text-slate-900 block">{r.statement ?? <span className="italic text-slate-400">No statement recorded</span>}</span>
                        {(r.process || r.referenceNumber) && <span className="text-[11px] text-slate-500">{[r.referenceNumber, r.process, r.subProcess].filter(Boolean).join(' · ')}</span>}
                      </td>
                      <td>{r.category ?? '—'}</td>
                      <td>{r.owner ?? '—'}</td>
                      <td className="whitespace-nowrap">
                        {cyc ? (
                          <Link href={`/rcsa/provisioning/${cyc.uuid}`} className="text-blue-800 hover:underline">
                            {cyc.cycle_reference || cyc.cycle_name}
                          </Link>
                        ) : r.cycleUuid != null ? (
                          `#${r.cycleUuid}`
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <BandBadge score={r.inherentScore} />
                        {r.inherentScore == null && hasPermission('update') && (
                          <Link href={`/assessments/inherent?riskId=${r.uuid}`} className="block text-[11px] text-blue-800 hover:underline mt-0.5">
                            Rate now
                          </Link>
                        )}
                      </td>
                      <td>
                        <BandBadge score={r.residualScore} />
                      </td>
                      <td className="text-right tabular-nums whitespace-nowrap">{money(r.sle)}</td>
                      <td>
                        <ApprovalBadge status={r.approvalStatus} />
                      </td>
                      <td className="whitespace-nowrap">{formatDate(r.createdOn)}</td>
                      <td className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button asChild size="sm" variant="ghost" className="text-blue-800">
                            <Link href={`/assessments/inherent?riskId=${r.uuid}`}>Assess</Link>
                          </Button>
                          <Button asChild size="sm" variant="ghost" className="text-blue-800">
                            <Link href={controlsHref}>Controls</Link>
                          </Button>
                          <RiskDecisionButtons risk={row} compact />
                          {hasPermission('update') && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Edit risk" onClick={() => setDialog({ open: true, risk: row })}>
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            </Button>
                          )}
                          {hasPermission('delete') && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-50" aria-label="Delete risk" disabled={del.isPending} onClick={() => remove(r)}>
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
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} busy={query.isFetching} />
        </DataState>
      </div>

      <RiskDialog open={dialog.open} risk={dialog.risk} onOpenChange={open => setDialog(d => ({ ...d, open }))} cycleUuid={cycle && cycle !== NO_CYCLE ? cycle : null} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} cycles={cycles.data ?? []} />
    </div>
  )
}

function FilterSelect({ id, label, value, onChange, options, allLabel }: { id: string; label: string; value: string; onChange: (v: string) => void; options: [string, string][]; allLabel: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-slate-600 mb-1">
        {label}
      </label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)} className={`${selectClass} w-44`}>
        <option value="">{allLabel}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
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
      <DialogContent className="max-w-3xl bg-white border-slate-200 rounded-lg p-5 text-xs max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-slate-900">Import risks from CSV</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Columns: {CSV_COLUMNS.join(', ')}. Only the risk statement is required; ratings are whole numbers 1–5 and need both likelihood and impact. Cycle reference must match an existing cycle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input id="risk-csv-file" ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" />
            <Button asChild variant="outline" size="sm">
              <label htmlFor="risk-csv-file" className="cursor-pointer">
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                Choose CSV file
              </label>
            </Button>
            {fileName && <span className="text-slate-600">{fileName}</span>}
            <Button variant="ghost" size="sm" className="text-blue-800" onClick={template}>
              <Download className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              Download template
            </Button>
          </div>

          <div>
            <label htmlFor="risk-csv-text" className="block text-slate-700 font-medium mb-1">
              Or paste CSV text (including the header row)
            </label>
            <textarea id="risk-csv-text" rows={4} value={text} onChange={e => setText(e.target.value)} className={`${textareaClass} font-mono bg-slate-50`} placeholder={CSV_COLUMNS.join(',')} />
            <Button size="sm" variant="outline" className="mt-2" disabled={!text.trim() || importing} onClick={() => parse(text)}>
              Check rows
            </Button>
          </div>

          {problem && (
            <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800">
              {problem}
            </p>
          )}

          {rows && (
            <div className="space-y-2">
              <p className="text-slate-700">
                {rows.length} row{rows.length === 1 ? '' : 's'} read: <strong className="text-emerald-800">{valid.length} ready</strong>
                {invalid.length > 0 && (
                  <>
                    , <strong className="text-red-700">{invalid.length} with problems (will be skipped)</strong>
                  </>
                )}
                .
              </p>
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded">
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
                        <td className="max-w-xs truncate">{String(r.values.risk_statement || '—')}</td>
                        <td>{String(r.values.risk_type ?? '—')}</td>
                        <td className="tabular-nums">{r.values.inherent_likelihood && r.values.inherent_impact ? `${r.values.inherent_likelihood} × ${r.values.inherent_impact}` : 'Not rated'}</td>
                        <td className={r.errors.length ? 'text-red-700' : 'text-emerald-800'}>{r.errors.length ? r.errors.join('; ') : 'OK'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importing && (
            <p role="status" aria-live="polite" className="text-slate-600">
              Importing {progress} of {valid.length}…
            </p>
          )}

          {result && (
            <div role="status" className={`rounded border px-3 py-2 ${result.failed.length ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
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

        <DialogFooter className="pt-2 border-t border-slate-200">
          <Button
            variant="outline"
            size="sm"
            disabled={importing}
            onClick={() => {
              reset()
              onOpenChange(false)
            }}
          >
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button size="sm" onClick={run} disabled={importing || valid.length === 0}>
              {importing ? 'Importing…' : `Import ${valid.length} risk${valid.length === 1 ? '' : 's'}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
