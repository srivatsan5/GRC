'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Download, TrendingUp, TrendingDown, MoreVertical, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FadeIn } from '@/components/ui/fade-in'
import { motion, AnimatePresence } from 'framer-motion'
import { oracleService } from '@/lib/oracleService'

export function KrimatrixPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const items = await oracleService.getKriMatrix()
        setData(items)
      } catch (error) {
        console.error('Failed to fetch KRI matrix:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const mappedData = data.map((d: any) => ({
    id: d.uuid ? `KRI-${d.uuid}` : (d.ID || d.KRI_ID || 'N/A'),
    dept: d.monitoring_goal || d.DEPT || d.DEPARTMENT || 'Operations',
    value: d.is_stage_complted === 'Y' ? 100 : 65,
    score: d.is_stage_complted === 'Y' ? 'Green' : 'Amber',
    prevValue: 50,
    prevScore: 'Amber',
    threshold: 80,
    nextBound: 60,
    breach: d.is_stage_complted === 'Y' ? 'Safe' : 'Warning',
    owner: d.mitigation_owner || d.OWNER || 'Unassigned',
    freq: 'Monthly',
    target: 100,
    type: 'LGI',
    source: 'Oracle ADW',
    updated: d.actual_start_date?.split('T')[0] || d.estimated_start_date?.split('T')[0] || 'N/A',
    trend: d.is_stage_complted === 'Y' ? 'up' : 'down'
  }))

  const filtered = mappedData.filter(d => 
    d.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.dept.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const redCount = mappedData.filter(d => d.score?.toLowerCase() === 'red').length
  const amberCount = mappedData.filter(d => ['amber', 'yellow'].includes(d.score?.toLowerCase())).length
  const greenCount = mappedData.filter(d => d.score?.toLowerCase() === 'green').length

  return (
    <div className="flex-1 pb-10 flex flex-col h-full">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/50 px-6 py-5 bg-background/50 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">KRI Matrix</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5 font-medium">Comprehensive monitoring matrix for all Key Risk Indicators</p>
          </div>
          <div className="flex items-center gap-3">
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button variant="outline" size="sm" className="gap-2 h-8 text-xs font-semibold bg-card/50 border-border/50 hover:bg-secondary shadow-sm">
                <Download className="w-3.5 h-3.5" />
                Export Matrix
              </Button>
            </motion.div>
          </div>
        </div>
      </FadeIn>

      <div className="p-6 flex-1 flex flex-col min-h-0">
        <FadeIn delay={0.2} className="flex-1 min-h-0">
          <div className="glass-card rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
            
            <div className="p-4 border-b border-border/50 bg-secondary/30 flex justify-between items-center">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, Department..."
                  className="pl-9 h-9 text-[13px] bg-background border-border/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-4">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-destructive" /> Red: {redCount}</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /> Amber: {amberCount}</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Green: {greenCount}</div>
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-[12px] whitespace-nowrap">
                <thead className="sticky top-0 z-10 bg-secondary/90 backdrop-blur-md border-b border-border/50 shadow-sm">
                  <tr className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                    <th className="px-4 py-3 sticky left-0 bg-secondary/90 z-20 border-r border-border/50 shadow-sm">KRI ID</th>
                    <th className="px-4 py-3 text-center border-r border-border/50" colSpan={2}>Current Status</th>
                    <th className="px-4 py-3 text-center border-r border-border/50" colSpan={2}>Previous Period</th>
                    <th className="px-4 py-3">Threshold</th>
                    <th className="px-4 py-3">Next Bound</th>
                    <th className="px-4 py-3 border-r border-border/50">Breach</th>
                    <th className="px-4 py-3 min-w-[120px]">Department</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Frequency</th>
                    <th className="px-4 py-3 font-mono">Target</th>
                    <th className="px-4 py-3 text-center">Type</th>
                    <th className="px-4 py-3 min-w-[150px]">Data Source</th>
                    <th className="px-4 py-3 border-l border-border/50">Last Updated</th>
                    <th className="px-3 py-3 text-center sticky right-0 bg-secondary/90 z-20 border-l border-border/50 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">Act</th>
                  </tr>
                  <tr className="bg-background/20 text-[9px] text-muted-foreground font-medium border-b border-border/30">
                    <th className="px-4 py-1.5 sticky left-0 bg-secondary/90 border-r border-border/50 border-t border-border/30"></th>
                    <th className="px-4 py-1.5 text-center text-foreground border-t border-border/30 border-r border-border/50">Value</th>
                    <th className="px-4 py-1.5 text-center text-foreground border-t border-border/30 border-r border-border/50">Score</th>
                    <th className="px-4 py-1.5 text-center border-t border-border/30 border-r border-border/50">Value</th>
                    <th className="px-4 py-1.5 text-center border-t border-border/30 border-r border-border/50">Score</th>
                    <th colSpan={11} className="border-t border-border/30 px-4 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filtered.map((row, idx) => (
                      <motion.tr 
                        layout="position"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        key={row.id || idx} 
                        className="border-b border-border/30 hover:bg-secondary/20 transition-colors last:border-0 group"
                      >
                        <td className="px-4 py-3 font-mono font-bold text-foreground sticky left-0 bg-background group-hover:bg-secondary/20 transition-colors border-r border-border/50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          {row.id}
                        </td>
                        
                        <td className="px-4 py-3 text-center border-r border-border/50 bg-secondary/10">
                          <div className="flex items-center justify-center gap-2 font-mono text-[13px] font-bold text-foreground">
                            {row.value}
                            {row.trend === 'up' ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> : <TrendingDown className="w-3.5 h-3.5 text-amber-500" />}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center border-r border-border/50 bg-secondary/10">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${row.score === 'Green' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                            {row.score}
                          </span>
                        </td>
                        
                        <td className="px-4 py-3 text-center border-r border-border/50 font-mono text-muted-foreground">{row.prevValue}</td>
                        <td className="px-4 py-3 text-center border-r border-border/50">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border opacity-70 bg-amber-500/10 text-amber-500 border-amber-500/20`}>
                            {row.prevScore}
                          </span>
                        </td>
                        
                        <td className="px-4 py-3 font-mono text-amber-500 font-semibold">{row.threshold}</td>
                        <td className="px-4 py-3 font-mono text-destructive font-semibold">{row.nextBound}</td>
                        
                        <td className="px-4 py-3 border-r border-border/50">
                          <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${row.breach === 'Warning' ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {row.breach === 'Warning' && <AlertTriangle className="w-3 h-3" />}
                            {row.breach}
                          </span>
                        </td>
                        
                        <td className="px-4 py-3 font-medium text-foreground">{row.dept.substring(0, 30)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.owner}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.freq}</td>
                        <td className="px-4 py-3 font-mono text-emerald-500 font-semibold bg-emerald-500/5">{row.target}</td>
                        
                        <td className="px-4 py-3 text-center">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-secondary text-muted-foreground text-[10px] font-bold uppercase tracking-wider border border-border/50">
                            {row.type}
                          </span>
                        </td>
                        
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground truncate max-w-[150px]">{row.source}</td>
                        <td className="px-4 py-3 border-l border-border/50 font-mono text-[11px] text-muted-foreground">{row.updated}</td>
                        
                        <td className="px-3 py-3 text-center sticky right-0 bg-background group-hover:bg-secondary/20 transition-colors border-l border-border/50 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground transition-colors">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-lg rounded-xl">
                               <DropdownMenuItem onClick={() => router.push(`/monitoring?kriId=${row.id}`)} className="text-[11px] font-bold hover:bg-secondary cursor-pointer uppercase tracking-wider text-muted-foreground">
                                 Monitor Indicator
                               </DropdownMenuItem>
                               <DropdownMenuItem onClick={() => router.push(`/rcsa?kriId=${row.id}`)} className="text-[11px] font-bold hover:bg-secondary cursor-pointer uppercase tracking-wider text-muted-foreground">
                                 Trigger Provisioning
                               </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                  <p className="font-medium text-xs">No indicators found.</p>
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 p-2.5 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center px-4">
              <span>{filtered.length} Key Risk Indicators</span>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
