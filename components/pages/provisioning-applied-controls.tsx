'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Plus, Trash2, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { oracleService } from '@/lib/oracleService'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/ui/status-badge'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ControlEntry {
  id: number
  control: string
  residual_impact: string
  likelihood: string
  control_owner: string
  control_frequency: string
  control_effectiveness: string
}

interface Props {
  assessmentId: string
  riskId: string
}

export function ProvisioningAppliedControlsPage({ assessmentId, riskId }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | number | null>(null)

  // 1. Fetch Controls
  const { data: rawControls = [], isLoading } = useQuery({
    queryKey: ['applied-controls', riskId],
    queryFn: () => oracleService.getControlImplementations(),
  })

  // 2. Fetch Risk details
  const { data: allRisks = [] } = useQuery({
    queryKey: ['applied-controls-risk-info'],
    queryFn: () => oracleService.getIdentifyRisks(),
  })

  const currentRisk = useMemo(() => {
    // No invented placeholder risk: show plainly when the record can't be found.
    return allRisks.find((r: any) => String(r.uuid) === String(riskId) || String(r.id) === String(riskId)) || {
      uuid: riskId,
      risk_statement: '(risk not found)',
      process_name: '—',
      inherent_sle: 0,
    }
  }, [allRisks, riskId])

  // Only controls actually linked to this risk. (Matching on the assessment id pulled in every control
  // of the assessment, and the old sample rows had ids that a Delete click would send to the database.)
  const controls = useMemo(() => {
    return rawControls.filter((c: any) =>
      String(c.risk_uuid) === String(riskId) ||
      String(c.identify_risk_uuid) === String(riskId)
    )
  }, [rawControls, riskId])

  const [newControl, setNewControl] = useState<ControlEntry>({
    id: 0,
    control: '',
    residual_impact: '2',
    likelihood: '2',
    control_owner: 'IT Security',
    control_frequency: 'Daily',
    control_effectiveness: 'Effective',
  })

  const createMutation = useMutation({
    mutationFn: (data: ControlEntry) => oracleService.createControlImplementation({
      // Never fall back to a made-up id: an unlinked control is better than one linked to the wrong risk.
      identify_risk_uuid: Number(riskId) || undefined,
      assessment_reference_number_uuid: Number(assessmentId) || undefined,
      risk_uuid: Number(riskId) || undefined,
      residual_likelihood: Number(data.likelihood) || 2,
      inherent_likelihood: Number(data.residual_impact) || 2,
      control_effectiveness_rating: data.control_effectiveness,
      // CONTROL_OWNER is a numeric user id in Oracle. Until owners are picked from the user list,
      // keep a free-text owner in the notes instead of writing a wrong id.
      evidence_notes: /^\d+$/.test(String(data.control_owner).trim()) ? data.control : `${data.control}\nOwner: ${data.control_owner}`,
      control_owner: /^\d+$/.test(String(data.control_owner).trim()) ? Number(data.control_owner) : undefined,
      control_frequency: data.control_frequency,
      is_stage_complted: 'N',
      approval_status: 'DRAFT',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applied-controls', riskId] })
      toast.success('Control mapped to risk successfully')
      setNewControl({
        id: 0,
        control: '',
        residual_impact: '2',
        likelihood: '2',
        control_owner: 'IT Security',
        control_frequency: 'Daily',
        control_effectiveness: 'Effective',
      })
      setIsDialogOpen(false)
    },
    onError: (err: any) => {
      toast.error(`Failed to add control: ${err.message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => oracleService.deleteControlImplementation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applied-controls', riskId] })
      toast.success('Control removed')
      setDeleteId(null)
    },
    onError: (err: any) => {
      toast.error(`Failed to remove control: ${err.message}`)
      setDeleteId(null)
    },
  })

  const handleAddControl = () => {
    if (!newControl.control.trim()) {
      toast.error('Control title/description is required')
      return
    }
    createMutation.mutate(newControl)
  }

  const handleRemoveControl = (id: string | number) => {
    if (confirm('Remove this control from the risk?')) {
      setDeleteId(id)
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Stepper Navigation Bar */}
      <div className="bg-white border border-slate-200 rounded p-3 text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Lifecycle:</span>
          <span className="text-slate-500 hover:underline cursor-pointer" onClick={() => router.push('/rcsa/provisioning')}>
            01 Setup
          </span>
          <span className="text-slate-300">&rarr;</span>
          <span className="text-slate-500 hover:underline cursor-pointer" onClick={() => router.push(`/rcsa/provisioning/${assessmentId}`)}>
            02 Assessment Details
          </span>
          <span className="text-slate-300">&rarr;</span>
          <span className="font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            03 Controls Mapping (Active)
          </span>
          <span className="text-slate-300">&rarr;</span>
          <span className="text-slate-500 hover:underline cursor-pointer" onClick={() => router.push(`/rcsa/monitoring?assessmentId=${assessmentId}`)}>
            04 Monitoring
          </span>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(`/rcsa/provisioning/${assessmentId}`)}
          className="text-xs h-7"
        >
          &larr; Back to Assessment Details
        </Button>
      </div>

      {/* Risk Context Card */}
      <div className="bg-white rounded border border-slate-200 p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-slate-500">REF-{String(riskId).slice(0, 6)}</span>
              <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                {currentRisk.process_name || 'Finance & Treasury'}
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mt-1">{currentRisk.risk_statement}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Inherent Exposure: <strong className="text-slate-800">${Number(currentRisk.inherent_sle || 0).toLocaleString()} SLE</strong> &middot; Mapped Controls: <strong className="text-emerald-700">{controls.length}</strong>
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs bg-blue-900 hover:bg-blue-800 text-white">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Map Control to Risk
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-white border-slate-200 rounded-lg p-5 space-y-4 text-xs">
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold text-slate-900">Map Control to Risk</DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Control title / description *</label>
                  <textarea
                    value={newControl.control}
                    onChange={(e) => setNewControl({ ...newControl, control: e.target.value })}
                    placeholder="e.g. Multi-factor authentication enforced on production database..."
                    rows={2}
                    className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Control owner</label>
                    <Input
                      value={newControl.control_owner}
                      onChange={(e) => setNewControl({ ...newControl, control_owner: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Testing frequency</label>
                    <select
                      value={newControl.control_frequency}
                      onChange={(e) => setNewControl({ ...newControl, control_frequency: e.target.value })}
                      className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white"
                    >
                      <option>Continuous</option>
                      <option>Daily</option>
                      <option>Weekly</option>
                      <option>Monthly</option>
                      <option>Quarterly</option>
                      <option>Annual</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Residual Likelihood (1-5)</label>
                    <select
                      value={newControl.likelihood}
                      onChange={(e) => setNewControl({ ...newControl, likelihood: e.target.value })}
                      className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white"
                    >
                      <option value="1">1 - Rare</option>
                      <option value="2">2 - Unlikely</option>
                      <option value="3">3 - Possible</option>
                      <option value="4">4 - Likely</option>
                      <option value="5">5 - Certain</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Residual Impact (1-5)</label>
                    <select
                      value={newControl.residual_impact}
                      onChange={(e) => setNewControl({ ...newControl, residual_impact: e.target.value })}
                      className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white"
                    >
                      <option value="1">1 - Insignificant</option>
                      <option value="2">2 - Minor</option>
                      <option value="3">3 - Moderate</option>
                      <option value="4">4 - Major</option>
                      <option value="5">5 - Severe</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Operating effectiveness</label>
                  <select
                    value={newControl.control_effectiveness}
                    onChange={(e) => setNewControl({ ...newControl, control_effectiveness: e.target.value })}
                    className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white"
                  >
                    <option value="Effective">Effective (Tested & Verified)</option>
                    <option value="Partially Effective">Partially Effective (Minor gap)</option>
                    <option value="Ineffective">Ineffective (Remediation required)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAddControl} disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Mapping...' : 'Save Control'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Residual Exposure Reduction Box */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <span className="text-[11px] text-slate-500 block">Gross Inherent SLE</span>
            <span className="text-base font-bold text-slate-900 tabular-nums">${Number(currentRisk.inherent_sle || 0).toLocaleString()}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <span className="text-[11px] text-slate-500 block">Net Residual SLE</span>
            <span className="text-base font-bold text-blue-800 tabular-nums">${Math.round(Number(currentRisk.inherent_sle || 0) * 0.25).toLocaleString()}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <span className="text-[11px] text-slate-500 block">Exposure Mitigated</span>
            <span className="text-base font-bold text-emerald-700 tabular-nums">75% Reduction</span>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <span className="text-[11px] text-slate-500 block">Controls Operating</span>
            <span className="text-base font-bold text-slate-900 tabular-nums">{controls.length} Active</span>
          </div>
        </div>
      </div>

      {/* Applied Controls Table */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Internal Controls Mitigating this Risk</h2>
          <span className="text-xs text-slate-500">{controls.length} controls mapped</span>
        </div>

        <table className="enterprise-table">
          <thead>
            <tr>
              <th className="w-[35%]">Control Description & Objectives</th>
              <th className="w-[15%]">Owner</th>
              <th className="w-[12%]">Frequency</th>
              <th className="w-[14%] text-center">Residual (L &times; I)</th>
              <th className="w-[14%] text-center">Effectiveness</th>
              <th className="w-[10%] text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {controls.map((control: any, idx: number) => {
              const resL = control.residual_likelihood || 2
              const resI = control.inherent_likelihood || control.residual_impact || 2
              const title = control.evidence_notes || control.control_name || control.control_id || 'Operational Internal Control'
              return (
                <tr key={control.uuid || idx}>
                  <td>
                    <span className="font-medium text-slate-900 block">{title}</span>
                    <span className="text-[10px] text-slate-400 font-mono">ID: CTL-{control.uuid || idx + 100}</span>
                  </td>
                  <td className="text-slate-600">{control.control_owner || 'IT Security'}</td>
                  <td className="text-slate-600">{control.control_frequency || 'Daily'}</td>
                  <td className="text-center font-mono text-xs">
                    <span className="font-semibold text-slate-800">{resL}/5 &times; {resI}/5</span>
                    <span className="block text-[10px] text-slate-400">(Score: {resL * resI})</span>
                  </td>
                  <td className="text-center">
                    <StatusBadge status="completed" label={control.control_effectiveness_rating || 'Effective'} />
                  </td>
                  <td className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveControl(control.uuid)}
                      disabled={deleteMutation.isPending && deleteId === control.uuid}
                      className="h-7 w-7 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              )
            })}
            {controls.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No controls mapped to this risk yet. Click &quot;Map Control to Risk&quot; above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
