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
  Download, 
  ChevronDown, 
  ChevronUp, 
  ChevronsUpDown, 
  Loader2, 
  ShieldCheck, 
  History, 
  User, 
  Database,
  Calendar,
  Filter,
  ArrowRight,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { oracleService } from '@/lib/oracleService'
import { cn } from '@/lib/utils'

const actionColors: Record<string, string> = {
  'Risk Created': '#3b82f6',
  'Assessment Updated': '#8b5cf6',
  'Response Plan Created': '#10b981',
  'Risk Approved': '#06b6d4',
  'Report Generated': '#f59e0b',
  'Access Denied': '#ef4444',
  'Settings Updated': '#64748b',
  'User Added': '#3b82f6',
}

export function AuditTrailPage() {
  const [globalFilter, setGlobalFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // 1. Data Fetching
  const { data: auditData = [], isLoading, isError, error } = useQuery({
    queryKey: ['audit-trail'],
    queryFn: () => oracleService.getAuditTrail(),
  })

  // 2. Column Definitions
  const columnHelper = createColumnHelper<any>()
  
  const columns = useMemo(() => [
    columnHelper.accessor('timestamp', {
      header: 'Moment',
      cell: info => (
        <div className="flex flex-col">
           <span className="font-mono text-[11px] font-black text-foreground tabular-nums">
              {info.getValue()?.split(' ')[1] || '00:00:00'}
           </span>
           <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
              {info.getValue()?.split(' ')[0] || 'N/A'}
           </span>
        </div>
      ),
    }),
    columnHelper.accessor('action', {
      header: 'Operation',
      cell: info => {
        const val = info.getValue() || 'UNKNOWN'
        const color = actionColors[val] || '#64748b'
        return (
          <div className="flex items-center gap-2">
             <div className="w-1.5 h-3 rounded-full shadow-[0_0_8px_currentColor]" style={{ color, backgroundColor: color }} />
             <span className="text-[10px] font-black uppercase tracking-widest text-foreground">{val}</span>
          </div>
        )
      },
    }),
    columnHelper.accessor('user', {
      header: 'Actor',
      cell: info => (
        <div className="flex items-center gap-2">
           <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[9px] font-black text-primary">
              {String(info.getValue() || 'U').charAt(0).toUpperCase()}
           </div>
           <span className="font-bold text-foreground text-[12px]">{info.getValue() || 'System'}</span>
        </div>
      ),
    }),
    columnHelper.accessor('entity', {
      header: 'Target Entity',
      cell: info => <span className="text-muted-foreground font-medium italic opacity-80">{info.getValue() || 'N/A'}</span>,
    }),
    columnHelper.accessor('status', {
      header: 'Result',
      cell: info => {
        const isSuccess = info.getValue() === 'Success'
        return (
          <span className={cn(
            "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border",
            isSuccess ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
          )}>
            {info.getValue() || 'N/A'}
          </span>
        )
      },
    }),
    columnHelper.display({
      id: 'inspect',
      header: '',
      cell: () => (
        <button className="p-1 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground/40 hover:text-primary">
           <ChevronDown className="w-4 h-4" />
        </button>
      )
    })
  ], [])

  // 3. Table instance
  const table = useReactTable({
    data: auditData,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative mb-6">
           <Loader2 className="w-12 h-12 animate-spin text-primary/30" />
           <History className="absolute inset-0 m-auto w-5 h-5 text-primary animate-pulse" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Relaying GRC Event Stream...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 pb-10 bg-background/20 font-sans">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/40 px-6 py-6 bg-background/60 backdrop-blur-xl sticky top-0 z-40 flex justify-between items-center shadow-sm">
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tighter uppercase italic">Event Ledger</h1>
            <p className="text-[12px] text-muted-foreground mt-1 font-medium italic opacity-70">Immutable audit stream and forensic attribution</p>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden lg:flex flex-col items-end mr-4">
                <span className="text-[9px] font-black text-muted-foreground uppercase opacity-60">Log Velocity</span>
                <span className="text-[11px] font-black text-primary flex items-center gap-1.5">Active <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" /></span>
             </div>
             <Button variant="outline" size="sm" className="h-9 px-4 rounded-full border-border/50 text-[11px] font-black uppercase tracking-widest bg-card/40 hover:bg-secondary transition-all">
                <Download className="w-3.5 h-3.5 mr-2" />
                Forge CSV
             </Button>
          </div>
        </div>
      </FadeIn>

      <div className="px-6 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
           <div className="glass-card rounded-2xl p-4 bg-card/30 border border-border/40 flex flex-col gap-1">
              <span className="text-[9px] font-black text-muted-foreground uppercase opacity-60">Fleet Volume</span>
              <span className="text-2xl font-black text-foreground tabular-nums">{auditData.length}</span>
           </div>
           <div className="glass-card rounded-2xl p-4 bg-card/30 border border-border/40 flex flex-col gap-1">
              <span className="text-[9px] font-black text-emerald-500 uppercase opacity-60">Nominal States</span>
              <span className="text-2xl font-black text-emerald-500 tabular-nums">{auditData.filter((a: any) => a.status === 'Success').length}</span>
           </div>
           <div className="glass-card rounded-2xl p-4 bg-card/30 border border-border/40 flex flex-col gap-1">
              <span className="text-[9px] font-black text-destructive uppercase opacity-60">Anomalous States</span>
              <span className="text-2xl font-black text-destructive tabular-nums">{auditData.filter((a: any) => a.status === 'Failed').length}</span>
           </div>
           <div className="glass-card rounded-2xl p-4 bg-card/30 border border-border/40 flex flex-col gap-1">
              <span className="text-[9px] font-black text-primary uppercase opacity-60">Core Integrity</span>
              <span className="text-2xl font-black text-primary italic">Verified</span>
           </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8 bg-card/40 p-3 rounded-2xl border border-border/40 backdrop-blur-md">
           <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input 
                placeholder="Query forensic data..." 
                className="pl-12 h-11 bg-background/40 border-none rounded-xl text-[14px] font-bold shadow-inner placeholder:italic placeholder:font-medium" 
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
              />
           </div>
           
           <div className="flex items-center gap-3 ml-auto">
              <div className="flex items-center gap-2 bg-secondary/30 px-4 py-2 rounded-xl border border-border/20">
                 <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                 <input type="date" className="bg-transparent border-none text-[11px] font-black uppercase outline-none text-foreground/70" />
                 <ArrowRight className="w-3 h-3 text-border" />
                 <input type="date" className="bg-transparent border-none text-[11px] font-black uppercase outline-none text-foreground/70" />
              </div>
              <Button size="icon" variant="ghost" className="w-11 h-11 rounded-xl bg-secondary/50 border border-border/20"><Filter className="w-4 h-4" /></Button>
           </div>
        </div>

        <FadeIn delay={0.3} className="flex-1 min-h-0">
          <div className="glass-card rounded-3xl overflow-hidden shadow-2xl border border-border/40 flex flex-col h-full bg-card/10">
            <div className="overflow-x-auto">
               <table className="w-full text-left text-[13px] border-collapse">
                  <thead className="bg-secondary/80 backdrop-blur-xl border-b border-border/40">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                       {table.getHeaderGroups()[0].headers.map(h => (
                         <th key={h.id} className="px-6 py-5 border-r border-border/10 last:border-r-0">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                         </th>
                       ))}
                    </tr>
                  </thead>
                  <tbody>
                     <AnimatePresence initial={false}>
                        {table.getRowModel().rows.map(row => (
                          <motion.tr 
                            key={row.id}
                            layout="position"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="group border-b border-border/10 hover:bg-secondary/40 transition-all cursor-pointer"
                          >
                             {row.getVisibleCells().map(cell => (
                               <td key={cell.id} className="px-6 py-4 border-r border-border/10 last:border-r-0">
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                               </td>
                             ))}
                          </motion.tr>
                        ))}
                     </AnimatePresence>
                  </tbody>
               </table>
            </div>

            <div className="bg-secondary/60 px-8 py-4 border-t border-border/40 flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <Database className="w-4 h-4 text-primary/60" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Synchronized with Oracle ADW Partition #04</span>
               </div>
               
               <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-8 h-8"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </Button>
                  <span className="text-[11px] font-black tabular-nums border border-border/40 px-3 py-1 bg-background/50 rounded-lg">
                    {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-8 h-8"
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
