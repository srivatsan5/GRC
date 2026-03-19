'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Search, Filter, MoreVertical, LayoutGrid, List, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { motion, AnimatePresence } from 'framer-motion'
import { oracleService } from '@/lib/oracleService'

export function MonitoringactionplanPage() {
  const [activeTab, setActiveTab] = useState('action')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const items = await oracleService.getMonitoringActionPlan()
        setData(items)
      } catch (error) {
        console.error('Failed to fetch action plans:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filtered = data.filter(d => 
    (d.NAME || d.PLAN_NAME || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (d.ROOT_CAUSE || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary/70" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Retrieving Execution Roadmap...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 pb-10 flex flex-col h-full">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/50 px-6 py-5 bg-background/50 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">Action Plans Tracker</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5 font-medium">Manage and track granular remediation tasks</p>
          </div>
          <div className="flex items-center gap-3">
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button size="sm" className="gap-2 h-8 text-xs font-semibold shadow-[var(--shadow-md)]">
                <Plus className="w-3.5 h-3.5" />
                New Action Plan
              </Button>
            </motion.div>
          </div>
        </div>
      </FadeIn>

      <div className="p-6 flex-1 flex flex-col min-h-0">
        <FadeIn delay={0.2}>
          <div className="mb-6 flex justify-between items-center bg-card border border-border/50 p-2 rounded-lg shadow-sm">
            
            <div className="flex items-center gap-1 bg-secondary/30 p-1 rounded-md border border-border/50 ml-1">
              <button 
                onClick={() => setActiveTab('action')}
                className={`px-3 py-1.5 rounded text-[12px] font-semibold transition-all ${activeTab === 'action' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
              >
                Action Plans
              </button>
              <button 
                onClick={() => setActiveTab('mitigation')}
                className={`px-3 py-1.5 rounded text-[12px] font-semibold transition-all ${activeTab === 'mitigation' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
              >
                Mitigation Plans
              </button>
            </div>

            <div className="relative max-w-sm flex-1 ml-6">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${activeTab === 'action' ? 'action' : 'mitigation'} plans...`}
                className="pl-9 h-9 text-[13px] bg-background border-border/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 ml-4">
              <Button variant="outline" size="sm" className="h-9 w-9 p-0 bg-background border-border/50">
                <Filter className="w-4 h-4 text-muted-foreground" />
              </Button>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0 bg-background border-border/50">
                <LayoutGrid className="w-4 h-4 text-muted-foreground" />
              </Button>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0 bg-secondary border-border/50 shadow-inner">
                <List className="w-4 h-4 text-foreground" />
              </Button>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.3} className="flex-1 min-h-0">
          <div className="glass-card rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-[12px] whitespace-nowrap">
                <thead className="sticky top-0 z-10 bg-secondary/90 backdrop-blur-md border-b border-border/50 shadow-sm">
                  <tr className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                    <th className="px-5 py-3 sticky left-0 bg-secondary/90 z-20 border-r border-border/50">ID</th>
                    <th className="px-5 py-3 min-w-[200px]">Plan Name</th>
                    <th className="px-5 py-3 min-w-[250px]">Description</th>
                    <th className="px-5 py-3">Owner</th>
                    <th className="px-5 py-3 min-w-[150px]">Root Cause</th>
                    <th className="px-5 py-3 font-mono">Target Date</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Overdue Status</th>
                    <th className="px-5 py-3">Priority</th>
                    <th className="px-5 py-3 min-w-[200px]">Latest Updates</th>
                    <th className="px-5 py-3 border-l border-border/50">Mitigations</th>
                    <th className="px-3 py-3 text-center sticky right-0 bg-secondary/90 z-20 border-l border-border/50 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">Act</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {filtered.map((row, idx) => (
                      <motion.tr 
                        layout="position"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        key={row.ID || row.PLAN_ID || idx} 
                        className="border-b border-border/30 hover:bg-secondary/20 transition-colors last:border-0 group"
                      >
                        <td className="px-5 py-4 font-mono font-semibold text-muted-foreground sticky left-0 bg-background group-hover:bg-secondary/20 transition-colors border-r border-border/50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          {row.ID || row.PLAN_ID || 'N/A'}
                        </td>
                        <td className="px-5 py-4 font-bold text-foreground">{row.NAME || row.PLAN_NAME || 'N/A'}</td>
                        <td className="px-5 py-4 text-muted-foreground truncate max-w-[250px]">{row.DESCRIPTION || 'N/A'}</td>
                        <td className="px-5 py-4 font-medium">
                          <span className="flex items-center gap-2 text-foreground">
                            <span className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                              {(row.OWNER || 'U').split(' ').map((n: string) => n[0]).join('')}
                            </span>
                            {row.OWNER || 'Unassigned'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground bg-secondary/10 truncate max-w-[150px]">{row.ROOT_CAUSE || 'N/A'}</td>
                        <td className="px-5 py-4 font-mono text-muted-foreground">{row.TARGET_DATE || 'N/A'}</td>
                        <td className="px-5 py-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wider">
                            {row.STATUS || 'Pending'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${(row.OVERDUE_STATUS || '').includes('Overdue') ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {row.OVERDUE_STATUS || 'On Track'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${row.PRIORITY === 'Critical' ? 'text-destructive' : row.PRIORITY === 'High' ? 'text-amber-500' : 'text-emerald-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${row.PRIORITY === 'Critical' ? 'bg-destructive' : row.PRIORITY === 'High' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            {row.PRIORITY || 'Normal'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground truncate max-w-[200px] text-[11px] font-medium italic">"{row.LATEST_UPDATES || 'No updates logged'}"</td>
                        <td className="px-5 py-4 border-l border-border/50 font-mono text-[11px] font-semibold text-muted-foreground">{row.MITIGATES || 'N/A'}</td>
                        <td className="px-3 py-4 text-center sticky right-0 bg-background group-hover:bg-secondary/20 transition-colors border-l border-border/50 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                  <p className="font-medium text-[13px] italic">No {activeTab} plans found in Oracle ADW.</p>
                </div>
              )}
            </div>
            
            <div className="bg-secondary/30 p-2.5 border-t border-border/50 text-[11px] font-medium text-muted-foreground flex justify-between items-center px-6">
              <span>Displaying {filtered.length} {activeTab === 'action' ? 'action' : 'mitigation'} plans</span>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
