'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { 
  Plus, 
  Shield, 
  Search, 
  ArrowRight, 
  Save, 
  Trash2, 
  Loader2, 
  Check, 
  RotateCcw,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FadeIn } from '@/components/ui/fade-in'
import { motion, AnimatePresence } from 'framer-motion'
import { oracleService } from '@/lib/oracleService'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export function AssessmentscontrolsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [globalFilter, setGlobalFilter] = useState('')
  const [editedRows, setEditedRows] = useState<Record<string, any>>({})

  // 1. Data Fetching
  const { data: controls = [], isLoading, isError, error } = useQuery({
    queryKey: ['assessments-controls'],
    queryFn: () => oracleService.getAssessmentsControls(),
  })

  // 2. Mutations
  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string | number, data: any }[]) => {
      const updates = payload.map(p => oracleService.updateControlAssessment(p.id, p.data))
      return Promise.all(updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments-controls'] })
      setEditedRows({})
      toast({ title: 'Success', description: 'Control assessments synchronized.' })
    },
    onError: () => {
      toast({ title: 'Sync Failure', description: 'Failed to update records.', variant: 'destructive' })
    }
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      return oracleService.createControlImplementation({
        identify_risk_uuid: 1,
        assessment_reference_number_uuid: 1,
        control_design_effectiveness: 90,
        control_frequency: 1,
        is_stage_complted: 'N',
        approval_status: 'DRAFT',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments-controls'] })
      toast({ title: 'Success', description: 'New control created.' })
    },
    onError: () => {
      toast({ title: 'Creation Failure', description: 'Failed to create control.', variant: 'destructive' })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string | number) => {
      // Use deleteControlImplementation if it exists, otherwise deleteMitigationPlan which maps to the same table
      return (oracleService as any).deleteControlImplementation 
        ? (oracleService as any).deleteControlImplementation(id) 
        : oracleService.deleteMitigationPlan(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments-controls'] })
      toast({ title: 'Success', description: 'Control deleted.' })
    },
    onError: (err: any) => {
      toast({ title: 'Deletion Failure', description: err.message || 'Failed to delete control.', variant: 'destructive' })
    }
  })

  // 3. Column Definitions
  const columnHelper = createColumnHelper<any>()
  
  const columns = useMemo(() => [
    columnHelper.accessor('root_cause', {
      header: 'Root Cause',
      cell: info => <span className="font-bold text-foreground block max-w-[200px] truncate">{info.getValue() || info.row.original.control_description || 'Unknown'}</span>,
    }),
    columnHelper.accessor('inh_score', {
      header: 'Score',
      cell: info => {
        const score = info.getValue() || info.row.original.inherent_sle || 0;
        return (
          <span className={cn(
            "px-2 py-0.5 rounded text-[10px] font-black tracking-tighter shadow-sm",
            score >= 15 ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
          )}>
            {score}
          </span>
        );
      },
    }),
    columnHelper.accessor('control_id', {
      header: 'ID',
      cell: info => <span className="font-mono text-[11px] text-muted-foreground/70">{info.getValue() || String(info.row.original.uuid || '').slice(0, 8) || 'NEW'}</span>,
    }),
    columnHelper.accessor('control_design_effectiveness', {
      header: 'Design Eff.',
      cell: info => {
        const val = info.getValue()
        const label = val >= 70 ? 'Effective' : val >= 40 ? 'Needs Improvement' : val ? 'Ineffective' : 'Unset'
        return <span className="font-semibold text-foreground/90">{label} {val ? `(${val})` : ''}</span>
      },
    }),
    columnHelper.accessor('control_frequency', {
      header: 'Frequency',
      cell: ({ row, getValue }) => (
        <select 
          className="w-full bg-secondary/50 border border-border/40 rounded px-2 py-1 text-[11px] font-bold outline-none focus:ring-1 focus:ring-primary/30"
          value={editedRows[row.original.uuid]?.control_frequency ?? getValue() ?? 1}
          onChange={(e) => {
            const val = Number(e.target.value)
            setEditedRows(prev => ({
              ...prev,
              [row.original.uuid]: { ...(prev[row.original.uuid] || row.original), control_frequency: val }
            }))
          }}
        >
          <option value={1}>Continuous</option>
          <option value={2}>Daily</option>
          <option value={3}>Weekly</option>
        </select>
      )
    }),
    columnHelper.accessor('is_stage_complted', {
      header: 'Oper. Status',
      cell: ({ row, getValue }) => (
        <select 
          className="w-full bg-secondary/50 border border-border/40 rounded px-2 py-1 text-[11px] font-bold outline-none focus:ring-1 focus:ring-primary/30"
          value={editedRows[row.original.uuid]?.is_stage_complted ?? getValue() ?? 'N'}
          onChange={(e) => {
            const val = e.target.value
            setEditedRows(prev => ({
              ...prev,
              [row.original.uuid]: { ...(prev[row.original.uuid] || row.original), is_stage_complted: val }
            }))
          }}
        >
          <option value="Y">Complete</option>
          <option value="N">In Progress</option>
        </select>
      )
    }),
    columnHelper.display({
      id: 'overall',
      header: 'Overall Status',
      cell: ({ row }) => {
        const edits = editedRows[row.original.uuid] || row.original
        const isGreen = edits.is_stage_complted === 'Y'
        return (
          <div className="flex items-center gap-2 px-1">
             <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]", isGreen ? "bg-emerald-500 text-emerald-500" : "bg-amber-500 text-amber-500")} />
             <span className={cn("text-[10px] font-black uppercase tracking-widest", isGreen ? "text-emerald-500" : "text-amber-500")}>
               {isGreen ? 'Green' : 'Amber'}
             </span>
          </div>
        )
      }
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Act',
      cell: ({ row }) => (
        <button 
          onClick={() => deleteMutation.mutate(row.original.uuid || row.original.id || row.original.control_id)}
          disabled={deleteMutation.isPending}
          className="p-1.5 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-md disabled:opacity-50"
        >
          {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      )
    })
  ], [editedRows, deleteMutation.isPending])

  // 4. Table instance
  const table = useReactTable({
    data: controls,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const hasChanges = Object.keys(editedRows).length > 0

  const handleSave = () => {
    const payload = Object.entries(editedRows).map(([id, data]) => ({ id, data }))
    updateMutation.mutate(payload)
  }

  return (
    <div className="flex-1 pb-10 flex flex-col h-full bg-background/30">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/40 px-6 py-5 bg-background/60 backdrop-blur-xl sticky top-0 z-40 flex justify-between items-center shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">Control Implementation</h1>
            <p className="text-[12px] text-muted-foreground font-medium">Mitigation mapping and effectiveness telemetry</p>
          </div>
          <div className="flex items-center gap-3">
             <Button 
                variant="outline" 
                size="sm" 
                className={cn("h-8 text-[11px] font-black uppercase tracking-tighter gap-2", hasChanges ? "border-amber-500/50 text-amber-600 bg-amber-500/5" : "opacity-50")}
                onClick={() => setEditedRows({})}
                disabled={!hasChanges}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Button>
              <Button 
                size="sm" 
                className={cn("h-8 text-[11px] font-black uppercase tracking-tighter gap-2 shadow-lg", !hasChanges && "opacity-50 grayscale transition-all")}
                onClick={handleSave}
                disabled={updateMutation.isPending || !hasChanges}
              >
                {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Sync Changes
              </Button>
          </div>
        </div>
      </FadeIn>

      <div className="p-6 flex-1 flex flex-col min-h-0">
        <div className="mb-6 flex gap-4">
           <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground/60" />
              <Input placeholder="Search controls..." className="pl-10 h-9 bg-card/40 border-border/40 text-[13px] font-medium" />
           </div>
           <Button 
              size="sm" 
              variant="ghost" 
              className="h-9 px-4 text-[11px] font-bold uppercase tracking-widest border border-border/40 bg-card/20"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-2" />}
              New Control
           </Button>
        </div>

        <FadeIn delay={0.2} className="flex-1 min-h-0">
          <div className="glass-card rounded-2xl overflow-hidden shadow-2xl border border-border/40 flex flex-col h-full bg-card/20 backdrop-blur-md">
            <div className="overflow-x-auto flex-1 scrollbar-thin scrollbar-thumb-border/20">
              {isLoading ? (
                <div className="py-40 text-center">
                   <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary/40 mb-4" />
                   <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Synchronizing with GRC Core...</p>
                </div>
              ) : isError ? (
                <div className="py-40 text-center">
                   <AlertCircle className="w-10 h-10 mx-auto text-destructive/40 mb-4" />
                   <p className="text-sm font-bold text-foreground">Traceability Link Interrupted</p>
                   <p className="text-[11px] text-muted-foreground mt-2 italic">{(error as any)?.message}</p>
                </div>
              ) : (
                <table className="w-full text-left text-[13px] border-collapse">
                  <thead className="sticky top-0 z-20 bg-secondary/80 backdrop-blur-md">
                    {table.getHeaderGroups().map(hg => (
                      <tr key={hg.id} className="border-b border-border/40">
                         {hg.headers.map(h => (
                           <th key={h.id} className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-r border-border/10 last:border-r-0">
                              {flexRender(h.column.columnDef.header, h.getContext())}
                           </th>
                         ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {table.getRowModel().rows.map(row => (
                        <motion.tr 
                          key={row.id} 
                          layout="position"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={cn(
                            "group border-b border-border/20 transition-all hover:bg-secondary/40",
                            editedRows[row.original.uuid] && "bg-primary/5 hover:bg-primary/10"
                          )}
                        >
                           {row.getVisibleCells().map(cell => (
                             <td key={cell.id} className="px-5 py-4 border-r border-border/10 last:border-r-0">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                             </td>
                           ))}
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="bg-secondary/40 px-6 py-3 border-t border-border/40 flex items-center justify-between">
               <div className="flex items-center gap-6">
                 <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="text-[11px] font-black uppercase tracking-tighter text-muted-foreground">Certified Traceability</span>
                 </div>
                 <div className="w-px h-4 bg-border/40" />
                 <span className="text-[11px] font-bold text-foreground">{controls.length} Registered Nodes</span>
               </div>
               
               {hasChanges && (
                 <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                    <span className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                       Unsaved local cache detected
                    </span>
                 </motion.div>
               )}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
