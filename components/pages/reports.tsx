'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { oracleService } from '@/lib/oracleService'
import { cn } from '@/lib/utils'
import { recordAudit, listAudit } from '@/lib/auditLog'
import { controlsStore } from '@/components/pages/control-library'
import { vendorStore } from '@/components/pages/vendor-risk'
import { kriStore } from '@/components/pages/kri-intelligence'
import { useStoreSnapshot } from '@/lib/localStore'

interface ReportRow {
  id: string
  name: string
  type: string
  lastGenerated: string
  status: 'Ready' | 'Pending'
  size: string
  department: string
  frequency: string
}

const REPORT_TEMPLATES: Array<Omit<ReportRow, 'lastGenerated' | 'size'>> = [
  { id: 'RPT-001', name: 'Executive Board Risk Committee Pack', type: 'Executive', status: 'Ready', department: 'Risk Office', frequency: 'Quarterly' },
  { id: 'RPT-002', name: 'RCSA Assessment Lifecycle Summary', type: 'Operational', status: 'Ready', department: 'Operations', frequency: 'Quarterly' },
  { id: 'RPT-003', name: 'SOX Section 404 Control Test Workpapers', type: 'Compliance', status: 'Ready', department: 'Internal Audit', frequency: 'Quarterly' },
  { id: 'RPT-004', name: 'Immutable Audit Trail Ledger (SOX)', type: 'Audit Trail', status: 'Ready', department: 'Internal Audit', frequency: 'On demand' },
  { id: 'RPT-005', name: 'Key Risk Indicator (KRI) Threshold Register', type: 'Operational', status: 'Ready', department: 'Risk Office', frequency: 'Monthly' },
  { id: 'RPT-006', name: 'Control Effectiveness & Residual Risk Report', type: 'Executive', status: 'Ready', department: 'Risk Office', frequency: 'Monthly' },
  { id: 'RPT-007', name: 'ISO/IEC 27001 Information Security Evidence Pack', type: 'Compliance', status: 'Ready', department: 'IT Security', frequency: 'Annual' },
  { id: 'RPT-008', name: 'Third-Party Vendor Risk Assessment (TPRM)', type: 'Operational', status: 'Ready', department: 'Procurement', frequency: 'Monthly' },
]

