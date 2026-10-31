'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { 
  Save, 
  RotateCcw, 
  Building2, 
  User, 
  HelpCircle, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Plus,
  Shield,
  Activity
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { motion, AnimatePresence } from 'framer-motion'
import { oracleService } from '@/lib/oracleService'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// 1. Validation Schema
const riskSchema = z.object({
  HIERARCHY_LEVEL: z.string().min(1, 'Required'),
  HIERARCHY_NAME: z.string().min(1, 'Required'),
  REFERENCE_NO: z.string().optional(),
  ASSESSMENT_REGISTERED_DATE: z.string().min(1, 'Required'),
  START_DATE: z.string().optional(),
  END_DATE: z.string().optional(),
  PROCESS: z.string().min(1, 'Required'),
  SUB_PROCESS: z.string().min(1, 'Required'),
  RISK_TYPE: z.string().min(1, 'Required'),
  RISK_STATEMENT: z.string().min(10, 'Min 10 chars'),
  IS_SOP_AVAILABLE: z.enum(['Yes', 'No', 'Partial / Outdated']),
  INHERENT_SLE: z.string().or(z.number()).transform(v => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0),
})

type RiskFormValues = z.infer<typeof riskSchema>

const WIZARD_STEPS = [
  { id: 1, title: 'Identify' },
  { id: 2, title: 'Inherent Risk Assessment' },
  { id: 3, title: 'Control Implementation' },
  { id: 4, title: 'Risk Monitoring' }
]

// Types for added risks
type AddedRisk = {
  id: string
  statement: string
  prob: number
  impact: number
  owner: string
  sle: number
}

