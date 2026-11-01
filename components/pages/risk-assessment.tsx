'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { DataState } from '@/components/data-state'
import { BandBadge } from '@/components/band-badge'
import { Pager } from '@/components/pager'
import { useAuth } from '@/components/providers/auth-provider'
import { useRowPage } from '@/lib/data'
import { BANDS, bandCounts, currentScore, toRisk, type Band } from '@/lib/risk'
import { useOrgSettings } from '@/lib/settings'
import { formatDate, formatNumber } from '@/lib/format'
import { approvalLabel, riskDate, riskLabel, RISK_TABLE, useRisks } from '@/components/analytics/risk-data'
import { Panel } from '@/components/analytics/widgets'

const PAGE_SIZE = 25

// Chart fills matching BAND_STYLES dots (recharts needs colour values, not Tailwind classes).
const BAND_FILL: Record<Band | 'Not rated', string> = {
  Low: '#10b981',
  Moderate: '#f59e0b',
  High: '#f97316',
  Critical: '#dc2626',
  'Not rated': '#cbd5e1',
}

/** /risk-assessment — every risk with its inherent and residual assessment, searchable and paged. */
export function RiskAssessmentPage() {
  const { hasPermission } = useAuth()
  const { bands, money } = useOrgSettings()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Debounce the search box; the server does the searching.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const pageQ = useRowPage(RISK_TABLE, { page, pageSize: PAGE_SIZE, search, sort: 'created_on', order: 'desc' })
  const rows = useMemo(() => (pageQ.data?.items ?? []).map(toRisk), [pageQ.data])

  // Distribution and totals over the whole register (not just this page).
  const allQ = useRisks()
  const all = allQ.data
  const stats = useMemo(() => {
    const active = (all ?? []).filter(r => r.isActive)
    const scores = active.map(currentScore)
    const counts = bandCounts(scores, bands)
    const rated = scores.filter((x): x is number => x != null)
    return {
      total: active.length,
      rated: rated.length,
      critical: counts.Critical,
      avg: rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null,
      chart: [...BANDS, 'Not rated' as const].map(b => ({ band: b, count: counts[b] })),
    }
  }, [all, bands])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Risk assessment</h1>
          <p className="text-xs text-slate-500">Inherent and residual likelihood × impact scoring across the risk register</p>
        </div>
        {hasPermission('create') && (
          <Link href="/rcsa/identification" className="inline-flex items-center h-8 px-3 rounded text-xs font-medium bg-blue-900 hover:bg-blue-800 text-white">
            Assess risks in the register
          </Link>
        )}
      </div>

      <DataState query={allQ} compact>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-3">
            <Metric label="Active risks" value={formatNumber(stats.total)} />
            <Metric label="Rated" value={formatNumber(stats.rated)} sub={`${stats.total - stats.rated} not rated`} />
            <Metric label="Average current score" value={stats.avg == null ? '—' : formatNumber(stats.avg, 1)} sub={stats.avg == null ? 'No ratings yet' : `of 25 · ${stats.critical} critical`} />
          </div>
          <Panel title="Current score by band" className="lg:col-span-3">
            <p className="-mt-1 mb-3 text-[11px] text-slate-500">Current = residual if assessed, else inherent.</p>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="band" axisLine={false} tickLine={false} style={{ fontSize: '11px' }} stroke="#64748b" />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} style={{ fontSize: '11px' }} stroke="#64748b" />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '12px' }} />
                  <Bar dataKey="count" name="Risks" radius={[4, 4, 0, 0]}>
                    {stats.chart.map(e => (
                      <Cell key={e.band} fill={BAND_FILL[e.band]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </DataState>

      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="relative w-72">
            <label htmlFor="risk-assessment-search" className="sr-only">Search risks</label>
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <Input
              id="risk-assessment-search"
              type="search"
              placeholder="Search statement, process, owner…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="h-8 pl-8 text-xs bg-slate-50"
            />
          </div>
        </div>

        <DataState
          query={pageQ}
          empty={rows.length === 0}
          emptyTitle={search ? `No risks match “${search}”` : 'No risks in the register yet'}
          emptyAction={!search ? <Link href="/rcsa/identification" className="text-xs text-blue-700 hover:underline">Identify a risk</Link> : undefined}
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th className="w-[34%]">Risk statement</th>
                  <th>Category</th>
                  <th>Process / owner</th>
                  <th>Inherent</th>
                  <th>Residual</th>
                  <th className="text-right">SLE</th>
                  <th>Approval</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.uuid}>
                    <td>
                      <span className="font-medium text-slate-900 block">{riskLabel(r)}</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {r.referenceNumber ?? `#${r.uuid}`}
                        {!r.isActive && ' · inactive'}
                      </span>
                    </td>
                    <td className="text-slate-600">{r.category ?? '—'}</td>
                    <td className="text-slate-600">
                      {r.process ?? '—'}
                      {r.owner && <span className="block text-[11px] text-slate-400">{r.owner}</span>}
                    </td>
                    <td>
                      <BandBadge score={r.inherentScore} />
                      {r.inherentScore != null && <span className="block text-[10px] text-slate-400 mt-0.5">L{r.inherentLikelihood} × I{r.inherentImpact}</span>}
                    </td>
                    <td>
                      <BandBadge score={r.residualScore} />
                      {r.residualScore != null && <span className="block text-[10px] text-slate-400 mt-0.5">L{r.residualLikelihood} × I{r.residualImpact}</span>}
                    </td>
                    <td className="text-right tabular-nums">{money(r.sle)}</td>
                    <td>
                      <Badge variant="outline" className="text-[10px] font-normal px-2 py-0.5 rounded">{approvalLabel(r.approvalStatus)}</Badge>
                    </td>
                    <td className="text-slate-600 whitespace-nowrap">{formatDate(riskDate(r))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200">
            <Pager page={page} pageSize={PAGE_SIZE} total={pageQ.data?.total ?? 0} onPage={setPage} busy={pageQ.isFetching} />
          </div>
        </DataState>
      </div>
    </div>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-4 bg-white rounded border border-slate-200">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}
