'use client'

import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Loader2, Download, AlertOctagon, TrendingUp, DollarSign, Laptop } from 'lucide-react'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { oracleService } from '@/lib/oracleService'

export function AssessmentsaccessPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await oracleService.getAssessmentsAccess()
        // result might be an array or object, we expect some structure for stats
        setData(result)
      } catch (error) {
        console.error('Failed to fetch access inherent data:', error)
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
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Analyzing Inherent Risk Exposure...</p>
        </div>
      </div>
    )
  }

  // Visual mock data for charts (fallback if no live data)
  const financialImpact = data?.FINANCIAL_IMPACT || [
    { category: 'Revenue Loss', score: 85 },
    { category: 'Fines', score: 45 },
    { category: 'Asset Damage', score: 20 },
    { category: 'OpEx Increase', score: 60 }
  ]

  const techImpact = data?.TECH_IMPACT || [
    { category: 'Data Breach', score: 90 },
    { category: 'System Downtime', score: 65 },
    { category: 'IP Loss', score: 75 },
    { category: 'Integrity', score: 40 }
  ]

  return (
    <div className="flex-1 pb-10">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/50 px-6 py-5 bg-background/50 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">Access Inherent Risk</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5 font-medium">Dashboard visualizing pure baseline risk exposure</p>
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
              <p className="text-xl font-bold text-foreground tracking-tight">{data?.TOP_RISK || 'Data Breach (External)'}</p>
              <p className="text-[11px] font-medium text-red-400 mt-1 uppercase tracking-wider">Score: {data?.TOP_SCORE || '25'}/25 (Critical)</p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="glass-card rounded-xl p-5 border-l-4 border-l-amber-500/50 shadow-sm relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-[30px] opacity-10 bg-amber-500 pointer-events-none transition-opacity group-hover:opacity-20" />
              <div className="flex justify-between items-start mb-4">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Avg Inherent Score</p>
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground tabular-nums tracking-tight">{data?.AVG_SCORE || '14.2'}</p>
              <p className="text-[11px] font-medium text-amber-400 mt-1 uppercase tracking-wider">Status: Elevated</p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="glass-card rounded-xl p-5 border-l-4 border-l-emerald-500/50 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Assessments Logged</p>
                <div className="p-2 rounded-lg bg-secondary/80 border border-border/50 text-foreground">
                  <AlertOctagon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground tabular-nums tracking-tight">{data?.TOTAL_ASSESSMENTS || '128'}</p>
              <p className="text-[11px] font-medium text-muted-foreground mt-1 uppercase tracking-wider">Last 30 Days</p>
            </div>
          </StaggerItem>
        </StaggerContainer>

        {/* Heatmap Section */}
        <FadeIn delay={0.4}>
          <div className="glass-card rounded-xl p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-sm font-bold text-foreground tracking-tight">Resultant Heat Map</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">Distribution of raw inherent risk combinations</p>
            </div>
            
            <div className="flex justify-center items-center py-4">
              <div className="flex gap-4 items-end">
                <div className="flex flex-col items-center justify-center h-full mr-2">
                  <span className="text-[10px] font-bold text-muted-foreground -rotate-90 whitespace-nowrap tracking-widest uppercase mb-10">Probability →</span>
                </div>
                <div>
                  <div className="grid grid-cols-5 gap-1.5 w-full max-w-2xl mx-auto">
                    {Array.from({ length: 25 }).map((_, i) => {
                      const row = Math.floor(i / 5);
                      const col = i % 5;
                      const score = (5 - row) * (col + 1);
                      const isRed = score >= 16;
                      const isOrange = score >= 10 && score < 16;
                      const isYellow = score >= 6 && score < 10;
                      const isGreen = score < 6;
                      
                      const bgClass = isRed ? 'bg-destructive/20 border-destructive/30 text-destructive' : 
                                    isOrange ? 'bg-amber-500/20 border-amber-500/30 text-amber-500' : 
                                    isYellow ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-500' :
                                    isGreen ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                                    'bg-secondary/50 border-border/50 text-muted-foreground';
                      
                      // Mock distribution counts heavily skewed towards higher inherent risk
                      const count = isRed ? Math.floor(Math.random() * 20) + 10 : 
                                    isOrange ? Math.floor(Math.random() * 15) + 5 : 
                                    Math.floor(Math.random() * 8);

                      return (
                        <div key={i} className={`h-20 rounded-lg border flex flex-col items-center justify-center shadow-sm transition-transform hover:scale-105 cursor-pointer ${bgClass}`}>
                          <span className="text-[10px] font-bold opacity-60 mb-1">{score}</span>
                          <span className="text-lg font-black tracking-tight">{count}</span>
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
                    Impact on Financials
                  </h2>
                  <p className="text-[11px] font-medium text-muted-foreground mt-0.5">Average calculated loss potential by category</p>
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
                    Impact on Technological
                  </h2>
                  <p className="text-[11px] font-medium text-muted-foreground mt-0.5">Vulnerability scores without controls applied</p>
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
