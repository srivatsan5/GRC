'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Loader2, Download, AlertOctagon, TrendingUp, DollarSign, Laptop } from 'lucide-react'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { oracleService } from '@/lib/oracleService'
import { cn } from '@/lib/utils'

export function AssessmentsaccessPage() {
  const { data: rawRisks = [], isLoading } = useQuery({
    queryKey: ['assessments-access'],
    queryFn: () => oracleService.getAssessmentsAccess(),
  })

  const risks = useMemo(() => {
    return oracleService.parseAllRisks(rawRisks)
  }, [rawRisks])

  // Compute real stats
  const stats = useMemo(() => {
    if (!risks.length) return { topRisk: 'No Data', topScore: 0, avgScore: '0.0', total: 0 }
    const sorted = [...risks].sort((a, b) => b.sle - a.sle)
    const top = sorted[0]
    const avg = (risks.reduce((s, r) => s + r.sle, 0) / risks.length)
    return {
      topRisk: top?.risk_statement || top?.process_name || 'Unknown',
      topScore: top?.sle || 0,
      avgScore: avg.toFixed(0),
      total: risks.length
    }
  }, [risks])

  // Build heatmap from real data
  const heatmapData = useMemo(() => {
    return Array.from({ length: 25 }, (_, i) => {
      const row = Math.floor(i / 5)
      const col = i % 5
      const prob = 5 - row
      const impact = col + 1
      const score = prob * impact
      const matching = risks.filter((r) => r.likelihood === prob && r.impact === impact).length
      return { prob, impact, score, count: matching }
    })
  }, [risks])

  // Build chart data from real risks
  const financialImpact = useMemo(() => {
    const groups: Record<string, number> = {}
    risks.forEach((r: any) => {
      const cat = r.risk_type || r.process_name || 'General'
      groups[cat] = (groups[cat] || 0) + (r.inherent_sle || 0)
    })
    return Object.entries(groups).slice(0, 4).map(([category, score]) => ({
      category: category.length > 15 ? category.substring(0, 15) + '…' : category,
      score: Math.round(score / 1000)
    }))
  }, [risks])

  const techImpact = useMemo(() => {
    const byProcess: Record<string, number> = {}
    risks.forEach((r: any) => {
      const proc = r.process_name || r.sub_process_name || `Process ${r.business_process_uuid || 'N/A'}`
      byProcess[proc] = (byProcess[proc] || 0) + 1
    })
    return Object.entries(byProcess).slice(0, 4).map(([category, score]) => ({
      category: category.length > 15 ? category.substring(0, 15) + '…' : category,
      score
    }))
  }, [risks])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary/70" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Analyzing Inherent Risk Exposure...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 pb-10">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/50 px-6 py-5 bg-background/50 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">Access Inherent Risk</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5 font-medium">Dashboard visualizing pure baseline risk exposure from ADW</p>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-secondary/80 text-foreground rounded-lg border border-border/50 hover:bg-secondary transition-colors shadow-sm">
            <Download className="w-3.5 h-3.5" />
            Export View
          </button>
        </div>
      </FadeIn>

      <div className="p-6 space-y-6">
        {/* Top Summary Cards */}
        <StaggerContainer className="grid grid-cols-3 gap-6" delayChildren={0.2} staggerChildren={0.1}>
          <StaggerItem>
            <div className="glass-card rounded-xl p-5 border-l-4 border-l-red-500/50 shadow-sm relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-[30px] opacity-10 bg-red-500 pointer-events-none transition-opacity group-hover:opacity-20" />
              <div className="flex justify-between items-start mb-4">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Top Inherent Risk</p>
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500">
                  <AlertOctagon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-bold text-foreground tracking-tight">{stats.topRisk}</p>
              <p className="text-[11px] font-medium text-red-400 mt-1 uppercase tracking-wider">SLE: ₹{stats.topScore.toLocaleString()}</p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="glass-card rounded-xl p-5 border-l-4 border-l-amber-500/50 shadow-sm relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-[30px] opacity-10 bg-amber-500 pointer-events-none transition-opacity group-hover:opacity-20" />
              <div className="flex justify-between items-start mb-4">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Avg Inherent SLE</p>
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground tabular-nums tracking-tight">₹{stats.avgScore}</p>
              <p className="text-[11px] font-medium text-amber-400 mt-1 uppercase tracking-wider">Status: {Number(stats.avgScore) > 40000 ? 'Elevated' : 'Nominal'}</p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="glass-card rounded-xl p-5 border-l-4 border-l-emerald-500/50 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Risks Identified</p>
                <div className="p-2 rounded-lg bg-secondary/80 border border-border/50 text-foreground">
                  <AlertOctagon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground tabular-nums tracking-tight">{stats.total}</p>
              <p className="text-[11px] font-medium text-muted-foreground mt-1 uppercase tracking-wider">Total cataloged</p>
            </div>
          </StaggerItem>
        </StaggerContainer>

        {/* Heatmap Section */}
        <FadeIn delay={0.4}>
          <div className="glass-card rounded-xl p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-sm font-bold text-foreground tracking-tight">Resultant Heat Map</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">Distribution of {risks.length} risks across inherent risk combinations</p>
            </div>
            
            <div className="flex justify-center items-center py-4">
              <div className="flex gap-4 items-end">
                <div className="flex flex-col items-center justify-center h-full mr-2">
                  <span className="text-[10px] font-bold text-muted-foreground -rotate-90 whitespace-nowrap tracking-widest uppercase mb-10">Probability →</span>
                </div>
                <div>
                  <div className="grid grid-cols-5 gap-1.5 w-full max-w-2xl mx-auto">
                    {heatmapData.map((cell, i) => {
                      const isRed = cell.score >= 16
                      const isOrange = cell.score >= 10 && cell.score < 16
                      const isYellow = cell.score >= 6 && cell.score < 10
                      const isGreen = cell.score < 6
                      
                      const bgClass = isRed ? 'bg-destructive/20 border-destructive/30 text-destructive' : 
                                    isOrange ? 'bg-amber-500/20 border-amber-500/30 text-amber-500' : 
                                    isYellow ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-500' :
                                    isGreen ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                                    'bg-secondary/50 border-border/50 text-muted-foreground'

                      return (
                        <div key={i} className={`h-20 rounded-lg border flex flex-col items-center justify-center shadow-sm transition-transform hover:scale-105 cursor-pointer ${bgClass}`}>
                          <span className="text-[10px] font-bold opacity-60 mb-1">{cell.score}</span>
                          <span className="text-lg font-black tracking-tight">{cell.count || ''}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex justify-between mt-3 px-6">
                    {[1, 2, 3, 4, 5].map(i => (
                      <span key={i} className="text-[10px] font-bold text-muted-foreground w-16 text-center">{i}</span>
                    ))}
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground text-center mt-2 uppercase tracking-widest">Impact →</p>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Charts Section */}
        <StaggerContainer className="grid grid-cols-2 gap-6" delayChildren={0.5} staggerChildren={0.1}>
          <StaggerItem>
            <div className="glass-card rounded-xl p-5 h-[340px] flex flex-col shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    SLE by Category
                  </h2>
                  <p className="text-[11px] font-medium text-muted-foreground mt-0.5">Single Loss Expectancy in ₹K</p>
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financialImpact} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={true} vertical={false} opacity={0.4} />
                    <XAxis dataKey="category" stroke="var(--muted-foreground)" style={{ fontSize: '11px', fontWeight: 500 }} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted-foreground)" style={{ fontSize: '11px', fontWeight: 500 }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'var(--secondary)', opacity: 0.3 }} contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', boxShadow: 'var(--shadow-md)' }} />
                    <Bar dataKey="score" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="glass-card rounded-xl p-5 h-[340px] flex flex-col shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-indigo-400" />
                    Risk by Process Area
                  </h2>
                  <p className="text-[11px] font-medium text-muted-foreground mt-0.5">Distribution across business processes</p>
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={techImpact} margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} vertical={true} opacity={0.4} />
                    <XAxis type="number" stroke="var(--muted-foreground)" style={{ fontSize: '11px', fontWeight: 500 }} tickLine={false} axisLine={false} />
                    <YAxis dataKey="category" type="category" stroke="var(--muted-foreground)" style={{ fontSize: '11px', fontWeight: 500 }} tickLine={false} axisLine={false} width={100} />
                    <Tooltip cursor={{ fill: 'var(--secondary)', opacity: 0.3 }} contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', boxShadow: 'var(--shadow-md)' }} />
                    <Bar dataKey="score" fill="#818cf8" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </StaggerItem>
        </StaggerContainer>

      </div>
    </div>
  )
}
