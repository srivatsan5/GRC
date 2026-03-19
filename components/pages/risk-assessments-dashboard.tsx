'use client'

import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import { ChevronDown, ChevronsUpDown, ChevronUp, Loader2, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { oracleService } from '@/lib/oracleService'

const COLORS = ['#3b82f6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#a78bfa']

export function RiskassessmentsdashboardPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const items = await oracleService.getRiskAssessmentsDashboard()
        setData(items)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary/70" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Syncing with Oracle ADW...</p>
        </div>
      </div>
    )
  }

  const EmptyChart = ({ title }: { title: string }) => (
    <div className="glass-card rounded-xl p-5 h-[280px] flex flex-col hover:shadow-md transition-shadow">
      <h2 className="text-sm font-bold text-foreground tracking-tight mb-4">{title}</h2>
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs font-medium bg-secondary/30 rounded-lg border border-border/50 border-dashed">
        Awaiting Data
      </div>
    </div>
  )

  const mockAssessments = [
    { id: 1, ref: 'RSK-2026-001', hierarchy: 'North America / Sales', statement: 'Data breach in regional CRM', progress: '75%', updated: '2026-03-14', assessment: 'Pending' },
    { id: 2, ref: 'RSK-2026-002', hierarchy: 'Europe / Operations', statement: 'Supply chain disruption', progress: '100%', updated: '2026-03-10', assessment: 'Complete' },
  ]

  return (
    <div className="flex-1 pb-10">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/50 px-6 py-5 bg-background/50 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">Risk Assessments Dashboard</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5 font-medium">Comprehensive risk analytics and evaluation metrics</p>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-secondary/80 text-foreground rounded-lg border border-border/50 hover:bg-secondary transition-colors shadow-sm">
            <Download className="w-3.5 h-3.5" />
            Export Dashboard
          </button>
        </div>
      </FadeIn>

      <div className="p-6 space-y-6">
        
        {/* Top Section: Heatmap & Table */}
        <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 2fr' }}>
          
          <FadeIn delay={0.2}>
            <div className="glass-card rounded-xl p-5 h-[340px] flex flex-col hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-[30px] opacity-10 pointer-events-none transition-opacity group-hover:opacity-20 bg-primary" />
              <div className="mb-4">
                <h2 className="text-sm font-bold text-foreground tracking-tight">Overall Risk Impact vs Likelihood</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">5x5 Evaluation Matrix</p>
              </div>
              <div className="flex-1 flex justify-center items-center">
                <div className="grid grid-cols-5 gap-1.5 w-full max-w-[240px]">
                  {Array.from({ length: 25 }).map((_, i) => {
                    // Simple heatmap aesthetic
                    const row = Math.floor(i / 5);
                    const col = i % 5;
                    const isRed = row < 2 && col > 2;
                    const isOrange = (row === 2 && col > 1) || (row < 2 && col === 2);
                    const isGreen = row > 2 && col < 3;
                    const bgClass = isRed ? 'bg-destructive/20 border-destructive/30 text-destructive' : 
                                  isOrange ? 'bg-amber-500/20 border-amber-500/30 text-amber-500' : 
                                  isGreen ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                                  'bg-secondary/50 border-border/50 text-muted-foreground';
                    return (
                      <div key={i} className={`aspect-square rounded-md border text-[10px] flex items-center justify-center font-bold shadow-sm ${bgClass}`}>
                        {Math.floor(Math.random() * 5)}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="glass-card rounded-xl overflow-hidden shadow-sm h-[340px] flex flex-col hover:shadow-md transition-shadow">
              <div className="p-5 border-b border-border/50">
                <h2 className="text-sm font-bold text-foreground tracking-tight">Risk Assessments</h2>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="bg-secondary/30 border-b border-border/50 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                      <th className="px-4 py-3">Sl No</th>
                      <th className="px-4 py-3">Reference No</th>
                      <th className="px-4 py-3">Hierarchy Name</th>
                      <th className="px-4 py-3 min-w-[200px]">Risk Statement</th>
                      <th className="px-4 py-3">Progress</th>
                      <th className="px-4 py-3">Last Updated</th>
                      <th className="px-4 py-3">Assessment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.length > 0 ? data.map((item, idx) => (
                      <tr key={item.id || idx} className="border-b border-zinc-800 hover:bg-zinc-800/20 transition-colors last:border-0 text-[11px] font-bold text-zinc-300">
                        <td className="px-5 py-4 text-zinc-600">{idx + 1}</td>
                        <td className="px-5 py-4 font-black text-zinc-100">{item.reference_no || 'N/A'}</td>
                        <td className="px-5 py-4 text-zinc-400">{item.hierarchy_name || 'N/A'}</td>
                        <td className="px-5 py-4 truncate max-w-[200px] text-zinc-100">{item.risk_statement || 'No statement provided'}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden min-w-[60px]">
                              <div 
                                className="h-full bg-primary" 
                                style={{ width: item.progress || '0%' }} 
                              />
                            </div>
                            <span className="text-[10px] text-zinc-500">{item.progress || '0%'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-mono text-zinc-500">{item.last_updated || '-'}</td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest",
                            item.assessment_status === 'Complete' 
                              ? "bg-emerald-500/10 text-emerald-500" 
                              : "bg-amber-500/10 text-amber-500"
                          )}>
                            {item.assessment_status || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="px-5 py-20 text-center text-zinc-600 italic font-medium">
                          No assessment data found in Oracle ADW.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </FadeIn>

        </div>

        {/* 12 Charts Grid */}
        <StaggerContainer className="grid grid-cols-3 gap-6" delayChildren={0.4} staggerChildren={0.05}>
          <StaggerItem><EmptyChart title="Risk Impact Overview" /></StaggerItem>
          <StaggerItem><EmptyChart title="Risk Likelihood Overview" /></StaggerItem>
          <StaggerItem><EmptyChart title="Likelihood vs Impact" /></StaggerItem>
          <StaggerItem><EmptyChart title="Assessments by Approval Status" /></StaggerItem>
          <StaggerItem><EmptyChart title="Assessments by Implementation Status" /></StaggerItem>
          <StaggerItem><EmptyChart title="Risk Details by Risk Type" /></StaggerItem>
          <StaggerItem><EmptyChart title="Risk by Availability of SOP" /></StaggerItem>
          <StaggerItem><EmptyChart title="Risks by Causal Factors" /></StaggerItem>
          <StaggerItem><EmptyChart title="Risks by Data Sources" /></StaggerItem>
          <StaggerItem><EmptyChart title="Risks by Impact Parties" /></StaggerItem>
          <StaggerItem><EmptyChart title="Risks by Risk Category" /></StaggerItem>
          <StaggerItem><EmptyChart title="Q-O-Q Residual Risk Analysis" /></StaggerItem>
        </StaggerContainer>

      </div>
    </div>
  )
}
