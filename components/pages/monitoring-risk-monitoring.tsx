'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { 
  Search, 
  Eye, 
  Filter, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  Activity
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { motion, AnimatePresence } from 'framer-motion'
import { oracleService } from '@/lib/oracleService'
import { cn } from '@/lib/utils'

export function MonitoringriskmonitoringPage() {
  const [globalFilter, setGlobalFilter] = useState('')

  // 1. Data Fetching
  const { data: monitoringData = [], isLoading, isError, error } = useQuery({
    queryKey: ['monitoring-risk'],
    queryFn: async () => {
      try {
        return await oracleService.getMonitoringRiskMonitoring()
      } catch (e) {
        console.warn("Recoverable monitoring fetch error:", e)
        return []
      }
    },
    retry: 1
  })

  // 2. Column Definitions
  const columnHelper = createColumnHelper<any>()
  
  const columns = useMemo(() => [
    columnHelper.accessor('root_cause', {
      header: 'Root Cause',
      cell: info => <span className="font-bold text-foreground block max-w-[150px] truncate">{info.getValue() || 'N/A'}</span>,
    }),
    columnHelper.accessor('title', {
      header: 'Title',
      cell: info => <span className="font-black text-foreground tracking-tight">{info.getValue() || info.row.original.monitoring_title || 'N/A'}</span>,
    }),
    columnHelper.accessor('description', {
      header: 'Description',
      cell: info => <span className="text-muted-foreground block max-w-[200px] truncate">{info.getValue() || info.row.original.monitoring_goal || 'N/A'}</span>,
    }),
    columnHelper.accessor('owner', {
      header: 'Owner',
      cell: info => {
        const name = info.getValue() || 'Unassigned'
        const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
        return (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[9px] font-black text-primary">
              {initials}
            </div>
            <span className="font-bold text-[12px]">{name}</span>
          </div>
        )
      },
    }),
    columnHelper.accessor('start_date', {
      header: 'Window',
      cell: info => {
        const start = info.getValue() || info.row.original.estimated_start_date || info.row.original.actual_start_date
        const end = info.row.original.end_date || info.row.original.estimated_end_date || info.row.original.actual_end_date
        return (
          <div className="font-mono text-[10px] text-muted-foreground flex items-center gap-1.5 font-bold">
            {start?.split('T')[0] || 'N/A'}
            <ArrowRight className="w-3 h-3 text-border" />
            {end?.split('T')[0] || 'N/A'}
          </div>
        )
      },
    }),
    columnHelper.accessor('status', {
      header: 'Maturity Status',
      cell: info => {
        const val = info.getValue() || (info.row.original.is_stage_complted === 'Y' ? 'Completed' : 'Active')
        const isDelayed = val.toLowerCase().includes('delayed') || val.toLowerCase().includes('at risk')
        return (
          <span className={cn(
            "inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border",
            isDelayed ? "bg-destructive/10 text-destructive border-destructive/20 shadow-[0_0_8px_rgba(239,68,68,0.2)]" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
          )}>
            {val}
          </span>
        )
      },
    }),
    columnHelper.accessor('action_plans', {
      header: 'Fidelity',
      cell: info => (
        <span className={cn(
          "text-[11px] font-black",
          String(info.getValue() || '').includes('Overdue') ? "text-amber-500 animate-pulse" : "text-primary"
        )}>
          {info.getValue() || '0 Active'}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Inspect',
      cell: () => (
        <button className="p-1.5 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground/40 hover:text-primary hover:bg-primary/10 rounded-md">
          <Eye className="w-4 h-4" />
        </button>
      )
    })
  ], [])

  // 3. Table instance
  const table = useReactTable({
    data: monitoringData,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const val = row.getValue(columnId)
      return String(val || '').toLowerCase().includes(String(filterValue).toLowerCase())
    },
  })

  return (
    <div className="flex-1 pb-10 flex flex-col h-full bg-background/20 font-sans">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/40 px-6 py-6 bg-background/60 backdrop-blur-xl sticky top-0 z-40 flex justify-between items-center shadow-sm">
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tighter uppercase italic">Control Monitoring</h1>
            <p className="text-[12px] text-muted-foreground mt-1 font-medium italic opacity-70">Real-time effectiveness tracking and mitigation audit</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden lg:flex flex-col items-end mr-4">
                <span className="text-[9px] font-black text-muted-foreground uppercase opacity-60">Fleet Health</span>
                <span className="text-[11px] font-black text-emerald-500 flex items-center gap-1.5">Nominal <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_currentColor]" /></span>
             </div>
             <Button variant="outline" size="sm" className="h-9 px-4 rounded-full border-border/50 text-[11px] font-black uppercase tracking-widest bg-card/40 hover:bg-secondary transition-all">
                <Filter className="w-3.5 h-3.5 mr-2" />
                Advanced Filters
             </Button>
          </div>
        </div>
      </FadeIn>

      <div className="p-6 flex-1 flex flex-col min-h-0">
        <div className="mb-8 bg-card/30 backdrop-blur-md rounded-2xl border border-border/40 p-3 shadow-xl flex items-center gap-4">
           <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input 
                placeholder="Query monitoring logs by cause, title or owner..." 
                className="pl-12 h-11 bg-background/40 border-none rounded-xl text-[14px] font-bold shadow-inner placeholder:font-medium placeholder:italic" 
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
              />
           </div>
           <div className="flex items-center px-4 py-2 bg-secondary/30 rounded-xl border border-border/20">
              <span className="text-[11px] font-black text-foreground/60 tabular-nums uppercase">{monitoringData.length} records mapped</span>
           </div>
        </div>

        <FadeIn delay={0.2} className="flex-1 min-h-0">
          <div className="glass-card rounded-3xl overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] border border-border/40 flex flex-col h-full bg-card/10">
            <div className="overflow-x-auto flex-1">
               {isLoading ? (
                 <div className="py-48 text-center bg-background/5">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary/30 mb-6" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Scanning Risk Nodes...</p>
                 </div>
               ) : isError ? (
                 <div className="py-48 text-center bg-background/5">
                    <AlertCircle className="w-12 h-12 mx-auto text-destructive/40 mb-6" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Data Layer Disruption</h3>
                    <p className="text-[11px] text-muted-foreground mt-2 italic opacity-60">{(error as any)?.message}</p>
                 </div>
               ) : (
                 <table className="w-full text-left text-[13px] border-collapse">
                   <thead className="sticky top-0 z-20 bg-secondary/90 backdrop-blur-xl border-b border-border/40">
                     <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {table.getHeaderGroups()[0].headers.map(h => (
                          <th key={h.id} className="px-6 py-5 first:sticky first:left-0 first:z-30 first:bg-secondary/90 border-r border-border/10">
                             {flexRender(h.column.columnDef.header, h.getContext())}
                          </th>
                        ))}
                     </tr>
                   </thead>
                   <tbody>
                      <AnimatePresence initial={false}>
                        {table.getRowModel().rows.length > 0 ? table.getRowModel().rows.map(row => (
                          <motion.tr 
                            key={row.id}
                            layout="position"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="group border-b border-border/10 hover:bg-secondary/30 transition-all cursor-default relative"
                          >
                             {row.getVisibleCells().map(cell => (
                               <td key={cell.id} className="px-6 py-5 first:sticky first:left-0 first:bg-background/90 group-hover:first:bg-secondary transition-colors border-r border-border/10 last:border-r-0">
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                               </td>
                             ))}
                          </motion.tr>
                        )) : (
                          <tr>
                            <td colSpan={columns.length} className="py-32 text-center text-muted-foreground italic font-medium opacity-40">
                               No operational telemetry matching criteria.
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                   </tbody>
                 </table>
               )}
            </div>
            
            <div className="bg-secondary/60 px-8 py-5 border-t border-border/40 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Live Monitoring Stream Active</span>
               </div>
               <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-8 h-8 rounded-lg"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </Button>
                  <span className="text-[11px] font-black tabular-nums border px-2 py-0.5 rounded bg-background/50">{table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-8 h-8 rounded-lg"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Button>
               </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
