'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { 
  Target, 
  Save, 
  RotateCcw, 
  AlertOctagon, 
  Activity, 
  Users, 
  Loader2, 
  ArrowLeft,
  ShieldAlert
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { motion } from 'framer-motion'
import { oracleService } from '@/lib/oracleService'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// 1. Validation Schema
const assessmentSchema = z.object({
  RISK_CATEGORY: z.string().min(1, 'Risk Category is required'),
  SUB_CATEGORY: z.string().min(1, 'Sub Category is required'),
  ROOT_CAUSE: z.string().min(10, 'Root Cause must be at least 10 characters'),
  CASUAL_FACTOR: z.string().optional(),
  DATA_SOURCE: z.string().optional(),
  OWNERS: z.string().min(1, 'Owner is required'),
  CURRENT_CYCLE: z.string().min(1, 'Current Cycle is required'),
  LIKELIHOOD: z.string(),
  IMPACT_CATEGORY: z.string(),
  IMPACT_PARTIES: z.string().optional(),
  IMPACT_DESCRIPTION: z.string().min(10, 'Impact Description must be at least 10 characters'),
})

type AssessmentFormValues = z.infer<typeof assessmentSchema>

// Avoid using useSearchParams inside Suspense-prone boundaries.
// We'll read the query param directly from the window location on the client.

