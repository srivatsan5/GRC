'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { 
  Plus, 
  Search, 
  Download, 
  ShieldCheck, 
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Target,
  GanttChart,
  ClipboardCheck,
  Zap,
  MoreVertical
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { oracleService } from '@/lib/oracleService'
import { cn } from '@/lib/utils'

export function AppetiteframeworkPage() {
  const [globalFilter, setGlobalFilter] = useState('')

  // 1. Data Fetching
  const { data = [], isLoading } = useQuery({
    queryKey: ['appetite-framework'],
    queryFn: () => oracleService.getAppetiteFramework(),
  })

  // 2. Columns
  const columnHelper = createColumnHelper<any>()
  const columns = useMemo(() => [
    columnHelper.accessor('AREA', {
      header: 'Strategic Area',
      cell: info => <span className="font-black text-foreground text-[13px] tracking-tight uppercase italic">{info.getValue() || info.row.original.RISK_AREA || 'GENERAL'}</span>,
    }),
    columnHelper.accessor('QUALITATIVE', {
      header: 'Directive Statement',
      cell: info => <p className="text-[12px] text-muted-foreground italic font-medium max-w-[300px] truncate">"{info.getValue() || info.row.original.STATEMENT || 'N/A'}"</p>,
    }),
    columnHelper.accessor('METRIC', {
      header: 'Unit',
      cell: info => <span className="font-mono text-[11px] font-bold text-primary/80">{info.getValue() || info.row.original.QUANTITATIVE_METRIC || 'N/A'}</span>,
    }),
    columnHelper.accessor('LOWER', {
      header: 'Min Vector',
      cell: info => <span className="font-mono text-[11px] font-black text-emerald-500">{info.getValue() || info.row.original.LOWER_BOUND || 'N/A'}</span>,
    }),
    columnHelper.accessor('UPPER', {
      header: 'Max Vector',
      cell: info => <span className="font-mono text-[11px] font-black text-destructive">{info.getValue() || info.row.original.UPPER_BOUND || 'N/A'}</span>,
    }),
    columnHelper.accessor('STATUS', {
      header: 'Lifecycle',
      cell: info => {
        const val = info.getValue() || 'Active'
        const isActive = val === 'Active'
        return (
          <span className={cn(
            "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border",
            isActive ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.1)]" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
          )}>
            {val}
          </span>
        )
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: () => (
        <button className="p-1 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground/40 hover:text-foreground">
           <MoreVertical className="w-4 h-4" />
        </button>
      )
    })
  ], [])

  // 3. Table instance
  const table = useReactTable({
    data,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
  })

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative mb-6">
           <Loader2 className="w-12 h-12 animate-spin text-primary/30" />
           <ShieldCheck className="absolute inset-0 m-auto w-5 h-5 text-primary animate-pulse" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mt-4 animate-pulse">Syncing Board Directives...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 pb-20 bg-background/20 font-sans">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/40 px-6 py-6 bg-background/60 backdrop-blur-xl sticky top-0 z-40 flex justify-between items-center shadow-sm">
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tighter uppercase italic">Appetite Framework</h1>
            <p className="text-[12px] text-muted-foreground mt-1 font-medium italic opacity-70">Board-mandated tolerance thresholds and qualitative directives</p>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" size="sm" className="h-10 rounded-full border-border/50 text-[11px] font-black uppercase tracking-widest bg-card/40">
                <Download className="w-3.5 h-3.5 mr-2" />
                Export Protocol
             </Button>
             <Button size="sm" className="rounded-full px-6 h-10 font-black uppercase text-[11px] tracking-widest shadow-xl shadow-primary/20">
                <Plus className="w-3.5 h-3.5 mr-2" />
                Inject Directive
             </Button>
          </div>
        </div>
      </FadeIn>

      <div className="p-8 space-y-8">
        {/* Context Grid */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-4 gap-6" delayChildren={0.2} staggerChildren={0.1}>
           {[
             { label: 'Core Directives', value: data.length, icon: ClipboardCheck, color: 'text-primary' },
             { label: 'Active Tolerance', value: '94%', icon: Zap, color: 'text-amber-500' },
             { label: 'Drift Index', value: '1.4%', icon: GanttChart, color: 'text-indigo-500' },
             { label: 'Strategic Alignment', value: 'High', icon: Target, color: 'text-emerald-500' }
           ].map((kpi, idx) => (
             <StaggerItem key={idx}>
                <div className="glass-card rounded-[32px] p-6 bg-card/30 border border-border/40 flex items-center gap-4 transition-all hover:bg-card/40">
                   <div className={cn("p-3 rounded-2xl bg-secondary/50", kpi.color)}>
                      <kpi.icon className="w-5 h-5" />
                   </div>
                   <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.label}</p>
                      <p className="text-xl font-black text-foreground tabular-nums tracking-tight">{kpi.value}</p>
                   </div>
                </div>
             </StaggerItem>
           ))}
        </StaggerContainer>

        {/* Global Search */}
        <div className="flex items-center gap-4 bg-card/30 p-3 rounded-2xl border border-border/40 backdrop-blur-md">
           <div className="relative flex-1 max-w-sm ml-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input 
                placeholder="Query framework..." 
                className="pl-12 h-11 bg-background/50 border-none rounded-xl text-[14px] font-bold shadow-inner placeholder:font-medium placeholder:italic" 
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
              />
           </div>
           <Button variant="ghost" className="hidden md:flex ml-auto h-11 rounded-xl px-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 italic">
              Oracle ADW Repository v2.4
           </Button>
        </div>

        {/* Board Directives Table */}
        <div className="glass-card rounded-[40px] overflow-hidden shadow-2xl border border-border/40 bg-card/5 backdrop-blur-xl flex flex-col min-h-[500px]">
           <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-separate border-spacing-0">
                 <thead className="bg-secondary/60 backdrop-blur-md">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                       {table.getHeaderGroups()[0].headers.map(h => (
                         <th key={h.id} className="px-8 py-5 border-b border-border/20 border-r border-border/10 last:border-r-0">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                         </th>
                       ))}
                    </tr>
                 </thead>
                 <tbody>
                    {table.getRowModel().rows.map(row => (
                      <motion.tr 
                        key={row.id} 
                        layout="position"
                        className="group hover:bg-primary/5 transition-all cursor-default"
                      >
                         {row.getVisibleCells().map(cell => (
                           <td key={cell.id} className="px-8 py-5 border-b border-border/10 border-r border-border/10 last:border-r-0">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                           </td>
                         ))}
                      </motion.tr>
                    ))}
                    {data.length === 0 && (
                      <tr>
                        <td colSpan={columns.length} className="py-40 text-center">
                           <ShieldCheck className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
                           <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground italic opacity-50">No directives synced from source</p>
                        </td>
                      </tr>
                    )}
                 </tbody>
              </table>
           </div>

           <div className="bg-secondary/40 px-10 py-5 border-t border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-6">
                 <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary/60" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Governance Baseline Valid</span>
                 </div>
                 <div className="w-px h-4 bg-border/40" />
                 <span className="text-[11px] font-bold text-foreground">{data.length} Directives Active</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground italic px-4 py-1.5 border border-border/20 rounded-full bg-background/40">Strict Quantitative Compliance Mandated</span>
           </div>
        </div>
      </div>
    </div>
  )
}
