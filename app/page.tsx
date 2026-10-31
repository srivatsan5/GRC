'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  Shield,
  Activity,
  ChevronRight,
  Plus,
  FileDown,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Layers,
  Building2,
  History,
  FileText,
  Target,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Check,
  Zap,
  ArrowRight,
  GitBranch,
} from 'lucide-react'
import { oracleService } from '@/lib/oracleService'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { PericopeLayout } from '@/components/pericope-layout'
import { cn } from '@/lib/utils'
import { workflowStore } from '@/components/pages/workflow'
import { kriStore } from '@/components/pages/kri-intelligence'
import { controlsStore } from '@/components/pages/control-library'
import { vendorStore } from '@/components/pages/vendor-risk'
import { listAudit } from '@/lib/auditLog'
import { useStoreSnapshot } from '@/lib/localStore'
import { useAuth } from '@/components/providers/auth-provider'

export default function HomePage() {
  const router = useRouter()
  const { user, hasPermission } = useAuth()
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<'velocity' | 'matrix' | 'distribution'>('velocity')

  // 1. Live Data Ingestion
  const { data: rawRisks = [], isLoading: risksLoading } = useQuery({
    queryKey: ['home-risks'],
    queryFn: () => oracleService.getIdentifyRisks(),
  })

  const { data: riskTrend = [] } = useQuery({
    queryKey: ['home-risk-trend'],
    queryFn: () => oracleService.getRiskTrend(),
  })

  // Live Local Store Snapshots
  const workflows = useStoreSnapshot(workflowStore)
  const kris = useStoreSnapshot(kriStore)
  const controls = useStoreSnapshot(controlsStore)
  const vendors = useStoreSnapshot(vendorStore)
  const auditLogs = useMemo(() => listAudit().slice(0, 5), [])

  // Process and Sanitize Risk Records using the unified oracleService.parseAllRisks
  const risks = useMemo(() => {
    return oracleService.parseAllRisks(rawRisks)
  }, [rawRisks])

  // Aggregate Mathematical Exposures
  const totalSLE = useMemo(() => risks.reduce((acc: number, r: any) => acc + Number(r.sle), 0), [risks])
  const residualSLE = useMemo(() => Math.round(totalSLE * 0.32), [totalSLE])
  const riskReductionPct = useMemo(() => totalSLE > 0 ? Math.round(((totalSLE - residualSLE) / totalSLE) * 100) : 0, [totalSLE, residualSLE])
  
  // Severity Band Distribution (Guaranteed exact match with Heatmap)
  const severityBands = useMemo(() => {
    const critical = risks.filter((r) => r.score >= 16)
    const high = risks.filter((r) => r.score >= 12 && r.score < 16)
    const medium = risks.filter((r) => r.score >= 8 && r.score < 12)
    const low = risks.filter((r) => r.score < 8)
    return { critical, high, medium, low }
  }, [risks])

  const criticalRisks = useMemo(() => risks.filter((r) => r.score >= 12), [risks])

  // Actionable Items
  const pendingApprovals = useMemo(() => workflows.filter(w => w.status === 'Pending' || w.status === 'In Review'), [workflows])
  const kriBreaches = useMemo(() => kris.filter(k => k.currentValue >= k.amberThreshold), [kris])

  // Chart Data
  const chartData = useMemo(() => {
    if (riskTrend && riskTrend.length > 0) return riskTrend
    return [
      { risk_date: '2025-11', total_risks: 8 },
      { risk_date: '2025-12', total_risks: 11 },
      { risk_date: '2026-01', total_risks: 14 },
      { risk_date: '2026-02', total_risks: 16 },
      { risk_date: '2026-03', total_risks: 15 },
      { risk_date: '2026-04', total_risks: 18 },
    ]
  }, [riskTrend])

  // 5x5 Mini Matrix Cells (Guaranteed exact match with Heatmap)
  const matrixCells = useMemo(() => {
    return Array.from({ length: 25 }, (_, i) => {
      const row = Math.floor(i / 5)
      const col = i % 5
      const prob = 5 - row
      const impact = col + 1
      const score = prob * impact

      const matched = risks.filter((r) => r.likelihood === prob && r.impact === impact)
      return { prob, impact, score, count: matched.length }
    })
  }, [risks])

  // Department Allocation Data
  const deptDistribution = useMemo(() => [
    { name: 'InfoSec & Cloud', count: 35, color: '#1e40af' },
    { name: 'Finance & Treasury', count: 28, color: '#0f766e' },
    { name: 'TPRM / Vendors', count: 22, color: '#b45309' },
    { name: 'Legal & SOX', count: 15, color: '#475569' },
  ], [])

  return (
    <PericopeLayout>
      <div className="space-y-6 font-sans">

        {/* 1. TOP BRIEFING HEADER BAR */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pericope ERM</span>
              <span className="text-slate-300">&middot;</span>
              <span className="text-[11px] font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Enterprise Risk Committee
              </span>
              <span className="text-slate-300">&middot;</span>
              <span className="text-[11px] text-slate-500 font-mono">Q1 2026 Assessment Cycle</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Enterprise Risk & Compliance Workspace
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Consolidated operational risk intelligence, single loss expectancy exposure, and internal control telemetry.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/reports')}
              className="h-8 text-xs bg-white text-slate-700 hover:bg-slate-50 border-slate-300 shadow-xs"
            >
              <FileDown className="w-3.5 h-3.5 mr-1.5" />
              Board Risk Pack (PDF)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/rcsa/identification')}
              className="h-8 text-xs bg-white text-slate-700 hover:bg-slate-50 border-slate-300 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Catalog Risk
            </Button>
            {hasPermission('create') && (
              <Button
                size="sm"
                onClick={() => router.push('/rcsa/provisioning')}
                className="h-8 text-xs bg-blue-900 hover:bg-blue-800 text-white font-medium shadow-xs"
              >
                <GitBranch className="w-3.5 h-3.5 mr-1.5" />
                Start RCSA Cycle
              </Button>
            )}
          </div>
        </div>

        {/* 2. EXECUTIVE RISK POSTURE & METRIC SPOTLIGHT STRIP */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Gross Financial Exposure (SLE) */}
          <div
            onClick={() => router.push('/assessments/inherent')}
            className="p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-700 transition-all shadow-xs cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold text-slate-600">Gross SLE Exposure</span>
              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-900 border-blue-200 font-mono">
                FAIR Model
              </Badge>
            </div>
            <div className="my-2">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                ${(totalSLE / 1000).toFixed(0)}k
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                <span>Net Residual: <strong className="text-slate-800">${(residualSLE / 1000).toFixed(0)}k</strong></span>
                <span className="text-emerald-700 font-semibold font-mono">({riskReductionPct}% &darr;)</span>
              </div>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-800 rounded-full" style={{ width: `${100 - riskReductionPct}%` }} />
            </div>
          </div>

          {/* Card 2: 4-Band Risk Severity Breakdown */}
          <div
            onClick={() => router.push('/heatmaps')}
            className="p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-700 transition-all shadow-xs cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold text-slate-600">Active Portfolio Risks</span>
              <span className="text-xs font-bold text-slate-900 tabular-nums">{risks.length} Total</span>
            </div>
            <div className="space-y-1.5 my-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-rose-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-rose-600" /> Critical (16–25)
                </span>
                <span className="font-bold tabular-nums text-slate-900">{severityBands.critical.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> High (12–15)
                </span>
                <span className="font-bold tabular-nums text-slate-900">{severityBands.high.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Moderate / Low (1–10)
                </span>
                <span className="font-bold tabular-nums text-slate-900">{severityBands.medium.length + severityBands.low.length}</span>
              </div>
            </div>
            <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-slate-100 gap-0.5">
              <div className="bg-rose-600 h-full" style={{ width: `${(severityBands.critical.length / risks.length) * 100}%` }} />
              <div className="bg-amber-500 h-full" style={{ width: `${(severityBands.high.length / risks.length) * 100}%` }} />
              <div className="bg-emerald-500 h-full" style={{ width: `${((severityBands.medium.length + severityBands.low.length) / risks.length) * 100}%` }} />
            </div>
          </div>

          {/* Card 3: Control Coverage & Operating Effectiveness */}
          <div
            onClick={() => router.push('/control-library')}
            className="p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-700 transition-all shadow-xs cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold text-slate-600">Control Coverage</span>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200 font-mono">
                ISO & SOX
              </Badge>
            </div>
            <div className="my-2">
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight tabular-nums">
                78.4%
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {controls.length} controls mapped &middot; Avg: 4.4/5
              </div>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-full" style={{ width: '78.4%' }} />
            </div>
          </div>

          {/* Card 4: Action Items & Telemetry Alerts */}
          <div
            onClick={() => router.push('/workflow')}
            className="p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-700 transition-all shadow-xs cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold text-slate-600">Action Items & Alerts</span>
              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200 font-mono">
                {pendingApprovals.length + kriBreaches.length} Open
              </Badge>
            </div>
            <div className="my-2">
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 tracking-tight tabular-nums">
                {pendingApprovals.length + kriBreaches.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {pendingApprovals.length} approvals due &middot; {kriBreaches.length} KRI alerts
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-blue-700 font-medium group-hover:underline">
              <span>Review action queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* 3. INTERACTIVE RCSA LIFECYCLE PROGRESSION ENGINE */}
        <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-blue-900" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Active RCSA Assessment Lifecycle
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-mono">Cycle Q1-2026 &middot; 4 Stages Active</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { id: '01', title: 'Cycle Provisioning', count: '4 cycles in-flight', status: 'Active', href: '/rcsa/provisioning', sub: 'Scope & Champions' },
              { id: '02', title: 'Risk Identification', count: `${risks.length} risks cataloged`, status: 'Active', href: '/rcsa/identification', sub: 'CSV Import & Likelihood/Impact' },
              { id: '03', title: 'Controls & Mitigation', count: `${controls.length} controls mapped`, status: 'Active', href: '/rcsa/mitigation', sub: 'Residual Step-down (68%)' },
              { id: '04', title: 'Continuous Monitoring', count: '8 action plans', status: 'In Progress', href: '/rcsa/monitoring', sub: 'Milestones & Attestation' },
            ].map((stg) => (
              <div
                key={stg.id}
                onClick={() => router.push(stg.href)}
                className="p-3 bg-slate-50 rounded border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-xs text-blue-900 group-hover:text-blue-800">{stg.id} {stg.title}</span>
                  <span className="text-[10px] text-slate-400 font-semibold">{stg.status}</span>
                </div>
                <div className="text-xs font-semibold text-slate-800 mt-1">{stg.count}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
                  <span>{stg.sub}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. SPLIT-SCREEN ANALYTICS & ACTION CENTER GRID (60% / 40%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column (7 of 12 columns): Interactive Visualizations & Posture */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Visual Analytics Box with 3 Tabbed Modes */}
            <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div>
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Risk Intelligence & Visual Posture</h2>
                  <p className="text-[11px] text-slate-500">Interactive analytical telemetry across enterprise portfolios</p>
                </div>

                {/* Analytical Tab Switcher */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
                  <button
                    onClick={() => setActiveAnalyticsTab('velocity')}
                    className={cn(
                      'px-2.5 py-1 rounded text-xs transition-colors font-medium',
                      activeAnalyticsTab === 'velocity' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    Risk Velocity
                  </button>
                  <button
                    onClick={() => setActiveAnalyticsTab('matrix')}
                    className={cn(
                      'px-2.5 py-1 rounded text-xs transition-colors font-medium',
                      activeAnalyticsTab === 'matrix' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    5×5 Matrix
                  </button>
                  <button
                    onClick={() => setActiveAnalyticsTab('distribution')}
                    className={cn(
                      'px-2.5 py-1 rounded text-xs transition-colors font-medium',
                      activeAnalyticsTab === 'distribution' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    Allocation
                  </button>
                </div>
              </div>

              {/* TAB 1: RISK VELOCITY (Area Chart) */}
              {activeAnalyticsTab === 'velocity' && (
                <div className="space-y-2">
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="velocityGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1e40af" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#1e40af" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="risk_date" axisLine={false} tickLine={false} style={{ fontSize: '11px', fontWeight: 500 }} stroke="#64748b" />
                        <YAxis axisLine={false} tickLine={false} style={{ fontSize: '11px', fontWeight: 500 }} stroke="#64748b" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="total_risks"
                          name="Active Risks"
                          stroke="#1e40af"
                          strokeWidth={2.5}
                          fill="url(#velocityGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span>Trailing 6-month risk velocity</span>
                    <button onClick={() => router.push('/heatmaps')} className="text-blue-800 font-semibold hover:underline">
                      Explore detailed heatmap &rarr;
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: INTERACTIVE 5x5 MINI-MATRIX */}
              {activeAnalyticsTab === 'matrix' && (
                <div className="space-y-3 py-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Likelihood (Vertical) &times; Impact (Horizontal)</span>
                    <span className="font-mono text-slate-700">Formula: S = L &times; I</span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 max-w-md mx-auto">
                    {matrixCells.map((cell, idx) => {
                      const tone = cell.score >= 16 ? 'bg-rose-50 border-rose-200 text-rose-800' :
                                   cell.score >= 12 ? 'bg-amber-50 border-amber-200 text-amber-800' :
                                   cell.score >= 8 ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                                   'bg-emerald-50 border-emerald-200 text-emerald-800'
                      return (
                        <div
                          key={idx}
                          onClick={() => router.push('/heatmaps')}
                          className={cn(
                            'h-10 rounded border flex flex-col items-center justify-center cursor-pointer transition-transform hover:scale-105',
                            tone
                          )}
                        >
                          <span className="text-[9px] opacity-60">S={cell.score}</span>
                          <span className="text-xs font-bold tabular-nums">{cell.count > 0 ? cell.count : '—'}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-600 pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> Critical</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> High</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Moderate</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Low</span>
                  </div>
                </div>
              )}

              {/* TAB 3: DEPARTMENTAL ALLOCATION */}
              {activeAnalyticsTab === 'distribution' && (
                <div className="space-y-3 py-1">
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deptDistribution} layout="vertical" margin={{ left: 20, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" tick={{ fontSize: 11 }} stroke="#64748b" />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} stroke="#0f172a" width={110} />
                        <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '4px' }} />
                        <Bar dataKey="count" name="Concentration %" radius={[0, 4, 4, 0]}>
                          {deptDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-right">
                    <button onClick={() => router.push('/rcsa/mitigation')} className="text-xs text-blue-800 font-semibold hover:underline">
                      View mitigation breakdown by department &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* High Priority Risk Scenarios Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div>
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Priority Risk Scenarios ($SLE &ge; $100k)</h2>
                  <p className="text-[11px] text-slate-500">Inherent risks requiring immediate control mitigation and testing</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/rcsa/identification')}
                  className="h-7 text-xs"
                >
                  View All ({risks.length})
                </Button>
              </div>

              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th className="w-[45%]">Risk Statement</th>
                    <th className="w-[20%]">Department</th>
                    <th className="w-[18%]">Exposure (SLE)</th>
                    <th className="w-[17%] text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {criticalRisks.slice(0, 4).map((r: any, i: number) => {
                    const sle = Number(r.inherent_sle) || 40000
                    const isCritical = sle >= 160000
                    return (
                      <tr key={r.uuid || i}>
                        <td>
                          <span className="font-medium text-slate-900 block">{r.risk_statement}</span>
                          <span className="text-[10px] text-slate-400 font-mono">REF-{r.uuid || i + 100}</span>
                        </td>
                        <td className="text-slate-600">{r.process_name || 'Operations'}</td>
                        <td>
                          <div className="font-medium tabular-nums text-slate-900">${sle.toLocaleString()}</div>
                          <span className={cn(
                            'text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded border',
                            isCritical ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                          )}>
                            {isCritical ? 'Critical' : 'High'}
                          </span>
                        </td>
                        <td className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/rcsa/mitigation/${r.uuid || r.id || '101'}`)}
                            className="h-7 text-xs text-blue-800 hover:text-blue-900 font-semibold"
                          >
                            Mitigate &rarr;
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Recent Operational Audit Events */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-600" />
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Recent System Audit Events</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/audit-trail')}
                  className="h-7 text-xs text-blue-800 hover:text-blue-900 font-semibold"
                >
                  Full Audit Log &rarr;
                </Button>
              </div>

              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th className="w-[20%]">Timestamp</th>
                    <th className="w-[20%]">User</th>
                    <th className="w-[15%]">Action</th>
                    <th className="w-[45%]">Event Description</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((e, idx) => (
                    <tr key={e.id || idx}>
                      <td className="font-mono text-[11px] text-slate-500">
                        {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &middot; {new Date(e.timestamp).toLocaleDateString()}
                      </td>
                      <td className="font-medium text-slate-900">{e.actor_name}</td>
                      <td className="font-mono text-xs font-semibold text-slate-700">{e.action}</td>
                      <td className="text-slate-600 line-clamp-1">{e.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>

          {/* Right Column (5 of 12 columns): Action Queue & Live Product Hub */}
          <div className="lg:col-span-5 space-y-6">

            {/* Action Center (Urgent Approvals & KRI Alerts) */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Items Requiring Attention</h2>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono bg-white text-slate-700 border-slate-300">
                  {pendingApprovals.length + kriBreaches.length} Open
                </Badge>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {/* Pending Approvals */}
                {pendingApprovals.map(appr => (
                  <div key={appr.id} className="p-3 hover:bg-slate-50 transition-colors space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 truncate pr-2">{appr.title}</span>
                      <StatusBadge status="warning" label="Approval Due" />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Submitted by {appr.submittedBy} &middot; {appr.business}</span>
                      <button
                        onClick={() => router.push('/workflow')}
                        className="text-blue-800 hover:underline font-semibold"
                      >
                        Review &rarr;
                      </button>
                    </div>
                  </div>
                ))}

                {/* KRI Breaches */}
                {kriBreaches.map(kri => {
                  const isRed = kri.currentValue >= kri.redThreshold
                  return (
                    <div key={kri.id} className="p-3 hover:bg-slate-50 transition-colors space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 truncate pr-2">{kri.name}</span>
                        <StatusBadge status={isRed ? 'critical' : 'warning'} label={isRed ? 'Breach' : 'Warning'} />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Current: <strong className="text-slate-900">{kri.currentValue} {kri.unit}</strong> (Limit: {kri.amberThreshold})</span>
                        <button
                          onClick={() => router.push('/kri')}
                          className="text-blue-800 hover:underline font-semibold"
                        >
                          View KRI &rarr;
                        </button>
                      </div>
                    </div>
                  )
                })}

                {pendingApprovals.length === 0 && kriBreaches.length === 0 && (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    No urgent action items pending.
                  </div>
                )}
              </div>
            </div>

            {/* Live Product Capability Showcase Hub */}
            <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Platform Capabilities Hub</h2>
                <span className="text-[10px] text-slate-400 font-mono">Live Modules</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                
                {/* Module 1: RCSA & Assessments */}
                <div
                  onClick={() => router.push('/rcsa')}
                  className="p-3 rounded border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer space-y-1 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <Shield className="w-3.5 h-3.5 text-blue-800" />
                      <span>RCSA Engine</span>
                    </div>
                    <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-blue-800 transition-colors" />
                  </div>
                  <p className="text-[11px] text-slate-500">4-stage lifecycle &middot; CSV import &middot; Single loss SLE</p>
                  <span className="text-[10px] font-semibold text-blue-800 font-mono">{risks.length} active risks</span>
                </div>

                {/* Module 2: Controls & Testing */}
                <div
                  onClick={() => router.push('/control-library')}
                  className="p-3 rounded border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer space-y-1 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <Layers className="w-3.5 h-3.5 text-emerald-800" />
                      <span>Control Library</span>
                    </div>
                    <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-emerald-800 transition-colors" />
                  </div>
                  <p className="text-[11px] text-slate-500">ISO 27001 & SOX 404 &middot; Design & Operating</p>
                  <span className="text-[10px] font-semibold text-emerald-800 font-mono">{controls.length} controls</span>
                </div>

                {/* Module 3: KRI Telemetry */}
                <div
                  onClick={() => router.push('/kri')}
                  className="p-3 rounded border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer space-y-1 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <Activity className="w-3.5 h-3.5 text-amber-800" />
                      <span>KRI Telemetry</span>
                    </div>
                    <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-amber-800 transition-colors" />
                  </div>
                  <p className="text-[11px] text-slate-500">Threshold alerts &middot; Trend sparklines &middot; Breaches</p>
                  <span className="text-[10px] font-semibold text-amber-800 font-mono">{kris.length} indicators</span>
                </div>

                {/* Module 4: Third-Party Risk & Resiliency */}
                <div
                  onClick={() => router.push('/vendor-risk')}
                  className="p-3 rounded border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer space-y-1 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <Building2 className="w-3.5 h-3.5 text-slate-700" />
                      <span>TPRM & Resiliency</span>
                    </div>
                    <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-slate-800 transition-colors" />
                  </div>
                  <p className="text-[11px] text-slate-500">Critical vendor tiers &middot; BCP/DRP &middot; FAIR stress lab</p>
                  <span className="text-[10px] font-semibold text-slate-700 font-mono">{vendors.length} vendors</span>
                </div>

              </div>
            </div>

            {/* Quick Actions & Navigation Link Strip */}
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Quick Navigation:</span>
              <div className="flex items-center gap-3">
                <Link href="/heatmaps" className="hover:text-blue-900 hover:underline">Heatmaps</Link>
                <span>&middot;</span>
                <Link href="/reports" className="hover:text-blue-900 hover:underline">Board Pack</Link>
                <span>&middot;</span>
                <Link href="/audit-trail" className="hover:text-blue-900 hover:underline">Audit Trail</Link>
                <span>&middot;</span>
                <Link href="/settings" className="hover:text-blue-900 hover:underline">Settings</Link>
              </div>
            </div>

          </div>

        </div>

      </div>
    </PericopeLayout>
  )
}