export function AssessmentsinherentPage() {
  const { toast } = useToast()
  const router = useRouter()
  const riskId: string | null = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('riskId') : null
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [initialLoading, setInitialLoading] = useState(!!riskId)

  // 2. Form Setup
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: {
      RISK_CATEGORY: 'Strategic risk',
      SUB_CATEGORY: 'Information Security',
      OWNERS: 'Information Technology',
      CURRENT_CYCLE: 'Q1 2026',
      LIKELIHOOD: '1 - Rare',
      IMPACT_CATEGORY: 'Financial',
    }
  })

  // 2b. Load context if riskId exists
  React.useEffect(() => {
    if (riskId) {
      const loadContext = async () => {
        try {
          const risks = await oracleService.getIdentifyRisks({ id: riskId })
          const risk = Array.isArray(risks) ? risks[0] : risks
          
          if (risk) {
            if (risk.risk_category) setValue('RISK_CATEGORY', risk.risk_category)
            if (risk.risk_statement) setValue('ROOT_CAUSE', risk.risk_statement)
            if (risk.hierarchy_name) setValue('OWNERS', risk.hierarchy_name)
          }
        } catch (error) {
          console.error('[InherentAssessment] Context load failed:', error)
        } finally {
          setInitialLoading(false)
        }
      }
      loadContext()
    }
  }, [riskId, setValue])

  // 3. Submission Strategy
  const onSubmit = async (data: AssessmentFormValues) => {
    setIsSubmitting(true)
    try {
      // Mapping logic for ORDS backend
      const submissionData = {
        ...data,
        RISK_CATEGORY_UUID: 1, 
        SUB_CATEGORY_UUID: 1,
        LIKELIHOOD_UUID: data.LIKELIHOOD.includes('1') ? 24 : 
                        data.LIKELIHOOD.includes('2') ? 24 :
                        data.LIKELIHOOD.includes('3') ? 25 : 26,
        IMPACT_UUID: data.IMPACT_CATEGORY === 'Financial' ? 26 : 24,
        CYCLE_UUID: 2026,
        IDENTIFY_RISK_UUID: riskId || 1121
      }

      await oracleService.createRiskAssessment(submissionData)
      
      toast({
        title: 'Assessment Captured',
        description: 'Inherent risk parameters synchronized with Oracle ADW.',
      })
      
      setTimeout(() => router.back(), 1200)
    } catch (error) {
      console.error('[InherentAssessment] Save failed:', error)
      toast({
        title: 'Compute Error',
        description: 'Failed to persist assessment data. Connectivity issue detected.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex-1 pb-20 bg-background/30">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/40 px-6 py-5 bg-background/60 backdrop-blur-xl sticky top-0 z-40 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-secondary">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">Inherent Assessment</h1>
              <p className="text-[12px] text-muted-foreground font-medium">Risk exposure analysis prior to mitigation controls</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <Button variant="ghost" size="sm" onClick={() => reset()} className="text-[11px] font-bold text-muted-foreground hover:text-foreground">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Reset
             </Button>
          </div>
        </div>
      </FadeIn>

      <div className="max-w-4xl mx-auto p-6 mt-6">
        <form onSubmit={handleSubmit(onSubmit)}>
          <StaggerContainer className="space-y-8" delayChildren={0.2} staggerChildren={0.1}>
            
            {/* Section 1: Classification */}
            <StaggerItem>
              <div className="glass-card rounded-2xl p-8 bg-card/40 border border-border/40 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50" />
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                     <Target className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-foreground tracking-tight">Taxonomy & Classification</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">Primary Risk Category</label>
                    <select 
                      {...register('RISK_CATEGORY')}
                      className={cn(
                        "w-full h-11 px-4 bg-background/50 border rounded-xl text-[14px] font-semibold",
                        errors.RISK_CATEGORY ? "border-destructive/50" : "border-border/60 hover:border-amber-500/30"
                      )}
                    >
                      <option value="Strategic risk">Strategic risk</option>
                      <option value="Operational risk">Operational risk</option>
                      <option value="Financial risk">Financial risk</option>
                      <option value="Compliance risk">Compliance risk</option>
                    </select>
                    {errors.RISK_CATEGORY && <p className="text-[10px] font-bold text-destructive pl-1 uppercase mt-1">{errors.RISK_CATEGORY.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">L2 Sub-Category</label>
                    <select 
                      {...register('SUB_CATEGORY')}
                      className="w-full h-11 px-4 bg-background/50 border border-border/60 rounded-xl text-[14px] font-semibold"
                    >
                      <option value="Information Security">Information Security</option>
                      <option value="Market Volatility">Market Volatility</option>
                      <option value="Regulatory Change">Regulatory Change</option>
                    </select>
                  </div>
                </div>
              </div>
            </StaggerItem>

            {/* Section 2: Causality */}
            <StaggerItem>
              <div className="glass-card rounded-2xl p-8 bg-card/40 border border-border/40 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-rose-500/50" />
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                     <ShieldAlert className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-foreground tracking-tight">Causality Analysis</h2>
                </div>

                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">Root Cause Determination</label>
                      <textarea 
                        {...register('ROOT_CAUSE')}
                        className={cn(
                          "w-full h-24 p-4 bg-background/50 border rounded-2xl text-[14px] font-semibold resize-none outline-none transition-all",
                          errors.ROOT_CAUSE ? "border-destructive/50" : "border-border/60 hover:border-rose-500/30"
                        )}
                        placeholder="State the fundamental origin of the risk..."
                      />
                      {errors.ROOT_CAUSE && <p className="text-[10px] font-bold text-destructive pl-1 uppercase">{errors.ROOT_CAUSE.message}</p>}
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">Casual Dynamics</label>
                      <textarea 
                        {...register('CASUAL_FACTOR')}
                        className="w-full h-24 p-4 bg-background/50 border border-border/60 rounded-2xl text-[14px] font-semibold resize-none hover:border-rose-500/30"
                        placeholder="Secondary factors or environmental triggers..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">Data Evidence Source</label>
                      <Input {...register('DATA_SOURCE')} placeholder="e.g. Historical Incidents" className="h-11 bg-background/50 border-border/60 rounded-xl font-semibold" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">Asset Ownership</label>
                      <Input {...register('OWNERS')} placeholder="Dept / Business Owner" className="h-11 bg-background/50 border-border/60 rounded-xl font-semibold" />
                    </div>
                  </div>
                </div>
              </div>
            </StaggerItem>

            {/* Section 3: Impact */}
            <StaggerItem>
              <div className="glass-card rounded-2xl p-8 bg-card/40 border border-border/40 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50" />
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                     <Activity className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-foreground tracking-tight">Inherent Impact Magnitude</h2>
                </div>

                <div className="space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">Strategic Cycle</label>
                        <select {...register('CURRENT_CYCLE')} className="w-full h-11 px-3 bg-background/50 border border-border/60 rounded-xl text-[13px] font-bold">
                          <option value="Q1 2026">Q1 2026</option>
                          <option value="Q2 2026">Q2 2026</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">Qualitative Likelihood</label>
                         <select {...register('LIKELIHOOD')} className="w-full h-11 px-3 bg-background/50 border border-border/60 rounded-xl text-[13px] font-bold">
                           {['1 - Rare', '2 - Unlikely', '3 - Possible', '4 - Likely', '5 - Certain'].map(v => <option key={v} value={v}>{v}</option>)}
                         </select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">Impact Vectors</label>
                         <select {...register('IMPACT_CATEGORY')} className="w-full h-11 px-3 bg-background/50 border border-border/60 rounded-xl text-[13px] font-bold">
                           {['Financial', 'Reputational', 'Operational', 'Safety'].map(v => <option key={v} value={v}>{v}</option>)}
                         </select>
                      </div>
                   </div>

                   <div className="space-y-3">
                     <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">Exposed Stakeholders</label>
                     <Input {...register('IMPACT_PARTIES')} placeholder="E.g. Primary Customers, Board members" className="h-11 bg-background/50 border-border/60 rounded-xl font-semibold" />
                   </div>

                   <div className="space-y-3">
                     <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">Scenario Description</label>
                     <textarea 
                        {...register('IMPACT_DESCRIPTION')}
                        className={cn(
                          "w-full h-28 p-4 bg-background/50 border rounded-2xl text-[14px] font-semibold resize-none",
                          errors.IMPACT_DESCRIPTION ? "border-destructive/50" : "border-border/60 hover:border-cyan-500/30"
                        )}
                        placeholder="Detail the most likely high-impact scenario..."
                     />
                     {errors.IMPACT_DESCRIPTION && <p className="text-[10px] font-bold text-destructive pl-1 uppercase">{errors.IMPACT_DESCRIPTION.message}</p>}
                   </div>
                </div>
              </div>
            </StaggerItem>

            {/* Submission Block */}
            <StaggerItem>
              <div className="flex items-center justify-between p-6 bg-secondary/20 rounded-2xl border border-secondary/30">
                <div className="flex flex-col">
                   <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Persistence Engine</span>
                   <span className="text-[11px] font-bold text-emerald-500">Linked to Oracle Autonomous DB</span>
                </div>
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={isSubmitting}
                  className="rounded-full px-12 h-14 font-black uppercase tracking-widest shadow-xl hover:brightness-110 active:scale-95 transition-all gap-4 bg-primary"
                >
                  {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                  {isSubmitting ? 'Syncing...' : 'Persist Assessment'}
                </Button>
              </div>
            </StaggerItem>

          </StaggerContainer>
        </form>
      </div>
    </div>
  )
}
