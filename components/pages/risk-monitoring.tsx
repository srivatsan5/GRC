'use client'

import React, { useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  Calendar,
  Download,
  Loader2,
  MoreVertical,
  Search,
  ShieldCheck,
  TrendingUp,
  Zap,
  ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { motion } from 'framer-motion'
import { FadeIn } from '@/components/ui/fade-in'
import { oracleService } from '@/lib/oracleService'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { recordAudit } from '@/lib/auditLog'
import { useConfirm } from '@/components/ui/confirm-dialog'

export function RiskMonitoringPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const assessmentId = searchParams.get('assessmentId')
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [globalFilter, setGlobalFilter] = React.useState('')

  const { data: monitoring = [], isLoading: monitoringLoading } = useQuery({
    queryKey: ['risk-monitoring', assessmentId],
    queryFn: () => oracleService.getRiskMonitoring(),
  })

  const { data: controls = [] } = useQuery({
    queryKey: ['monitoring-controls'],
    queryFn: () => oracleService.getControlImplementations(),
  })

  const maxImpact = Math.max(1, ...controls.map((c: any) => Number(c.residual_impact) || 1))
  const maxLikelihood = Math.max(1, ...controls.map((c: any) => Number(c.residual_likelihood) || 1))
  const heatScore = maxImpact * maxLikelihood

  const getRiskColor = (prob: number, impact: number): string => {
    const s = prob * impact
    if (s >= 16) return '#dc2626'
    if (s >= 12) return '#f59e0b'
    if (s >= 8) return '#eab308'
    return '#10b981'
  }

  const archiveMutation = useMutation({
    mutationFn: () => {
      if (!assessmentId) throw new Error('No active assessment selected.')
      return oracleService.updateRiskAssessment(assessmentId, { is_stage_complted: 'Y' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-monitoring'] })
      recordAudit({
        action: 'APPROVE',
        entity: 'Assessment Cycle',
        entity_id: assessmentId || undefined,
        description: 'Finalized and archived assessment cycle',
        result: 'SUCCESS',
      })
      toast.success('Assessment cycle archived.')
    },
    onError: (err: any) => {
      recordAudit({
        action: 'APPROVE',
        entity: 'Assessment Cycle',
        entity_id: assessmentId || undefined,
        description: `Failed to finalize: ${err.message}`,
        result: 'FAILURE',
      })
      toast.error(`Archive failed: ${err.message}`)
    },
  })

  const handleFinalize = async () => {
    const ok = await confirm({
      title: 'Finalize assessment cycle?',
      description: 'This will close the cycle for further edits and archive it for audit. You can still view it read-only.',
      confirmLabel: 'Finalize & archive',
      tone: 'warning',
    })
    if (ok) archiveMutation.mutate()
  }

  const columnHelper = createColumnHelper<any>()

  const columns = useMemo(() => [
    columnHelper.accessor('uuid', {
      header: 'Action ID',
      cell: info => <span className="font-mono text-[10px] font-black text-primary/40 uppercase">{(String(info.getValue() || '').slice(0, 8))}</span>,
    }),
    columnHelper.accessor('monitoring_title', {
      header: 'Monitoring Action',
      cell: info => (
        <div className="flex flex-col">
          <span className="font-black text-foreground tracking-tight leading-tight">{info.getValue() || 'Routine Monitoring Check'}</span>
          <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest mt-0.5">{info.row.original.monitoring_goal?.slice(0, 40) || 'Focus: Residual Exposure'}</span>
        </div>
      ),
    }),
    columnHelper.accessor('mitigation_owner', {
      header: 'Owner',
      cell: info => <span className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">{info.getValue() || 'Risk Owner'}</span>,
    }),
    columnHelper.accessor('is_stage_complted', {
      header: 'Status',
      cell: info => {
        const val = info.getValue()
        const isComplete = val === 'Y'
        const isOverdue = !isComplete && info.row.original.estimated_end_date && new Date(info.row.original.estimated_end_date) < new Date()

        return (
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor]',
              isOverdue ? 'bg-red-500 text-red-500' : isComplete ? 'bg-emerald-600 text-emerald-600' : 'bg-blue-500 text-blue-500'
            )} />
            <span className={cn(
              'text-[10px] font-black uppercase tracking-widest',
              isOverdue ? 'text-red-500' : isComplete ? 'text-emerald-600' : 'text-blue-600'
            )}>{isComplete ? 'Completed' : isOverdue ? 'Overdue' : 'In Progress'}</span>
          </div>
        )
      },
    }),
    columnHelper.accessor('estimated_end_date', {
      header: 'Next Review',
      cell: info => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="w-3 h-3" />
          <span className="text-[11px] font-black tracking-tighter uppercase">{info.getValue() ? new Date(info.getValue()).toLocaleDateString() : 'Pending'}</span>
        </div>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-card rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-lg rounded-xl">
              <DropdownMenuItem onClick={() => router.push(`/monitoring/action-plan?actionId=${row.original.uuid || row.original.id}`)} className="text-[11px] font-bold cursor-pointer uppercase tracking-wider text-muted-foreground">
                View Action Plan
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/monitoring/risk-monitoring?actionId=${row.original.uuid || row.original.id}`)} className="text-[11px] font-bold cursor-pointer uppercase tracking-wider text-muted-foreground">
                Update Status
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    }),
  ], [router])

  const table = useReactTable({
    data: monitoring,
    columns,
    state: { globalFilter },
    initialState: { pagination: { pageSize: 5 } },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const handleExport = () => {
    const csv = ['ID,Action,Owner,Status,Next Review']
    monitoring.forEach((m: any) => csv.push([
      m.uuid,
      `"${m.monitoring_title || ''}"`,
      m.mitigation_owner || '',
      m.is_stage_complted === 'Y' ? 'Completed' : 'In Progress',
      m.estimated_end_date || '',
    ].join(',')))
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `monitoring-actions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    recordAudit({ action: 'EXPORT', entity: 'Monitoring Actions', description: `Exported ${monitoring.length} actions to CSV`, result: 'SUCCESS' })
  }

  return (
    <div className="flex-1 pb-10 flex flex-col min-h-screen">
      {/* Header */}
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border px-6 py-6 bg-background/80 backdrop-blur-3xl sticky top-0 z-40 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10 border border-border/50 rounded-xl hover:bg-secondary">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">Control Monitoring</span>
                </div>
                <h1 className="text-2xl font-black tracking-tight text-foreground uppercase">Risk Monitoring</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleExport} className="h-10 text-[11px] font-black uppercase tracking-wider border-border/60 rounded-xl px-5">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={() => router.push('/audit-trail')} className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 h-10 px-6 rounded-xl">
                <Bell className="w-4 h-4 mr-2" />
                Alert Logs
              </Button>
            </div>
          </div>
        </div>
      </FadeIn>

      <div className="px-6 pt-5 space-y-8">
        {/* KPI Grid */}
        {(() => {
          const completed = monitoring.filter((m: any) => m.is_stage_complted === 'Y').length
          const total = monitoring.length || 1
          const healthPct = ((completed / total) * 100).toFixed(1)
          const overdue = monitoring.filter((m: any) => m.is_stage_complted !== 'Y' && m.estimated_end_date && new Date(m.estimated_end_date) < new Date()).length
          const slaPct = total > 0 ? Math.round(((total - overdue) / total) * 100) : 0
          return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <FadeIn delay={0.2} direction="up">
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-8 text-white relative overflow-hidden h-[180px] flex flex-col justify-between group shadow-blue-500/20 shadow-2xl">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <TrendingUp className="w-24 h-24" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary/60 block mb-1">Completion Rate</span>
                    <div className="text-4xl font-black tracking-tighter">{healthPct}%</div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {completed}/{total} Completed
                  </div>
                </div>
              </FadeIn>

              <FadeIn delay={0.3} direction="up">
                <div className="bg-card border border-border rounded-3xl p-8 relative h-[180px] flex flex-col justify-between group overflow-hidden">
                  <BarChart3 className="absolute -bottom-6 -right-6 w-32 h-32 text-primary/5 group-hover:rotate-12 transition-transform duration-700" />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Active Monitoring Actions</span>
                    <div className="text-4xl font-black tracking-tighter text-foreground">{monitoring.length}</div>
                  </div>
                  <div className="text-[9px] font-black uppercase text-primary tracking-widest">Mitigation actions in flight</div>
                </div>
              </FadeIn>

              <FadeIn delay={0.4} direction="up">
                <div className="bg-red-500/5 border border-red-500/10 rounded-3xl p-8 relative h-[180px] flex flex-col justify-between group">
                  <AlertCircle className="absolute -bottom-4 -right-4 w-24 h-24 text-red-500/5 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-600/60 block mb-1">Overdue Items</span>
                    <div className="text-4xl font-black tracking-tighter text-red-600">{overdue.toString().padStart(2, '0')}</div>
                  </div>
                  <div className="text-[9px] font-black uppercase text-red-500 tracking-widest flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-red-500" />
                    {overdue > 0 ? 'Action required' : 'All on track'}
                  </div>
                </div>
              </FadeIn>

              <FadeIn delay={0.5} direction="up">
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-8 relative h-[180px] flex flex-col justify-between group">
                  <ShieldCheck className="absolute -bottom-4 -right-4 w-24 h-24 text-emerald-500/5 transition-transform" />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60 block mb-1">SLA Adherence</span>
                    <div className="text-4xl font-black tracking-tighter text-emerald-600">{slaPct}%</div>
                  </div>
                  <div className="text-[9px] font-black uppercase text-emerald-600 tracking-widest">
                    {slaPct >= 90 ? 'Target met' : 'Below target'}
                  </div>
                </div>
              </FadeIn>
            </div>
          )
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <FadeIn delay={0.6}>
              <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-8 border-b border-border bg-secondary/10 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black tracking-tight uppercase text-foreground leading-none">Action Plan Register</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-2">Live tracking of audit-mandated action items</p>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground opacity-50" />
                    <Input
                      placeholder="Search actions..."
                      className="pl-9 h-9 text-[11px] bg-background border-border shadow-inner rounded-xl"
                      value={globalFilter}
                      onChange={e => setGlobalFilter(e.target.value)}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto flex-1">
                  {monitoringLoading ? (
                    <div className="py-32 text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary/30 mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Loading monitoring records…</p>
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="bg-secondary/20 border-b border-border text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                        {table.getHeaderGroups().map(headerGroup => (
                          <tr key={headerGroup.id}>
                            {headerGroup.headers.map(header => (
                              <th key={header.id} className="px-8 py-5">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {table.getRowModel().rows.map(row => (
                          <motion.tr
                            key={row.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="group hover:bg-primary/5 transition-colors cursor-pointer"
                          >
                            {row.getVisibleCells().map(cell => (
                              <td key={cell.id} className="px-8 py-6">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            ))}
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="p-6 border-t border-border bg-secondary/5 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-50">{monitoring.length} action{monitoring.length === 1 ? '' : 's'} total</span>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-4">
                      Page <span className="text-primary">{table.getState().pagination.pageIndex + 1}</span> of <span className="text-foreground">{table.getPageCount() || 1}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-[9px] font-black tracking-widest uppercase rounded-xl disabled:opacity-30"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-[9px] font-black tracking-widest uppercase rounded-xl disabled:opacity-30"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <FadeIn delay={0.7}>
              <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-6 flex items-center justify-between">
                  <span>Residual Risk Heatmap</span>
                  <span className="text-primary font-bold text-[10px]">Score: {heatScore}</span>
                </h4>
                <div className="flex">
                  <div className="flex flex-col items-center justify-center mr-3 w-4">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground transform -rotate-90 whitespace-nowrap">Impact →</span>
                  </div>
                  <div className="flex-1 w-full">
                    <div className="grid grid-cols-5 gap-1">
                      {Array.from({ length: 5 }).map((_, impactIdx) =>
                        Array.from({ length: 5 }).map((_, probIdx) => {
                          const prob = probIdx + 1
                          const impact = 5 - impactIdx
                          const color = getRiskColor(prob, impact)
                          const isActive = prob === maxLikelihood && impact === maxImpact
                          return (
                            <div
                              key={`${prob}-${impact}`}
                              className={`aspect-square rounded-lg flex items-center justify-center text-[9px] font-black relative transition-all duration-300 ${isActive ? 'ring-2 ring-offset-2 ring-primary scale-110 z-10 shadow-lg' : ''}`}
                              style={{ backgroundColor: color + (isActive ? '40' : '18'), border: `1px solid ${color}30` }}
                            >
                              {isActive && (
                                <div className="w-3 h-3 rounded-full animate-pulse shadow-[0_0_8px_currentColor]" style={{ backgroundColor: color, color: color }} />
                              )}
                              {!isActive && (
                                <span className="text-muted-foreground/30">{prob * impact}</span>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                    <div className="text-center mt-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Likelihood →</span>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.8}>
              <div className="bg-primary rounded-3xl p-8 text-primary-foreground shadow-2xl relative overflow-hidden group">
                <Zap className="absolute top-0 right-0 w-32 h-32 opacity-10 -mr-8 -mt-8 rotate-12 group-hover:scale-110 transition-transform duration-700" />
                <h4 className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-3">Finalize Assessment</h4>
                <p className="text-[13px] font-bold leading-relaxed mb-6">
                  All actions look on track. Finalize and archive this assessment cycle for audit retention?
                </p>
                <Button
                  className="w-full bg-white text-primary hover:bg-white/90 font-black text-[10px] uppercase tracking-widest h-12 rounded-2xl shadow-xl shadow-black/10"
                  onClick={handleFinalize}
                  disabled={archiveMutation.isPending}
                >
                  {archiveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                  {archiveMutation.isPending ? 'Archiving…' : 'Finalize & Archive'}
                  {!archiveMutation.isPending && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </div>
  )
}
