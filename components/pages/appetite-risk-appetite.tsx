'use client'

import React, { useState, useEffect } from 'react'
import { Search, Download, Target, Plus, Sliders, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FadeIn } from '@/components/ui/fade-in'
import { motion, AnimatePresence } from 'framer-motion'
import { oracleService } from '@/lib/oracleService'

export function AppetiteriskappetitePage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const items = await oracleService.getAppetiteRiskAppetite()
        setData(items)
      } catch (error) {
        console.error('Failed to fetch risk appetite data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filtered = data.filter(d => (d.COMPONENT || d.NAME || '').toLowerCase().includes(searchTerm.toLowerCase()))

  const getAppetiteColor = (appetite: string) => {
    switch (appetite?.toLowerCase()) {
      case 'zero': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
      case 'low': return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      case 'medium': return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      case 'high': return 'bg-destructive/10 text-destructive border-destructive/20'
      default: return 'bg-secondary text-muted-foreground border-border/50'
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary/70" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Quantifying Organization Boundaries...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 pb-10 flex flex-col h-full">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/50 px-6 py-5 bg-background/50 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Risk Appetite
            </h1>
            <p className="text-[13px] text-muted-foreground mt-0.5 font-medium">Define tolerances and capacities for key business components</p>
          </div>
          <div className="flex items-center gap-3">
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button size="sm" className="gap-2 h-8 text-xs font-semibold shadow-[var(--shadow-md)]">
                <Plus className="w-3.5 h-3.5" />
                Add Tolerance
              </Button>
            </motion.div>
          </div>
        </div>
      </FadeIn>

      <div className="p-6 flex-1 flex flex-col min-h-0">
        <FadeIn delay={0.2}>
          <div className="mb-6 flex justify-between items-center bg-card border border-border/50 p-2 rounded-lg shadow-sm">
            <div className="relative max-w-sm flex-1 ml-2">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search components..."
                className="pl-9 h-9 text-[13px] bg-background border-border/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Button variant="outline" size="sm" className="gap-2 h-9 text-[12px] bg-background border-border/50 font-semibold px-4 text-muted-foreground">
                <Download className="w-3.5 h-3.5" />
                Export
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
                    <th className="px-5 py-3 border-r border-border/50 w-16 text-center">No.</th>
                    <th className="px-5 py-3 min-w-[200px]">Component Name</th>
                    <th className="px-5 py-3 text-center">Appetite Level</th>
                    <th className="px-5 py-3">Acceptable Range</th>
                    <th className="px-5 py-3">Max Capacity</th>
                    <th className="px-5 py-3 text-center border-l border-border/50">Metric Type</th>
                    <th className="px-5 py-3 border-l border-border/50 text-right">Last Updated</th>
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
                        key={row.ID || row.TOLERANCE_ID || idx} 
                        className="border-b border-border/30 hover:bg-secondary/20 transition-colors last:border-0 group"
                      >
                        <td className="px-5 py-4 font-mono font-bold text-muted-foreground border-r border-border/50 text-center">
                          {row.uuid || row.ID || row.TOLERANCE_ID || (idx + 1)}
                        </td>
                        <td className="px-5 py-4 font-bold text-foreground">{row.process_name || row.business_process_name || row.COMPONENT || row.NAME || 'General Component'}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getAppetiteColor(row.inherent_sle >= 15 ? 'High' : row.inherent_sle >= 10 ? 'Medium' : 'Low')}`}>
                            {row.inherent_sle >= 15 ? 'High' : row.inherent_sle >= 10 ? 'Medium' : 'Low'}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-mono text-emerald-500 font-semibold">10% - 20%</td>
                        <td className="px-5 py-4 font-mono text-destructive font-semibold">25%</td>
                        <td className="px-5 py-4 text-center border-l border-border/50">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground text-[10px] font-bold uppercase tracking-wider border border-border/50">
                            Percentage
                          </span>
                        </td>
                        <td className="px-5 py-4 border-l border-border/50 font-mono text-[11px] text-muted-foreground text-right">{row.assessment_registered_date?.split('T')[0] || row.UPDATED || row.LAST_UPDATED || 'N/A'}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                  <p className="font-medium text-xs">No risk appetite tolerances defined.</p>
                </div>
              )}
            </div>
            <div className="bg-slate-50 p-2.5 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center px-4">
              <span>{filtered.length} categories defined</span>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
