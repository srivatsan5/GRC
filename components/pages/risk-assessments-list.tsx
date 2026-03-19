'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  Trash2, 
  ArrowRight, 
  Loader2, 
  CheckSquare, 
  AlertCircle,
  X,
  FileText,
  Activity,
  ArrowUpRight,
  Filter
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'
import { oracleService } from '@/lib/oracleService'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { cn } from '@/lib/utils'

export function RiskassessmentslistPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [globalFilter, setGlobalFilter] = useState('')
  const [selectedRisk, setSelectedRisk] = useState<any>(null)

  // 1. Data Fetching
  const { data: assessments = [], isLoading, isError, error } = useQuery({
    queryKey: ['assessments-list'],
    queryFn: async () => {
      try {
        return await oracleService.getRiskAssessmentsList()
      } catch (e) {
        console.warn("Recoverable fetch error:", e)
        return []
      }
    },
    retry: 1
  })

  // 2. Mutations
  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => oracleService.deleteIdentifyRisk(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments-list'] })
      toast.success("Risk record purged successfully")
    },
    onError: (err: any) => {
      toast.error(`Purge failed: ${err.message}`)
    }
  })

  const handleDelete = (risk: any) => {
    const id = risk.uuid || risk.id
    if (!id) return
    if (window.confirm(`Permanently delete "${risk.hierarchy_name || 'this risk'}"?`)) {
      deleteMutation.mutate(id)
    }
  }

  // 3. Columns
  const columnHelper = createColumnHelper<any>()
  const columns = useMemo(() => [
    columnHelper.accessor('hierarchy_name', {
      header: 'Risk Identifier',
      cell: info => (
        <div className="flex flex-col">
          <span className="font-bold text-foreground tracking-tight">
            {info.getValue() || info.row.original.risk_name || 'ID: ' + (String(info.row.original.uuid || '').slice(0, 8) || 'N/A')}
          </span>
          <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest mt-0.5">
            {info.row.original.risk_category || 'General Risk'}
          </span>
        </div>
      ),
    }),
    columnHelper.accessor('process_name', {
      header: 'Business Unit',
      cell: info => (
        <Badge variant="outline" className="text-[10px] font-black uppercase bg-secondary/30 border-border/50 px-2 py-0.5 rounded-md">
          {info.getValue() || 'Corporate'}
        </Badge>
      ),
    }),
    columnHelper.accessor('overall_progress', {
      header: 'Assessment Integrity',
      cell: info => {
        const progress = info.getValue() || (info.row.original.is_stage_completed === 'Y' ? 100 : 25)
        return (
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-16 bg-secondary rounded-full overflow-hidden flex-shrink-0">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${progress}%` }}
                 className="h-full bg-primary"
               />
            </div>
            <span className="text-[11px] font-bold tabular-nums text-muted-foreground">{progress}%</span>
          </div>
        )
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg"
            onClick={() => handleDelete(row.original)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-primary hover:bg-primary/5 rounded-lg"
            onClick={() => setSelectedRisk(row.original)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      ),
    }),
  ], [])

  const table = useReactTable({
    data: assessments,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Risk Identification</h1>
          <p className="text-sm text-muted-foreground mt-1">Centralized risk ledger and classification engine.</p>
        </div>
        <div className="flex items-center gap-3">
           <Button 
             onClick={() => router.push('/risk-planning/identify')} 
             className="bg-primary text-primary-foreground text-sm font-medium shadow-sm h-9 px-4 rounded-lg"
           >
             <Plus className="w-4 h-4 mr-2" />
             New Risk
           </Button>
        </div>
      </div>

      {/* Utility Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground opacity-50" />
          <Input
            placeholder="Search risk ledger..."
            className="pl-9 bg-card border-border/50 text-sm h-9 rounded-lg focus-visible:ring-1 focus-visible:ring-primary/20"
            value={globalFilter ?? ''}
            onChange={e => setGlobalFilter(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" className="h-9 px-3 border-border/50 bg-card/50 text-xs font-bold uppercase tracking-tight">
             <Filter className="w-3.5 h-3.5 mr-2 opacity-50" />
             Filters
           </Button>
           <div className="h-4 w-px bg-border/50 mx-1" />
           <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-2">
             {assessments.length} Records
           </span>
        </div>
      </div>

      {/* Table Content */}
      <div className="bg-card border border-border rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-24 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 border-b border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id} className="p-4 font-black">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border">
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="group hover:bg-muted/20 transition-colors">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="p-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {assessments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-muted-foreground italic opacity-40">
                      Risk ledger is currently empty.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Details Modal */}
      <Dialog open={!!selectedRisk} onOpenChange={() => setSelectedRisk(null)}>
        <DialogContent className="max-w-xl bg-card border border-border shadow-2xl p-0 overflow-hidden rounded-xl">
          <div className="h-1.5 w-full bg-primary" />
          <div className="p-6 space-y-6">
            <DialogHeader className="flex flex-row items-start justify-between">
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight">Risk Intelligence</DialogTitle>
                <DialogDescription className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1">
                  Reference: {String(selectedRisk?.uuid || '').slice(0, 16) || 'N/A'}
                </DialogDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-black bg-primary/5 text-primary border-primary/20">
                {selectedRisk?.is_stage_completed === 'Y' ? 'Verified' : 'In Review'}
              </Badge>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/20 rounded-lg border border-border/50">
                <span className="text-[9px] font-black uppercase text-muted-foreground block mb-2 tracking-widest">Business Owner</span>
                <span className="text-xs font-bold">{selectedRisk?.process_name || 'Unassigned'}</span>
              </div>
              <div className="p-4 bg-muted/20 rounded-lg border border-border/50">
                <span className="text-[9px] font-black uppercase text-muted-foreground block mb-2 tracking-widest">Process Level</span>
                <span className="text-xs font-bold">{selectedRisk?.sub_process_name || 'Root'}</span>
              </div>
            </div>

            <div className="p-4 bg-muted/20 rounded-lg border border-border/50">
              <span className="text-[9px] font-black uppercase text-muted-foreground block mb-2 tracking-widest">Risk Statement</span>
              <p className="text-xs text-foreground/80 leading-relaxed font-medium">
                {selectedRisk?.risk_statement || selectedRisk?.description || 'No detailed statement provided for this record.'}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" size="sm" className="text-xs font-bold rounded-lg" onClick={() => setSelectedRisk(null)}>
                Close
              </Button>
              <Button 
                size="sm" 
                className="text-xs font-bold rounded-lg bg-primary shadow-lg shadow-primary/20"
                onClick={() => {
                  if (selectedRisk?.id) {
                    router.push(`/assessments/inherent?riskId=${selectedRisk.id}`)
                  }
                }}
              >
                Open Full Analysis
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ChevronRight(props: any) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6"/>
    </svg>
  )
}
