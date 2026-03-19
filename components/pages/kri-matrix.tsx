'use client'

import React, { useState, useEffect } from 'react'
import { Search, Download, TrendingUp, TrendingDown, MoreVertical, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FadeIn } from '@/components/ui/fade-in'
import { motion, AnimatePresence } from 'framer-motion'
import { oracleService } from '@/lib/oracleService'

export function KrimatrixPage() {
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

  const filtered = data.filter(d => 
    (d.ID || d.KRI_ID || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (d.DEPT || d.DEPARTMENT || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getScoreColor = (score: string) => {
    switch (score?.toLowerCase()) {
      case 'green': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
      case 'amber':
      case 'yellow': return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      case 'red': return 'bg-destructive/10 text-destructive border-destructive/20'
      default: return 'bg-secondary text-muted-foreground border-border/50'
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary/70" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Scanning Risk Indicators...</p>
        </div>
      </div>
    )
  }

  const redCount = data.filter(d => d.SCORE?.toLowerCase() === 'red').length
  const amberCount = data.filter(d => ['amber', 'yellow'].includes(d.SCORE?.toLowerCase())).length
  const greenCount = data.filter(d => d.SCORE?.toLowerCase() === 'green').length

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
                        key={row.ID || row.KRI_ID || idx} 
                        className="border-b border-border/30 hover:bg-secondary/20 transition-colors last:border-0 group"
                      >
                        <td className="px-4 py-3 font-mono font-bold text-foreground sticky left-0 bg-background group-hover:bg-secondary/20 transition-colors border-r border-border/50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          {row.ID || row.KRI_ID || 'N/A'}
                        </td>
                        
                        <td className="px-4 py-3 text-center border-r border-border/50 bg-secondary/10">
                          <div className="flex items-center justify-center gap-2 font-mono text-[13px] font-bold text-foreground">
                            {row.VALUE || row.CURRENT_VALUE}
                            {row.TREND === 'up' ? <TrendingUp className="w-3.5 h-3.5 text-destructive" /> : <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center border-r border-border/50 bg-secondary/10">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getScoreColor(row.SCORE || row.CURRENT_SCORE)}`}>
                            {row.SCORE || row.CURRENT_SCORE || 'N/A'}
                          </span>
                        </td>
                        
                        <td className="px-4 py-3 text-center border-r border-border/50 font-mono text-muted-foreground">{row.PREV_VALUE || row.PREVIOUS_VALUE || 'N/A'}</td>
                        <td className="px-4 py-3 text-center border-r border-border/50">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border opacity-70 ${getScoreColor(row.PREV_SCORE || row.PREVIOUS_SCORE)}`}>
                            {row.PREV_SCORE || row.PREVIOUS_SCORE || 'N/A'}
                          </span>
                        </td>
                        
                        <td className="px-4 py-3 font-mono text-amber-500 font-semibold">{row.THRESHOLD || row.WARNING_THRESHOLD || 'N/A'}</td>
                        <td className="px-4 py-3 font-mono text-destructive font-semibold">{row.NEXT_BOUND || row.CRITICAL_THRESHOLD || 'N/A'}</td>
                        
                        <td className="px-4 py-3 border-r border-border/50">
                          <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${(row.BREACH || '').includes('Warning') ? 'text-amber-500' : (row.BREACH || '').includes('Breached') ? 'text-destructive' : 'text-emerald-500'}`}>
                            {(row.BREACH || '').includes('Warning') && <AlertTriangle className="w-3 h-3" />}
                            {row.BREACH || 'Safe'}
                          </span>
                        </td>
                        
                        <td className="px-4 py-3 font-medium text-foreground">{row.DEPT || row.DEPARTMENT || 'N/A'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.OWNER || 'N/A'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.FREQ || row.FREQUENCY || 'N/A'}</td>
                        <td className="px-4 py-3 font-mono text-emerald-500 font-semibold bg-emerald-500/5">{row.TARGET || 'N/A'}</td>
                        
                        <td className="px-4 py-3 text-center">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-secondary text-muted-foreground text-[10px] font-bold uppercase tracking-wider border border-border/50">
                            {row.TYPE === 'Leading' ? 'LDI' : 'LGI'}
                          </span>
                        </td>
                        
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground truncate max-w-[150px]">{row.SOURCE || 'N/A'}</td>
                        <td className="px-4 py-3 border-l border-border/50 font-mono text-[11px] text-muted-foreground">{row.UPDATED || row.LAST_UPDATED || 'N/A'}</td>
                        
                        <td className="px-3 py-3 text-center sticky right-0 bg-background group-hover:bg-secondary/20 transition-colors border-l border-border/50 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
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
                  <p className="font-medium text-[13px] italic">No indicators found in Oracle ADW.</p>
                </div>
              )}
            </div>
            
            <div className="bg-secondary/30 p-2.5 border-t border-border/50 text-[11px] font-medium text-muted-foreground flex justify-between items-center px-6">
              <span>Displaying {filtered.length} Key Risk Indicators from Oracle ADW</span>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
