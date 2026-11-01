'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataState } from '@/components/data-state'
import { bandCounts } from '@/lib/risk'
import { useOrgSettings } from '@/lib/settings'
import { formatNumber, formatPct, pctOf } from '@/lib/format'
import { exportCsv, fileDate } from '@/components/analytics/csv'
import { approvalLabel, countBy, riskCsvColumns, useRisks } from '@/components/analytics/risk-data'
import { BandCountTable, BarList, Panel } from '@/components/analytics/widgets'

/**
 * /risk-assessments/dashboard — how far the assessment work has got across the register:
 * rating coverage, approval and completion status, SOP availability, and where the risks sit.
 * (Score analytics live on /assessments/access (inherent) and /assessments/residual.)
 */
export function RiskassessmentsdashboardPage() {
  const { bands, money, settings } = useOrgSettings()
  const risksQ = useRisks()
  const all = risksQ.data
  const risks = useMemo(() => (all ?? []).filter(r => r.isActive), [all])

  const s = useMemo(() => {
    const inherentRated = risks.filter(r => r.inherentScore != null).length
    const residualRated = risks.filter(r => r.residualScore != null).length
    const complete = risks.filter(r => r.isComplete).length
    const sop = (v: unknown) => (v === 'Y' ? 'SOP available' : v === 'N' ? 'No SOP' : 'Not recorded')
    const sleByCategory = new Map<string, { total: number; n: number }>()
    for (const r of risks) {
      if (r.sle == null) continue
      const k = r.category ?? 'Not specified'
      const cur = sleByCategory.get(k) ?? { total: 0, n: 0 }
      sleByCategory.set(k, { total: cur.total + r.sle, n: cur.n + 1 })
    }
    return {
      inherentRated,
      residualRated,
      complete,
      approval: countBy(risks, r => approvalLabel(r.approvalStatus)),
      completion: [
        { name: 'Stage complete', count: complete },
        { name: 'In progress', count: risks.length - complete },
      ],
      sop: countBy(risks, r => sop(r.raw.is_sop_available)),
      byCategory: countBy(risks, r => r.category),
      byProcess: countBy(risks, r => r.process),
      sleByCategory: [...sleByCategory.entries()].map(([name, v]) => ({ name, count: v.total, n: v.n })).sort((a, b) => b.count - a.count),
      inherent: bandCounts(risks.map(r => r.inherentScore), bands),
      residual: bandCounts(risks.map(r => r.residualScore), bands),
    }
  }, [risks, bands])

  const onExport = () =>
    exportCsv({
      filename: `risk-assessments-${fileDate()}`,
      entity: 'per_trn_identify_risk',
      description: 'Exported risk assessment register from assessment dashboard',
      rows: risks,
      columns: riskCsvColumns(bands, settings.currency),
    })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Risk assessment dashboard</h1>
          <p className="text-xs text-slate-500">Assessment progress across the active risk register</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onExport} disabled={!risksQ.isSuccess || risks.length === 0}>
          <FileDown className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      <DataState query={risksQ} empty={risks.length === 0} emptyTitle="No risks in the register yet" emptyAction={<Link href="/rcsa/identification" className="text-xs text-blue-700 hover:underline">Identify a risk</Link>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="Active risks" value={formatNumber(risks.length)} />
          <Tile label="Inherent assessed" value={formatPct(pctOf(s.inherentRated, risks.length))} sub={`${s.inherentRated} of ${risks.length} risks`} href="/assessments/access" />
          <Tile label="Residual assessed" value={formatPct(pctOf(s.residualRated, risks.length))} sub={`${s.residualRated} of ${risks.length} risks`} href="/assessments/residual" />
          <Tile label="Stage complete" value={formatPct(pctOf(s.complete, risks.length))} sub={`${s.complete} of ${risks.length} risks`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="Risks by band" bodyClassName="p-0">
            <BandCountTable columns={[{ label: 'Inherent', counts: s.inherent }, { label: 'Residual', counts: s.residual }]} />
          </Panel>
          <Panel title="Approval status">
            <BarList items={s.approval} total={risks.length} />
          </Panel>
          <div className="space-y-4">
            <Panel title="Completion">
              <BarList items={s.completion} total={risks.length} />
            </Panel>
            <Panel title="SOP availability">
              <BarList items={s.sop} total={risks.length} />
            </Panel>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="By category">
            <BarList items={s.byCategory} total={risks.length} limit={10} />
          </Panel>
          <Panel title="By business process">
            <BarList items={s.byProcess} total={risks.length} limit={10} />
          </Panel>
          <Panel title="Recorded SLE by category">
            {s.sleByCategory.length === 0 ? (
              <p className="text-xs text-slate-500">No risk has an SLE recorded yet.</p>
            ) : (
              <BarList
                items={s.sleByCategory.map(c => ({ name: `${c.name} (${c.n})`, count: c.count }))}
                total={0}
                limit={10}
                valueLabel={v => money(v, { compact: true })}
              />
            )}
          </Panel>
        </div>
      </DataState>
    </div>
  )
}

function Tile({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) {
  const body = (
    <>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </>
  )
  return href ? (
    <Link href={href} className="block p-4 bg-white rounded border border-slate-200 hover:border-slate-300 transition-colors">
      {body}
    </Link>
  ) : (
    <div className="p-4 bg-white rounded border border-slate-200">{body}</div>
  )
}
