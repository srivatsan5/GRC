'use client'

import React, { useState, useEffect } from 'react'
import { FolderTree, ChevronRight, ChevronDown, Activity, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { motion, AnimatePresence } from 'framer-motion'
import { oracleService } from '@/lib/oracleService'

export function MonitoringactionshierarchyPage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [hierarchyData, setHierarchyData] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const items = await oracleService.getMonitoringActionsHierarchy()
        
        // Transform flat ORDS rows into hierarchy [Parent -> children]
        const parents = items.filter((it: any) => it.TYPE === 'parent' || !it.PARENT_ID)
        const hierarchy = parents.map((p: any) => ({
          ...p,
          id: p.ID || p.PLAN_ID,
          title: p.TITLE || p.NAME,
          progress: p.PROGRESS || 0,
          status: p.STATUS || 'Pending',
          owner: p.OWNER || 'N/A',
          children: items.filter((c: any) => c.PARENT_ID === (p.ID || p.PLAN_ID)).map((c: any) => ({
            ...c,
            id: c.ID || c.ACTION_ID,
            title: c.TITLE || c.NAME,
            progress: c.PROGRESS || 0,
            status: c.STATUS || 'Pending',
            owner: c.OWNER || 'N/A'
          }))
        }))

        setHierarchyData(hierarchy)
        if (hierarchy.length > 0) {
          setExpanded({ [hierarchy[0].id]: true })
        }
      } catch (error) {
        console.error('Failed to fetch actions hierarchy:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const getStatusColor = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'completed': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
      case 'in progress': return 'text-primary bg-primary/10 border-primary/20'
      case 'delayed':
      case 'at risk': return 'text-destructive bg-destructive/10 border-destructive/20'
      default: return 'text-muted-foreground bg-secondary/50 border-border/50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      case 'in progress': return <Activity className="w-4 h-4 text-primary" />
      default: return <Clock className="w-4 h-4 text-muted-foreground" />
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary/70" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Building Action Hierarchy from Oracle ADW...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 pb-10 flex flex-col h-full">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/50 px-6 py-5 bg-background/50 backdrop-blur-md sticky top-0 z-40">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">Monitor Actions Hierarchy</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5 font-medium">Traceable nested view of parent mitigation plans and child actions</p>
        </div>
      </FadeIn>

      <div className="p-6 max-w-5xl mx-auto w-full flex-1">
        <FadeIn delay={0.2}>
          <div className="glass-card rounded-xl shadow-sm border border-border/50 overflow-hidden">
            
            {/* Header row */}
            <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-border/50 bg-secondary/30 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-6 flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-primary opacity-70" />
                Action Structure
              </div>
              <div className="col-span-2">Owner</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 pl-4">Progress</div>
            </div>

            {/* Tree content */}
            <div className="divide-y divide-border/30">
              <AnimatePresence>
                {hierarchyData.map((parent: HierarchyItem) => (
                  <div key={parent.id} className="group">
                    {/* Parent Row */}
                    <motion.div 
                      layout
                      onClick={() => toggleExpand(parent.id)}
                      className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-secondary/20 cursor-pointer transition-colors"
                    >
                      <div className="col-span-6 flex items-center gap-3">
                        <button className="p-0.5 rounded-sm hover:bg-secondary transition-colors text-muted-foreground data-[expanded=true]:text-foreground" data-expanded={expanded[parent.id]}>
                          {expanded[parent.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <span className="font-mono text-[11px] font-bold text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded border border-border/50">{parent.id}</span>
                        <span className="font-bold text-[13px] text-foreground tracking-tight">{parent.title}</span>
                      </div>
                      
                      <div className="col-span-2">
                        <span className="text-[12px] font-medium flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">
                            {parent.owner.split(' ').map(n => n[0]).join('')}
                          </span>
                          {parent.owner}
                        </span>
                      </div>
                      
                      <div className="col-span-2 flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
                        {getStatusIcon(parent.status)}
                        <span className="truncate">{parent.status}</span>
                      </div>
                      
                      <div className="col-span-2 pl-4">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden shrink-0 shadow-inner">
                            <div 
                              className={`h-full rounded-full ${parent.progress > 75 ? 'bg-emerald-500' : 'bg-primary'}`} 
                              style={{ width: `${parent.progress}%` }} 
                            />
                          </div>
                          <span className="text-[11px] font-bold text-muted-foreground tabular-nums min-w-[3ch]">{parent.progress}%</span>
                        </div>
                      </div>
                    </motion.div>

                    {/* Children Rows */}
                    {expanded[parent.id] && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden bg-background/30"
                      >
                        {parent.children.map((child: any, idx: number) => (
                          <div key={child.id} className="grid grid-cols-12 gap-4 px-6 py-3.5 items-center hover:bg-secondary/30 transition-colors border-l-2 border-l-primary/30 relative">
                            {/* Connector aesthetic */}
                            <div className={`absolute left-0 top-0 w-8 border-l-2 border-border border-b-2 rounded-bl-xl ml-[35px] ${idx === parent.children.length - 1 ? 'h-1/2' : 'h-full border-b-0'} pointer-events-none opacity-50`} />
                            
                            <div className="col-span-6 flex items-center gap-3 pl-14">
                              <span className="font-mono text-[11px] font-medium text-muted-foreground/70">{child.id}</span>
                              <span className="font-medium text-[13px] text-foreground/80">{child.title}</span>
                            </div>
                            
                            <div className="col-span-2">
                              <span className="text-[12px] font-medium flex items-center gap-2 text-muted-foreground">
                                <span className="w-5 h-5 rounded-full bg-secondary border border-border/50 flex items-center justify-center text-[9px] font-bold">
                                  {child.owner.split(' ').map(n => n[0]).join('')}
                                </span>
                                {child.owner}
                              </span>
                            </div>
                            
                            <div className="col-span-2">
                              {/* Pill format for child status */}
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(child.status)}`}>
                                {child.status}
                              </span>
                            </div>
                            
                            <div className="col-span-2 pl-4">
                              <div className="flex items-center gap-3">
                                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden shrink-0 shadow-inner">
                                  <div 
                                    className={`h-full rounded-full ${child.progress === 100 ? 'bg-emerald-500/70' : child.progress === 0 ? 'bg-transparent' : 'bg-primary/70'}`} 
                                    style={{ width: `${child.progress}%` }} 
                                  />
                                </div>
                                <span className="text-[11px] font-semibold text-muted-foreground tabular-nums min-w-[3ch]">{child.progress}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                ))}
              </AnimatePresence>
            </div>
            
            <div className="bg-secondary/30 p-2.5 border-t border-border/50 text-[11px] font-medium text-muted-foreground flex justify-between items-center px-6">
              <span>Displaying 2 Parent Action Plans</span>
            </div>

          </div>
        </FadeIn>
      </div>
    </div>
  )
}
