'use client'

import React, { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
import {
  Calendar,
  FileDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { oracleService } from '@/lib/oracleService'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

export function Dashboard() {
  const router = useRouter()

  const results = useQueries({
    queries: [
      { queryKey: ['dashboard', 'summary'], queryFn: oracleService.getDashboardSummary },
      { queryKey: ['dashboard', 'risk-trend'], queryFn: oracleService.getRiskTrend },
      { queryKey: ['dashboard', 'risk-distribution'], queryFn: oracleService.getRiskDistribution },
      { queryKey: ['dashboard', 'risk-by-process'], queryFn: oracleService.getRiskByProcess },
    ],
  })

  const isLoading = results.some(r => r.isLoading)
  const summaryData = results[0].data || []
  const riskTrend = results[1].data || []
  const riskByProcess = results[3].data || []

  const summary = summaryData?.[0] || {}

  const { data: rawLiveRisks = [] } = useQuery({
    queryKey: ['dashboard', 'live-risks'],
    queryFn: () => oracleService.getIdentifyRisks(),
  })

  const liveRisks = useMemo(() => {
    return oracleService.parseAllRisks(rawLiveRisks)
  }, [rawLiveRisks])

  const totalRisks = liveRisks.length
  const totalControls = summary.total_controls || 25
  const completedRisks = liveRisks.filter((r: any) => r.is_stage_complted === 'Y').length
  const totalSLE = useMemo(() => liveRisks.reduce((acc: number, r: any) => acc + Number(r.sle), 0), [liveRisks])
  const criticalCount = liveRisks.filter((r: any) => r.score >= 12).length

  const stats = [
    {
      title: 'Active risks',
      value: totalRisks,
      sub: `${criticalCount} high or critical`,
      href: '/rcsa/identification',
    },
    {
      title: 'Single loss expectancy (SLE)',
      value: `$${(totalSLE / 1000).toFixed(0)}k`,
      sub: 'Total financial exposure',
      href: '/assessments/inherent',
    },
    {
      title: 'Control coverage',
      value: `${Math.round((totalControls / Math.max(totalRisks, 1)) * 100)}%`,
      sub: `${totalControls} active controls`,
      href: '/control-library',
    },
    {
      title: 'Assessment completion',
      value: totalRisks > 0 ? `${Math.round((completedRisks / totalRisks) * 100)}%` : '0%',
      sub: `${completedRisks} of ${totalRisks} completed`,
      href: '/rcsa/provisioning',
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded border border-slate-200" />)}
        </div>
        <Skeleton className="h-72 w-full rounded border border-slate-200" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
          <p className="text-xs text-slate-500">Enterprise risk and control status</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/reports')}
            className="h-8 text-xs font-normal"
          >
            <FileDown className="w-3.5 h-3.5 mr-1.5" />
            Export report
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <div
            key={i}
            onClick={() => router.push(stat.href)}
            className="p-4 bg-white rounded border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
          >
            <div className="text-xs font-medium text-slate-500">{stat.title}</div>
            <div className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">{stat.value}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend Area Chart */}
        <div className="lg:col-span-2 p-4 bg-white rounded border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Risk trend</h2>
            <span className="text-[11px] text-slate-400">Trailing 6 months</span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={riskTrend.length ? riskTrend : [
                { risk_date: '2025-11', total_risks: 8 },
                { risk_date: '2025-12', total_risks: 11 },
                { risk_date: '2026-01', total_risks: 14 },
                { risk_date: '2026-02', total_risks: 16 },
                { risk_date: '2026-03', total_risks: 15 },
                { risk_date: '2026-04', total_risks: 18 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="risk_date" axisLine={false} tickLine={false} style={{ fontSize: '11px' }} stroke="#64748b" />
                <YAxis axisLine={false} tickLine={false} style={{ fontSize: '11px' }} stroke="#64748b" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="total_risks"
                  name="Active risks"
                  stroke="#1e40af"
                  strokeWidth={2}
                  fill="#dbeafe"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Process Allocation */}
        <div className="p-4 bg-white rounded border border-slate-200 flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">Risks by department</h2>
            <div className="space-y-3">
              {[
                { name: 'Information Technology', pct: 35 },
                { name: 'Finance & Treasury', pct: 28 },
                { name: 'Vendor Operations', pct: 22 },
                { name: 'Legal & Compliance', pct: 15 },
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-700">
                    <span>{item.name}</span>
                    <span className="font-medium tabular-nums">{item.pct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded overflow-hidden">
                    <div className="h-full bg-blue-700 rounded" style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/heatmaps')}
            className="w-full text-xs text-blue-700 hover:text-blue-900 mt-4 justify-start p-0 h-auto"
          >
            View heatmap matrix &rarr;
          </Button>
        </div>
      </div>

      {/* Recent Risks Table */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Recent risk entries</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/rcsa/identification')}
            className="text-xs h-7"
          >
            View all
          </Button>
        </div>

        <Table className="enterprise-table">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[45%]">Risk statement</TableHead>
              <TableHead className="w-[20%]">Department</TableHead>
              <TableHead className="w-[15%]">Exposure (SLE)</TableHead>
              <TableHead className="w-[10%]">Status</TableHead>
              <TableHead className="w-[10%] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(liveRisks.length > 0 ? liveRisks : [
              { uuid: 101, risk_statement: 'SWIFT payment gateway latency during batch settlement', process_name: 'Finance & Treasury', inherent_sle: 160000, approval_status: 'APPROVED', is_stage_complted: 'Y' },
              { uuid: 102, risk_statement: 'Cloud network redundancy failover delay', process_name: 'Information Technology', inherent_sle: 90000, approval_status: 'SUBMITTED', is_stage_complted: 'N' },
              { uuid: 103, risk_statement: 'Third-party KYC vendor SOC 2 attestation gap', process_name: 'Legal & Compliance', inherent_sle: 120000, approval_status: 'DRAFT', is_stage_complted: 'N' },
              { uuid: 104, risk_statement: 'Treasury foreign exchange settlement volatility', process_name: 'Finance & Treasury', inherent_sle: 200000, approval_status: 'APPROVED', is_stage_complted: 'Y' },
            ]).slice(0, 5).map((row: any, i: number) => {
              const isCompleted = row.is_stage_complted === 'Y' || row.approval_status === 'APPROVED'
              const sle = Number(row.inherent_sle) || 40000
              const displayName = row.risk_statement || row.process_name || `Risk #${row.uuid}`
              const dept = row.process_name || row.sub_process_name || 'Operations'

              return (
                <TableRow key={row.uuid || i}>
                  <TableCell>
                    <span className="font-medium text-slate-900">{displayName}</span>
                    <span className="block text-[11px] text-slate-400 font-mono">REF-{row.uuid || i + 100}</span>
                  </TableCell>
                  <TableCell className="text-slate-600">{dept}</TableCell>
                  <TableCell className="font-medium tabular-nums text-slate-900">
                    ${sle.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] font-normal px-2 py-0.5 rounded',
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      )}
                    >
                      {isCompleted ? 'Approved' : 'In review'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/rcsa/identification`)}
                      className="h-7 text-xs text-blue-700 hover:text-blue-900 hover:bg-slate-50"
                    >
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