export function ReportsPage() {
  const [selectedReportId, setSelectedReportId] = useState<string>('RPT-001')
  const [globalFilter, setGlobalFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('All')

  // Live Store Snapshots
  const localControls = useStoreSnapshot(controlsStore)
  const localVendors = useStoreSnapshot(vendorStore)
  const localKri = useStoreSnapshot(kriStore)
  const [auditEntries, setAuditEntries] = useState<any[]>([])

  React.useEffect(() => {
    setAuditEntries(listAudit())
    const handler = () => setAuditEntries(listAudit())
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const { data: rawRisks = [] } = useQuery({
    queryKey: ['reports-risks'],
    queryFn: () => oracleService.getIdentifyRisks(),
  })

  // Sanitized Risk Records with guaranteed titles
  const risks = useMemo(() => {
    return oracleService.parseAllRisks(rawRisks)
  }, [rawRisks])

  const totalSLE = useMemo(() => risks.reduce((acc, r) => acc + Number(r.sle), 0), [risks])
  const criticalCount = useMemo(() => risks.filter((r) => r.score >= 16).length, [risks])

  const reportsList = useMemo(() => {
    return REPORT_TEMPLATES.map((tpl, i) => {
      const date = new Date(Date.now() - (i + 1) * 2 * 24 * 60 * 60 * 1000)
      return {
        ...tpl,
        lastGenerated: date.toISOString().slice(0, 10),
        size: `${(140 + i * 18)} KB`,
      }
    }).filter(r => {
      if (typeFilter !== 'All' && r.type !== typeFilter) return false
      if (globalFilter && !r.name.toLowerCase().includes(globalFilter.toLowerCase())) return false
      return true
    })
  }, [typeFilter, globalFilter])

  const handlePrint = () => {
    recordAudit({
      action: 'EXPORT',
      entity: 'Report',
      entity_id: selectedReportId,
      description: `Generated and printed ${REPORT_TEMPLATES.find(t => t.id === selectedReportId)?.name}`,
      result: 'SUCCESS',
    })
    window.print()
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Top Page Header — Hidden when Printing */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Reports & Board Deliverables</h1>
          <p className="text-xs text-slate-500">Formal governance documentation, audit workpapers, and committee packs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handlePrint} size="sm" className="h-8 text-xs bg-blue-900 hover:bg-blue-800 text-white shadow-xs">
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start print:block print:w-full">
        {/* Left: Report Catalog Selector — Hidden when Printing */}
        <div className="space-y-3 print:hidden">
          <div className="bg-white rounded border border-slate-200 p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search reports..."
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
                className="pl-8 h-8 text-xs bg-slate-50"
              />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
              {(['All', 'Executive', 'Operational', 'Compliance'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    'px-2 py-0.5 rounded text-xs transition-colors whitespace-nowrap',
                    typeFilter === t ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {reportsList.map(r => {
              const isSelected = selectedReportId === r.id
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedReportId(r.id)}
                  className={cn(
                    'p-3 cursor-pointer transition-colors text-xs space-y-1',
                    isSelected ? 'bg-blue-50/70 border-l-4 border-l-blue-900' : 'hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 truncate pr-2">{r.name}</span>
                    <span className="text-[10px] text-slate-400">{r.frequency}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{r.department}</span>
                    <span className="font-mono text-[10px]">{r.lastGenerated}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Dynamic Formatted Report Preview (The ONLY section visible in Print/PDF) */}
        <div className="lg:col-span-2 bg-white rounded border border-slate-200 p-6 space-y-6 shadow-xs print:p-0 print:border-none print:shadow-none print:w-full print:m-0 print:space-y-4">
          
          {/* ========================================================================= */}
          {/* 1. REPORT: Executive Board Risk Committee Pack (RPT-001) */}
          {/* ========================================================================= */}
          {selectedReportId === 'RPT-001' && (
            <>
              <div className="pb-3 border-b border-slate-300 flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pericope ERM &middot; Executive Governance Pack</div>
                  <h2 className="text-xl font-bold text-slate-900 mt-0.5">Quarterly Risk & Governance Report</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Target Scope: Board Risk Committee &middot; Cycle: Q1 2026 Assessment &middot; Generated {new Date().toLocaleDateString()}</p>
                </div>
                <Badge variant="outline" className="text-xs border-slate-300">
                  Audit Ready
                </Badge>
              </div>

              <div className="space-y-2.5 print:break-inside-avoid">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">1. Executive Exposure Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Total Active Risks</span>
                    <span className="text-xl font-bold text-slate-900 tabular-nums">{risks.length}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Gross SLE Exposure</span>
                    <span className="text-xl font-bold text-slate-900 tabular-nums">${(totalSLE / 1000).toFixed(0)}k</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Critical Band Risks</span>
                    <span className="text-xl font-bold text-rose-700 tabular-nums">{criticalCount}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Control Coverage</span>
                    <span className="text-xl font-bold text-emerald-700 tabular-nums">78.4%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 print:break-inside-avoid">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">2. Top High-Exposure Risk Scenarios</h3>
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th className="w-[45%]">Risk Scenario</th>
                      <th className="w-[20%]">Department</th>
                      <th className="w-[20%]">Single Loss (SLE)</th>
                      <th className="w-[15%]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {risks.slice(0, 5).map((r: any, i: number) => (
                      <tr key={i}>
                        <td>
                          <span className="font-medium text-slate-900">{r.risk_statement}</span>
                        </td>
                        <td className="text-slate-600">{r.process_name}</td>
                        <td className="font-medium tabular-nums text-slate-900">
                          ${(Number(r.inherent_sle) || 40000).toLocaleString()}
                        </td>
                        <td>
                          <StatusBadge status={r.approval_status === 'APPROVED' ? 'approved' : 'in-review'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2.5 print:break-inside-avoid">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">3. Key Risk Indicator (KRI) Operational Thresholds</h3>
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th className="w-[40%]">Indicator Metric</th>
                      <th className="w-[20%]">Unit & Frequency</th>
                      <th className="w-[20%]">Upper Limit</th>
                      <th className="w-[20%]">Breach Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localKri.map((kri: any, idx: number) => (
                      <tr key={idx}>
                        <td className="font-medium text-slate-900">{kri.name}</td>
                        <td className="text-slate-600">{kri.unit}</td>
                        <td className="font-mono text-slate-700">&lt; {kri.amberThreshold}</td>
                        <td>
                          <StatusBadge status={kri.currentValue >= kri.redThreshold ? 'critical' : kri.currentValue >= kri.amberThreshold ? 'warning' : 'success'} label={kri.currentValue >= kri.redThreshold ? 'Breach' : kri.currentValue >= kri.amberThreshold ? 'Warning' : 'Normal'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 border-t border-slate-300 text-xs text-slate-500 flex flex-col sm:flex-row justify-between gap-4 print:break-inside-avoid">
                <div>
                  <span className="font-semibold text-slate-800 block">Report Certified by:</span>
                  <span>Chief Risk Officer (CRO) &middot; Board Risk Committee</span>
                </div>
                <div className="sm:text-right">
                  <span className="font-semibold text-slate-800 block">Regulatory Compliance:</span>
                  <span>SOX Section 404 &middot; ISO/IEC 31000:2018</span>
                </div>
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* 2. REPORT: RCSA Assessment Lifecycle Summary (RPT-002) */}
          {/* ========================================================================= */}
          {selectedReportId === 'RPT-002' && (
            <>
              <div className="pb-3 border-b border-slate-300 flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pericope ERM &middot; Operational Risk</div>
                  <h2 className="text-xl font-bold text-slate-900 mt-0.5">RCSA Assessment Lifecycle Summary</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Departmental Assessment Progress &middot; Generated {new Date().toLocaleDateString()}</p>
                </div>
                <Badge variant="outline" className="text-xs border-slate-300">RCSA Cycle 2026</Badge>
              </div>

              <div className="space-y-2.5 print:break-inside-avoid">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">1. Assessment Stage Progression Overview</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Total Active Cycles</span>
                    <span className="text-xl font-bold text-slate-900 tabular-nums">4</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Identification Phase</span>
                    <span className="text-xl font-bold text-blue-700 tabular-nums">100%</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Control Evaluation</span>
                    <span className="text-xl font-bold text-amber-700 tabular-nums">78%</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Monitoring Stage</span>
                    <span className="text-xl font-bold text-emerald-700 tabular-nums">67%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 print:break-inside-avoid">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">2. Departmental Assessment Schedules</h3>
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th className="w-[30%]">Assessment Cycle</th>
                      <th className="w-[25%]">Target Department</th>
                      <th className="w-[20%]">Risk Champion</th>
                      <th className="w-[15%]">Active Stage</th>
                      <th className="w-[10%]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { code: 'RCSA-FIN-2026-001', dept: 'Finance & Treasury', champ: 'Priya Sharma', stage: '03 Controls', status: 'In Progress' },
                      { code: 'RCSA-IT-2026-002', dept: 'Information Technology', champ: 'Anthony Muller', stage: '04 Monitoring', status: 'Completed' },
                      { code: 'RCSA-LEG-2026-003', dept: 'Legal & Compliance', champ: 'Lin Wei', stage: '02 Identify', status: 'In Progress' },
                      { code: 'RCSA-OPS-2026-004', dept: 'Operations & Logistics', champ: 'Anthony Muller', stage: '03 Controls', status: 'In Progress' },
                    ].map((row, i) => (
                      <tr key={i}>
                        <td>
                          <span className="font-semibold text-slate-900 font-mono text-xs">{row.code}</span>
                        </td>
                        <td className="text-slate-700">{row.dept}</td>
                        <td className="text-slate-600">{row.champ}</td>
                        <td className="font-medium text-slate-800">{row.stage}</td>
                        <td>
                          <StatusBadge status={row.status === 'Completed' ? 'completed' : 'in-review'} label={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 border-t border-slate-300 text-xs text-slate-500 flex justify-between print:break-inside-avoid">
                <div><span>Reviewed by: Head of Operational Risk</span></div>
                <div><span>Governance Sign-off: Attested</span></div>
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* 3. REPORT: SOX Section 404 Control Test Workpapers (RPT-003) */}
          {/* ========================================================================= */}
          {selectedReportId === 'RPT-003' && (
            <>
              <div className="pb-3 border-b border-slate-300 flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pericope ERM &middot; Internal Audit & Compliance</div>
                  <h2 className="text-xl font-bold text-slate-900 mt-0.5">SOX Section 404 Control Test Workpapers</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Internal Controls Over Financial Reporting (ICFR) &middot; Generated {new Date().toLocaleDateString()}</p>
                </div>
                <Badge variant="outline" className="text-xs border-slate-300">SOX 404(b)</Badge>
              </div>

              <div className="space-y-2.5 print:break-inside-avoid">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">1. Control Testing Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Controls Evaluated</span>
                    <span className="text-xl font-bold text-slate-900 tabular-nums">{localControls.length}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Effective / Tested</span>
                    <span className="text-xl font-bold text-emerald-700 tabular-nums">{localControls.filter((c: any) => c.status === 'Active').length}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Control Deficiencies</span>
                    <span className="text-xl font-bold text-slate-900 tabular-nums">0</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Avg Operating Score</span>
                    <span className="text-xl font-bold text-blue-700 tabular-nums">4.4 / 5</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 print:break-inside-avoid">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">2. Control Testing Workpapers Matrix</h3>
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th className="w-[15%]">Control Code</th>
                      <th className="w-[35%]">Control Title</th>
                      <th className="w-[15%]">Type & Nature</th>
                      <th className="w-[15%]">Frequency</th>
                      <th className="w-[10%]">Design</th>
                      <th className="w-[10%]">Operating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localControls.map((c: any, idx: number) => (
                      <tr key={idx}>
                        <td className="font-mono text-slate-700 font-semibold">{c.code}</td>
                        <td>
                          <span className="font-medium text-slate-900">{c.name}</span>
                          <span className="block text-[11px] text-slate-500">{c.owner}</span>
                        </td>
                        <td className="text-slate-600">{c.type} / {c.nature}</td>
                        <td className="text-slate-600">{c.frequency}</td>
                        <td className="font-mono font-medium text-slate-800">{c.designEffectiveness}/5</td>
                        <td className="font-mono font-medium text-emerald-700">{c.operatingEffectiveness}/5</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 border-t border-slate-300 text-xs text-slate-500 flex justify-between print:break-inside-avoid">
                <div><span>Audit Workpaper Lead: Lin Wei (Internal Auditor)</span></div>
                <div><span>Attestation: Controls verified operating effectively</span></div>
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* 4. REPORT: Immutable Audit Trail Ledger (SOX) (RPT-004) */}
          {/* ========================================================================= */}
          {selectedReportId === 'RPT-004' && (
            <>
              <div className="pb-3 border-b border-slate-300 flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pericope ERM &middot; System of Record</div>
                  <h2 className="text-xl font-bold text-slate-900 mt-0.5">Immutable Audit Trail Ledger</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Chronological System Events & Mutations &middot; Generated {new Date().toLocaleDateString()}</p>
                </div>
                <Badge variant="outline" className="text-xs border-slate-300">Tamper Evident</Badge>
              </div>

              <div className="space-y-2.5 print:break-inside-avoid">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">1. Event Log Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Total Events Logged</span>
                    <span className="text-xl font-bold text-slate-900 tabular-nums">{auditEntries.length}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Create Mutations</span>
                    <span className="text-xl font-bold text-blue-700 tabular-nums">{auditEntries.filter((e: any) => e.action === 'CREATE').length}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Updates / Approvals</span>
                    <span className="text-xl font-bold text-amber-700 tabular-nums">{auditEntries.filter((e: any) => e.action === 'UPDATE' || e.action === 'APPROVE').length}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Integrity Status</span>
                    <span className="text-xl font-bold text-emerald-700 tabular-nums">Verified</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 print:break-inside-avoid">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">2. Chronological System Events Table</h3>
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th className="w-[18%]">Timestamp</th>
                      <th className="w-[18%]">User & Role</th>
                      <th className="w-[14%]">Action</th>
                      <th className="w-[18%]">Entity</th>
                      <th className="w-[32%]">Event Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEntries.slice(0, 8).map((e: any, idx: number) => (
                      <tr key={idx}>
                        <td className="font-mono text-[11px] text-slate-600">{new Date(e.timestamp).toLocaleString()}</td>
                        <td>
                          <span className="font-medium text-slate-900 block">{e.actor_name}</span>
                          <span className="text-[10px] text-slate-400">{e.actor_role}</span>
                        </td>
                        <td className="font-mono text-xs font-semibold">{e.action}</td>
                        <td className="text-slate-700">{e.entity}</td>
                        <td className="text-slate-600 line-clamp-1">{e.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 border-t border-slate-300 text-xs text-slate-500 flex justify-between print:break-inside-avoid">
                <div><span>Database Engine: Autonomous Transaction Triggers</span></div>
                <div><span>Attestation: Non-repudiation verified</span></div>
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* 5. REPORT: Key Risk Indicator (KRI) Threshold Register (RPT-005) */}
          {/* ========================================================================= */}
          {selectedReportId === 'RPT-005' && (
            <>
              <div className="pb-3 border-b border-slate-300 flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pericope ERM &middot; Risk Telemetry</div>
                  <h2 className="text-xl font-bold text-slate-900 mt-0.5">Key Risk Indicator (KRI) Threshold Register</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Continuous Operational Telemetry &middot; Generated {new Date().toLocaleDateString()}</p>
                </div>
                <Badge variant="outline" className="text-xs border-slate-300">Continuous Telemetry</Badge>
              </div>

              <div className="space-y-2.5 print:break-inside-avoid">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">1. Indicator Health Overview</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Total Tracked KRIs</span>
                    <span className="text-xl font-bold text-slate-900 tabular-nums">{localKri.length}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Green / Normal</span>
                    <span className="text-xl font-bold text-emerald-700 tabular-nums">{localKri.filter((k: any) => k.currentValue < k.amberThreshold).length}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Amber Warnings</span>
                    <span className="text-xl font-bold text-amber-700 tabular-nums">{localKri.filter((k: any) => k.currentValue >= k.amberThreshold && k.currentValue < k.redThreshold).length}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Red Breaches</span>
                    <span className="text-xl font-bold text-rose-700 tabular-nums">{localKri.filter((k: any) => k.currentValue >= k.redThreshold).length}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 print:break-inside-avoid">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">2. Indicator Threshold & Reading Ledger</h3>
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th className="w-[15%]">KRI Code</th>
                      <th className="w-[30%]">Indicator Title</th>
                      <th className="w-[15%]">Owner</th>
                      <th className="w-[15%]">Green / Amber Bound</th>
                      <th className="w-[12%]">Current Value</th>
                      <th className="w-[13%]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localKri.map((k: any, idx: number) => {
                      const isRed = k.currentValue >= k.redThreshold
                      const isAmber = k.currentValue >= k.amberThreshold && !isRed
                      return (
                        <tr key={idx}>
                          <td className="font-mono text-slate-700 font-semibold">{k.code}</td>
                          <td>
                            <span className="font-medium text-slate-900">{k.name}</span>
                            <span className="block text-[11px] text-slate-400">{k.category}</span>
                          </td>
                          <td className="text-slate-600">{k.owner}</td>
                          <td className="font-mono text-slate-700">&le; {k.greenThreshold} / &le; {k.amberThreshold} {k.unit}</td>
                          <td className="font-mono font-bold text-slate-900">{k.currentValue} {k.unit}</td>
                          <td>
                            <StatusBadge status={isRed ? 'critical' : isAmber ? 'warning' : 'success'} label={isRed ? 'Breach' : isAmber ? 'Warning' : 'Normal'} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 border-t border-slate-300 text-xs text-slate-500 flex justify-between print:break-inside-avoid">
                <div><span>Monitoring Custodian: Risk Operations Lead</span></div>
                <div><span>Escalation Protocol: Automated Webhooks Active</span></div>
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* 6. REPORT: Control Effectiveness & Residual Risk Report (RPT-006) */}
          {/* ========================================================================= */}
          {selectedReportId === 'RPT-006' && (
            <>
              <div className="pb-3 border-b border-slate-300 flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pericope ERM &middot; Risk Quantification</div>
                  <h2 className="text-xl font-bold text-slate-900 mt-0.5">Control Effectiveness & Residual Risk Report</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Inherent vs Residual Exposure Reduction &middot; Generated {new Date().toLocaleDateString()}</p>
                </div>
                <Badge variant="outline" className="text-xs border-slate-300">FAIR Model</Badge>
              </div>

              <div className="space-y-2.5 print:break-inside-avoid">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">1. Portfolio Risk Reduction Metrics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Gross Inherent SLE</span>
                    <span className="text-xl font-bold text-slate-900 tabular-nums">${(totalSLE / 1000).toFixed(0)}k</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Net Residual SLE</span>
                    <span className="text-xl font-bold text-blue-700 tabular-nums">${Math.round((totalSLE * 0.32) / 1000)}k</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Exposure Mitigated</span>
                    <span className="text-xl font-bold text-emerald-700 tabular-nums">68%</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Active Controls</span>
                    <span className="text-xl font-bold text-slate-900 tabular-nums">{localControls.length}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 print:break-inside-avoid">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">2. Inherent to Residual Risk Step-Down Matrix</h3>
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th className="w-[40%]">Risk Scenario</th>
                      <th className="w-[15%]">Inherent Score</th>
                      <th className="w-[15%]">Mapped Controls</th>
                      <th className="w-[15%]">Residual Score</th>
                      <th className="w-[15%]">Reduction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {risks.slice(0, 5).map((r: any, i: number) => {
                      const inhScore = Math.min(25, Math.max(1, Math.round((Number(r.inherent_sle) || 40000) / 10000)))
                      const resScore = Math.max(1, Math.round(inhScore * 0.35))
                      const reductionPct = Math.round(((inhScore - resScore) / inhScore) * 100)
                      return (
                        <tr key={i}>
                          <td>
                            <span className="font-medium text-slate-900">{r.risk_statement}</span>
                          </td>
                          <td className="font-mono text-slate-800 font-bold">{inhScore}/25</td>
                          <td className="text-slate-600">CTL-00{(i % 5) + 1}</td>
                          <td className="font-mono text-emerald-700 font-bold">{resScore}/25</td>
                          <td>
                            <span className="text-emerald-700 font-semibold">{reductionPct}% &darr;</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 border-t border-slate-300 text-xs text-slate-500 flex justify-between print:break-inside-avoid">
                <div><span>Formula: S = L &times; I &middot; Residual SLE = S_res &times; $10k</span></div>
                <div><span>Certified: Risk Governance Lead</span></div>
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* 7. REPORT: ISO/IEC 27001 Information Security Evidence Pack (RPT-007) */}
          {/* ========================================================================= */}
          {selectedReportId === 'RPT-007' && (
            <>
              <div className="pb-3 border-b border-slate-300 flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pericope ERM &middot; Information Security Management System</div>
                  <h2 className="text-xl font-bold text-slate-900 mt-0.5">ISO/IEC 27001:2022 Security Evidence Pack</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Annex A Information Security Controls &middot; Generated {new Date().toLocaleDateString()}</p>
                </div>
                <Badge variant="outline" className="text-xs border-slate-300">ISO 27001:2022</Badge>
              </div>

              <div className="space-y-2.5 print:break-inside-avoid">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">1. ISMS Control Implementation Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Annex A Controls</span>
                    <span className="text-xl font-bold text-slate-900 tabular-nums">93</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Implemented</span>
                    <span className="text-xl font-bold text-emerald-700 tabular-nums">96.8%</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Tested Frequency</span>
                    <span className="text-xl font-bold text-blue-700 tabular-nums">Continuous</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Audit Certification</span>
                    <span className="text-xl font-bold text-slate-900 tabular-nums">Compliant</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 print:break-inside-avoid">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">2. Key Information Security Controls Matrix</h3>
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th className="w-[15%]">Annex A Clause</th>
                      <th className="w-[35%]">Control Implementation</th>
                      <th className="w-[15%]">Nature</th>
                      <th className="w-[20%]">Testing Evidence</th>
                      <th className="w-[15%]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { clause: 'A.5.15', name: 'Multi-Factor Authentication on Production Systems', nature: 'Automated', evidence: 'SSO & Hardware Token Logs', status: 'Compliant' },
                      { clause: 'A.8.12', name: 'Data Leakage Prevention (DLP) Policies', nature: 'Automated', evidence: 'Cloud DLP Endpoint Audit', status: 'Compliant' },
                      { clause: 'A.8.24', name: 'Use of Cryptography (AES-256 GCM at Rest)', nature: 'Automated', evidence: 'Database Encryption Keys', status: 'Compliant' },
                      { clause: 'A.8.8', name: 'Management of Technical Vulnerabilities', nature: 'Hybrid', evidence: 'Monthly CVE Vulnerability Scans', status: 'Compliant' },
                      { clause: 'A.8.13', name: 'Information Backup & Offsite Retention', nature: 'Automated', evidence: 'Daily Geo-Redundant Backups', status: 'Compliant' },
                    ].map((row, i) => (
                      <tr key={i}>
                        <td className="font-mono text-slate-700 font-semibold">{row.clause}</td>
                        <td className="font-medium text-slate-900">{row.name}</td>
                        <td className="text-slate-600">{row.nature}</td>
                        <td className="text-slate-600">{row.evidence}</td>
                        <td>
                          <StatusBadge status="completed" label={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 border-t border-slate-300 text-xs text-slate-500 flex justify-between print:break-inside-avoid">
                <div><span>Chief Information Security Officer (CISO)</span></div>
                <div><span>ISMS Audit Scope: Stage 2 Surveillance Audit</span></div>
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* 8. REPORT: Third-Party Vendor Risk Assessment (TPRM) (RPT-008) */}
          {/* ========================================================================= */}
          {selectedReportId === 'RPT-008' && (
            <>
              <div className="pb-3 border-b border-slate-300 flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pericope ERM &middot; Vendor Governance</div>
                  <h2 className="text-xl font-bold text-slate-900 mt-0.5">Third-Party Risk Management (TPRM) Report</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Supplier Due Diligence & Criticality Review &middot; Generated {new Date().toLocaleDateString()}</p>
                </div>
                <Badge variant="outline" className="text-xs border-slate-300">TPRM Cadence</Badge>
              </div>

              <div className="space-y-2.5 print:break-inside-avoid">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">1. Vendor Portfolio Criticality Distribution</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Total Active Vendors</span>
                    <span className="text-xl font-bold text-slate-900 tabular-nums">{localVendors.length}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Critical Tier</span>
                    <span className="text-xl font-bold text-rose-700 tabular-nums">{localVendors.filter((v: any) => v.tier === 'Critical').length}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Annual Spend ($)</span>
                    <span className="text-xl font-bold text-slate-900 tabular-nums">${(localVendors.reduce((acc: number, v: any) => acc + v.contractValue, 0) / 1000000).toFixed(1)}M</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">Open Findings</span>
                    <span className="text-xl font-bold text-amber-700 tabular-nums">{localVendors.reduce((acc: number, v: any) => acc + v.findings, 0)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 print:break-inside-avoid">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">2. Critical Vendor Inventory & Risk Ratings</h3>
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th className="w-[28%]">Vendor Name</th>
                      <th className="w-[18%]">Service Category</th>
                      <th className="w-[14%]">Risk Tier</th>
                      <th className="w-[15%] text-right">Contract Spend</th>
                      <th className="w-[12%]">Risk Score</th>
                      <th className="w-[13%]">Next Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localVendors.map((v: any, idx: number) => (
                      <tr key={idx}>
                        <td>
                          <span className="font-medium text-slate-900">{v.name}</span>
                          <span className="block text-[10px] text-slate-400 font-mono">{v.id} &middot; {v.country}</span>
                        </td>
                        <td className="text-slate-600">{v.category}</td>
                        <td>
                          <StatusBadge status={v.tier === 'Critical' ? 'critical' : v.tier === 'High' ? 'high' : 'warning'} label={v.tier} />
                        </td>
                        <td className="text-right font-medium tabular-nums text-slate-900">${v.contractValue.toLocaleString()}</td>
                        <td className="font-bold tabular-nums text-slate-800">{v.riskScore}/100</td>
                        <td className="text-slate-600 text-[11px] font-mono">{v.nextReview}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 border-t border-slate-300 text-xs text-slate-500 flex justify-between print:break-inside-avoid">
                <div><span>Reviewed by: Head of Strategic Procurement</span></div>
                <div><span>TPRM Policy: Annual Re-Attestation Enforced</span></div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
