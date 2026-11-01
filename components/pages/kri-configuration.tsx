'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Search, Filter, Edit2, Trash2, SlidersHorizontal, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { motion, AnimatePresence } from 'framer-motion'
import { oracleService } from '@/lib/oracleService'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function KriconfigurationPage() {
  const [searchTerm, setSearchTerm] = useState('')

  const queryClient = useQueryClient()
  const { data: rawData = [], isLoading: loading } = useQuery({
    queryKey: ['kri-config'],
    queryFn: () => oracleService.getKriConfiguration()
  })

  const data = Array.isArray(rawData) ? rawData : []

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => oracleService.deleteKriDefinition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kri-config'] })
      toast.success("KRI Definition permanently removed.")
    },
    onError: (err: any) => {
      toast.error(`Deletion failed: ${err.message}`)
    }
  })

  const filtered = data.filter(d => 
    (d.MEASURE || d.NAME || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (d.ID || d.KRI_ID || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          <p className="text-xs text-slate-500">Loading KRI definitions...</p>
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
              <SlidersHorizontal className="w-5 h-5 text-primary" />
              KRI Configuration
            </h1>
            <p className="text-[13px] text-muted-foreground mt-0.5 font-medium">Define thresholds, units, and formulas for Key Risk Indicators</p>
          </div>
          <div className="flex items-center gap-3">
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button size="sm" className="gap-2 h-8 text-xs font-semibold shadow-[var(--shadow-md)]">
                <Plus className="w-3.5 h-3.5" />
                Create New KRI
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
                placeholder="Search indicator definitions..."
                className="pl-9 h-9 text-[13px] bg-background border-border/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Button variant="outline" size="sm" className="gap-2 h-9 text-[12px] bg-background border-border/50 font-semibold px-4">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                More Filters
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
                    <th className="px-5 py-3 sticky left-0 bg-secondary/90 z-20 border-r border-border/50">KRI ID</th>
                    <th className="px-5 py-3 min-w-[200px] border-r border-border/50">Measure</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Unit</th>
                    <th className="px-5 py-3">Direction</th>
                    <th className="px-3 py-3 text-center border-l border-border/50" colSpan={2}>Threshold Range</th>
                    <th className="px-5 py-3 min-w-[250px] border-l border-border/50">Description</th>
                    <th className="px-5 py-3 min-w-[200px]">Formula Calculation</th>
                    <th className="px-3 py-3 text-center sticky right-0 bg-secondary/90 z-20 border-l border-border/50 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">Actions</th>
                  </tr>
                  <tr className="bg-background/20 text-[9px] text-muted-foreground font-medium border-b border-border/30">
                    <th colSpan={5} className="border-t border-border/30 px-5 py-1.5 border-r border-border/50"></th>
                    <th className="px-3 py-1.5 text-center text-emerald-500/70 border-t border-border/30">Lower Bound</th>
                    <th className="px-3 py-1.5 text-center text-destructive/70 border-t border-border/30 border-r border-border/50">Upper Bound</th>
                    <th colSpan={3} className="border-t border-border/30 px-5 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filtered.map((row, idx) => (
                      <motion.tr 
                        layout="position"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        key={row.ID || row.KRI_ID || idx} 
                        className="border-b border-border/30 hover:bg-secondary/20 transition-colors last:border-0 group"
                      >
                        <td className="px-5 py-4 font-mono font-bold text-muted-foreground sticky left-0 bg-background group-hover:bg-secondary/20 transition-colors border-r border-border/50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          {row.uuid || row.ID || row.KRI_ID || 'N/A'}
                        </td>
                        <td className="px-5 py-4 font-bold text-foreground border-r border-border/50 truncate max-w-[200px]">{row.monitoring_title || row.MEASURE || row.NAME || 'Unnamed Measure'}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary border border-primary/20`}>
                            Leading
                          </span>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground font-medium">Count</td>
                        <td className="px-5 py-4 font-medium text-muted-foreground">Maximize</td>
                        <td className="px-3 py-4 text-center border-l border-border/50 font-mono text-emerald-500 font-semibold">0</td>
                        <td className="px-3 py-4 text-center border-r border-border/50 font-mono text-destructive font-semibold">100</td>
                        <td className="px-5 py-4 text-muted-foreground truncate max-w-[250px]">{row.monitoring_goal || row.DESCRIPTION || 'No description'}</td>
                        <td className="px-5 py-4">
                          <code className="px-1.5 py-0.5 rounded bg-secondary/50 text-foreground text-[11px] font-mono border border-border/50">
                            {row.FORMULA || 'Auto'}
                          </code>
                        </td>
                        <td className="px-3 py-4 text-center sticky right-0 bg-background group-hover:bg-secondary/20 transition-colors border-l border-border/50 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors">
                                <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              type="button"
                              aria-label="Delete KRI definition"
                              onClick={() => {
                                if (window.confirm('Delete this KRI definition permanently? This cannot be undone.')) {
                                  deleteMutation.mutate(row.uuid || row.ID || row.KRI_ID)
                                }
                              }}
                              disabled={deleteMutation.isPending}
                              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                  <p className="font-medium text-xs">No KRI definitions found.</p>
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 p-2.5 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center px-4">
              <span>{filtered.length} KRI definitions</span>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
