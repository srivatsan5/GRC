'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { BandBadge } from '@/components/band-badge'
import { useRows } from '@/lib/data'
import { currentScore, toRisk } from '@/lib/risk'
import { useOrgSettings } from '@/lib/settings'
import { DASH } from '@/lib/format'
import { isActionComplete, labelCls, numOrNull, pageSlice, selectCls } from '@/components/treatment/shared'

const PAGE_SIZE = 25
type Scope = 'needs' | 'above' | 'nocontrols' | 'all'

export function MitigationActiveRisksPage() {
  const { bands } = useOrgSettings()
  const risksQ = useRows('per_trn_identify_risk')
  const implQ = useRows('per_trn_control_implementation')
  const plansQ = useRows('per_trn_risk_monitoring')

  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<Scope>('needs')
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [search, scope])

  const rows = useMemo(() => {
    const controlCount = new Map<number, number>()
    for (const c of implQ.data ?? []) {
      const id = numOrNull(c.identify_risk_uuid)
      if (id != null) controlCount.set(id, (controlCount.get(id) ?? 0) + 1)
    }
    const planCount = new Map<number, { total: number; open: number }>()
    for (const p of plansQ.data ?? []) {
      const id = numOrNull(p.identify_risk_uuid)
      if (id == null) continue
      const cur = planCount.get(id) ?? { total: 0, open: 0 }
      cur.total++
      if (!isActionComplete(p)) cur.open++
      planCount.set(id, cur)
    }
    return (risksQ.data ?? [])
      .map(toRisk)
      .filter(r => r.isActive && Number.isFinite(r.uuid))
      .map(r => {
        const score = currentScore(r)
        const controls = controlCount.get(r.uuid) ?? 0
        const above = score != null && score >= bands.high
        return { risk: r, score, controls, plans: planCount.get(r.uuid) ?? { total: 0, open: 0 }, above, noControls: controls === 0 }
      })
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.risk.uuid - b.risk.uuid)
  }, [risksQ.data, implQ.data, plansQ.data, bands.high])

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter(x => {
      if (scope === 'needs' && !(x.above || x.noControls)) return false
      if (scope === 'above' && !x.above) return false
      if (scope === 'nocontrols' && !x.noControls) return false
      if (!term) return true
      const r = x.risk
      return [r.statement, r.process, r.category, r.owner, r.referenceNumber].some(v => v && v.toLowerCase().includes(term))
    })
  }, [rows, scope, search])

  const counts = {
    needs: rows.filter(x => x.above || x.noControls).length,
    above: rows.filter(x => x.above).length,
    nocontrols: rows.filter(x => x.noControls).length,
    unrated: rows.filter(x => x.score == null).length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Risk mitigation</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Active risks that need treatment: rated at or above the High band (score ≥ {bands.high}, from Settings), or with no controls applied.
        </p>
      </div>

      {risksQ.data && implQ.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Need treatment', counts.needs],
            [`At or above High (≥ ${bands.high})`, counts.above],
            ['No controls applied', counts.nocontrols],
            ['Not rated yet', counts.unrated],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-white border border-slate-200 rounded p-3">
              <span className="block text-[11px] text-slate-500">{label}</span>
              <span className="text-lg font-semibold text-slate-900 tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded">
        <div className="p-3 border-b border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label htmlFor="mit-search" className={labelCls}>
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <Input id="mit-search" className="pl-8 h-9" placeholder="Statement, process, category, owner…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="mit-scope" className={labelCls}>
              Show
            </label>
            <select id="mit-scope" className={selectCls} value={scope} onChange={e => setScope(e.target.value as Scope)}>
              <option value="needs">Needs treatment</option>
              <option value="above">At or above High</option>
              <option value="nocontrols">No controls applied</option>
              <option value="all">All active risks</option>
            </select>
          </div>
        </div>

        <DataState
          query={[risksQ, implQ, plansQ]}
          empty={shown.length === 0}
          emptyTitle={rows.length === 0 ? 'The risk register is empty' : 'No risks match'}
          emptyDescription={rows.length === 0 ? 'Identify risks in an assessment cycle first.' : 'Change the filter or search to see other risks.'}
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Risk</th>
                  <th>Process / category</th>
                  <th>Current score</th>
                  <th className="text-right">Controls</th>
                  <th className="text-right">Action plans (open / total)</th>
                  <th>Why listed</th>
                  <th className="text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {pageSlice(shown, page, PAGE_SIZE).map(({ risk: r, score, controls, plans, above, noControls }) => (
                  <tr key={r.uuid}>
                    <td className="max-w-[320px]">
                      <span className="font-medium text-slate-900 line-clamp-2">{r.statement ?? `Risk #${r.uuid} (no statement)`}</span>
                      <span className="text-[11px] text-slate-500">{r.owner ? `Owner: ${r.owner}` : `#${r.uuid}`}</span>
                    </td>
                    <td className="text-xs text-slate-600">
                      {r.process ?? DASH}
                      {r.category && <span className="block text-slate-500">{r.category}</span>}
                    </td>
                    <td>
                      <BandBadge score={score} />
                      {score == null && (
                        <Link href={`/rcsa/mitigation/${r.uuid}`} className="block text-[11px] text-blue-700 hover:underline mt-0.5">
                          Rate this risk
                        </Link>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{controls}</td>
                    <td className="text-right tabular-nums">
                      {plans.open} / {plans.total}
                    </td>
                    <td className="text-xs text-slate-600">
                      {[above && `Score ≥ ${bands.high}`, noControls && 'No controls'].filter(Boolean).join(' · ') || DASH}
                    </td>
                    <td className="text-right">
                      <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                        <Link href={`/rcsa/mitigation/${r.uuid}`} aria-label={`View details of risk ${r.uuid}`}>
                          View <ArrowRight className="w-3.5 h-3.5 ml-1" aria-hidden="true" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={shown.length} onPage={setPage} />
        </DataState>
      </div>
    </div>
  )
}
