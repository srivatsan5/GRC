'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, GripVertical, Calendar, MoreVertical, Loader2, Target, Users, Layout } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { oracleService } from '@/lib/oracleService'
import { cn } from '@/lib/utils'

const pipelineColumns = [
  { key: 'Planning', label: 'Drafting', color: '#94a3b8' },
  { key: 'In Progress', label: 'Execution', color: '#3b82f6' },
  { key: 'On Track', label: 'Operational', color: '#10b981' },
  { key: 'At Risk', label: 'Critical', color: '#ef4444' },
  { key: 'Completed', label: 'Review', color: '#8b5cf6' },
]

const strategyColors: Record<string, string> = {
  Mitigate: '#3b82f6',
  Accept: '#6366f1',
  Avoid: '#f43f5e',
  Transfer: '#06b6d4',
}

export function RiskResponsePage() {
  const [searchTerm, setSearchTerm] = useState('')

  // 1. Data Fetching
  const { data: rawResponses = [], isLoading, isError } = useQuery({
    queryKey: ['risk-responses'],
    queryFn: () => oracleService.getControlImplementations(),
  })

  // 2. Normalization / Transformation
  const responseData = useMemo(() => {
    return rawResponses.map((d: any) => ({
      id: d.plan_id || d.id || `RPL-${Math.floor(Math.random() * 1000)}`,
      risk: d.risk_name || d.risk_statement || 'N/A',
      strategy: d.strategy || 'Mitigate',
      action: d.action || d.description || 'No action defined',
      owner: d.owner || 'Unassigned',
      status: d.status || 'Planning',
      dueDate: d.due_date || d.target_date || 'N/A',
      completion: parseInt(d.completion || d.progress || '0')
    }))
  }, [rawResponses])

  const filtered = responseData.filter(item =>
    item.risk.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.owner.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getColumnItems = (status: string) => filtered.filter(item => item.status === status)

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative mb-6">
           <Loader2 className="w-12 h-12 animate-spin text-primary/30" />
           <Layout className="absolute inset-0 m-auto w-5 h-5 text-primary animate-pulse" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Orchestrating Response Pipeline...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 pb-10 bg-background/20">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/40 px-6 py-6 bg-background/60 backdrop-blur-xl sticky top-0 z-40 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tighter uppercase italic">Response Engine</h1>
              <p className="text-[12px] text-muted-foreground mt-1 font-medium italic opacity-70">Strategic mitigation lifecycle and pipeline velocity</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-secondary/40 px-3 py-1.5 rounded-full border border-border/30 flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[10px] font-black text-foreground uppercase tracking-wider">{responseData.length} Active Plans</span>
              </div>
              <Button size="sm" className="rounded-full px-5 h-9 font-black uppercase text-[11px] tracking-widest shadow-xl shadow-primary/20">
                <Plus className="w-3.5 h-3.5 mr-2" />
                Initiate Plan
              </Button>
            </div>
          </div>
        </div>
      </FadeIn>

      <div className="p-6">
        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
           <div className="glass-card rounded-2xl p-5 bg-card/30 border border-border/40 flex flex-col justify-between h-32 hover:bg-card/40 transition-all cursor-default group">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">Pipeline Volume</span>
              <span className="text-3xl font-black text-foreground tracking-tighter">{responseData.length}</span>
              <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                 <div className="w-full h-full bg-primary" />
              </div>
           </div>
           {['On Track', 'At Risk', 'Completed'].map(status => {
             const count = responseData.filter(r => r.status === status).length
             return (
               <div key={status} className="glass-card rounded-2xl p-5 bg-card/30 border border-border/40 flex flex-col justify-between h-32 hover:bg-card/40 transition-all cursor-default group">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">{status}</span>
                  <span className="text-3xl font-black text-foreground tracking-tighter">{count}</span>
                  <div className="flex items-center gap-2">
                     <span className="text-[11px] font-bold text-muted-foreground">Velocity:</span>
                     <span className="text-[11px] font-black text-emerald-500">Stable</span>
                  </div>
               </div>
             )
           })}
        </div>

        {/* Search & Layout Control */}
        <div className="mb-8 flex justify-between items-center bg-card/40 p-2 rounded-2xl border border-border/40 backdrop-blur-md">
           <div className="relative flex-1 max-w-sm ml-2">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground/60" />
              <Input 
                placeholder="Query pipeline records..." 
                className="pl-10 h-9 bg-background/50 border-none text-[13px] font-bold shadow-inner" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-xl">
              <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg bg-background shadow-sm hover:bg-background"><Layout className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg text-muted-foreground opacity-50 hover:opacity-100 hover:bg-transparent"><Users className="w-4 h-4" /></Button>
           </div>
        </div>

        {/* Pipeline Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
           {pipelineColumns.map(col => {
             const items = getColumnItems(col.key)
             return (
               <div key={col.key} className="flex flex-col gap-4">
                  <div className="flex items-center justify-between px-2 mb-2">
                     <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded shadow-[0_0_8px_currentColor]" style={{ color: col.color, backgroundColor: col.color }} />
                        <span className="text-[11px] font-black uppercase tracking-widest text-foreground/80">{col.label}</span>
                     </div>
                     <span className="text-[10px] font-black tabular-nums bg-secondary/80 px-2 py-0.5 rounded-full border border-border/40">{items.length}</span>
                  </div>

                  <div className="flex-1 flex flex-col gap-4 min-h-[500px]">
                     <AnimatePresence mode="popLayout">
                        {items.map(item => (
                          <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            whileHover={{ y: -4, shadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                            className="glass-card rounded-2xl p-5 bg-card/50 border border-border/40 shadow-sm group hover:bg-card/80 transition-all cursor-pointer relative overflow-hidden"
                          >
                             <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                             </div>
                             
                             <div className="flex items-center gap-2 mb-4">
                                <span className="text-[9px] font-black font-mono text-muted-foreground uppercase opacity-60 italic">{item.id}</span>
                                <div className="h-0.5 flex-1 bg-border/20" />
                             </div>

                             <h3 className="text-[13px] font-bold text-foreground leading-snug mb-3 tracking-tight group-hover:text-primary transition-colors">{item.risk}</h3>
                             
                             <div className="flex flex-col gap-3">
                                <div className="space-y-1.5">
                                   <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                      <span>Completion</span>
                                      <span className="text-foreground">{item.completion}%</span>
                                   </div>
                                   <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                      <motion.div 
                                        className="h-full rounded-full" 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${item.completion}%` }}
                                        style={{ backgroundColor: col.color }} 
                                      />
                                   </div>
                                </div>

                                <div className="pt-3 border-t border-border/20 flex flex-wrap gap-2 items-center justify-between">
                                   <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-background/50 border border-border/30">
                                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: strategyColors[item.strategy] || '#3b82f6' }} />
                                      <span className="text-[9px] font-black uppercase tracking-tighter text-foreground/70">{item.strategy}</span>
                                   </div>
                                   <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 italic">
                                      <Calendar className="w-3 h-3" />
                                      {item.dueDate}
                                   </span>
                                </div>
                             </div>
                          </motion.div>
                        ))}
                     </AnimatePresence>
                  </div>
               </div>
             )
           })}
        </div>
      </div>
    </div>
  )
}

import { useMemo } from 'react'
