'use client'

import React, { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { 
  Plus, 
  Search, 
  MoreVertical, 
  ChevronUp, 
  ChevronDown, 
  ChevronsUpDown, 
  Loader2, 
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn } from '@/components/ui/fade-in'
import { oracleService } from '@/lib/oracleService'
import { cn } from '@/lib/utils'

const severityColors: Record<string, string> = { 
  Critical: '#ef4444', 
  High: '#f59e0b', 
  Medium: '#eab308', 
  Low: '#22c55e' 
}

const statusColors: Record<string, string> = { 
  New: '#3b82f6', 
  'Under Review': '#a78bfa', 
  Identified: '#71717a', 
  'In Progress': '#f59e0b' 
}

export function RiskIdentificationPage() {
  const router = useRouter()
  const [globalFilter, setGlobalFilter] = React.useState('')

  // 1. Data Fetching with React Query
  const { data: risks = [], isLoading, isError, error } = useQuery({
    queryKey: ['risks'],
    queryFn: () => oracleService.getIdentifyRisks(),
  })

  // 2. Column Definitions
  const columnHelper = createColumnHelper<any>()
  
  const columns = useMemo(() => [
    columnHelper.accessor('uuid', {
      header: 'ID',
      cell: info => <span className="font-mono text-[12px] font-bold text-muted-foreground">{info.getValue()}</span>,
    }),
    columnHelper.accessor('hierarchy_name', {
      header: ({ column }) => (
        <button className="flex items-center gap-1.5 hover:text-foreground transition-colors" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Risk Name {column.getIsSorted() === 'asc' ? <ChevronUp className="w-3 h-3"/> : column.getIsSorted() === 'desc' ? <ChevronDown className="w-3 h-3"/> : <ChevronsUpDown className="w-3 h-3 opacity-40"/>}
        </button>
      ),
      cell: info => <span className="font-semibold text-foreground">{info.getValue() || info.row.original.risk_statement || 'N/A'}</span>,
    }),
    columnHelper.accessor('risk_type', {
      header: 'Category',
      cell: info => <span className="font-medium text-muted-foreground">{info.getValue() || 'General'}</span>,
    }),
    columnHelper.accessor('assessor', {
      header: 'Owner',
      cell: info => <span className="font-medium text-muted-foreground">{info.getValue() || 'Unassigned'}</span>,
    }),
    columnHelper.accessor('inherent_sle', {
      header: 'Severity',
      cell: info => {
        const value = info.getValue() || 0
        const label = value > 50000 ? 'Critical' : value > 10000 ? 'High' : 'Medium'
        const color = severityColors[label]
        return (
          <span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }} />
            <span style={{ color }} className="text-[12px] font-bold">{label}</span>
          </span>
        )
      },
    }),
    columnHelper.accessor('is_stage_complted', {
      header: 'Status',
      cell: info => {
        const status = info.getValue() === 'Y' ? 'Identified' : 'New'
        const color = statusColors[status]
        return (
          <span
            className="inline-block px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: `${color}15`, color: color }}
          >
            {status}
          </span>
        )
      },
    }),
    columnHelper.accessor('assessment_registered_date', {
      header: 'Identified',
      cell: info => <span className="font-medium text-muted-foreground tabular-nums">{info.getValue()?.split('T')[0] || 'N/A'}</span>,
    }),
    columnHelper.display({
      id: 'actions',
      cell: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 hover:bg-card border border-transparent hover:border-border/50 hover:shadow-sm rounded transition-all opacity-0 group-hover:opacity-100">
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-xl border-border/50">
            <DropdownMenuItem className="text-[13px] font-medium cursor-pointer">View Details</DropdownMenuItem>
            <DropdownMenuItem className="text-[13px] font-medium cursor-pointer">Edit Risk</DropdownMenuItem>
            <DropdownMenuItem className="text-[13px] font-medium cursor-pointer">Start Assessment</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    }),
  ], [])

  // 3. Table Instance
  const table = useReactTable({
    data: risks,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const value = row.getValue(columnId)
      return String(value || '').toLowerCase().includes(String(filterValue).toLowerCase())
    },
  })

  return (
    <div className="flex-1 pb-10">
      {/* Page Header */}
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/50 px-6 py-5 bg-background/50 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">Risk Identification</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">Catalog and classify enterprise risks by source, category, and severity</p>
          </div>
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button size="sm" onClick={() => router.push('/risk-planning/identify')} className="gap-1.5 h-8 text-xs shadow-[var(--shadow-md)]">
              <Plus className="w-3.5 h-3.5" />
              New Risk
            </Button>
          </motion.div>
        </div>
      </FadeIn>

      <div className="px-6 pt-5">
        {/* Inline stat bar */}
        <FadeIn delay={0.2}>
          <div className="flex items-center gap-6 mb-6 text-sm glass-card rounded-md px-4 py-2 w-max shadow-sm border border-border/50">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground font-medium">Total Risks:</span>
              <span className="font-bold text-foreground tabular-nums">{risks.length}</span>
            </div>
            <div className="w-px h-4 bg-border/50" />
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
              <span className="text-muted-foreground font-medium">Critical:</span>
              <span className="font-bold text-foreground tabular-nums">{risks.filter((r: any) => r.inherent_sle > 50000).length}</span>
            </div>
          </div>
        </FadeIn>

        {/* Search & Utility */}
        <FadeIn delay={0.3}>
          <div className="mb-5 flex justify-between items-center">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search across all fields…"
                className="pl-9 h-9 text-[13px] bg-card border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 transition-all duration-300"
                value={globalFilter ?? ''}
                onChange={e => setGlobalFilter(e.target.value)}
              />
            </div>
          </div>
        </FadeIn>

        {/* Table Content */}
        <FadeIn delay={0.4}>
          <div className="glass-card rounded-xl overflow-hidden shadow-sm border border-border/50">
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="py-24 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-primary/70" />
                  <p className="text-sm font-medium text-muted-foreground animate-pulse">Synchronizing with Oracle ADW...</p>
                </div>
              ) : isError ? (
                <div className="py-24 text-center">
                  <AlertCircle className="w-8 h-8 mx-auto mb-3 text-destructive/70" />
                  <p className="text-sm font-bold text-foreground">Data Synchronization Failed</p>
                  <p className="text-[12px] text-muted-foreground mt-1">{(error as any)?.message || 'Unknown network error'}</p>
                  <Button variant="outline" size="sm" className="mt-4 h-8 text-[11px]" onClick={() => window.location.reload()}>Retry Connection</Button>
                </div>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    {table.getHeaderGroups().map(headerGroup => (
                      <tr key={headerGroup.id} className="bg-secondary/30 border-b border-border/50">
                        {headerGroup.headers.map(header => (
                          <th key={header.id} className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {table.getRowModel().rows.length > 0 ? table.getRowModel().rows.map(row => (
                        <motion.tr
                          layout="position"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          key={row.id}
                          className="border-b border-border/30 hover:bg-secondary/20 group transition-colors last:border-0 relative"
                        >
                          {row.getVisibleCells().map(cell => (
                            <td key={cell.id} className="px-5 py-4">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </motion.tr>
                      )) : (
                        <tr>
                          <td colSpan={columns.length} className="px-5 py-12 text-center text-muted-foreground text-sm font-medium italic">
                            No records found matching your criteria
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
            </div>
            
            {/* Pagination */}
            {!isLoading && !isError && risks.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border/50 bg-secondary/10">
                <div className="flex items-center gap-4 text-[12px] font-medium text-muted-foreground">
                  <span>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
                  <select
                    className="bg-transparent border-none outline-none cursor-pointer hover:text-foreground"
                    value={table.getState().pagination.pageSize}
                    onChange={e => table.setPageSize(Number(e.target.value))}
                  >
                    {[10, 20, 30, 40, 50].map(pageSize => (
                      <option key={pageSize} value={pageSize}>Show {pageSize}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-3 shadow-sm bg-card hover:bg-secondary transition-all"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-3 shadow-sm bg-card hover:bg-secondary transition-all"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
