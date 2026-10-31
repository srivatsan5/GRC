'use client'

import React, { useMemo, useState, useRef } from 'react'
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
  Plus, 
  Search, 
  MoreVertical, 
  ChevronUp, 
  ChevronDown, 
  ChevronsUpDown, 
  Loader2, 
  AlertCircle,
  Shield,
  ArrowLeft,
  ArrowRight,
  Filter,
  CheckCircle2,
  Trash2,
  Upload,
  Download,
  FileSpreadsheet,
  Layers,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { oracleService } from '@/lib/oracleService'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { recordAudit } from '@/lib/auditLog'

export function RiskIdentificationPage({ assessmentId: propAssessmentId }: { assessmentId?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const assessmentId = propAssessmentId || searchParams.get('assessmentId')
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [isAddRiskOpen, setIsAddRiskOpen] = React.useState(false)
  const [isImportOpen, setIsImportOpen] = React.useState(false)
  const [pasteText, setPasteText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form State
  const [riskStatement, setRiskStatement] = React.useState('')
  const [riskType, setRiskType] = React.useState('Operational')
  const [inherentLikelihood, setInherentLikelihood] = React.useState('3')
  const [inherentImpact, setInherentImpact] = React.useState('3')
  const [justification, setJustification] = React.useState('')
  const [riskOwner, setRiskOwner] = React.useState('Finance & Treasury')

  // CSV Import State
  const [parsedRows, setParsedRows] = useState<any[]>([])
  const [importing, setImporting] = useState(false)

  // 1. Data Fetching
  const { data: risks = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['risks', assessmentId],
    queryFn: () => oracleService.getIdentifyRisks(),
  })

  // 2. Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => oracleService.createIdentifyRisk(data),
    onSuccess: () => {
      toast.success("Risk cataloged successfully")
      setIsAddRiskOpen(false)
      setRiskStatement('')
      setInherentLikelihood('3')
      setInherentImpact('3')
      setJustification('')
      queryClient.invalidateQueries({ queryKey: ['risks'] })
      refetch()
    },
    onError: (err: any) => {
      toast.error(`Failed to save risk: ${err.message}`)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => oracleService.deleteIdentifyRisk(id),
    onSuccess: () => {
      toast.success("Risk deleted from catalog")
      queryClient.invalidateQueries({ queryKey: ['risks'] })
      refetch()
    },
    onError: (err: any) => {
      toast.error(`Failed to delete risk: ${err.message}`)
    }
  })

  const handleSaveRisk = () => {
    if (!riskStatement.trim()) {
      toast.error("Please enter a risk statement")
      return
    }

    const likelihood = Number(inherentLikelihood) || 3
    const impact = Number(inherentImpact) || 3

    const payload = {
      risk_statement: riskStatement.trim(),
      risk_type: riskType,
      inherent_sle: likelihood * impact * 10000,
      risk_owner: riskOwner,
      is_stage_complted: 'N',
      approval_status: 'DRAFT',
      status: 'Y',
      business_process_name: riskOwner,
    }

    createMutation.mutate(payload)
  }

  // CSV Template Export
  const downloadTemplate = () => {
    const csvContent = [
      'Risk Statement,Category,Department,Likelihood,Impact,Owner',
      '"Cloud infrastructure outage during peak month-end payroll settlement","IT & Cyber","Information Technology",4,4,"Anthony Muller"',
      '"Vendor SOC 2 attestation lapse on critical payment processor","Third Party","Procurement",3,4,"Priya Sharma"',
      '"Foreign exchange currency volatility on cross-border supplier invoices","Financial","Finance & Treasury",3,3,"CFO"',
      '"Key employee attrition in specialized actuarial compliance team","People","Human Resources",2,3,"HR Director"',
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pericope_risk_register_template.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.info("Sample CSV template downloaded")
  }

  // Parse Raw CSV Text
  const parseCSVText = (text: string) => {
    const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0)
    if (lines.length <= 1) {
      toast.error("CSV text is empty or missing data rows")
      return
    }

    const rows: any[] = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const matches = line.match(/(?:^|,)(?:"([^"]*)"|([^,]*))/g)
      if (!matches) continue

      const cleanValues = matches.map(m => m.replace(/^,/, '').replace(/^"|"$/g, '').trim())
      if (cleanValues[0] && cleanValues[0].length > 0) {
        const l = Math.max(1, Math.min(5, Number(cleanValues[3]) || 3))
        const imp = Math.max(1, Math.min(5, Number(cleanValues[4]) || 3))
        rows.push({
          risk_statement: cleanValues[0],
          risk_type: cleanValues[1] || 'Operational',
          process_name: cleanValues[2] || 'Operations',
          likelihood: l,
          impact: imp,
          inherent_sle: l * imp * 10000,
          risk_owner: cleanValues[5] || 'Risk Owner',
        })
      }
    }

    setParsedRows(rows)
    if (rows.length > 0) {
      toast.success(`Parsed ${rows.length} risk records`)
    } else {
      toast.error("No valid risk rows found in CSV")
    }
  }

  // CSV File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        parseCSVText(text)
        setIsImportOpen(true)
      } catch (err: any) {
        toast.error("Failed to parse CSV file: " + err.message)
      }
    }
    reader.readAsText(file)
  }

  // Execute Bulk Import
  const executeBulkImport = async () => {
    if (parsedRows.length === 0) return
    setImporting(true)
    let importedCount = 0

    for (const r of parsedRows) {
      try {
        await oracleService.createIdentifyRisk({
          risk_statement: r.risk_statement,
          risk_type: r.risk_type,
          inherent_sle: r.inherent_sle,
          risk_owner: r.risk_owner,
          process_name: r.process_name,
          is_stage_complted: 'N',
          approval_status: 'DRAFT',
          status: 'Y',
        })
        importedCount++
      } catch {
        // Continue with other rows
      }
    }

    setImporting(false)
    setIsImportOpen(false)
    setParsedRows([])
    setPasteText('')
    queryClient.invalidateQueries({ queryKey: ['risks'] })
    refetch()
    toast.success(`Successfully imported ${importedCount} risk records into register!`)
    recordAudit({
      action: 'CREATE',
      entity: 'Risk Register',
      description: `Bulk imported ${importedCount} risks via CSV spreadsheet upload`,
      result: 'SUCCESS',
    })
  }

  // 3. Column Definitions
  const columnHelper = createColumnHelper<any>()
  
  const columns = useMemo(() => [
    columnHelper.accessor('uuid', {
      header: 'ID',
      cell: info => <span className="font-mono text-xs text-slate-500">REF-{String(info.getValue() || info.row.original.id || '100').slice(0, 6)}</span>,
    }),
    columnHelper.accessor('risk_statement', {
      header: ({ column }) => (
        <button className="flex items-center gap-1 hover:text-slate-900 font-semibold" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Risk Statement {column.getIsSorted() === 'asc' ? <ChevronUp className="w-3 h-3"/> : column.getIsSorted() === 'desc' ? <ChevronDown className="w-3 h-3"/> : <ChevronsUpDown className="w-3 h-3 opacity-30"/>}
        </button>
      ),
      cell: info => (
        <div>
          <span className="font-medium text-slate-900 block">{info.getValue() || info.row.original.process_name || 'Risk entry'}</span>
          <span className="text-[11px] text-slate-400">{info.row.original.risk_type || 'General'}</span>
        </div>
      ),
    }),
    columnHelper.accessor((row: any) => row.risk_owner || row.process_name || 'Finance & Treasury', {
      id: 'risk_owner',
      header: 'Owner / Department',
      cell: info => <span className="text-slate-600">{info.getValue() as string}</span>,
    }),
    columnHelper.accessor('inherent_sle', {
      header: 'Exposure (SLE)',
      cell: info => {
        const value = Number(info.getValue()) || 30000
        const isCritical = value >= 160000
        const isHigh = value >= 100000
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium tabular-nums text-slate-900">${value.toLocaleString()}</span>
            <span className={cn(
              "text-[10px] font-medium px-1.5 py-0.2 rounded border",
              isCritical ? "bg-red-50 text-red-700 border-red-200" :
              isHigh ? "bg-amber-50 text-amber-700 border-amber-200" :
              "bg-slate-100 text-slate-700 border-slate-200"
            )}>
              {isCritical ? 'Critical' : isHigh ? 'High' : 'Moderate'}
            </span>
          </div>
        )
      },
    }),
    columnHelper.accessor('approval_status', {
      header: 'Status',
      cell: info => (
        <StatusBadge status={info.getValue() === 'APPROVED' ? 'approved' : 'in-review'} label={info.getValue() || 'Draft'} />
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
             <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700">
               <MoreVertical className="w-3.5 h-3.5" />
             </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 text-xs bg-white">
            <DropdownMenuItem onClick={() => router.push(`/rcsa/mitigation/${row.original.uuid || row.original.id}`)} className="cursor-pointer">
              Map Controls
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/heatmaps`)} className="cursor-pointer">
              View on Heatmap
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
                const id = row.original.uuid || row.original.id || row.original.identify_risk_uuid;
                if(confirm("Delete this risk entry?")) {
                  deleteMutation.mutate(id);
                }
              }} 
              disabled={deleteMutation.isPending}
              className="text-red-600 hover:bg-red-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete risk
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    }),
  ], [router, deleteMutation.isPending])

  const table = useReactTable({
    data: risks,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  if (isError) {
    return (
      <div className="py-20 text-center text-slate-500">
        <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
        <h2 className="text-sm font-semibold text-slate-900">Database connection error</h2>
        <p className="text-xs text-slate-500 mt-1">Unable to retrieve risks. Please check server status.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Stepper Bar */}
      <div className="bg-white border border-slate-200 rounded p-3 text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">RCSA Lifecycle:</span>
          <span className="text-slate-500 hover:underline cursor-pointer" onClick={() => router.push('/rcsa/provisioning')}>01 Setup</span>
          <span className="text-slate-300">&rarr;</span>
          <span className="font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">02 Identification (Active)</span>
          <span className="text-slate-300">&rarr;</span>
          <span className="text-slate-500 hover:underline cursor-pointer" onClick={() => router.push('/rcsa/mitigation')}>03 Controls & Mitigation</span>
          <span className="text-slate-300">&rarr;</span>
          <span className="text-slate-500 hover:underline cursor-pointer" onClick={() => router.push('/rcsa/monitoring')}>04 Monitoring</span>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push('/rcsa/mitigation')}
          className="text-xs h-7"
        >
          Next Stage: Controls &rarr;
        </Button>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            {assessmentId ? 'In-Scope Assessment Risks' : 'Risk Identification Register'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Catalog enterprise risk statements with inherent likelihood and impact parameters
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Hidden File Input for CSV Upload */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv"
            className="hidden"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            className="h-8 text-xs font-normal"
            title="Download sample CSV template"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            CSV Template
          </Button>

          {/* Import CSV Modal Trigger */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportOpen(true)}
            className="h-8 text-xs font-normal"
          >
            <Upload className="w-3.5 h-3.5 mr-1" />
            Import CSV
          </Button>

          {/* Add Risk Manual Modal */}
          <Dialog open={isAddRiskOpen} onOpenChange={setIsAddRiskOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs font-medium bg-blue-900 hover:bg-blue-800 text-white rounded">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Risk
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-white border-slate-200 rounded-lg p-5 space-y-4 text-xs">
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold text-slate-900">Catalog Risk Scenario</DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Register a new risk statement with initial likelihood and impact scores.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Risk statement *</label>
                  <textarea
                    value={riskStatement}
                    onChange={e => setRiskStatement(e.target.value)}
                    placeholder="e.g. Failure of primary cloud database during quarterly reconciliation batch..."
                    rows={2}
                    className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Risk category</label>
                    <select
                      value={riskType}
                      onChange={e => setRiskType(e.target.value)}
                      className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white"
                    >
                      <option>Operational</option>
                      <option>Financial</option>
                      <option>IT & Cyber</option>
                      <option>Third Party</option>
                      <option>Compliance</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Department / Function</label>
                    <select
                      value={riskOwner}
                      onChange={e => setRiskOwner(e.target.value)}
                      className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white"
                    >
                      <option>Finance & Treasury</option>
                      <option>Information Technology</option>
                      <option>Operations & Logistics</option>
                      <option>Legal & Compliance</option>
                      <option>Human Resources</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Inherent likelihood (1-5)</label>
                    <select
                      value={inherentLikelihood}
                      onChange={e => setInherentLikelihood(e.target.value)}
                      className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white"
                    >
                      <option value="1">1 - Rare (&lt;5%)</option>
                      <option value="2">2 - Unlikely (5-20%)</option>
                      <option value="3">3 - Possible (20-50%)</option>
                      <option value="4">4 - Likely (50-80%)</option>
                      <option value="5">5 - Almost Certain (&gt;80%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Inherent impact (1-5)</label>
                    <select
                      value={inherentImpact}
                      onChange={e => setInherentImpact(e.target.value)}
                      className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white"
                    >
                      <option value="1">1 - Insignificant (&lt;$25K)</option>
                      <option value="2">2 - Minor ($25K-$100K)</option>
                      <option value="3">3 - Moderate ($100K-$250K)</option>
                      <option value="4">4 - Major ($250K-$1M)</option>
                      <option value="5">5 - Severe (&gt;$1M)</option>
                    </select>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-[11px] text-slate-600 flex justify-between">
                  <span>Calculated Single Loss Exposure (SLE):</span>
                  <span className="font-semibold text-slate-900">${(Number(inherentLikelihood) * Number(inherentImpact) * 10000).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <Button variant="outline" size="sm" onClick={() => setIsAddRiskOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSaveRisk} disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Saving...' : 'Save risk'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="Search risk statements..."
            className="pl-8 h-8 text-xs bg-white"
            value={globalFilter ?? ''}
            onChange={e => setGlobalFilter(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          <div>
            <span>Total risks: </span>
            <span className="font-semibold text-slate-900">{risks.length}</span>
          </div>
          <div>
            <span>Critical exposure: </span>
            <span className="font-semibold text-red-600">{risks.filter((r: any) => (Number(r.inherent_sle) || 0) >= 160000).length}</span>
          </div>
        </div>
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
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                  <p className="text-xs">Loading risk records...</p>
                </td>
              </tr>
            ) : risks.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                  No risk entries cataloged. Click &quot;Add Risk&quot; or &quot;Import CSV&quot; to begin.
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

      {/* Comprehensive CSV Import Modal */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-2xl bg-white border-slate-200 rounded-lg p-5 space-y-4 text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-slate-900">Bulk Import Risk Register (CSV)</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Upload a .csv spreadsheet or paste raw CSV rows to migrate your risk register into Pericope.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* File Upload Zone */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-700 rounded-lg p-5 text-center cursor-pointer bg-slate-50 hover:bg-blue-50/40 transition-colors"
            >
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="font-semibold text-slate-800 text-xs">Click to browse or drag & drop .csv spreadsheet</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Supports: Risk Statement, Category, Department, Likelihood (1-5), Impact (1-5), Owner</p>
            </div>

            {/* Direct Paste Area */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-700 font-medium">Or paste CSV text:</label>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="text-blue-700 hover:underline text-[11px]"
                >
                  Download template.csv
                </button>
              </div>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={'Risk Statement,Category,Department,Likelihood,Impact,Owner\n"Cloud database outage during payroll","IT & Cyber","IT",4,4,"Anthony Muller"'}
                rows={3}
                className="w-full p-2 border border-slate-200 rounded text-xs font-mono bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-700"
              />
              {pasteText.trim().length > 0 && parsedRows.length === 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => parseCSVText(pasteText)}
                  className="mt-2 text-xs"
                >
                  Parse Pasted CSV
                </Button>
              )}
            </div>

            {/* Parsed Rows Preview */}
            {parsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 text-xs">Parsed Records Preview ({parsedRows.length} rows):</span>
                  <button onClick={() => setParsedRows([])} className="text-red-600 hover:underline text-[11px]">Clear preview</button>
                </div>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded">
                  <table className="enterprise-table">
                    <thead>
                      <tr>
                        <th>Risk Statement</th>
                        <th>Category</th>
                        <th>Department</th>
                        <th className="text-center">Likelihood &times; Impact</th>
                        <th className="text-right">Exposure (SLE)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((r, idx) => (
                        <tr key={idx}>
                          <td className="font-medium text-slate-900">{r.risk_statement}</td>
                          <td>{r.risk_type}</td>
                          <td>{r.process_name}</td>
                          <td className="text-center font-mono">{r.likelihood}/5 &times; {r.impact}/5</td>
                          <td className="text-right font-medium tabular-nums text-slate-900">${(r.inherent_sle).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => { setIsImportOpen(false); setParsedRows([]); setPasteText('') }}>
              Cancel
            </Button>
            <Button size="sm" onClick={executeBulkImport} disabled={importing || parsedRows.length === 0}>
              {importing ? 'Importing...' : `Import ${parsedRows.length} risks into database`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
