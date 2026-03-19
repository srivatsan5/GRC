'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts'
import { 
  X, 
  Loader2, 
  Activity, 
  Bell, 
  ShieldCheck, 
  TrendingDown, 
  Zap,
  Target,
  AlertTriangle,
  ChevronRight,
  BarChart3
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { oracleService } from '@/lib/oracleService'
import { cn } from '@/lib/utils'

export function MonitoringPage() {
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([])

  // 1. Data Fetching
  const { data: monitoringData = {}, isLoading, isError, error } = useQuery({
    queryKey: ['risk-monitoring-summary'],
    queryFn: async () => {
      try {
        const data = await oracleService.getRiskMonitoring()
        return data?.[0] || {}
      } catch (e) {
        console.warn("Recoverable monitoring summary error:", e)
        return {}
      }
    },
    retry: 1
  })

  // 2. Computed
  const metrics = monitoringData.riskMetricsData || []
  const alerts = (monitoringData.alerts || []).filter((a: any) => !dismissedAlerts.includes(a.id))
  const indicators = monitoringData.riskIndicatorsData || []
  const effectiveness = monitoringData.mitigationData || []

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative mb-6">
           <Loader2 className="w-12 h-12 animate-spin text-primary/30" />
           <Activity className="absolute inset-0 m-auto w-5 h-5 text-primary animate-pulse" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Synchronizing Telemetry Flux...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 pb-20 bg-background/20 font-sans">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/40 px-6 py-6 bg-background/60 backdrop-blur-xl sticky top-0 z-40 flex justify-between items-center shadow-sm">
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tighter uppercase italic">Control Stream</h1>
            <p className="text-[12px] text-muted-foreground mt-1 font-medium italic opacity-70">Real-time GRC health monitoring and vector analysis</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">ADW Live</span>
             </div>
          </div>
        </div>
      </FadeIn>

      <div className="p-8 space-y-8">
        {/* Main Trend Surface */}
        <FadeIn delay={0.2}>
          <div className="glass-card rounded-[40px] p-8 bg-card/40 border border-border/40 shadow-2xl backdrop-blur-xl">
             <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className="text-base font-black text-foreground uppercase tracking-widest italic leading-none">Security Posture Trend</h2>
                  <p className="text-[10px] text-muted-foreground font-medium mt-1 italic opacity-60">Systemic risk velocity over the baseline period</p>
                </div>
                <div className="flex gap-2">
                   {['8W', '3M', '1Y'].map(p => (
                     <button key={p} className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase border transition-all", p === '8W' ? "bg-primary text-background border-primary shadow-lg" : "bg-secondary/40 text-muted-foreground border-border/40 hover:bg-secondary")}>{p}</button>
                   ))}
                </div>
             </div>
             
             <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={metrics} margin={{ top: 0, right: 0, left: -40, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMain" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="week" axisLine={false} tickLine={false} style={{ fontSize: '10px', fontWeight: 800 }} />
                      <Tooltip cursor={{ stroke: 'var(--primary)', strokeDasharray: '4 4' }} contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px' }} />
                      <Area type="monotone" dataKey="open" stroke="#3b82f6" strokeWidth={3} fill="url(#colorMain)" />
                      <Area type="monotone" dataKey="mitigated" stroke="#10b981" strokeWidth={2} fillOpacity={0} />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>
        </FadeIn>

        {/* Global KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <div className="glass-card rounded-3xl p-6 bg-card/40 border border-border/40 shadow-lg flex flex-col items-center text-center group transition-all hover:bg-card/60">
              <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500 mb-4 border border-indigo-500/20">
                 <ShieldCheck className="w-5 h-5" />
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Maturity Level</p>
              <h3 className="text-3xl font-black text-foreground">Tier 4</h3>
              <span className="text-[9px] font-black text-emerald-500 uppercase mt-2">Optimized State</span>
           </div>
           <div className="glass-card rounded-3xl p-6 bg-card/40 border border-border/40 shadow-lg flex flex-col items-center text-center group transition-all hover:bg-card/60">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary mb-4 border border-primary/20">
                 <Zap className="w-5 h-5" />
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Response Latency</p>
              <h3 className="text-3xl font-black text-foreground">0.4d</h3>
              <span className="text-[9px] font-black text-primary uppercase mt-2">Elite Velocity</span>
           </div>
           <div className="glass-card rounded-3xl p-6 bg-card/40 border border-border/40 shadow-lg flex flex-col items-center text-center group transition-all hover:bg-card/60">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 mb-4 border border-amber-500/20">
                 <Target className="w-5 h-5" />
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">KRI Accuracy</p>
              <h3 className="text-3xl font-black text-foreground">98.2%</h3>
              <span className="text-[9px] font-black text-amber-500 uppercase mt-2">High Confidence</span>
           </div>
           <div className="glass-card rounded-3xl p-6 bg-card/40 border border-border/40 shadow-lg flex flex-col items-center text-center group transition-all hover:bg-card/60">
              <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500 mb-4 border border-indigo-500/20">
                 <TrendingDown className="w-5 h-5" />
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Risk Reduction</p>
              <h3 className="text-3xl font-black text-foreground">52%</h3>
              <span className="text-[9px] font-black text-indigo-500 uppercase mt-2">Annual Delta</span>
           </div>
        </div>

        {/* Binary View: KRIs vs Operations */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           {/* KRI Registry */}
           <div className="lg:col-span-8">
              <div className="glass-card rounded-[40px] overflow-hidden border border-border/40 bg-card/10 shadow-2xl flex flex-col h-full">
                 <div className="p-8 border-b border-border/40 flex items-center justify-between bg-card/40">
                    <div>
                       <h3 className="text-base font-black text-foreground uppercase tracking-widest italic leading-none">Indicator Matrix</h3>
                       <p className="text-[10px] text-muted-foreground font-medium mt-1 italic opacity-60">Key Performance Indicators for systemic risk</p>
                    </div>
                    <Button variant="ghost" size="sm" className="rounded-full text-[10px] font-black uppercase tracking-widest">Full Explorer</Button>
                 </div>
                 <div className="p-0 overflow-x-auto">
                    <table className="w-full text-left text-[13px] border-collapse">
                       <thead className="bg-secondary/40">
                          <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                             <th className="px-8 py-4">Metric Node</th>
                             <th className="px-8 py-4 text-right">Value</th>
                             <th className="px-8 py-4 text-right">Delta</th>
                             <th className="px-8 py-4 text-right">Vector</th>
                          </tr>
                       </thead>
                       <tbody>
                          {indicators.map((ind: any, idx: number) => (
                            <tr key={idx} className="group hover:bg-primary/5 transition-all">
                               <td className="px-8 py-5">
                                  <div className="flex flex-col">
                                     <span className="font-bold text-foreground text-[13px] tracking-tight">{ind.indicator}</span>
                                     <span className="text-[10px] font-medium text-muted-foreground italic opacity-60">{ind.category}</span>
                                  </div>
                               </td>
                               <td className="px-8 py-5 text-right font-black tabular-nums">{ind.value}%</td>
                               <td className="px-8 py-5 text-right font-mono text-[11px] text-muted-foreground">{ind.prev}%</td>
                               <td className="px-8 py-5 text-right">
                                  <span className={cn(
                                    "font-black text-xs",
                                    ind.trend === 'up' ? "text-destructive" : ind.trend === 'down' ? "text-emerald-500" : "text-muted-foreground"
                                  )}>
                                     {ind.trend === 'up' ? '↗' : ind.trend === 'down' ? '↘' : '→'}
                                  </span>
                               </td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>

           {/* Alerts Panel */}
           <div className="lg:col-span-4 space-y-6">
              <div className="glass-card rounded-[40px] p-8 bg-card/40 border border-border/40 shadow-xl min-h-[400px]">
                 <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                       <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
                          <Bell className="w-4 h-4" />
                       </div>
                       <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground">Alert Hub</h3>
                    </div>
                    <span className="text-[10px] font-black bg-secondary/80 px-2 py-0.5 rounded-full border border-border/40 tabular-nums">{alerts.length} New</span>
                 </div>
                 
                 <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                       {alerts.map((alert: any) => (
                         <motion.div
                           layout
                           key={alert.id}
                           initial={{ opacity: 0, x: 20 }}
                           animate={{ opacity: 1, x: 0 }}
                           exit={{ opacity: 0, scale: 0.95 }}
                           className="group flex gap-4 p-4 rounded-3xl bg-secondary/20 border border-border/10 hover:bg-secondary/40 transition-all relative"
                         >
                            <div className={cn(
                              "w-1.5 h-10 rounded-full flex-shrink-0",
                              alert.severity === 'critical' ? "bg-destructive border-destructive/20 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-orange-500/40"
                            )} />
                            <div className="flex-1 min-w-0">
                               <h4 className="text-[13px] font-black text-foreground leading-tight truncate tracking-tight">{alert.title}</h4>
                               <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1 italic font-medium opacity-70">{alert.desc}</p>
                               <span className="text-[9px] font-black uppercase text-muted-foreground/40 mt-2 inline-block tracking-tighter">{alert.time}</span>
                            </div>
                            <button 
                              onClick={() => setDismissedAlerts(prev => [...prev, alert.id])}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:text-foreground transition-all"
                            >
                               <X className="w-3.5 h-3.5" />
                            </button>
                         </motion.div>
                       ))}
                    </AnimatePresence>
                    {alerts.length === 0 && (
                      <div className="py-20 text-center flex flex-col items-center">
                         <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
                            <ShieldCheck className="w-6 h-6" />
                         </div>
                         <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">Systemic Equilibrium Achieved</p>
                      </div>
                    )}
                 </div>
              </div>

              {/* Strategy Widget */}
              <div className="glass-card rounded-[40px] p-6 bg-card/20 border border-border/40 shadow-lg">
                 <div className="flex items-center justify-between mb-6">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground">Strategy Efficacy</h4>
                    <BarChart3 className="w-4 h-4 text-muted-foreground/30" />
                 </div>
                 <div className="h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={effectiveness} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                          <Bar dataKey="effectiveness" radius={[10, 10, 0, 0]} barSize={20}>
                             {effectiveness.map((_: any, index: number) => (
                               <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#94a3b8'} fillOpacity={0.4} />
                             ))}
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
