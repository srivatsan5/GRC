'use client'

import React from 'react'
import { useQueries } from '@tanstack/react-query'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts'
import { 
  Shield, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Search,
  Bell,
  Settings,
  ChevronRight
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { oracleService } from '@/lib/oracleService'

export function Dashboard() {
  // 1. Data Fetching
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
  const riskDistribution = results[2].data || []
  const riskByProcess = results[3].data || []

  const summary = summaryData?.[0] || {}

  const stats = [
    { title: 'Total Risks', value: summary.total_risks || 0, change: '+2.5%', icon: Activity },
    { title: 'Completed', value: summary.completed_risks || 0, change: '+1.2%', icon: CheckCircle2 },
    { title: 'Pending', value: summary.pending_risks || 0, change: '-0.5%', icon: Clock },
    { title: 'Implemented', value: summary.total_controls || 0, change: '+8.4%', icon: Shield },
  ]

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1 text-balance">Enterprise-grade risk telemetry and operational health.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
            Export Report
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 bg-card border border-border rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.title}</span>
              <stat.icon className="w-4 h-4 text-primary opacity-50" />
            </div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold tracking-tighter">{stat.value}</h2>
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full border",
                stat.change.startsWith('+') ? "text-emerald-500 bg-emerald-500/5 border-emerald-500/10" : "text-destructive bg-destructive/5 border-destructive/10"
              )}>
                {stat.change}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2 p-6 bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Risk Velocity Trend
            </h3>
            <select className="bg-transparent text-[10px] font-black uppercase text-muted-foreground outline-none border-none">
              <option>Last 30 Days</option>
              <option>Quarterly</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={riskTrend}>
                <defs>
                  <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#635BFF" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#635BFF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="risk_date" axisLine={false} tickLine={false} style={{ fontSize: '10px', fontWeight: 600 }} stroke="var(--muted-foreground)" />
                <YAxis axisLine={false} tickLine={false} style={{ fontSize: '10px', fontWeight: 600 }} stroke="var(--muted-foreground)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontWeight: 700 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="total_risks" 
                  stroke="#635BFF" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#colorTrend)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Process Distribution */}
        <div className="p-6 bg-card border border-border rounded-xl">
          <h3 className="text-sm font-semibold mb-8">Process Exposure</h3>
          <div className="space-y-6">
            {riskByProcess.slice(0, 5).map((p: any, i: number) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                  <span className="text-muted-foreground">{p.process}</span>
                  <span>{p.count}</span>
                </div>
                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(p.count / summary.total_risks) * 100}%` }}
                    className="h-full bg-primary" 
                  />
                </div>
              </div>
            ))}
            {riskByProcess.length === 0 && (
              <div className="h-[200px] flex flex-col items-center justify-center text-center opacity-30">
                <Activity className="w-8 h-8 mb-2" />
                <span className="text-xs font-bold uppercase">No Process Mapping</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Distribution Table View */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="text-sm font-semibold">Inherent Risk Matrix</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-black uppercase text-muted-foreground tracking-widest bg-muted/50">
              <tr>
                <th className="p-4">Risk Category</th>
                <th className="p-4 text-center">Inherent Value</th>
                <th className="p-4 text-center">Score</th>
                <th className="p-4 text-right">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {riskDistribution.map((row: any, i: number) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors group">
                  <td className="p-4 font-bold tracking-tight text-foreground">{row.category}</td>
                  <td className="p-4 text-center tabular-nums">{row.value}</td>
                  <td className="p-4 text-center">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-black border uppercase shadow-sm",
                      row.value > 10 ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    )}>
                      {row.value > 10 ? 'High' : 'Low'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1 text-emerald-500 font-bold">
                      <ArrowUpRight className="w-3 h-3" />
                      <span className="text-[11px] tabular-nums">0.0%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {riskDistribution.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground italic">No distribution metrics available in current cycle.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
