'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { 
  Plus, 
  Search, 
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { oracleService } from '@/lib/oracleService'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

function scoreColor(score: number): string {
  if (score >= 16) return '#dc2626'
  if (score >= 12) return '#d97706'
  if (score >= 8) return '#ca8a04'
  return '#16a34a'
}

export function RiskAssessmentPage() {
  const router = useRouter()
  const [globalFilter, setGlobalFilter] = useState('')

  // 1. Data Fetching
  const { data: assessmentData = [], isLoading } = useQuery({
    queryKey: ['risk-assessments-core'],
    queryFn: async () => {
      const data = await oracleService.getIdentifyRisks()
      const parsed = oracleService.parseAllRisks(data)
      return parsed.map((d) => ({
        id: d.uuid,
        risk: d.risk_statement,
        riskId: `RSK-${d.uuid}`,
        probability: d.likelihood,
        impact: d.impact,
        riskScore: d.score,
        status: d.is_stage_complted === 'Y' ? 'Completed' : 'In Review',
        assessor: d.process_name,
        date: 'Q1 2026',
      }))
    },
  })

  // 2. Computed
  const scoreDistribution = useMemo(() => {
    const dist = [
      { range: '1–5', count: 0, color: '#16a34a' },
      { range: '6–10', count: 0, color: '#ca8a04' },
      { range: '11–15', count: 0, color: '#d97706' },
      { range: '16–20', count: 0, color: '#dc2626' },
      { range: '21–25', count: 0, color: '#991b1b' },
    ]
    assessmentData.forEach((a: any) => {
      if (a.riskScore <= 5) dist[0].count++
      else if (a.riskScore <= 10) dist[1].count++
      else if (a.riskScore <= 15) dist[2].count++
      else if (a.riskScore <= 20) dist[3].count++
      else dist[4].count++
    })
    return dist
  }, [assessmentData])

  const stats = useMemo(() => {
    const avg = assessmentData.length > 0 ? (assessmentData.reduce((s: number, i: any) => s + i.riskScore, 0) / assessmentData.length).toFixed(1) : '0.0'
    const critical = assessmentData.filter((a: any) => a.riskScore >= 16).length
    return { avg, critical, total: assessmentData.length }
  }, [assessmentData])

  // 3. Columns
  const columnHelper = createColumnHelper<any>()
  const columns = useMemo(() => [
    columnHelper.accessor('risk', {
      header: 'Risk statement',
      cell: info => (
        <div>
          <span className="font-medium text-slate-900 block">{info.getValue()}</span>
          <span className="text-[11px] text-slate-400 font-mono">ID: {info.row.original.riskId}</span>
        </div>
      ),
    }),
    columnHelper.accessor('probability', {
      header: 'Likelihood',
      cell: info => <span className="font-mono text-slate-600">{info.getValue()}/5</span>,
    }),
    columnHelper.accessor('impact', {
      header: 'Impact',
      cell: info => <span className="font-mono text-slate-600">{info.getValue()}/5</span>,
    }),
    columnHelper.accessor('riskScore', {
      header: 'Score (S)',
      cell: info => {
        const score = info.getValue()
        const color = scoreColor(score)
        return (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="font-semibold tabular-nums" style={{ color }}>{score}</span>
          </div>
        )
      },
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => (
        <span className={cn(
          "px-2 py-0.5 rounded text-[11px] font-medium border",
          info.getValue() === 'Completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
        )}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('assessor', {
      header: 'Department / Owner',
      cell: info => <span className="text-slate-600">{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/assessments/inherent`)}
          className="h-7 text-xs text-blue-700 hover:text-blue-900"
        >
          View &rarr;
        </Button>
      )
    })
  ], [router])

  // 4. Table instance
  const table = useReactTable({
    data: assessmentData,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
  })

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
        <p className="text-xs">Loading assessments...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Risk Assessment</h1>
          <p className="text-xs text-slate-500">Likelihood and impact scoring across active risks</p>
        </div>
        <Button 
          size="sm" 
          onClick={() => router.push('/assessments/inherent')}
          className="h-8 text-xs font-medium bg-blue-900 hover:bg-blue-800 text-white rounded"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          New assessment
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Total assessments</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">{stats.total}</div>
        </div>
        <div className="p-4 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Critical risks (Score &ge; 16)</div>
          <div className="text-2xl font-semibold text-rose-600 mt-1 tabular-nums">{stats.critical}</div>
        </div>
        <div className="p-4 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Average risk score</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">{stats.avg} <span className="text-xs font-normal text-slate-400">/ 25</span></div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4 bg-white rounded border border-slate-200">
        <div className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-4">Score distribution</div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="range" axisLine={false} tickLine={false} style={{ fontSize: '11px' }} stroke="#64748b" />
              <YAxis axisLine={false} tickLine={false} style={{ fontSize: '11px' }} stroke="#64748b" />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '12px' }}
              />
              <Bar dataKey="count" name="Risks" radius={[4, 4, 0, 0]}>
                {scoreDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="Filter assessments..."
              value={globalFilter}
              onChange={e => setGlobalFilter(e.target.value)}
              className="h-8 pl-8 text-xs bg-slate-50"
            />
          </div>
        </div>

        <table className="enterprise-table">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  No assessments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
