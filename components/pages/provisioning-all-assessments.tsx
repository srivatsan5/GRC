'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, ArrowRight, Loader2, Trash2, Search, Sparkles } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table'
import { oracleService } from '@/lib/oracleService'
import { toast } from 'sonner'
import { recordAudit } from '@/lib/auditLog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const assessmentSchema = z.object({
  assessment_code: z.string(),
  department: z.string().min(1, 'Required'),
  estimated_start_date: z.string().min(1, 'Required'),
  estimated_end_date: z.string().min(1, 'Required'),
  status: z.string().min(1, 'Required'),
  risk_champion: z.string().min(2, 'Required'),
})

type AssessmentFormValues = z.infer<typeof assessmentSchema>

const DEPARTMENTS = ['Finance & Treasury', 'Information Technology', 'Operations & Logistics', 'Legal & Compliance', 'Human Resources', 'Internal Audit', 'Risk Management']

const STARTER_PACKS = {
  fintech: {
    label: 'Fintech & Banking Starter Pack',
    items: [
      { code: 'RCSA-FIN-2026-001', dept: 'Finance & Treasury', champ: 'Priya Sharma', start: '2026-01-01', end: '2026-03-31', status: 'In Progress' },
      { code: 'RCSA-AML-2026-002', dept: 'Legal & Compliance', champ: 'Lin Wei', start: '2026-01-15', end: '2026-04-15', status: 'In Progress' },
      { code: 'RCSA-PAY-2026-003', dept: 'Information Technology', champ: 'Anthony Muller', start: '2026-02-01', end: '2026-05-01', status: 'In Progress' },
    ]
  },
  saas: {
    label: 'Tech / SaaS Cloud Security Pack',
    items: [
      { code: 'RCSA-SOC2-2026-101', dept: 'Information Technology', champ: 'Anthony Muller', start: '2026-01-01', end: '2026-03-31', status: 'In Progress' },
      { code: 'RCSA-GDPR-2026-102', dept: 'Legal & Compliance', champ: 'Lin Wei', start: '2026-02-01', end: '2026-05-01', status: 'In Progress' },
      { code: 'RCSA-AWS-2026-103', dept: 'Operations & Logistics', champ: 'Priya Sharma', start: '2026-03-01', end: '2026-06-30', status: 'In Progress' },
    ]
  },
  healthcare: {
    label: 'Healthcare & HIPAA Compliance Pack',
    items: [
      { code: 'RCSA-HIPAA-2026-201', dept: 'Legal & Compliance', champ: 'Lin Wei', start: '2026-01-01', end: '2026-04-30', status: 'In Progress' },
      { code: 'RCSA-EHR-2026-202', dept: 'Information Technology', champ: 'Anthony Muller', start: '2026-02-01', end: '2026-05-30', status: 'In Progress' },
    ]
  }
}

function safeCode(code: string | undefined, fallbackId: string) {
  if (!code) return `RCSA-${fallbackId.slice(0, 6).toUpperCase()}`
  if (/^-\d{4}-\d+$/.test(code)) return `RCSA-DEFAULT${code}`
  return code
}

export function ProvisioningAllAssessmentsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ['assessments-list'],
    queryFn: () => oracleService.getIdentifyRisks(),
  })

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: {
      assessment_code: '',
      department: '',
      estimated_start_date: '',
      estimated_end_date: '',
      status: 'In Progress',
      risk_champion: '',
    }
  })

  const watchDepartment = watch('department')

  React.useEffect(() => {
    const deptCode = (watchDepartment || '').split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 3) || 'GEN'
    const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '')
    const seq = Math.floor(100 + Math.random() * 900)
    setValue('assessment_code', `RCSA-${deptCode}-${yyyymm}-${seq}`)
  }, [watchDepartment, setValue])

  const createMutation = useMutation({
    mutationFn: (data: any) => oracleService.createIdentifyRisk({
      assessment_reference_number: data.assessment_code,
      process_name: data.department,
      start_date: new Date(data.estimated_start_date).toISOString(),
      end_date: new Date(data.estimated_end_date).toISOString(),
      risk_statement: `RCSA assessment cycle for ${data.department}`,
      assessment_registered_date: new Date().toISOString(),
      is_stage_complted: data.status === 'Completed' ? 'Y' : 'N',
      status: 'Y',
      risk_champion: data.risk_champion,
      approval_status: 'DRAFT',
    }),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['assessments-list'] })
      recordAudit({ action: 'CREATE', entity: 'Assessment', entity_id: result?.uuid || result?.id, description: `Created RCSA cycle for ${watch('department')}`, after: result, result: 'SUCCESS' })
      toast.success('Assessment created')
      setIsDialogOpen(false)
      reset()
    },
    onError: (err: any) => {
      toast.error(`Failed to create assessment: ${err.message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => oracleService.deleteIdentifyRisk(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['assessments-list'] })
      recordAudit({ action: 'DELETE', entity: 'Assessment', entity_id: id, description: `Deleted assessment ${id}`, result: 'SUCCESS' })
      toast.success('Assessment deleted')
    },
    onError: (err: any) => {
      toast.error(`Failed to delete: ${err.message}`)
    },
  })

  const handleDelete = async (id: string, code: string) => {
    const ok = await confirm({
      title: `Delete ${code}?`,
      description: 'This will remove the assessment entry from the register.',
      confirmLabel: 'Delete assessment',
      tone: 'danger',
    })
    if (!ok) return
    deleteMutation.mutate(id)
  }

  const loadStarterPack = async (packKey: keyof typeof STARTER_PACKS) => {
    const pack = STARTER_PACKS[packKey]
    toast.info(`Seeding ${pack.label}...`)
    for (const item of pack.items) {
      await oracleService.createIdentifyRisk({
        assessment_reference_number: item.code,
        process_name: item.dept,
        start_date: new Date(item.start).toISOString(),
        end_date: new Date(item.end).toISOString(),
        risk_statement: `RCSA cycle for ${item.dept}`,
        assessment_registered_date: new Date().toISOString(),
        is_stage_complted: 'N',
        status: 'Y',
        risk_champion: item.champ,
        approval_status: 'DRAFT',
      })
    }
    queryClient.invalidateQueries({ queryKey: ['assessments-list'] })
    toast.success(`${pack.label} seeded successfully!`)
  }

  const onSubmit = (data: AssessmentFormValues) => {
    createMutation.mutate(data)
  }

  const columnHelper = createColumnHelper<any>()
  const columns = useMemo(() => [
    columnHelper.accessor('assessment_reference_number', {
      header: 'Assessment code',
      cell: info => <span className="font-mono text-xs font-semibold text-slate-800">{safeCode(info.getValue(), String(info.row.original.uuid || ''))}</span>,
    }),
    columnHelper.accessor((row: any) => row.process_name || row.risk_statement || 'General', {
      id: 'department',
      header: 'Department / Scope',
      cell: info => <span className="font-medium text-slate-900">{info.getValue() as string}</span>,
    }),
    columnHelper.accessor('start_date', {
      header: 'Start date',
      cell: info => info.getValue() ? new Date(info.getValue() as string).toLocaleDateString() : '—',
    }),
    columnHelper.accessor('end_date', {
      header: 'End date',
      cell: info => info.getValue() ? new Date(info.getValue() as string).toLocaleDateString() : '—',
    }),
    columnHelper.accessor((row: any) => row.is_stage_complted === 'Y' ? 'Completed' : 'In Progress', {
      id: 'status',
      header: 'Status',
      cell: info => {
        const v = info.getValue() as string
        return (
          <StatusBadge status={v === 'Completed' ? 'completed' : 'in-review'} label={v} />
        )
      },
    }),
    columnHelper.accessor((row: any) => row.risk_champion || row.risk_owner || 'Assessor', {
      id: 'risk_champion',
      header: 'Risk owner',
      cell: info => <span className="text-slate-600">{info.getValue() as string}</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          {hasPermission('delete') && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-50" onClick={() => handleDelete(row.original.uuid, row.original.assessment_reference_number || row.original.uuid)} disabled={deleteMutation.isPending}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-700 hover:text-blue-900 font-medium" onClick={() => router.push(`/rcsa/provisioning/${row.original.uuid || row.original.id}`)}>
            Open &rarr;
          </Button>
        </div>
      ),
    }),
  ], [router, deleteMutation.isPending, hasPermission])

  const table = useReactTable({
    data: assessments,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  return (
    <div className="space-y-6 font-sans">
      {/* Stepper Bar */}
      <div className="bg-white border border-slate-200 rounded p-3 text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">RCSA Lifecycle:</span>
          <span className="font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">01 Setup (Active)</span>
          <span className="text-slate-300">&rarr;</span>
          <span className="text-slate-500 hover:underline cursor-pointer" onClick={() => router.push('/rcsa/identification')}>02 Identification</span>
          <span className="text-slate-300">&rarr;</span>
          <span className="text-slate-500 hover:underline cursor-pointer" onClick={() => router.push('/rcsa/mitigation')}>03 Controls & Mitigation</span>
          <span className="text-slate-300">&rarr;</span>
          <span className="text-slate-500 hover:underline cursor-pointer" onClick={() => router.push('/rcsa/monitoring')}>04 Monitoring</span>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                Demo starter packs
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 text-xs bg-white">
              <DropdownMenuItem onClick={() => loadStarterPack('fintech')} className="cursor-pointer">
                Fintech & Banking Pack
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => loadStarterPack('saas')} className="cursor-pointer">
                SaaS & Tech Security Pack
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => loadStarterPack('healthcare')} className="cursor-pointer">
                Healthcare Compliance Pack
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push('/rcsa/identification')}
            className="text-xs h-7"
          >
            Next Stage: Identify &rarr;
          </Button>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">RCSA Assessment Setup</h1>
          <p className="text-xs text-slate-500">Provision and manage quarterly risk and control self-assessment cycles</p>
        </div>

        {hasPermission('create') && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs bg-blue-900 hover:bg-blue-800 text-white">
                <Plus className="w-3.5 h-3.5 mr-1" />
                New assessment cycle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-white border-slate-200 rounded-lg p-5 space-y-4 text-xs">
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold text-slate-900">Provision Assessment Cycle</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Assessment reference code</label>
                  <Input {...register('assessment_code')} disabled className="h-8 text-xs font-mono bg-slate-50" />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Department *</label>
                  <select {...register('department')} className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white">
                    <option value="">Select department...</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {errors.department && <span className="text-[11px] text-red-600">{errors.department.message}</span>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Start date *</label>
                    <Input type="date" {...register('estimated_start_date')} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">End date *</label>
                    <Input type="date" {...register('estimated_end_date')} className="h-8 text-xs" />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Risk owner / Champion *</label>
                  <Input {...register('risk_champion')} placeholder="e.g. Priya Sharma" className="h-8 text-xs" />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Provisioning...' : 'Create cycle'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filter Row */}
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="Search assessments..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="pl-8 h-8 text-xs bg-white"
          />
        </div>
        <span className="text-xs text-slate-500">{assessments.length} assessment cycles</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <table className="enterprise-table">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                  <p className="text-xs">Loading assessments...</p>
                </td>
              </tr>
            ) : assessments.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                  No assessments provisioned. Use &quot;New assessment cycle&quot; or select a &quot;Demo starter pack&quot;.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
