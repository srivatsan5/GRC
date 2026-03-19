'use client'

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Loader2, Download, ShieldCheck, TrendingDown, DollarSign, Laptop, AlertCircle, Activity } from 'lucide-react'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { oracleService } from '@/lib/oracleService'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function AssessmentsresidualPage() {
  // 1. Data Fetching
  const { data: residualData = {}, isLoading, isError, error } = useQuery({
    queryKey: ['assessments-residual'],
    queryFn: () => oracleService.getAssessmentsResidual(),
  })

  // 2. Data Preparation
  const financialImpact = useMemo(() => residualData?.financial_impact || [
    { category: 'Revenue Loss', score: 35 },
    { category: 'Fines', score: 15 },
    { category: 'Asset Damage', score: 10 },
    { category: 'OpEx Increase', score: 25 }
  ], [residualData])

  const techImpact = useMemo(() => residualData?.tech_impact || [
    { category: 'Data Breach', score: 40 },
    { category: 'System Downtime', score: 20 },
    { category: 'IP Loss', score: 15 },
    { category: 'Integrity', score: 25 }
  ], [residualData])

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative mb-6">
           <Loader2 className="w-12 h-12 animate-spin text-primary/30" />
           <Activity className="absolute inset-0 m-auto w-5 h-5 text-primary animate-pulse" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground animate-pulse tracking-tighter">Calculating Delta Vectors...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="w-12 h-12 text-destructive/40 mb-4" />
        <h3 className="text-sm font-black uppercase text-foreground">Analytics Engine Failure</h3>
        <p className="text-[11px] text-muted-foreground mt-2 italic opacity-60">{(error as any)?.message}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 pb-20 bg-background/20">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/40 px-6 py-6 bg-background/60 backdrop-blur-xl sticky top-0 z-40 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tighter uppercase italic">Residual Posture</h1>
              <p className="text-[12px] text-muted-foreground mt-1 font-medium italic opacity-70">Delta analysis of risk exposure after control synchronization</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" className="h-9 rounded-full px-5 text-[11px] font-black uppercase tracking-widest border-border/50 bg-card/40">
                <Download className="w-3.5 h-3.5 mr-2" />
                Snapshot
              </Button>
            </div>
          </div>
        </div>
      </FadeIn>

      <div className="p-6 space-y-8">
        {/* KPI Grid */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6" delayChildren={0.2} staggerChildren={0.1}>
          <StaggerItem>
            <div className="glass-card rounded-2xl p-6 bg-card/40 border border-border/40 relative overflow-hidden group shadow-sm transition-all hover:bg-card/60">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <ShieldCheck className="w-16 h-16 text-emerald-500" />
               </div>
               <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Primary Constraint</span>
               <h3 className="text-xl font-black text-foreground tracking-tighter mt-4 leading-tight truncate">{residualData?.top_risk || 'Supply Chain Flux'}</h3>
               <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-black text-emerald-500 uppercase px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">Maturity: {residualData?.top_score || '12'}/25</span>
               </div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="glass-card rounded-2xl p-6 bg-card/40 border border-border/40 relative overflow-hidden group shadow-sm transition-all hover:bg-card/60">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <TrendingDown className="w-16 h-16 text-primary" />
               </div>
               <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Systemic Average</span>
               <h3 className="text-4xl font-black text-foreground tracking-tighter mt-4 tabular-nums">{residualData?.avg_score || '6.8'}</h3>
               <div className="flex items-center gap-2 mt-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] font-black text-primary uppercase pt-0.5">Under Threshold</span>
               </div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="glass-card rounded-2xl p-6 bg-card/40 border border-border/40 relative overflow-hidden group shadow-sm transition-all hover:bg-card/60">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Activity className="w-16 h-16 text-indigo-500" />
               </div>
               <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Efficiency Delta</span>
               <h3 className="text-4xl font-black text-foreground tracking-tighter mt-4 tabular-nums">{residualData?.risk_reduction || '-52.4%'}</h3>
               <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60 italic">Post-control optimization</span>
               </div>
            </div>
          </StaggerItem>
        </StaggerContainer>

        {/* Heatmap Section */}
        <FadeIn delay={0.4}>
          <div className="glass-card rounded-3xl p-8 bg-card/30 border border-border/40 shadow-xl backdrop-blur-md">
            <div className="mb-10 text-center md:text-left">
              <h2 className="text-base font-black text-foreground uppercase tracking-widest italic">Operational Risk Matrix</h2>
              <p className="text-[12px] font-medium text-muted-foreground mt-1 italic">Normalized distribution of residual probability vs impact vectors</p>
            </div>
            
            <div className="flex flex-col md:flex-row gap-12 items-center justify-center">
               <div className="flex items-center">
                  <div className="flex flex-col items-center justify-center mr-6">
                    <span className="text-[10px] font-black text-muted-foreground -rotate-90 whitespace-nowrap tracking-widest uppercase opacity-40">Probability Continuum</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2.5">
                    {Array.from({ length: 25 }).map((_, i) => {
                      const row = Math.floor(i / 5)
                      const col = i % 5
                      const score = (5 - row) * (col + 1)
                      const isRed = score >= 16
                      const isOrange = score >= 10 && score < 16
                      const isYellow = score >= 6 && score < 10
                      
                      const count = isRed ? Math.floor(Math.random() * 2) : 
                                    isOrange ? Math.floor(Math.random() * 8) : 
                                    Math.floor(Math.random() * 30) + 10

                      return (
                        <motion.div 
                          key={i} 
                          whileHover={{ scale: 1.05, zIndex: 10 }}
                          className={cn(
                            "w-16 h-16 md:w-20 md:h-20 rounded-2xl border flex flex-col items-center justify-center shadow-lg transition-all cursor-default",
                            isRed ? "bg-destructive/20 border-destructive/40 text-destructive shadow-destructive/5" :
                            isOrange ? "bg-amber-500/20 border-amber-500/40 text-amber-500 shadow-amber-500/5" :
                            isYellow ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-500 shadow-yellow-500/5" :
                            "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-emerald-500/5"
                          )}
                        >
                          <span className="text-[9px] font-bold opacity-40 mb-1">{score}</span>
                          <span className="text-xl font-black tracking-tighter">{count}</span>
                        </motion.div>
                      )
                    })}
                  </div>
               </div>
               
               <div className="hidden lg:flex flex-col gap-6 max-w-[200px]">
                  <div className="space-y-2">
                     <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-destructive shadow-[0_0_8px_currentColor]" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Critical Flux</span>
                     </div>
                     <p className="text-[10px] text-muted-foreground italic font-medium leading-relaxed">Immediate executive intervention required. Residual exposure exceeds appetite.</p>
                  </div>
                  <div className="space-y-2">
                     <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_currentColor]" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Elevated State</span>
                     </div>
                     <p className="text-[10px] text-muted-foreground italic font-medium leading-relaxed">Continuous oversight via GRC monitoring mandatory.</p>
                  </div>
                  <div className="space-y-2">
                     <div className="flex items-center gap-2 text-emerald-500">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_currentColor]" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Optimized Zone</span>
                     </div>
                     <p className="text-[10px] text-muted-foreground italic font-medium leading-relaxed">Risk effectively contained within tolerance parameters.</p>
                  </div>
               </div>
            </div>
          </div>
        </FadeIn>

        {/* Chart Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <FadeIn delay={0.5}>
              <div className="glass-card rounded-3xl p-6 bg-card/30 border border-border/40 h-[400px] flex flex-col shadow-xl">
                 <div className="mb-8 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                       <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                       <h3 className="text-sm font-black uppercase tracking-widest italic text-foreground tracking-tighter leading-none">Financial Impact Vectors</h3>
                       <span className="text-[11px] text-muted-foreground font-medium italic opacity-60">Residual loss potential post-controls</span>
                    </div>
                 </div>
                 <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={financialImpact} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={true} vertical={false} opacity={0.3} />
                          <XAxis dataKey="category" stroke="var(--muted-foreground)" style={{ fontSize: '10px', fontWeight: 600 }} tickLine={false} axisLine={false} />
                          <YAxis stroke="var(--muted-foreground)" style={{ fontSize: '10px', fontWeight: 600 }} tickLine={false} axisLine={false} />
                          <Tooltip cursor={{ fill: 'var(--secondary)', opacity: 0.2 }} contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', fontSize: '12px' }} />
                          <Bar dataKey="score" fill="#10b981" radius={[8, 8, 0, 0]} barSize={40}>
                             {financialImpact.map((_: any, index: number) => (
                               <Cell key={`cell-${index}`} fillOpacity={0.8} />
                             ))}
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </FadeIn>

           <FadeIn delay={0.6}>
              <div className="glass-card rounded-3xl p-6 bg-card/30 border border-border/40 h-[400px] flex flex-col shadow-xl">
                 <div className="mb-8 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
                       <Laptop className="w-5 h-5" />
                    </div>
                    <div>
                       <h3 className="text-sm font-black uppercase tracking-widest italic text-foreground tracking-tighter leading-none">Technological Vulnerability</h3>
                       <span className="text-[11px] text-muted-foreground font-medium italic opacity-60">Remaining digital risk profile</span>
                    </div>
                 </div>
                 <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart layout="vertical" data={techImpact} margin={{ top: 0, right: 20, left: 30, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} vertical={true} opacity={0.3} />
                          <XAxis type="number" stroke="var(--muted-foreground)" style={{ fontSize: '10px', fontWeight: 600 }} tickLine={false} axisLine={false} />
                          <YAxis dataKey="category" type="category" stroke="var(--muted-foreground)" style={{ fontSize: '10px', fontWeight: 600 }} tickLine={false} axisLine={false} width={120} />
                          <Tooltip cursor={{ fill: 'var(--secondary)', opacity: 0.2 }} contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', fontSize: '12px' }} />
                          <Bar dataKey="score" fill="#818cf8" radius={[0, 8, 8, 0]} barSize={20} />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </FadeIn>
        </div>
      </div>
    </div>
  )
}
