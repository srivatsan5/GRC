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
  Download, 
  Eye, 
  FileText, 
  ChevronDown, 
  Loader2, 
  Clock,
  BarChart3,
  Search,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { oracleService } from '@/lib/oracleService'
import { cn } from '@/lib/utils'

export function ReportsPage() {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [globalFilter, setGlobalFilter] = useState('')

  // 1. Data Fetching
  const { data: reportsData = [], isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => oracleService.getReports(),
  })

  // 2. Computed
  const selectedReport = useMemo(() => 
    reportsData.find((r: any) => r.id === selectedReportId), 
    [reportsData, selectedReportId]
  )

  const generationTimeData = useMemo(() => [
    { type: 'Executive', time: 4.2 },
    { type: 'Operational', time: 2.1 },
    { type: 'Compliance', time: 8.5 },
    { type: 'Audit Trail', time: 1.8 }
  ], [])

  // 3. Columns
  const columnHelper = createColumnHelper<any>()
  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Report Descriptor',
      cell: info => (
        <div className="flex items-center gap-3">
           <FileText className={cn("w-4 h-4 transition-colors", selectedReportId === info.row.original.id ? "text-primary" : "text-muted-foreground/60")} />
           <span className="font-bold text-foreground text-[13px] tracking-tight">{info.getValue()}</span>
        </div>
      ),
    }),
    columnHelper.accessor('type', {
      header: 'Class',
      cell: info => <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{info.getValue()}</span>,
    }),
    columnHelper.accessor('lastGenerated', {
      header: 'Last Sync',
      cell: info => <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.accessor('status', {
      header: 'State',
      cell: info => {
        const val = info.getValue()
        const isReady = val === 'Ready'
        return (
          <div className="flex items-center gap-2">
             <div className={cn("w-1.5 h-1.5 rounded-full", isReady ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-primary animate-pulse")} />
             <span className={cn("text-[9px] font-black uppercase tracking-widest", isReady ? "text-emerald-500" : "text-primary")}>{val}</span>
          </div>
        )
      },
    }),
    columnHelper.accessor('size', {
      header: 'Volume',
      cell: info => <span className="text-[11px] font-medium text-muted-foreground italic">{info.getValue()}</span>,
    })
  ], [selectedReportId])

  // 4. Table instance
  const table = useReactTable({
    data: reportsData,
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
           <BarChart3 className="absolute inset-0 m-auto w-5 h-5 text-primary animate-pulse" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Aggregating Report Metadata...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 pb-20 bg-background/20 font-sans">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/40 px-6 py-6 bg-background/60 backdrop-blur-xl sticky top-0 z-40 flex justify-between items-center shadow-sm">
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tighter uppercase italic">Reporting Oracle</h1>
            <p className="text-[12px] text-muted-foreground mt-1 font-medium italic opacity-70">Automated intelligence extraction and document forging</p>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" size="sm" className="h-10 rounded-full border-border/50 text-[11px] font-black uppercase tracking-widest bg-card/40">
                <Calendar className="w-3.5 h-3.5 mr-2" />
                Scheduler
             </Button>
             <Button size="sm" className="rounded-full px-6 h-10 font-black uppercase text-[11px] tracking-widest shadow-xl shadow-primary/20">
                <Plus className="w-3.5 h-3.5 mr-2" />
                Initialize Build
             </Button>
          </div>
        </div>
      </FadeIn>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
           {/* Main Column */}
           <div className={cn("col-span-1 space-y-8 transition-all duration-500", selectedReport ? "lg:col-span-8" : "lg:col-span-12")}>
              {/* Analytics Summary */}
              {!selectedReport && (
                <StaggerContainer className="grid grid-cols-1 md:grid-cols-4 gap-4" delayChildren={0.2} staggerChildren={0.1}>
                   {[
                     { label: 'Fleet Capacity', value: reportsData.length, icon: Layers, color: 'text-primary' },
                     { label: 'Pending Sync', value: '2 Units', icon: Clock, color: 'text-amber-500' },
                     { label: 'Data Latency', value: '1.2ms', icon: Sparkles, color: 'text-emerald-500' },
                     { label: 'Uptime', value: '99.99%', icon: BarChart3, color: 'text-indigo-500' }
                   ].map((kpi, idx) => (
                     <StaggerItem key={idx}>
                        <div className="glass-card rounded-2xl p-5 bg-card/30 border border-border/40 flex items-center gap-4">
                           <div className={cn("p-2.5 rounded-xl bg-secondary/50", kpi.color)}>
                              <kpi.icon className="w-5 h-5" />
                           </div>
                           <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.label}</p>
                              <p className="text-xl font-black text-foreground tabular-nums">{kpi.value}</p>
                           </div>
                        </div>
                     </StaggerItem>
                   ))}
                </StaggerContainer>
              )}

              {/* Filtering Controls */}
              <div className="flex items-center gap-4 bg-card/40 p-3 rounded-2xl border border-border/40 backdrop-blur-md">
                 <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    <Input 
                      placeholder="Search repositories..." 
                      className="pl-12 h-11 bg-background/50 border-none rounded-xl text-[14px] font-bold shadow-inner placeholder:italic placeholder:font-medium" 
                      value={globalFilter}
                      onChange={e => setGlobalFilter(e.target.value)}
                    />
                 </div>
                 <div className="hidden md:flex ml-auto items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-muted-foreground/40 italic pr-2">Engine Filter:</span>
                    <Button variant="ghost" size="sm" className="h-8 rounded-full text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">All Sources</Button>
                    <Button variant="ghost" size="sm" className="h-8 rounded-full text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Executive</Button>
                 </div>
              </div>

              {/* Table Body */}
              <div className="glass-card rounded-[40px] overflow-hidden shadow-2xl border border-border/40 bg-card/5 backdrop-blur-xl">
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
                              layoutId={row.id}
                              onClick={() => setSelectedReportId(selectedReportId === row.original.id ? null : row.original.id)}
                              className={cn(
                                "group transition-all cursor-pointer border-r-4",
                                selectedReportId === row.original.id ? "bg-primary/10 border-primary" : "hover:bg-primary/5 border-transparent"
                              )}
                            >
                               {row.getVisibleCells().map(cell => (
                                 <td key={cell.id} className="px-8 py-5 border-b border-border/10 border-r border-border/10 last:border-r-0">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                 </td>
                               ))}
                            </motion.tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>

           {/* Inspection Panel */}
           <AnimatePresence>
              {selectedReport && (
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="lg:col-span-4 sticky top-32 space-y-6"
                >
                   <div className="glass-card rounded-[40px] p-8 bg-card/40 border border-border/40 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-5">
                         <Sparkles className="w-32 h-32 text-primary" />
                      </div>
                      
                      <div className="flex items-center gap-4 mb-8">
                         <div className="p-4 rounded-3xl bg-primary/10 text-primary border border-primary/20 shadow-lg">
                            <FileText className="w-7 h-7" />
                         </div>
                         <div>
                            <h3 className="text-lg font-black text-foreground tracking-tighter uppercase leading-none">{selectedReport.name}</h3>
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Node ID: {selectedReport.id}</span>
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-8">
                         <div className="bg-secondary/30 p-4 rounded-2xl border border-border/20">
                            <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Generated</p>
                            <p className="text-[12px] font-bold text-foreground font-mono">{selectedReport.lastGenerated}</p>
                         </div>
                         <div className="bg-secondary/30 p-4 rounded-2xl border border-border/20">
                            <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Payload Size</p>
                            <p className="text-[12px] font-bold text-foreground font-mono">{selectedReport.size}</p>
                         </div>
                      </div>

                      <div className="space-y-4 mb-10">
                         <div className="flex justify-between items-center px-2">
                            <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">Entity Cluster</span>
                            <span className="text-[12px] font-bold text-foreground italic">{selectedReport.department}</span>
                         </div>
                         <div className="flex justify-between items-center px-2">
                            <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">Sync Frequency</span>
                            <span className="text-[12px] font-bold text-foreground italic">{selectedReport.frequency}</span>
                         </div>
                         <div className="flex justify-between items-center px-2">
                            <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">Node Integrity</span>
                            <span className="text-[11px] font-black text-emerald-500 uppercase flex items-center gap-2">
                               Verified <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            </span>
                         </div>
                      </div>

                      <div className="flex gap-4">
                         <Button className="flex-1 rounded-full h-12 font-black uppercase text-[11px] tracking-widest shadow-xl shadow-primary/20">
                            <ArrowUpRight className="w-4 h-4 mr-2" />
                            Open View
                         </Button>
                         <Button variant="outline" size="icon" className="w-12 h-12 rounded-full border-border/50">
                            <Download className="w-4 h-4" />
                         </Button>
                      </div>
                   </div>

                   {/* Latency Projection */}
                   <div className="glass-card rounded-[40px] p-8 bg-card/20 border border-border/40 shadow-xl">
                      <div className="flex items-center justify-between mb-8">
                         <div>
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-foreground">Synthesis Latency</h4>
                            <p className="text-[10px] text-muted-foreground font-medium italic">Execution cycles per kernel</p>
                         </div>
                         <BarChart3 className="w-5 h-5 text-muted-foreground/30" />
                      </div>
                      <div className="h-[120px]">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={generationTimeData} margin={{ top: 0, right: 0, left: -40, bottom: 0 }}>
                               <Bar dataKey="time" radius={[4, 4, 0, 0]} barSize={20}>
                                  {generationTimeData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 2 ? '#3b82f6' : '#94a3b8'} fillOpacity={0.4} />
                                  ))}
                               </Bar>
                            </BarChart>
                         </ResponsiveContainer>
                      </div>
                   </div>
                </motion.div>
              )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
