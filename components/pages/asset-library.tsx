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
  File, 
  Folder, 
  Download, 
  ChevronRight, 
  Loader2, 
  Archive,
  HardDrive,
  Clock,
  LayoutGrid,
  List,
  ChevronLeft
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { oracleService } from '@/lib/oracleService'
import { cn } from '@/lib/utils'

const assetCategories = [
  { id: 1, name: 'Risk Templates', description: 'Pre-defined identification matrices', color: '#3b82f6' },
  { id: 2, name: 'Assessment Frameworks', description: 'COSO, ISO/NIST methodologies', color: '#8b5cf6' },
  { id: 3, name: 'Mitigation Playbooks', description: 'Response procedures and manuals', color: '#10b981' },
  { id: 4, name: 'Policy Documents', description: 'Governance and mandate binders', color: '#f59e0b' },
  { id: 5, name: 'Training Materials', description: 'Awareness and mastery kits', color: '#06b6d4' },
  { id: 6, name: 'Compliance Checklists', description: 'Audit and validation protocols', color: '#ec4899' },
]

export function AssetLibraryPage() {
  const [globalFilter, setGlobalFilter] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // 1. Data Fetching
  const { data: assetLibrary = [], isLoading } = useQuery({
    queryKey: ['asset-library'],
    queryFn: () => oracleService.getAssets(),
  })

  // 2. Computed
  const filteredAssets = useMemo(() => {
    return assetLibrary.filter((a: any) => !selectedCategory || a.category === selectedCategory)
  }, [assetLibrary, selectedCategory])

  // 3. Columns
  const columnHelper = createColumnHelper<any>()
  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Identified Resource',
      cell: info => (
        <div className="flex items-center gap-3">
           <div className="p-2 rounded-lg bg-secondary/50 group-hover:bg-primary/10 transition-colors">
              <File className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
           </div>
           <span className="font-bold text-foreground text-[13px] tracking-tight">{info.row.original.business_process_name || info.getValue() || 'Unnamed Asset'}</span>
        </div>
      ),
    }),
    columnHelper.accessor('category', {
      header: 'Cluster',
      cell: () => <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Business Process</span>,
    }),
    columnHelper.accessor('type', {
      header: 'Protocol',
      cell: () => <span className="font-mono text-[11px] font-bold text-primary/80">DOC</span>,
    }),
    columnHelper.accessor('size', {
      header: 'Payload',
      cell: () => <span className="font-mono text-[11px] text-muted-foreground tabular-nums">1.2 MB</span>,
    }),
    columnHelper.accessor('modified', {
      header: 'Revision',
      cell: () => <span className="text-[11px] font-medium text-muted-foreground tabular-nums">2026-05-18</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Fetch',
      cell: () => (
        <button className="p-1.5 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground/40 hover:text-foreground">
           <Download className="w-4 h-4" />
        </button>
      )
    })
  ], [])

  // 4. Table instance
  const table = useReactTable({
    data: filteredAssets,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
  })

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        <p className="text-xs text-slate-500 mt-3">Loading assets...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 pb-20 bg-background/20 font-sans">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/40 px-6 py-6 bg-background/60 backdrop-blur-xl sticky top-0 z-40 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-4">
             {selectedCategory && (
               <Button variant="ghost" size="icon" onClick={() => setSelectedCategory(null)} className="rounded-full hover:bg-secondary">
                  <ChevronLeft className="w-5 h-5" />
               </Button>
             )}
             <div>
               <h1 className="text-xl font-black text-foreground tracking-tighter uppercase italic">Resource Bank</h1>
               <p className="text-[12px] text-muted-foreground mt-1 font-medium italic opacity-70">Centralized repository for methodologies and compliance assets</p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <Button size="sm" className="rounded-full px-6 h-10 font-black uppercase text-[11px] tracking-widest shadow-xl shadow-primary/20">
                <Plus className="w-3.5 h-3.5 mr-2" />
                Ingest Resource
             </Button>
          </div>
        </div>
      </FadeIn>

      <div className="p-8">
        <AnimatePresence mode="wait">
          {!selectedCategory ? (
            <motion.div
              key="explorer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                 {assetCategories.map((cat, idx) => {
                   const count = assetLibrary.filter((a: any) => a.category === cat.name).length
                   return (
                     <motion.div
                       key={cat.id}
                       whileHover={{ y: -6, boxShadow: '0 25px 30px -10px rgba(0,0,0,0.1)' }}
                       onClick={() => setSelectedCategory(cat.name)}
                       className="glass-card rounded-3xl p-7 bg-card/40 border border-border/40 cursor-pointer group relative overflow-hidden"
                     >
                        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-20" style={{ backgroundColor: cat.color }} />
                        <div className="flex items-start justify-between mb-6">
                           <div className="p-3 rounded-2xl bg-secondary/50 border border-border/40 shadow-sm" style={{ color: cat.color }}>
                              <Folder className="w-6 h-6" />
                           </div>
                           <span className="text-[10px] font-black bg-secondary/80 px-3 py-1 rounded-full border border-border/40 tabular-nums">{count} Nodes</span>
                        </div>
                        <h3 className="text-[15px] font-black text-foreground tracking-tight mb-2 uppercase group-hover:text-primary transition-colors">{cat.name}</h3>
                        <p className="text-[11px] font-medium text-muted-foreground leading-relaxed italic opacity-70">{cat.description}</p>
                     </motion.div>
                   )
                 })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="table-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
               <div className="flex flex-col md:flex-row gap-4 bg-card/30 p-3 rounded-2xl border border-border/40 backdrop-blur-md">
                  <div className="relative flex-1 max-w-sm ml-2">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                     <Input 
                       placeholder="Filter resources..." 
                       className="pl-12 h-11 bg-background/50 border-none rounded-xl text-[14px] font-bold shadow-inner placeholder:font-medium placeholder:italic" 
                       value={globalFilter}
                       onChange={e => setGlobalFilter(e.target.value)}
                     />
                  </div>
                  <div className="flex items-center gap-2 bg-secondary/30 px-5 rounded-xl border border-border/20">
                     <span className="text-[10px] font-black uppercase text-muted-foreground">Cluster:</span>
                     <span className="text-[11px] font-black text-primary">{selectedCategory}</span>
                  </div>
               </div>

               <div className="glass-card rounded-[40px] overflow-hidden shadow-2xl border border-border/40 bg-card/5 backdrop-blur-xl flex flex-col h-full min-h-[500px]">
                  <div className="overflow-x-auto flex-1">
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
                           {filteredAssets.length === 0 && (
                             <tr>
                               <td colSpan={columns.length} className="py-40 text-center">
                                  <Archive className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
                                  <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground italic opacity-50">Cluster contains zero payloads</p>
                               </td>
                             </tr>
                           )}
                        </tbody>
                     </table>
                  </div>

                  <div className="bg-secondary/40 px-10 py-5 border-t border-border/40 flex items-center justify-between">
                     <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                           <HardDrive className="w-4 h-4 text-primary/60" />
                           <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Storage Matrix Online</span>
                        </div>
                        <div className="w-px h-4 bg-border/40" />
                        <span className="text-[11px] font-bold text-foreground">{filteredAssets.length} Resource Payloads</span>
                     </div>
                     <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground italic">Authenticated Access Guaranteed</span>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