export function RiskplanningidentifyPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [activeStep, setActiveStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isIdentifyStageComplete, setIsIdentifyStageComplete] = useState(false)
  const [addedRisks, setAddedRisks] = useState<AddedRisk[]>([])
  const [showRiskForm, setShowRiskForm] = useState(false)
  const [newRisk, setNewRisk] = useState<Partial<AddedRisk>>({ prob: 3, impact: 3 })

  // 2. React Hook Form Setup
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    watch
  } = useForm<RiskFormValues>({
    resolver: zodResolver(riskSchema),
    defaultValues: {
      HIERARCHY_LEVEL: 'Group',
      HIERARCHY_NAME: 'Demo_Bank (Demo_TRPGlobal)',
      REFERENCE_NO: 'RSK-ASS-08-2025-186',
      ASSESSMENT_REGISTERED_DATE: '2025-09-05',
      START_DATE: '2025-08-28',
      END_DATE: '2025-09-03',
      PROCESS: 'Iraq_bank_Risk Management and Con',
      SUB_PROCESS: 'Risk Assessment',
      RISK_TYPE: 'Threat',
      RISK_STATEMENT: 'R_Fin_IRAQ02_Single high-value cash deposit',
      IS_SOP_AVAILABLE: 'Yes',
      INHERENT_SLE: 1000000,
    }
  })

  // 3. Submission Logic
  const onSubmit = async (data: RiskFormValues) => {
    if (activeStep < 4) {
      setActiveStep(prev => prev + 1)
      return
    }
    
    setIsSubmitting(true)
    try {
      // Map form fields to actual Oracle PER_TRN_IDENTIFY_RISK columns
      const submissionData = {
        hierarchy_level: data.HIERARCHY_LEVEL === 'Enterprise' ? 1 : 
                        data.HIERARCHY_LEVEL === 'Business Unit' ? 2 : 
                        data.HIERARCHY_LEVEL === 'Department' ? 3 : 
                        data.HIERARCHY_LEVEL === 'Process' ? 4 : 0,
        assessment_reference_number: data.REFERENCE_NO || '',
        assessment_registered_date: new Date(data.ASSESSMENT_REGISTERED_DATE).toISOString(),
        start_date: data.START_DATE ? new Date(data.START_DATE).toISOString() : new Date().toISOString(),
        end_date: data.END_DATE ? new Date(data.END_DATE).toISOString() : new Date().toISOString(),
        process_name: data.PROCESS,
        sub_process_name: data.SUB_PROCESS,
        risk_type: data.RISK_TYPE,
        risk_statement: data.RISK_STATEMENT,
        is_sop_available: data.IS_SOP_AVAILABLE === 'Yes' ? 'Y' : 'N',
        inherent_sle: Number(data.INHERENT_SLE) || 0,
        is_stage_complted: isIdentifyStageComplete ? 'Y' : 'N',
        approval_status: 'DRAFT',
        status: 'N',
      }

      await oracleService.createIdentifyRisk(submissionData)
      
      toast({
        title: 'Workflow Complete',
        description: 'Record has been successfully persisted to ADW.',
        variant: 'default',
        className: 'bg-blue-600 text-white border-none'
      })
      
      setTimeout(() => router.back(), 1500)
    } catch (error) {
      console.error('[ERMWizard] Submission failed:', error)
      toast({
        title: 'Persistence Error',
        description: 'Failed to save record. Check network or permissions.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddRisk = () => {
    if (!newRisk.statement || !newRisk.owner) {
      toast({ title: 'Validation Error', description: 'Please fill out Statement and Owner', variant: 'destructive' })
      return
    }
    setAddedRisks([...addedRisks, {
      ...newRisk,
      id: Math.random().toString(36).substr(2, 9),
      prob: newRisk.prob || 3,
      impact: newRisk.impact || 3,
      sle: newRisk.sle || 0,
    } as AddedRisk])
    setShowRiskForm(false)
    setNewRisk({ prob: 3, impact: 3 })
  }

  // Generate 5x5 Heatmap data dynamically from addedRisks
  const heatmapData = Array.from({ length: 25 }, (_, i) => {
    const row = Math.floor(i / 5)
    const col = i % 5
    const prob = 5 - row
    const impact = col + 1
    const matching = addedRisks.filter(r => r.prob === prob && r.impact === impact).length
    return { prob, impact, score: prob * impact, count: matching }
  })

  return (
    <div className="flex-1 min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header / Wizard Progress */}
      <div className="border-b border-border/60 bg-card/80 backdrop-blur-3xl sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => router.back()} className="h-8 text-xs font-bold shadow-sm">
            Cancel
          </Button>
          
          <div className="flex-1 flex items-center justify-center max-w-3xl mx-auto relative px-8">
            <div className="absolute left-8 right-8 top-1/2 -tranblue-y-1/2 h-0.5 bg-border/60 -z-10" />
            <div className="flex justify-between w-full relative z-10">
              {WIZARD_STEPS.map((step) => {
                const isActive = activeStep === step.id
                const isPassed = activeStep > step.id
                return (
                  <div key={step.id} className="flex flex-col items-center gap-2 bg-card/80 rounded-full px-2" onClick={() => setActiveStep(step.id)}>
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black transition-all cursor-pointer shadow-sm border-2",
                      isActive ? "bg-primary text-primary-foreground border-primary scale-110 shadow-md" :
                      isPassed ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border/80"
                    )}>
                      {isPassed ? <CheckCircle className="w-3.5 h-3.5" /> : step.id}
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold absolute -bottom-6 w-32 text-center transition-colors",
                      isActive ? "text-primary" : isPassed ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {step.title}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <Button 
            onClick={handleSubmit(onSubmit)}
            size="sm" 
            className="h-8 text-xs font-bold shadow-md bg-foreground text-background hover:bg-foreground/90 gap-1.5"
          >
            {activeStep === 4 ? 'Complete' : 'Next'}
            {activeStep < 4 && <ChevronRight className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-muted/20">
        <div className="max-w-[1400px] mx-auto p-6 mt-4">
          
          {/* Identify Stage Toolbar */}
          {activeStep === 1 && (
            <FadeIn>
              <div className="mb-4 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="rounded border-border/60 text-primary focus:ring-primary/20 w-4 h-4 transition-all"
                    checked={isIdentifyStageComplete}
                    onChange={(e) => setIsIdentifyStageComplete(e.target.checked)}
                  />
                  Mark Identify Stage Complete
                </label>
              </div>

              <div className="flex items-center justify-between bg-card/60 backdrop-blur-md border border-border/60 p-4 rounded-t-xl">
                <div className="px-4 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-bold shadow-sm">
                  Risk Planning Details
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" variant="outline" className="h-8 text-[11px] font-bold tracking-wider text-primary border-primary/30 hover:bg-primary/5 bg-transparent shadow-sm">
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add New Risk
                  </Button>
                  <Button size="sm" className="h-8 text-[11px] font-bold tracking-wider bg-blue-600 hover:bg-blue-700 text-white shadow-md border-none">
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Apply Changes
                  </Button>
                </div>
              </div>
            </FadeIn>
          )}

          {/* Form Content */}
          <div className="bg-card border border-border/60 rounded-b-xl shadow-sm p-6 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar">
            <form id="erm-wizard-form" onSubmit={handleSubmit(onSubmit)}>
              
              {activeStep === 1 && (
                <FadeIn className="space-y-6">
                  <h3 className="text-sm font-black text-foreground tracking-tight border-b border-border/40 pb-2">Identify</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-x-4 gap-y-5">
                    
                    {/* Compact Fields */}
                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex justify-between">
                        Hierarchy Level <span className="text-[9px] lowercase opacity-50 italic">Required</span>
                      </label>
                      <select {...register('HIERARCHY_LEVEL')} className="w-full h-8 px-2 text-xs font-semibold bg-background border border-border/60 rounded focus:ring-1 focus:ring-primary/30 outline-none">
                        <option>Group</option>
                        <option>Enterprise</option>
                        <option>Business Unit</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 col-span-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex justify-between">
                        Hierarchy Name <span className="text-[9px] lowercase opacity-50 italic">Required</span>
                      </label>
                      <select {...register('HIERARCHY_NAME')} className="w-full h-8 px-2 text-xs font-semibold bg-background border border-border/60 rounded focus:ring-1 focus:ring-primary/30 outline-none">
                        <option>Demo_Bank (Demo_TRPGlobal)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 col-span-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Reference No</label>
                      <Input {...register('REFERENCE_NO')} className="h-8 text-xs font-semibold border-border/60 rounded" />
                    </div>

                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex justify-between">
                        Assessment Date <span className="text-[9px] lowercase opacity-50 italic">Required</span>
                      </label>
                      <Input type="date" {...register('ASSESSMENT_REGISTERED_DATE')} className="h-8 text-xs font-semibold border-border/60 rounded" />
                    </div>

                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex justify-between">
                        Start Date <span className="text-[9px] lowercase opacity-50 italic">Required</span>
                      </label>
                      <Input type="date" {...register('START_DATE')} className="h-8 text-xs font-semibold border-border/60 rounded" />
                    </div>

                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex justify-between">
                        End Date <span className="text-[9px] lowercase opacity-50 italic">Required</span>
                      </label>
                      <Input type="date" {...register('END_DATE')} className="h-8 text-xs font-semibold border-border/60 rounded" />
                    </div>

                    {/* Spacing to push to next row nicely */}
                    <div className="col-span-2" />

                    <div className="space-y-1.5 col-span-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex justify-between">
                        Process <span className="text-[9px] lowercase opacity-50 italic">Required</span>
                      </label>
                      <select {...register('PROCESS')} className="w-full h-8 px-2 text-xs font-semibold bg-background border border-border/60 rounded focus:ring-1 focus:ring-primary/30 outline-none overflow-hidden text-ellipsis">
                        <option>Iraq_bank_Risk Management and Con...</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex justify-between">
                        Sub Process <span className="text-[9px] lowercase opacity-50 italic">Required</span>
                      </label>
                      <select {...register('SUB_PROCESS')} className="w-full h-8 px-2 text-xs font-semibold bg-background border border-border/60 rounded focus:ring-1 focus:ring-primary/30 outline-none">
                        <option>Risk Assessment</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Risk Type</label>
                      <select {...register('RISK_TYPE')} className="w-full h-8 px-2 text-xs font-semibold bg-background border border-border/60 rounded focus:ring-1 focus:ring-primary/30 outline-none">
                        <option>Threat</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 col-span-4">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex justify-between">
                        Risk Statement <span className="text-[9px] lowercase opacity-50 italic">Required</span>
                      </label>
                      <select {...register('RISK_STATEMENT')} className="w-full h-8 px-2 text-xs font-semibold bg-background border border-border/60 rounded focus:ring-1 focus:ring-primary/30 outline-none">
                        <option>R_Fin_IRAQ02_Single high-value cash deposit</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 col-span-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Is SOP Available?</label>
                      <select {...register('IS_SOP_AVAILABLE')} className="w-full h-8 px-2 text-xs font-semibold bg-background border border-border/60 rounded focus:ring-1 focus:ring-primary/30 outline-none">
                        <option>Yes</option>
                        <option>No</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 col-span-4">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Inherent Sle</label>
                      <Input {...register('INHERENT_SLE')} type="number" className="h-8 text-xs font-semibold border-border/60 rounded" />
                    </div>

                  </div>
                </FadeIn>
              )}

              {activeStep === 2 && (
                <FadeIn className="space-y-6">
                  <div className="flex justify-between items-end border-b border-border/40 pb-2">
                    <div>
                      <h3 className="text-sm font-black text-foreground tracking-tight">Inherent Risk Assessment</h3>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Add multiple risks, assign owners, and generate heatmaps</p>
                    </div>
                    {!showRiskForm && (
                      <Button type="button" onClick={() => setShowRiskForm(true)} size="sm" className="h-8 text-[11px] font-bold tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Risk
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Side: Table & Form */}
                    <div className="lg:col-span-2 space-y-4">
                      
                      {showRiskForm && (
                        <div className="p-4 bg-muted/30 border border-border/60 rounded-xl space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">New Risk Details</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 space-y-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-wider">Risk Statement</label>
                              <Input value={newRisk.statement || ''} onChange={e => setNewRisk({...newRisk, statement: e.target.value})} className="h-8 text-xs font-semibold" placeholder="e.g. Unauthorized access to server" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-wider">Likelihood (1-5)</label>
                              <select value={newRisk.prob} onChange={e => setNewRisk({...newRisk, prob: Number(e.target.value)})} className="w-full h-8 px-2 text-xs font-semibold bg-background border border-border/60 rounded">
                                {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-wider">Impact (1-5)</label>
                              <select value={newRisk.impact} onChange={e => setNewRisk({...newRisk, impact: Number(e.target.value)})} className="w-full h-8 px-2 text-xs font-semibold bg-background border border-border/60 rounded">
                                {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-wider">Risk Owner</label>
                              <Input value={newRisk.owner || ''} onChange={e => setNewRisk({...newRisk, owner: e.target.value})} className="h-8 text-xs font-semibold" placeholder="e.g. IT Sec Team" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-wider">Inherent SLE ($)</label>
                              <Input type="number" value={newRisk.sle || ''} onChange={e => setNewRisk({...newRisk, sle: Number(e.target.value)})} className="h-8 text-xs font-semibold" placeholder="50000" />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setShowRiskForm(false)} className="h-7 text-[10px]">Cancel</Button>
                            <Button type="button" onClick={handleAddRisk} size="sm" className="h-7 text-[10px] bg-blue-600 hover:bg-blue-700 text-white">Save Risk</Button>
                          </div>
                        </div>
                      )}

                      <div className="border border-border/60 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-secondary/40 border-b border-border/40 text-[9px] text-muted-foreground font-black uppercase tracking-wider">
                            <tr>
                              <th className="px-3 py-2">Risk Statement</th>
                              <th className="px-3 py-2 text-center">Score</th>
                              <th className="px-3 py-2">Owner</th>
                              <th className="px-3 py-2 text-right">SLE ($)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {addedRisks.length === 0 ? (
                              <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground italic font-medium">No risks added to this assessment yet.</td></tr>
                            ) : (
                              addedRisks.map((r, idx) => {
                                const score = r.prob * r.impact
                                const isRed = score >= 16
                                const isOrange = score >= 10 && score < 16
                                return (
                                  <tr key={idx} className="border-b border-border/30 last:border-0 hover:bg-muted/50 transition-colors font-medium">
                                    <td className="px-3 py-2 text-foreground font-semibold">{r.statement}</td>
                                    <td className="px-3 py-2 text-center">
                                      <span className={cn(
                                        "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                        isRed ? "bg-rose-50 text-rose-700 border border-rose-200" : isOrange ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      )}>{score}</span>
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground">{r.owner}</td>
                                    <td className="px-3 py-2 text-right font-mono">{r.sle.toLocaleString()}</td>
                                  </tr>
                                )
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Right Side: Heatmap */}
                    <div className="lg:col-span-1 border border-border/60 rounded-xl p-4 bg-card/40 flex flex-col items-center shadow-sm">
                      <h4 className="text-xs font-black uppercase tracking-widest text-foreground w-full text-center mb-4">Assessment Heatmap</h4>
                      <div className="grid grid-cols-5 gap-1 w-full max-w-[200px] mb-2">
                        {heatmapData.map((cell, i) => {
                          const isRed = cell.score >= 16
                          const isOrange = cell.score >= 10 && cell.score < 16
                          const isGreen = cell.score < 6
                          const bgClass = cell.count === 0 ? 'bg-slate-50 border border-slate-200 text-slate-300' :
                                        isRed ? 'bg-rose-50 border border-rose-200 text-rose-800 font-semibold' : 
                                        isOrange ? 'bg-amber-50 border border-amber-200 text-amber-800 font-semibold' : 
                                        isGreen ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium' :
                                        'bg-blue-50 text-blue-800 font-medium border border-blue-200'
                          return (
                            <div key={i} className={cn("aspect-square rounded flex items-center justify-center text-[10px]", bgClass)}>
                              {cell.count > 0 ? cell.count : ''}
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-[9px] text-muted-foreground font-bold tracking-wider uppercase mt-2 w-full text-center">Likelihood (Vertical) × Impact (Horizontal)</p>
                    </div>

                  </div>
                </FadeIn>
              )}

              {activeStep === 3 && (
                <FadeIn className="text-center py-20">
                  <div className="w-16 h-16 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-2xl mx-auto flex items-center justify-center mb-4">
                    <Shield className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-black text-foreground mb-2">Control Implementation</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">Map specific controls to mitigate the inherent risks identified in the previous step.</p>
                  <Button variant="outline" className="shadow-sm border-blue-500/20 text-blue-500 bg-blue-500/5 font-bold text-xs uppercase tracking-widest gap-2">
                    <Plus className="w-4 h-4" /> Import Controls
                  </Button>
                </FadeIn>
              )}

              {activeStep === 4 && (
                <FadeIn className="text-center py-20">
                  <div className="w-16 h-16 bg-blue-600/10 text-blue-600 border border-blue-600/20 rounded-2xl mx-auto flex items-center justify-center mb-4">
                    <Activity className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-black text-foreground mb-2">Risk Monitoring</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">Establish monitoring thresholds and metrics for the identified risks and controls.</p>
                  <Button onClick={() => toast({ title: 'Monitoring Sync', description: 'Monitoring parameters registered successfully.' })} type="button" className="shadow-md bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest gap-2">
                    <CheckCircle className="w-4 h-4" /> Finalize Workflow
                  </Button>
                </FadeIn>
              )}

            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
