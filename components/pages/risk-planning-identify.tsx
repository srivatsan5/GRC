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
  ArrowLeft 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { motion } from 'framer-motion'
import { oracleService } from '@/lib/oracleService'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// 1. Validation Schema
const riskSchema = z.object({
  HIERARCHY_LEVEL: z.string().min(1, 'Hierarchy Level is required'),
  HIERARCHY_NAME: z.string().min(1, 'Hierarchy Name is required'),
  ASSESSMENT_REGISTERED_DATE: z.string().min(1, 'Date is required'),
  ASSESSOR: z.string().min(1, 'Assessor is required'),
  RISK_STATEMENT: z.string().min(10, 'Risk Statement must be at least 10 characters'),
  IMPACT_STATEMENT: z.string().optional(),
  DETAILED_DESCRIPTION: z.string().optional(),
  IS_SOP_AVAILABLE: z.enum(['Yes', 'No', 'Partial / Outdated']),
  LIKELIHOOD: z.string(),
  IMPACT: z.string(),
  INHERENT_SLE: z.string().or(z.number()).transform(v => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0),
})

type RiskFormValues = z.infer<typeof riskSchema>

export function RiskplanningidentifyPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      HIERARCHY_LEVEL: '',
      HIERARCHY_NAME: 'Global Supply Chain',
      ASSESSMENT_REGISTERED_DATE: new Date().toISOString().split('T')[0],
      ASSESSOR: 'Srivatsan (Current)',
      RISK_STATEMENT: '',
      IS_SOP_AVAILABLE: 'Yes',
      LIKELIHOOD: '1 - Rare',
      IMPACT: '1 - Insignificant',
      INHERENT_SLE: 0,
    }
  })

  // 3. Submission Logic
  const onSubmit = async (data: RiskFormValues) => {
    setIsSubmitting(true)
    try {
      // Robust backend mapping
      const submissionData = {
        ...data,
        HIERARCHY_LEVEL: data.HIERARCHY_LEVEL === 'Enterprise' ? 1 : 
                        data.HIERARCHY_LEVEL === 'Business Unit' ? 2 : 
                        data.HIERARCHY_LEVEL === 'Department' ? 3 : 
                        data.HIERARCHY_LEVEL === 'Process' ? 4 : 0,
        ASSESSMENT_REGISTERED_DATE: new Date(data.ASSESSMENT_REGISTERED_DATE).toISOString(),
        IS_SOP_AVAILABLE: data.IS_SOP_AVAILABLE === 'Yes' ? 'Y' : 'N',
      }

      await oracleService.createIdentifyRisk(submissionData)
      
      toast({
        title: 'Success',
        description: 'Risk identifier has been persisted to Oracle Cloud.',
        variant: 'default',
      })
      
      setTimeout(() => router.back(), 1200)
    } catch (error) {
      console.error('[RiskIdentify] Submission failed:', error)
      toast({
        title: 'Persistence Error',
        description: 'Failed to save record. Check network or permissions.',
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
              <h1 className="text-lg font-bold text-foreground tracking-tight">Identify New Risk</h1>
              <p className="text-[12px] text-muted-foreground font-medium">Enterprise Governance & Risk Compliance Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs font-bold text-muted-foreground hover:text-foreground"
                onClick={() => reset()}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Clear
              </Button>
          </div>
        </div>
      </FadeIn>

      <div className="max-w-4xl mx-auto p-6 mt-6">
        <form onSubmit={handleSubmit(onSubmit)}>
          <StaggerContainer className="space-y-8" delayChildren={0.2} staggerChildren={0.1}>
            
            {/* Section 1: Org Context */}
            <StaggerItem>
              <div className="glass-card rounded-2xl p-8 bg-card/40 border border-border/40 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary/40" />
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                     <Building2 className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-foreground">Organizational Context</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">Hierarchy Level</label>
                    <select 
                      {...register('HIERARCHY_LEVEL')}
                      className={cn(
                        "w-full h-11 px-4 bg-background/50 border rounded-xl text-[14px] font-semibold text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all",
                        errors.HIERARCHY_LEVEL ? "border-destructive/50" : "border-border/60 hover:border-primary/40"
                      )}
                    >
                      <option value="">Select Level...</option>
                      <option value="Enterprise">Enterprise</option>
                      <option value="Business Unit">Business Unit</option>
                      <option value="Department">Department</option>
                      <option value="Process">Process</option>
                    </select>
                    {errors.HIERARCHY_LEVEL && <p className="text-[10px] font-bold text-destructive pl-1 uppercase">{errors.HIERARCHY_LEVEL.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">Target Entity Name</label>
                    <Input 
                      {...register('HIERARCHY_NAME')}
                      placeholder="e.g. Finance Operations"
                      className={cn(
                        "h-11 text-[14px] font-semibold bg-background/50 border rounded-xl",
                        errors.HIERARCHY_NAME ? "border-destructive/50" : "border-border/60"
                      )}
                    />
                    {errors.HIERARCHY_NAME && <p className="text-[10px] font-bold text-destructive pl-1 uppercase">{errors.HIERARCHY_NAME.message}</p>}
                  </div>
                </div>
              </div>
            </StaggerItem>

            {/* Section 2: Attribution */}
            <StaggerItem>
              <div className="glass-card rounded-2xl p-8 bg-card/40 border border-border/40 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/40" />
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                     <User className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-foreground">Assessment Attribution</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">Registry Code</label>
                    <Input disabled placeholder="SYS-GEN-2026" className="h-11 text-[14px] font-mono text-muted-foreground/60 bg-secondary/20 border-border/20 italic" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">Effective Date</label>
                    <Input 
                      type="date"
                      {...register('ASSESSMENT_REGISTERED_DATE')}
                      className="h-11 text-[14px] font-semibold bg-background/50 border-border/60 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">Assigned Owner</label>
                    <select 
                      {...register('ASSESSOR')}
                      className="w-full h-11 px-4 bg-background/50 border border-border/60 rounded-xl text-[14px] font-semibold text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                    >
                      <option value="Srivatsan (Current)">Srivatsan (Lead)</option>
                      <option value="Compliance Team">Compliance Team</option>
                      <option value="Internal Audit">Internal Audit</option>
                    </select>
                  </div>
                </div>
              </div>
            </StaggerItem>

            {/* Section 3: Definition */}
            <StaggerItem>
              <div className="glass-card rounded-2xl p-8 bg-card/40 border border-border/40 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/40" />
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                     <HelpCircle className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-foreground">Risk Definition & Metrics</h2>
                </div>

                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1 flex items-center justify-between">
                      Risk Statement
                      <span className="text-[10px] font-medium lowercase opacity-60 italic">Minimum 10 chars</span>
                    </label>
                    <textarea 
                      {...register('RISK_STATEMENT')}
                      placeholder="Describe the potential event and its root cause..."
                      className={cn(
                        "w-full h-24 p-4 bg-background/50 border rounded-2xl text-[14px] font-semibold text-foreground focus:ring-2 focus:ring-primary/20 outline-none resize-none transition-all",
                        errors.RISK_STATEMENT ? "border-destructive/50" : "border-border/60 hover:border-primary/40"
                      )}
                    />
                    {errors.RISK_STATEMENT && <p className="text-[10px] font-bold text-destructive pl-1 uppercase">{errors.RISK_STATEMENT.message}</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">SOP Availability</label>
                      <select {...register('IS_SOP_AVAILABLE')} className="w-full h-11 px-3 bg-background/50 border border-border/60 rounded-xl text-[13px] font-bold">
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                        <option value="Partial / Outdated">Partial / Outdated</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">Likelihood</label>
                      <select {...register('LIKELIHOOD')} className="w-full h-11 px-3 bg-background/50 border border-border/60 rounded-xl text-[13px] font-bold">
                        {['1 - Rare', '2 - Unlikely', '3 - Possible', '4 - Likely', '5 - Certain'].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">Impact</label>
                      <select {...register('IMPACT')} className="w-full h-11 px-3 bg-background/50 border border-border/60 rounded-xl text-[13px] font-bold">
                        {['1 - Insignificant', '2 - Minor', '3 - Moderate', '4 - Major', '5 - Severe'].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pl-1">Inherent SLE ($)</label>
                      <Input 
                        {...register('INHERENT_SLE')}
                        type="number"
                        placeholder="0.00"
                        className="h-11 text-[14px] font-black bg-background/50 border-border/60 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </StaggerItem>

            {/* Submission */}
            <StaggerItem>
              <div className="flex items-center justify-between p-6 bg-secondary/20 rounded-2xl border border-secondary/30">
                <div className="flex items-center gap-2 text-[12px] font-bold text-muted-foreground">
                   <AlertCircle className="w-4 h-4" />
                   Review carefully before applying signature
                </div>
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={isSubmitting}
                  className="rounded-full px-10 h-12 font-black uppercase tracking-widest shadow-xl hover:brightness-110 active:scale-95 transition-all gap-3 bg-primary"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {isSubmitting ? 'Persisting...' : 'Apply Changes'}
                </Button>
              </div>
            </StaggerItem>

          </StaggerContainer>
        </form>
      </div>
    </div>
  )
}
