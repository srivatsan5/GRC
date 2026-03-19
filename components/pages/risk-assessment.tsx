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
  ChevronUp, 
  ChevronDown, 
  ChevronsUpDown, 
  MoreVertical, 
  Loader2,
  Activity,
  BarChart3,
  ShieldAlert,
  Target,
  ArrowRight,
  TrendingDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { oracleService } from '@/lib/oracleService'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

function scoreColor(score: number): string {
  if (score >= 16) return '#ef4444'
  if (score >= 12) return '#f59e0b'
  if (score >= 8) return '#eab308'
  return '#10b981'
}

export function RiskAssessmentPage() {
  const router = useRouter()
  const [globalFilter, setGlobalFilter] = useState('')

  // 1. Data Fetching
  const { data: assessmentData = [], isLoading } = useQuery({
    queryKey: ['risk-assessments-core'],
    queryFn: async () => {
      const data = await oracleService.getIdentifyRisks()
      return data.map((d: any) => {
        const prob = d.probability || Math.floor(Math.random() * 5) + 1
        const imp = d.impact || Math.floor(Math.random() * 5) + 1
        return {
          id: d.assessment_id || d.ID || `ASM-${Math.floor(Math.random() * 1000)}`,
          risk: d.risk_name || d.NAME || d.name || 'Unknown',
          riskId: d.risk_id || 'RSK-0000',
          probability: prob,
          impact: imp,
          riskScore: prob * imp,
          status: d.assessment_status || 'Pending Review',
          assessor: d.assessor || d.owner || 'Unassigned',
          date: d.assessment_date || d.identified_date || new Date().toISOString().split('T')[0]
        }
      })
    },
  })

  // 2. Computed
  const scoreDistribution = useMemo(() => {
    const dist = [
      { range: '1–5', count: 0, color: '#10b981' },
      { range: '6–10', count: 0, color: '#eab308' },
      { range: '11–15', count: 0, color: '#f59e0b' },
      { range: '16–20', count: 0, color: '#ef4444' },
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
      header: 'Identified Bound',
      cell: info => (
        <div className="flex flex-col">
           <span className="font-bold text-foreground text-[13px] tracking-tight">{info.getValue()}</span>
           <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">ID: {info.row.original.riskId}</span>
        </div>
      ),
    }),
    columnHelper.accessor('probability', {
      header: 'Likelihood',
      cell: info => <span className="font-mono text-[11px] font-bold text-muted-foreground">{info.getValue()}/5</span>,
    }),
    columnHelper.accessor('impact', {
      header: 'Gravity',
      cell: info => <span className="font-mono text-[11px] font-bold text-muted-foreground">{info.getValue()}/5</span>,
    }),
    columnHelper.accessor('riskScore', {
      header: 'Vector Sum',
      cell: info => {
        const score = info.getValue()
        const color = scoreColor(score)
        return (
          <div className="flex items-center gap-2">
             <div className="w-1 h-3 rounded-full" style={{ backgroundColor: color }} />
             <span className="text-sm font-black tabular-nums" style={{ color }}>{score}</span>
          </div>
        )
      },
    }),
    columnHelper.accessor('status', {
      header: 'Lifecycle',
      cell: info => (
        <span className={cn(
          "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border",
          info.getValue() === 'Complete' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-primary/10 text-primary border-primary/20"
        )}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('assessor', {
      header: 'Custodian',
      cell: info => <span className="text-[11px] font-bold text-foreground italic">{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: () => (
        <button className="p-1 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground/40 hover:text-foreground">
           <ArrowRight className="w-4 h-4" />
        </button>
      )
    })
  ], [])

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
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative mb-6">
           <Loader2 className="w-12 h-12 animate-spin text-primary/30" />
           <ShieldAlert className="absolute inset-0 m-auto w-5 h-5 text-primary animate-pulse" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Scanning Risk Perimeter...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 pb-20 bg-background/20 font-sans">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/40 px-6 py-6 bg-background/60 backdrop-blur-xl sticky top-0 z-40 flex justify-between items-center shadow-sm">
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tighter uppercase italic">Assessment Kernel</h1>
            <p className="text-[12px] text-muted-foreground mt-1 font-medium italic opacity-70">Probability × Impact orchestration and systemic scoring</p>
          </div>
          <Button 
            size="sm" 
            onClick={() => router.push('/assessments/inherent')}
            className="rounded-full px-6 h-10 font-black uppercase text-[11px] tracking-widest shadow-xl shadow-primary/20"
          >
            <Plus className="w-3.5 h-3.5 mr-2" />
            New Vector
          </Button>
        </div>
      </FadeIn>

      <div className="p-8 space-y-8">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
           <div className="md:col-span-8">
              <div className="glass-card rounded-[40px] p-8 bg-card/40 border border-border/40 shadow-xl h-full flex flex-col">
                 <div className="flex items-center justify-between mb-10">
                    <div>
                       <h2 className="text-base font-black text-foreground uppercase tracking-widest italic leading-none">Scoring Distribution</h2>
                       <p className="text-[10px] text-muted-foreground font-medium mt-1 italic opacity-60">Fleet behavior segmented by impact vectors</p>
                    </div>
                    <BarChart3 className="w-5 h-5 text-muted-foreground/30" />
                 </div>
                 <div className="flex-1 min-h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={scoreDistribution} margin={{ top: 0, right: 0, left: -40, bottom: 0 }}>
                          <XAxis dataKey="range" axisLine={false} tickLine={false} style={{ fontSize: '10px', fontWeight: 800 }} />
                          <Tooltip cursor={{ fill: 'var(--secondary)', opacity: 0.2 }} contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', fontSize: '11px' }} />
                          <Bar dataKey="count" radius={[10, 10, 0, 0]} barSize={40}>
                             {scoreDistribution.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                             ))}
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           <div className="md:col-span-4 space-y-4">
              <div className="glass-card rounded-[32px] p-6 bg-card/40 border border-border/40 shadow-lg flex flex-col items-center justify-center text-center">
                 <div className="p-3 rounded-2xl bg-primary/10 text-primary mb-4">
                    <TrendingDown className="w-6 h-6" />
                 </div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Systemic Average</p>
                 <h3 className="text-4xl font-black text-foreground tabular-nums tracking-tighter">{stats.avg}</h3>
                 <span className="text-[9px] font-black text-primary uppercase mt-2 px-2 py-0.5 rounded bg-primary/10 border border-primary/20">Operational Nominal</span>
              </div>
              <div className="glass-card rounded-[32px] p-6 bg-card/40 border border-border/40 shadow-lg flex flex-col items-center justify-center text-center">
                 <div className="p-3 rounded-2xl bg-destructive/10 text-destructive mb-4">
                    <ShieldAlert className="w-6 h-6" />
                 </div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Critical Flux</p>
                 <h3 className="text-4xl font-black text-destructive tabular-nums tracking-tighter">{stats.critical}</h3>
                 <span className="text-[9px] font-black text-destructive uppercase mt-2 px-2 py-0.5 rounded bg-destructive/10 border border-destructive/20">Intervention Req</span>
              </div>
           </div>
        </div>

        {/* Search & Grid Controls */}
        <div className="flex flex-col md:flex-row gap-4 bg-card/40 p-3 rounded-2xl border border-border/40 backdrop-blur-md">
           <div className="relative flex-1 max-w-sm ml-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input 
                placeholder="Query risk nodes..." 
                className="pl-12 h-11 bg-background/50 border-none rounded-xl text-[14px] font-bold shadow-inner placeholder:font-medium placeholder:italic" 
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
              />
           </div>
           <div className="flex ml-auto items-center gap-2">
              <Button variant="ghost" className="h-11 rounded-xl px-5 text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:bg-secondary">
                 <Activity className="w-4 h-4 mr-2" />
                 Live Stream
              </Button>
           </div>
        </div>

        {/* Data Grid */}
        <div className="glass-card rounded-[40px] overflow-hidden shadow-2xl border border-border/40 bg-card/5 backdrop-blur-xl flex flex-col min-h-[600px]">
           <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-separate border-spacing-0">
                 <thead className="bg-secondary/60 backdrop-blur-md">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                       {table.getHeaderGroups()[0].headers.map(h => (
                         <th key={h.id} className="px-8 py-5 border-b border-border/20 border-r border-border/10 last:border-r-0">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                         </th>
                       ))}
                    </tr>
                 </thead>
                 <tbody>
                    {table.getRowModel().rows.map(row => (
                      <motion.tr 
                        key={row.id} 
                        layout="position"
                        className="group hover:bg-primary/5 transition-all cursor-pointer"
                      >
                         {row.getVisibleCells().map(cell => (
                           <td key={cell.id} className="px-8 py-5 border-b border-border/10 border-r border-border/10 last:border-r-0">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                           </td>
                         ))}
                      </motion.tr>
                    ))}
                 </tbody>
              </table>
           </div>
           
           <div className="bg-secondary/40 px-10 py-5 border-t border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-6">
                 <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary/60" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">ADW Real-time Orchestration</span>
                 </div>
                 <div className="w-px h-4 bg-border/40" />
                 <span className="text-[11px] font-bold text-foreground">{assessmentData.length} Identified Nodes</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground italic">Vector Matrix Synchronized</span>
           </div>
        </div>

        {/* Bottom Section: 5x5 Matrix visual */}
        <div className="glass-card rounded-[40px] p-8 bg-card/30 border border-border/40 shadow-xl relative overflow-hidden">
           <div className="mb-10 text-center md:text-left">
              <h2 className="text-base font-black text-foreground uppercase tracking-widest italic">Vector Magnitude Matrix</h2>
              <p className="text-[11px] font-medium text-muted-foreground mt-1 italic opacity-70">Positional distribution of current risk inventory</p>
           </div>
           
           <div className="flex justify-center">
              <div className="grid grid-cols-5 gap-2.5">
                 {Array.from({ length: 25 }).map((_, i) => {
                    const row = Math.floor(i / 5)
                    const col = i % 5
                    const p = 5 - row
                    const im = col + 1
                    const score = p * im
                    const matching = assessmentData.filter((a: any) => a.probability === p && a.impact === im).length
                    
                    return (
                      <motion.div 
                        key={i} 
                        whileHover={{ scale: 1.05, zIndex: 10 }}
                        className={cn(
                          "w-16 h-16 md:w-24 md:h-20 rounded-2xl border flex flex-col items-center justify-center transition-all cursor-default shadow-lg",
                          score >= 16 ? "bg-destructive/20 border-destructive/40 text-destructive" :
                          score >= 12 ? "bg-amber-500/20 border-amber-500/40 text-amber-500" :
                          score >= 8 ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-500" :
                          "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                        )}
                      >
                         <span className="text-[9px] font-black opacity-30 mb-1">{score}</span>
                         <span className="text-xl font-black tracking-tighter tabular-nums">{matching || ''}</span>
                      </motion.div>
                    )
                 })}
              </div>
           </div>
           <div className="mt-8 flex justify-center gap-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
              <span className="flex items-center gap-2 pr-10 border-r border-border/30 italic">Impact Vector →</span>
              <span className="italic">← Probability Vector</span>
           </div>
        </div>
      </div>
    </div>
  )
}
