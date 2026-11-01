'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Download, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { BandBadge } from '@/components/band-badge'
import { useRows, type Row } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { recordAudit } from '@/lib/auditLog'
import { currentScore, toRisk, type Risk } from '@/lib/risk'
import { DASH } from '@/lib/format'
import { ControlImplementationDialog, useRemoveAppliedControl } from '@/components/treatment/control-dialog'
import {
  OPERATING_OPTIONS,
  ValueChip,
  controlName,
  downloadCsv,
  labelCls,
  numOrNull,
  pageSlice,
  riskLabel,
  rowId,
  selectCls,
  text,
} from '@/components/treatment/shared'

const PAGE_SIZE = 25
const NOT_ASSESSED = '__none__'

export function AssessmentscontrolsPage() {
  const { hasPermission } = useAuth()
  const confirm = useConfirm()
  const params = useSearchParams()
  const initialRisk = numOrNull(params.get('riskId'))

  const implQ = useRows('per_trn_control_implementation')
  const risksQ = useRows('per_trn_identify_risk')
  const libraryQ = useRows('erm_mst_control')
  const { remove, isPending: removing } = useRemoveAppliedControl()

  const [search, setSearch] = useState('')
  const [effFilter, setEffFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'Y' | 'N'>('')
  const [riskFilter, setRiskFilter] = useState<number | null>(initialRisk)
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)

  useEffect(() => setPage(1), [search, effFilter, statusFilter, riskFilter])

  const risks = useMemo(() => {
    const m = new Map<number, Risk>()
    for (const r of risksQ.data ?? []) {
      const risk = toRisk(r)
      if (Number.isFinite(risk.uuid)) m.set(risk.uuid, risk)
    }
    return m
  }, [risksQ.data])
  const library = useMemo(() => {
    const m = new Map<number, Row>()
    for (const c of libraryQ.data ?? []) {
      const id = rowId(c)
      if (id != null) m.set(id, c)
    }
    return m
  }, [libraryQ.data])

  const rows = useMemo(() => {
    const all = implQ.data ?? []
    const term = search.trim().toLowerCase()
    return all.filter(c => {
      const riskId = numOrNull(c.identify_risk_uuid)
      if (riskFilter != null && riskId !== riskFilter) return false
      if (statusFilter && (c.is_stage_complted === 'Y' ? 'Y' : 'N') !== statusFilter) return false
      const eff = text(c.control_effectiveness_rating)
      if (effFilter === NOT_ASSESSED ? eff != null : effFilter && eff?.toLowerCase() !== effFilter.toLowerCase()) return false
      if (!term) return true
      const { code, name } = controlName(c.control_id, library)
      const risk = riskId != null ? risks.get(riskId) : undefined
      return [code, name, risk?.statement, text(c.evidence_notes), text(c.control_frequency), text(c.control_type), eff]
        .some(v => v && v.toLowerCase().includes(term))
    })
  }, [implQ.data, search, effFilter, statusFilter, riskFilter, library, risks])

  const counts = useMemo(() => {
    const all = implQ.data ?? []
    const by = (v: string) => all.filter(c => text(c.control_effectiveness_rating)?.toLowerCase() === v.toLowerCase()).length
    return {
      total: all.length,
      effective: by('Effective'),
      partial: by('Partially Effective'),
      ineffective: by('Ineffective'),
      notAssessed: all.filter(c => !text(c.control_effectiveness_rating) || text(c.control_effectiveness_rating)?.toLowerCase() === 'not tested').length,
    }
  }, [implQ.data])

  const openNew = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const handleDelete = async (row: Row) => {
    const { name } = controlName(row.control_id, library)
    const ok = await confirm({
      title: 'Delete this applied control?',
      description: `The test record for “${name}” will be permanently deleted. The library control itself is kept.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await remove(row)
      toast.success('Applied control deleted')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const exportCsv = () => {
    downloadCsv(
      `control-testing-${new Date().toISOString().slice(0, 10)}.csv`,
      ['ID', 'Control code', 'Control', 'Risk ID', 'Risk', 'Type', 'Frequency', 'Design effectiveness', 'Operating effectiveness', 'Evidence', 'Assessment complete'],
      rows.map(c => {
        const { code, name } = controlName(c.control_id, library)
        const riskId = numOrNull(c.identify_risk_uuid)
        return [
          rowId(c),
          code,
          name,
          riskId,
          riskId != null ? risks.get(riskId)?.statement : null,
          text(c.control_type),
          text(c.control_frequency),
          text(c.control_design_effectiveness),
          text(c.control_effectiveness_rating),
          text(c.evidence_notes),
          c.is_stage_complted === 'Y' ? 'Yes' : 'No',
        ]
      }),
    )
    recordAudit({ action: 'EXPORT', entity: 'Control testing', description: `Exported ${rows.length} applied controls to CSV`, result: 'SUCCESS' })
  }

  const filtered = search || effFilter || statusFilter || riskFilter != null

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Control testing</h1>
          <p className="text-sm text-slate-500 mt-0.5">Controls applied to risks, with their design and operating effectiveness and test evidence.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            Export CSV
          </Button>
          {hasPermission('create') && (
            <Button size="sm" onClick={openNew}>
              <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              New applied control
            </Button>
          )}
        </div>
      </div>

      {implQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ['Applied controls', counts.total],
            ['Effective', counts.effective],
            ['Partially effective', counts.partial],
            ['Ineffective', counts.ineffective],
            ['Not tested / not assessed', counts.notAssessed],
          ].map(([label, value]) => (
            <div key={label} className="bg-white border border-slate-200 rounded p-3">
              <span className="block text-[11px] text-slate-500">{label}</span>
              <span className="text-lg font-semibold text-slate-900 tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded">
        <div className="p-3 border-b border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label htmlFor="ctl-search" className={labelCls}>
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <Input id="ctl-search" className="pl-8 h-9" placeholder="Control, risk, evidence…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="ctl-eff" className={labelCls}>
              Operating effectiveness
            </label>
            <select id="ctl-eff" className={selectCls} value={effFilter} onChange={e => setEffFilter(e.target.value)}>
              <option value="">All</option>
              {OPERATING_OPTIONS.map(o => (
                <option key={o}>{o}</option>
              ))}
              <option value={NOT_ASSESSED}>Not assessed</option>
            </select>
          </div>
          <div>
            <label htmlFor="ctl-status" className={labelCls}>
              Assessment
            </label>
            <select id="ctl-status" className={selectCls} value={statusFilter} onChange={e => setStatusFilter(e.target.value as '' | 'Y' | 'N')}>
              <option value="">All</option>
              <option value="N">In progress</option>
              <option value="Y">Complete</option>
            </select>
          </div>
          <div>
            <label htmlFor="ctl-risk-filter" className={labelCls}>
              Risk
            </label>
            <select
              id="ctl-risk-filter"
              className={selectCls}
              value={riskFilter ?? ''}
              onChange={e => setRiskFilter(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">All risks</option>
              {riskFilter != null && !risks.has(riskFilter) && <option value={riskFilter}>Risk #{riskFilter}</option>}
              {[...risks.values()].map(r => (
                <option key={r.uuid} value={r.uuid}>
                  #{r.uuid} · {(r.statement ?? 'No statement').slice(0, 70)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataState
          query={[implQ, risksQ, libraryQ]}
          empty={rows.length === 0}
          emptyTitle={filtered ? 'No applied controls match these filters' : 'No controls have been applied to risks yet'}
          emptyDescription={filtered ? 'Clear the search or filters to see more.' : 'Apply a library control to a risk to start testing it.'}
          emptyAction={
            !filtered && hasPermission('create') ? (
              <Button size="sm" onClick={openNew}>
                <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                New applied control
              </Button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Control</th>
                  <th>Risk</th>
                  <th>Frequency</th>
                  <th>Design</th>
                  <th>Operating</th>
                  <th>Evidence</th>
                  <th>Assessment</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageSlice(rows, page, PAGE_SIZE).map(c => {
                  const id = rowId(c)
                  const { code, name } = controlName(c.control_id, library)
                  const riskId = numOrNull(c.identify_risk_uuid)
                  const risk = riskId != null ? risks.get(riskId) : undefined
                  return (
                    <tr key={id ?? JSON.stringify(c)}>
                      <td>
                        <span className="font-medium text-slate-900 block">{name}</span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {code ?? DASH}
                          {text(c.control_type) ? ` · ${text(c.control_type)}` : ''}
                        </span>
                      </td>
                      <td className="max-w-[260px]">
                        {riskId != null ? (
                          <Link href={`/rcsa/mitigation/${riskId}`} className="text-xs text-blue-700 hover:underline line-clamp-2">
                            {riskLabel(risk, riskId)}
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">No risk linked</span>
                        )}
                        {risk && <BandBadge score={currentScore(risk)} className="mt-1" />}
                      </td>
                      <td className="text-slate-600 text-xs">{text(c.control_frequency) ?? DASH}</td>
                      <td>
                        <ValueChip value={c.control_design_effectiveness} />
                      </td>
                      <td>
                        <ValueChip value={c.control_effectiveness_rating} />
                      </td>
                      <td className="max-w-[220px]">
                        <span className="line-clamp-2 text-xs text-slate-600">{text(c.evidence_notes) ?? DASH}</span>
                      </td>
                      <td className="text-xs text-slate-600">{c.is_stage_complted === 'Y' ? 'Complete' : 'In progress'}</td>
                      <td className="text-right whitespace-nowrap">
                        {hasPermission('update') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Edit ${name}`}
                            onClick={() => {
                              setEditing(c)
                              setDialogOpen(true)
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          </Button>
                        )}
                        {hasPermission('delete') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-600 hover:bg-red-50"
                            aria-label={`Delete ${name}`}
                            disabled={removing}
                            onClick={() => handleDelete(c)}
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
        </DataState>
      </div>

      <ControlImplementationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        row={editing}
        defaultRiskId={riskFilter}
      />
    </div>
  )
}
