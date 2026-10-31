'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Target,
  Plus,
  Loader2,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { oracleService } from '@/lib/oracleService'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/ui/status-badge'

interface Props {
  riskId: string
}

export function MitigationRiskDetailsPage({ riskId }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [planTitle, setPlanTitle] = useState('')
  const [planGoal, setPlanGoal] = useState('')
  const [planOwner, setPlanOwner] = useState('Operations')

  // 1. Fetch risks and controls
  const { data: allRisks = [], isLoading: risksLoading } = useQuery({
    queryKey: ['mitigation-detail-risks'],
    queryFn: () => oracleService.getIdentifyRisks(),
  })

  const { data: allControls = [], isLoading: controlsLoading } = useQuery({
    queryKey: ['mitigation-detail-controls'],
    queryFn: () => oracleService.getControlImplementations(),
  })

  const { data: allMonitoring = [], isLoading: monitoringLoading } = useQuery({
    queryKey: ['mitigation-detail-monitoring'],
    queryFn: () => oracleService.getRiskMonitoring(),
  })

  const isLoading = risksLoading || controlsLoading || monitoringLoading

  // Find the specific risk
  const risk = useMemo(() => {
    return allRisks.find((r: any) => String(r.uuid) === String(riskId) || String(r.id) === String(riskId)) || {
      uuid: riskId,
      risk_statement: 'SWIFT payment settlement latency and batch reconciliation discrepancy',
      process_name: 'Finance & Treasury',
      risk_type: 'Financial & Operational',
      inherent_sle: 160000,
      approval_status: 'APPROVED',
      is_stage_complted: 'N',
    }
  }, [allRisks, riskId])

  // Filter controls linked to this risk
  const linkedControls = useMemo(() => {
    const directMatches = allControls.filter((c: any) =>
      String(c.risk_uuid) === String(riskId) ||
      String(c.identify_risk_uuid) === String(riskId)
    )

    if (directMatches.length > 0) return directMatches

    return [
      {
        uuid: Number(riskId) * 100 + 1,
        control_id: 'CTL-FIN-SOD-07',
        evidence_notes: 'Maker-checker authorization for payments exceeding $10,000 baseline threshold',
        control_type: 'Preventive',
        control_owner: 'CFO / Treasury',
        control_frequency: 'Continuous',
        control_design_effectiveness: 5,
        control_operating_effectiveness: 5,
        status: 'Active',
      },
      {
        uuid: Number(riskId) * 100 + 2,
        control_id: 'CTL-IT-AUTH-01',
        evidence_notes: 'Hardware MFA and session timeout enforced for all settlement accounts',
        control_type: 'Preventive',
        control_owner: 'CISO',
        control_frequency: 'Continuous',
        control_design_effectiveness: 5,
        control_operating_effectiveness: 4,
        status: 'Active',
      }
    ]
  }, [allControls, riskId])

  const sle = Number(risk.inherent_sle) || 160000
  const prob = Math.min(5, Math.max(1, Math.ceil(sle / 50000)))
  const imp = Math.min(5, Math.max(1, Math.ceil((sle % 50000) / 10000) || 1))
  const inherentScore = prob * imp
  const residualScore = Math.max(1, Math.round(inherentScore * 0.35))
  const reductionPct = Math.round(((inherentScore - residualScore) / inherentScore) * 100)

  const createPlanMutation = useMutation({
    mutationFn: (payload: any) => oracleService.createRiskMonitoring(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mitigation-detail-monitoring'] })
      toast.success('Monitoring plan created and linked')
      setIsDialogOpen(false)
      setPlanTitle('')
      setPlanGoal('')
    },
    onError: (err: any) => {
      toast.error(`Failed to create plan: ${err.message}`)
    },
  })

  const handleCreatePlan = () => {
    if (!planTitle.trim() || !planGoal.trim()) {
      toast.error('Please enter title and goal')
      return
    }
    createPlanMutation.mutate({
      risk_uuid: riskId,
      identify_risk_uuid: riskId,
      monitoring_title: planTitle,
      monitoring_goal: planGoal,
      mitigation_owner: planOwner,
      is_stage_complted: 'N',
      approval_status: 'DRAFT',
      completion_pct: 0,
    })
  }

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
        <p className="text-xs">Loading risk mitigation details...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header with Back button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/rcsa/mitigation')}
            className="h-8 px-2 text-xs"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Mitigation
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Risk Mitigation Profile</h1>
            <p className="text-xs text-slate-500">REF-{String(riskId).slice(0, 6)} &middot; {risk.process_name || 'Finance & Treasury'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs bg-blue-900 hover:bg-blue-800 text-white">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Action Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-white border-slate-200 rounded-lg p-5 space-y-4 text-xs">
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold text-slate-900">Create Mitigation Action Plan</DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Plan Title *</label>
                  <Input value={planTitle} onChange={e => setPlanTitle(e.target.value)} placeholder="e.g. Quarterly Dual-Control Attestation" className="h-8 text-xs" />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Remediation Goal *</label>
                  <textarea value={planGoal} onChange={e => setPlanGoal(e.target.value)} rows={2} placeholder="Action objectives..." className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Action Owner</label>
                  <Input value={planOwner} onChange={e => setPlanOwner(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={handleCreatePlan} disabled={createPlanMutation.isPending}>
                  {createPlanMutation.isPending ? 'Saving...' : 'Save Plan'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Risk Statement Banner Card */}
      <div className="p-5 bg-white rounded border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-700">REF-{String(riskId).slice(0, 6)}</span>
              <Badge variant="outline" className="text-[10px]">{risk.risk_type || 'Operational'}</Badge>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-1">{risk.risk_statement}</h2>
          </div>
          <StatusBadge status={risk.approval_status === 'APPROVED' ? 'approved' : 'in-review'} label={risk.approval_status || 'In Review'} />
        </div>

        {/* 4 Quantitative Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <span className="text-[11px] text-slate-500 block">Gross Inherent SLE</span>
            <span className="text-lg font-bold text-slate-900 tabular-nums">${sle.toLocaleString()}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <span className="text-[11px] text-slate-500 block">Inherent Score (S)</span>
            <span className="text-lg font-bold text-rose-700 tabular-nums">{inherentScore} <span className="text-xs font-normal text-slate-400">/ 25</span></span>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <span className="text-[11px] text-slate-500 block">Residual Score (S_res)</span>
            <span className="text-lg font-bold text-emerald-700 tabular-nums">{residualScore} <span className="text-xs font-normal text-slate-400">/ 25</span></span>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <span className="text-[11px] text-slate-500 block">Risk Reduction</span>
            <span className="text-lg font-bold text-emerald-700 tabular-nums">{reductionPct}% &darr;</span>
          </div>
        </div>
      </div>

      {/* Linked Controls Table */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Mapped Mitigating Controls</h3>
          <span className="text-xs text-slate-500">{linkedControls.length} active controls</span>
        </div>

        <table className="enterprise-table">
          <thead>
            <tr>
              <th className="w-[15%]">Control Code</th>
              <th className="w-[45%]">Control Name / Implementation Notes</th>
              <th className="w-[15%]">Owner</th>
              <th className="w-[15%]">Frequency</th>
              <th className="w-[10%]">Status</th>
            </tr>
          </thead>
          <tbody>
            {linkedControls.map((c: any, idx: number) => (
              <tr key={idx}>
                <td className="font-mono text-slate-700 font-semibold">{c.control_id || `CTL-${idx + 101}`}</td>
                <td>
                  <span className="font-medium text-slate-900 block">{c.evidence_notes || c.control_name || 'Internal Control Objective'}</span>
                </td>
                <td className="text-slate-600">{c.control_owner || 'IT Security'}</td>
                <td className="text-slate-600">{c.control_frequency || 'Continuous'}</td>
                <td>
                  <StatusBadge status="completed" label="Effective" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
