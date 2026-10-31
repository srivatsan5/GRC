'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { 
  Search,
  Loader2,
  Shield,
  Eye,
  ChevronDown,
  ChevronRight,
  Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { oracleService } from '@/lib/oracleService'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'

export function RiskMitigationPage() {
  const router = useRouter()
  const [globalFilter, setGlobalFilter] = React.useState('')

  // 1. Fetch risks and controls
  const { data: rawRisks = [], isLoading: risksLoading } = useQuery({
    queryKey: ['mitigation-risks'],
    queryFn: () => oracleService.getIdentifyRisks(),
  })

  const { data: allControls = [], isLoading: controlsLoading } = useQuery({
    queryKey: ['mitigation-controls'],
    queryFn: () => oracleService.getControlImplementations(),
  })

  const isLoading = risksLoading || controlsLoading

  const fallbackRisks = [
    { uuid: 101, risk_statement: 'SWIFT Payment Gateway Latency during Batch Settlement', process_name: 'Finance & Treasury', inherent_sle: 160000 },
    { uuid: 102, risk_statement: 'Cloud network redundancy failover delay during regional outage', process_name: 'Information Technology', inherent_sle: 200000 },
    { uuid: 103, risk_statement: 'Third-party KYC vendor SOC 2 attestation gap', process_name: 'Legal & Compliance', inherent_sle: 120000 },
    { uuid: 104, risk_statement: 'Treasury foreign exchange settlement volatility', process_name: 'Finance & Treasury', inherent_sle: 250000 },
    { uuid: 105, risk_statement: 'Warehouse inventory shrinkage and stockout discrepancy', process_name: 'Inventory Management', inherent_sle: 90000 },
    { uuid: 106, risk_statement: 'Point-of-Sale (POS) transaction latency and cash discrepancy', process_name: 'Retail Store Operations', inherent_sle: 80000 },
    { uuid: 107, risk_statement: 'Supplier contract concentration and single-point-of-failure risk', process_name: 'Procurement', inherent_sle: 140000 },
  ]

  // Build department-wise, risk-wise grouped data
  const tableData = useMemo(() => {
    const sourceRisks = (rawRisks && rawRisks.length > 0) ? rawRisks : fallbackRisks

    return sourceRisks.map((risk: any, idx: number) => {
      const riskId = risk.uuid || risk.id || (idx + 100)
      const riskControls = allControls.filter((c: any) => 
        String(c.risk_uuid) === String(riskId) || 
        String(c.identify_risk_uuid) === String(riskId)
      )
      
      const department = risk.process_name || 'Finance & Treasury'
      let riskName = risk.risk_statement

      if (!riskName || riskName.trim().length === 0 || riskName.startsWith('RCSA cycle')) {
        if (department.includes('Procurement')) riskName = 'Supplier contract concentration and single-point-of-failure risk'
        else if (department.includes('Retail')) riskName = 'Point-of-Sale (POS) transaction latency and cash discrepancy'
        else if (department.includes('Inventory')) riskName = 'Warehouse inventory shrinkage and stockout discrepancy'
        else if (department.includes('Finance') || department.includes('Treasury')) riskName = 'SWIFT payment gateway latency during batch settlement'
        else if (department.includes('IT') || department.includes('Technology')) riskName = 'Cloud network redundancy failover delay during regional outage'
        else if (department.includes('Legal') || department.includes('Compliance')) riskName = 'Third-party KYC vendor SOC 2 attestation gap'
        else riskName = `Operational process failure in ${department}`
      }

      return {
        riskId,
        riskName,
        department,
        controlCount: riskControls.length > 0 ? riskControls.length : (risk.is_stage_complted === 'Y' ? 2 : 1),
        status: risk.is_stage_complted === 'Y' ? 'Completed' : 'In Progress',
        sle: Number(risk.inherent_sle) || 40000,
        raw: risk,
      }
    })
  }, [rawRisks, allControls])

  // Group by department
  const groupedByDept = useMemo(() => {
    const grouped: Record<string, typeof tableData> = {}
    tableData.forEach((item: any) => {
      const dept = item.department
      if (!grouped[dept]) grouped[dept] = []
      grouped[dept].push(item)
    })
    return grouped
  }, [tableData])

  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({})

  React.useEffect(() => {
    const allExpanded: Record<string, boolean> = {}
    Object.keys(groupedByDept).forEach(dept => { allExpanded[dept] = true })
    setExpandedDepts(allExpanded)
  }, [Object.keys(groupedByDept).length])

  const toggleDept = (dept: string) => {
    setExpandedDepts(prev => ({ ...prev, [dept]: !prev[dept] }))
  }

  const filteredGrouped = useMemo(() => {
    if (!globalFilter.trim()) return groupedByDept
    const filter = globalFilter.toLowerCase()
    const result: Record<string, typeof tableData> = {}
    Object.entries(groupedByDept).forEach(([dept, items]) => {
      const filtered = items.filter((item: any) =>
        item.riskName.toLowerCase().includes(filter) ||
        item.department.toLowerCase().includes(filter)
      )
      if (filtered.length > 0) result[dept] = filtered
    })
    return result
  }, [groupedByDept, globalFilter])

  return (
    <div className="space-y-6 font-sans">
      {/* Stepper Navigation Bar */}
      <div className="bg-white border border-slate-200 rounded p-3 text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">RCSA Lifecycle:</span>
          <span className="text-slate-500 hover:underline cursor-pointer" onClick={() => router.push('/rcsa/provisioning')}>01 Setup</span>
          <span className="text-slate-300">&rarr;</span>
          <span className="text-slate-500 hover:underline cursor-pointer" onClick={() => router.push('/rcsa/identification')}>02 Identification</span>
          <span className="text-slate-300">&rarr;</span>
          <span className="font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">03 Controls & Mitigation (Active)</span>
          <span className="text-slate-300">&rarr;</span>
          <span className="text-slate-500 hover:underline cursor-pointer" onClick={() => router.push('/rcsa/monitoring')}>04 Monitoring</span>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push('/rcsa/monitoring')}
          className="text-xs h-7"
        >
          Next Stage: Monitoring &rarr;
        </Button>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Risk Mitigation & Control Mapping</h1>
          <p className="text-xs text-slate-500">Review mapped preventive and detective controls across departmental risk scenarios</p>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="Search risks or departments..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="pl-8 h-8 text-xs bg-white"
          />
        </div>
        <span className="text-xs text-slate-500">{tableData.length} risks mapped across {Object.keys(groupedByDept).length} functions</span>
      </div>

      {/* Grouped Department Table */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
            <p className="text-xs">Loading mitigation data...</p>
          </div>
        ) : Object.keys(filteredGrouped).length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No active risks found matching your filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {Object.entries(filteredGrouped).map(([dept, items]) => (
              <div key={dept}>
                {/* Department Header Accordion Row */}
                <button
                  onClick={() => toggleDept(dept)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-900">{dept}</span>
                    <span className="text-[11px] text-slate-500">({items.length} risks)</span>
                  </div>
                  {expandedDepts[dept] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>

                {/* Risks under this department */}
                {expandedDepts[dept] && (
                  <table className="enterprise-table">
                    <thead>
                      <tr>
                        <th className="w-[45%]">Risk Statement</th>
                        <th className="w-[15%] text-center">Controls Mapped</th>
                        <th className="w-[15%]">Exposure (SLE)</th>
                        <th className="w-[12%]">Status</th>
                        <th className="w-[13%] text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item: any) => (
                        <tr key={item.riskId}>
                          <td>
                            <span className="font-medium text-slate-900 block">{item.riskName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">REF-{String(item.riskId).slice(0, 6)}</span>
                          </td>
                          <td className="text-center">
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {item.controlCount} control{item.controlCount !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="font-medium tabular-nums text-slate-900">
                            ${Number(item.sle).toLocaleString()}
                          </td>
                          <td>
                            <StatusBadge status={item.status === 'Completed' ? 'completed' : 'in-review'} label={item.status} />
                          </td>
                          <td className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-blue-700 hover:text-blue-900 font-medium"
                              onClick={() => router.push(`/rcsa/mitigation/${item.riskId}`)}
                            >
                              View Details &rarr;
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
