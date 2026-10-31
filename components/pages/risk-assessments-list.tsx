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
  Filter,
  User,
  ChevronRight,
  CheckCircle2
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { cn } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const provisionSchema = z.object({
  assessment_code: z.string(),
  department: z.string().min(1, 'Required'),
  start_date: z.string().min(1, 'Required'),
  end_date: z.string().min(1, 'Required'),
  status: z.string().min(1, 'Required'),
  assigned_to: z.string().min(1, 'Required'),
})

type ProvisionFormValues = z.infer<typeof provisionSchema>

export function RiskAssessmentsListPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [globalFilter, setGlobalFilter] = useState('')
  const [selectedRisk, setSelectedRisk] = useState<any>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | number | null>(null)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ProvisionFormValues>({
    resolver: zodResolver(provisionSchema),
    defaultValues: {
      assessment_code: '',
      department: 'Corporate Risk Management',
      status: 'Draft / Planning',
      assigned_to: 'Subha',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    }
  })

  const watchDept = watch('department')

  React.useEffect(() => {
    const deptCode = (watchDept || '').split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 3)
    const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '')
    const seq = Math.floor(100 + Math.random() * 900)
    setValue('assessment_code', `RCSA-${deptCode}-${yyyymm}-${seq}`)
  }, [watchDept, setValue])

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

  const provisionMutation = useMutation({
    mutationFn: async (data: ProvisionFormValues) => {
      const payload = {
        process_name: data.department,
        risk_statement: `RCSA: ${data.department}`,
        assessment_reference_number: data.assessment_code,
        start_date: new Date(data.start_date).toISOString(),
        end_date: new Date(data.end_date).toISOString(),
        assessment_registered_date: new Date().toISOString(),
        hierarchy_level: 3,
        is_stage_complted: 'N',
        status: 'N',
        risk_champion: data.assigned_to,
        approval_status: 'DRAFT',
      }
      return oracleService.createRiskAssessment(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments-list'] })
      toast.success("Assessment provisioned successfully")
      setIsOpen(false)
      reset()
    },
    onError: (err: any) => {
      const dbError = err.response?.data?.message || err.response?.data?.title || err.message || 'Database error'
      toast.error(`Provisioning failed: ${dbError}`, {
        duration: 5000,
        description: 'Unable to save assessment. Please check network connection.'
      })
    }
  })

  const onProvision = (data: ProvisionFormValues) => {
    provisionMutation.mutate(data)
  }

  const handleDelete = (risk: any) => {
    const id = risk.uuid || risk.id
    if (!id) return
    if (window.confirm(`Permanently delete "${risk.hierarchy_name || 'this risk'}"?`)) {
      setPendingDeleteId(id)
      deleteMutation.mutate(id, {
        onSettled: () => setPendingDeleteId(null)
      })
    }
  }

  // 3. Columns
  const columnHelper = createColumnHelper<any>()
  const columns = useMemo(() => [
    columnHelper.accessor('risk_statement', {
      header: 'Risk Identifier',
      cell: info => (
        <div className="flex flex-col">
          <span className="font-bold text-foreground tracking-tight">
            {info.getValue() || info.row.original.assessment_reference_number || info.row.original.risk_name || 'ID: ' + (String(info.row.original.uuid || '').slice(0, 8) || 'N/A')}
          </span>
          <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest mt-0.5">
            {info.row.original.risk_type || 'General Risk'}
          </span>
        </div>
      ),
    }),
    columnHelper.accessor('process_name', {
      header: 'Business Unit',
      cell: info => (
        <Badge variant="outline" className="text-[10px] font-black uppercase bg-secondary/30 border-border/50 px-2 py-0.5 rounded-md">
          {info.getValue() || info.row.original.business_process_name || info.row.original.process || 'Corporate'}
        </Badge>
      ),
    }),
    columnHelper.accessor('overall_progress', {
      header: 'Assessment Integrity',
      cell: info => {
        const progress = info.getValue() || (info.row.original.is_stage_completed === 'Y' || info.row.original.is_stage_complted === 'Y' ? 100 : 25)
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
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg"
              onClick={() => handleDelete(row.original)}
              disabled={pendingDeleteId === (row.original.uuid || row.original.id)}
            >
              {pendingDeleteId === (row.original.uuid || row.original.id) ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-[11px] font-black uppercase tracking-widest text-primary border-primary/20 bg-primary/5 hover:bg-primary/10 rounded-lg whitespace-nowrap ml-2 px-4 shadow-[0_0_15px_var(--primary)_inset] shadow-primary/5"
              onClick={() => router.push(`/rcsa/provisioning/${row.original.uuid || row.original.id}`)}
            >
              Details
            </Button>
          </motion.div>
        </div>
      ),
    }),
  ], [router, pendingDeleteId])

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
          <div className="flex items-center gap-2 mb-1">
             <span className="text-[10px] font-black uppercase tracking-widest text-primary">Pericope RCSA</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground uppercase italic">RCSA Provisioning</h1>
          <p className="text-[13px] text-muted-foreground mt-1 font-medium italic opacity-70">Initialize and orchestrate Risk Control Self-Assessment cycles.</p>
        </div>
        <div className="flex items-center gap-3">
           <Dialog open={isOpen} onOpenChange={setIsOpen}>
             <DialogTrigger asChild>
               <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                 <Button 
                   className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 h-10 px-6 rounded-xl"
                 >
                   <Plus className="w-4 h-4 mr-2" />
                   New Assessment
                 </Button>
               </motion.div>
             </DialogTrigger>
             <DialogContent className="max-w-md bg-card border border-border/60 shadow-2xl p-0 overflow-hidden rounded-2xl">
               <div className="h-1.5 w-full bg-primary" />
               <form onSubmit={handleSubmit(onProvision)} className="p-8 space-y-6 text-foreground">
                 <DialogHeader>
                   <DialogTitle className="text-xl font-black tracking-tight uppercase italic">Provision New RCSA</DialogTitle>
                   <DialogDescription className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1">
                     Initialize a new risk assessment cycle for the enterprise.
                   </DialogDescription>
                 </DialogHeader>
                 
                 <div className="space-y-4">
                   <div className="space-y-1.5">
                     <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Assessment Code</label>
                     <Input 
                       readOnly 
                       {...register('assessment_code')} 
                       className="h-10 text-xs font-bold bg-muted/50 border-border/50 rounded-xl text-muted-foreground cursor-not-allowed select-none" 
                     />
                   </div>

                   <div className="space-y-1.5">
                     <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
                       Department / Business Unit
                       {errors.department && <span className="text-destructive lowercase font-bold">Required</span>}
                     </label>
                     <select {...register('department')} className="w-full h-10 px-3 text-xs font-bold bg-secondary/30 border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none appearance-none">
                       <option>Corporate Risk Management</option>
                       <option>Information Security</option>
                       <option>Financial Operations</option>
                       <option>Legal & Compliance</option>
                     </select>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Est. Start Date</label>
                       <Input type="date" {...register('start_date')} className="h-10 text-xs font-bold bg-secondary/30 border-border/50 rounded-xl" />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Est. End Date</label>
                       <Input type="date" {...register('end_date')} className="h-10 text-xs font-bold bg-secondary/30 border-border/50 rounded-xl" />
                     </div>
                   </div>

                   <div className="space-y-1.5">
                     <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Initial Status</label>
                     <select {...register('status')} className="w-full h-10 px-3 text-xs font-bold bg-secondary/30 border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none appearance-none">
                       <option>Draft / Planning</option>
                       <option>Identification Phase</option>
                       <option>Active Analysis</option>
                     </select>
                   </div>

                   <div className="space-y-1.5">
                     <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex justify-between">
                       Risk Champion
                       {errors.assigned_to && <span className="text-destructive lowercase font-bold">Required</span>}
                     </label>
                     <div className="relative">
                       <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground opacity-50" />
                       <Input {...register('assigned_to')} placeholder="Search user directory..." className="pl-9 h-10 text-xs font-bold bg-secondary/30 border-border/50 rounded-xl" />
                     </div>
                   </div>
                 </div>

                 <div className="flex justify-end gap-3 pt-4">
                   <Button type="button" variant="ghost" className="text-xs font-black uppercase tracking-widest rounded-xl px-6 h-10" onClick={() => setIsOpen(false)}>Cancel</Button>
                   <Button 
                     type="submit"
                     className="bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest rounded-xl px-8 h-10 shadow-lg shadow-primary/20"
                     disabled={provisionMutation.isPending}
                   >
                     {provisionMutation.isPending ? (
                       <Loader2 className="w-4 h-4 animate-spin" />
                     ) : (
                       'Provision'
                     )}
                   </Button>
                 </div>
               </form>
             </DialogContent>
           </Dialog>
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
                  if (selectedRisk?.id || selectedRisk?.uuid) {
                    router.push(`/risk-identification?assessmentId=${selectedRisk.uuid || selectedRisk.id}`)
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
