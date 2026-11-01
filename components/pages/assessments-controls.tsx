'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Check, CircleCheck, Clock, Download, Minus, OctagonAlert, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip, CountUp, FilterChip, PageHeader, Panel, SearchField, Stat } from '@/components/charter/primitives'
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
  EffectivenessChip,
  FigureStrip,
  OPERATING_OPTIONS,
  controlName,
  downloadCsv,
  numOrNull,
  pageSlice,
  riskLabel,
  riskRefOf,
  rowId,
  testStatus,
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

  const [search, setSearch] = useState(params.get('q') ?? '')
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
  const loaded = !!implQ.data
  const pct = (n: number) => (counts.total ? `${Math.round((n / counts.total) * 100)}% of applied controls` : 'No applied controls yet')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Controls & mitigation · Testing"
        title="Control testing"
        description="Controls applied to risks, with their design and operating effectiveness and test evidence."
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
              <Download aria-hidden="true" />
              Export CSV
            </Button>
            {hasPermission('create') && (
              <Button onClick={openNew}>
                <Plus aria-hidden="true" />
                New applied control
              </Button>
            )}
          </>
        }
      />

      <FigureStrip>
        <Stat label="Applied controls" loading={!loaded} value={<CountUp value={counts.total} />} context={`Across ${new Set((implQ.data ?? []).map(c => numOrNull(c.identify_risk_uuid)).filter(v => v != null)).size} risks`} />
        <Stat
          label={<span className="inline-flex items-center gap-1.5"><CircleCheck className="size-3.5 text-status-success-fg" aria-hidden="true" />Effective</span>}
          loading={!loaded}
          value={<CountUp value={counts.effective} />}
          context={pct(counts.effective)}
        />
        <Stat
          label={<span className="inline-flex items-center gap-1.5"><TriangleAlert className="size-3.5 text-status-warning-fg" aria-hidden="true" />Partially effective</span>}
          loading={!loaded}
          value={<CountUp value={counts.partial} />}
          context={pct(counts.partial)}
        />
        <Stat
          label={<span className="inline-flex items-center gap-1.5"><OctagonAlert className="size-3.5 text-status-danger-fg" aria-hidden="true" />Ineffective</span>}
          loading={!loaded}
          value={<CountUp value={counts.ineffective} />}
          tone={counts.ineffective > 0 ? 'text-status-danger-fg' : undefined}
          context={counts.ineffective > 0 ? 'Need remediation' : 'None failing'}
        />
        <Stat label="Never tested" loading={!loaded} value={<CountUp value={counts.notAssessed} />} context="No operating result recorded" />
      </FigureStrip>

      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={search} onChange={setSearch} label="Search applied controls" placeholder="Control, risk, evidence…" />
        <FilterChip
          label="Operating"
          value={effFilter}
          onChange={setEffFilter}
          options={[...OPERATING_OPTIONS.map(o => ({ value: o, label: o })), { value: NOT_ASSESSED, label: 'Not assessed' }]}
        />
        <FilterChip
          label="Test"
          value={statusFilter}
          onChange={v => setStatusFilter(v as '' | 'Y' | 'N')}
          options={[
            { value: 'N', label: 'In progress' },
            { value: 'Y', label: 'Complete' },
          ]}
        />
        <FilterChip
          label="Risk"
          value={riskFilter != null ? String(riskFilter) : ''}
          onChange={v => setRiskFilter(v ? Number(v) : null)}
          options={[
            ...(riskFilter != null && !risks.has(riskFilter) ? [{ value: String(riskFilter), label: `Risk #${riskFilter}` }] : []),
            ...[...risks.values()].map(r => ({ value: String(r.uuid), label: `${r.referenceNumber ?? `#${r.uuid}`} · ${(r.statement ?? 'No statement recorded').slice(0, 60)}` })),
          ]}
        />
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('')
              setEffFilter('')
              setStatusFilter('')
              setRiskFilter(null)
            }}
          >
            Clear filters
          </Button>
        )}
        <span className="ml-auto text-caption text-muted-foreground tabular-nums">{loaded ? `${rows.length} of ${counts.total}` : ''}</span>
      </div>

      <Panel bodyClassName="p-0">
        <DataState
          query={[implQ, risksQ, libraryQ]}
          empty={rows.length === 0}
          emptyTitle={filtered ? 'No applied controls match these filters' : 'No controls have been applied to risks yet'}
          emptyDescription={filtered ? 'Clear the search or filters to see more.' : 'Apply a library control to a risk to start testing it.'}
          emptyAction={
            !filtered && hasPermission('create') ? (
              <Button onClick={openNew}>
                <Plus aria-hidden="true" />
                New applied control
              </Button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table min-w-[980px]">
              <thead>
                <tr>
                  <th className="pl-6">Control</th>
                  <th>Risk</th>
                  <th>Design</th>
                  <th>Operating</th>
                  <th>Evidence</th>
                  <th>Test</th>
                  <th className="pr-6 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageSlice(rows, page, PAGE_SIZE).map(c => {
                  const id = rowId(c)
                  const { code, name } = controlName(c.control_id, library)
                  const riskId = numOrNull(c.identify_risk_uuid)
                  const risk = riskId != null ? risks.get(riskId) : undefined
                  const ts = testStatus(c)
                  const evidence = text(c.evidence_notes)
                  return (
                    <tr key={id ?? JSON.stringify(c)}>
                      <td className="max-w-[300px] py-2 pl-6">
                        <span className="block truncate font-medium text-foreground" title={name}>
                          {name}
                        </span>
                        <span className="block truncate font-mono text-caption text-muted-foreground">
                          {[code ?? 'No code', text(c.control_type), text(c.control_frequency)].filter(Boolean).join(' · ')}
                        </span>
                      </td>
                      <td className="max-w-[280px] py-2">
                        {riskId != null ? (
                          <div className="flex min-w-0 items-center gap-2.5">
                            {risk && <BandBadge score={currentScore(risk)} compact />}
                            <span className="min-w-0">
                              <Link href={`/risks/${riskId}`} className="block truncate rounded-xs text-foreground hover:text-primary hover:underline focus-ring" title={riskLabel(risk, riskId)}>
                                {riskLabel(risk, riskId)}
                              </Link>
                              <span className="block font-mono text-caption text-muted-foreground">{riskRefOf(risk, riskId)}</span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No risk linked</span>
                        )}
                      </td>
                      <td>
                        <EffectivenessChip value={c.control_design_effectiveness} />
                      </td>
                      <td>
                        <EffectivenessChip value={c.control_effectiveness_rating} />
                      </td>
                      <td className="max-w-[200px]">
                        <span className={'block truncate ' + (evidence ? 'text-foreground-secondary' : 'text-muted-foreground')} title={evidence ?? undefined}>
                          {evidence ?? 'No evidence recorded'}
                        </span>
                      </td>
                      <td>
                        <Chip tone={ts.tone === 'success' ? 'success' : ts.tone === 'info' ? 'info' : 'neutral'} icon={ts.tone === 'success' ? Check : ts.tone === 'info' ? Clock : Minus}>
                          {ts.label.replace('Test ', '').replace(/^./, m => m.toUpperCase())}
                        </Chip>
                      </td>
                      <td className="pr-6 text-right whitespace-nowrap">
                        {hasPermission('update') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${name}`}
                            onClick={() => {
                              setEditing(c)
                              setDialogOpen(true)
                            }}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                        )}
                        {hasPermission('delete') && (
                          <Button variant="ghost" size="icon" className="hover:bg-status-danger-bg hover:text-status-danger-fg" aria-label={`Delete ${name}`} disabled={removing} onClick={() => handleDelete(c)}>
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
          <Pager page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
        </DataState>
      </Panel>

      <ControlImplementationDialog open={dialogOpen} onOpenChange={setDialogOpen} row={editing} defaultRiskId={riskFilter} />
    </div>
  )
}
