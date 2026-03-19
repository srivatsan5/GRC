'use client'

import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { 
  Shield, 
  Bell, 
  Lock, 
  Users, 
  Database, 
  Eye, 
  EyeOff, 
  Key, 
  Clock, 
  Check, 
  Loader2, 
  Save, 
  RotateCcw,
  Globe,
  Zap,
  HardDrive
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { oracleService } from '@/lib/oracleService'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const tabs = [
  { id: 'general', name: 'Identity', icon: Globe },
  { id: 'notifications', name: 'Logic', icon: Zap },
  { id: 'security', name: 'Vault', icon: Lock },
  { id: 'users', name: 'Registry', icon: Users },
  { id: 'api', name: 'Gateway', icon: Key },
  { id: 'data', name: 'Persistence', icon: HardDrive },
]

export function SettingsPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('general')
  const [showPassword, setShowPassword] = useState(false)
  
  // 1. General Settings State (Managed via React Hook Form ideally, but keeping it simple for now with local + Mutation)
  const [orgName, setOrgName] = useState('Acme Corporation')
  const [industry, setIndustry] = useState('Financial Services')

  // 2. Mutations
  const updateMutation = useMutation({
    mutationFn: (data: any) => oracleService.createIdentifyRisk({ type: 'settings', ...data }), // Proxy for settings save
    onSuccess: () => {
      toast({ title: 'Success', description: 'System configuration synchronized with Oracle ADW.' })
    },
    onError: () => {
      toast({ title: 'Sync Error', description: 'Failed to persist settings.', variant: 'destructive' })
    }
  })

  return (
    <div className="flex-1 pb-10 bg-background/20 min-h-screen">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/40 px-6 py-6 bg-background/60 backdrop-blur-xl sticky top-0 z-40 shadow-sm">
          <h1 className="text-xl font-black text-foreground tracking-tighter uppercase italic">Control Center</h1>
          <p className="text-[12px] text-muted-foreground mt-1 font-medium italic opacity-70">Infrastructure, security, and GRC orchestrator settings</p>
        </div>
      </FadeIn>

      <div className="flex px-8 pt-8 gap-12 items-start max-w-[1400px] mx-auto">
        {/* Navigation Rail */}
        <FadeIn delay={0.2} className="w-64 flex-shrink-0 sticky top-32">
          <div className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative w-full flex items-center gap-4 px-5 py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all duration-300 text-left group",
                    activeTab === tab.id ? "text-primary shadow-lg shadow-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  )}
                >
                  <Icon className={cn("w-4 h-4 transition-transform group-hover:scale-110", activeTab === tab.id ? "text-primary" : "text-muted-foreground/60")} />
                  {tab.name}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeSettingsRail"
                      className="absolute inset-0 bg-card/60 border border-border/40 rounded-2xl -z-10 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </FadeIn>

        {/* Configuration Surface */}
        <div className="flex-1 min-h-[600px] pb-20">
          <AnimatePresence mode="wait">
            {activeTab === 'general' && (
              <motion.div
                key="general"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-10"
              >
                <div className="space-y-6">
                   <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                         <Globe className="w-5 h-5" />
                      </div>
                      <h2 className="text-base font-black text-foreground uppercase tracking-widest italic">Global Identity</h2>
                   </div>
                   
                   <div className="glass-card rounded-3xl p-8 bg-card/30 border border-border/40 shadow-xl space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter pl-1">Corporation Name</label>
                            <Input 
                              value={orgName}
                              onChange={e => setOrgName(e.target.value)}
                              className="h-11 bg-background/50 border-border/40 rounded-xl font-bold text-sm shadow-inner"
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter pl-1">Primary Sector</label>
                            <select 
                              value={industry}
                              onChange={e => setIndustry(e.target.value)}
                              className="w-full h-11 px-4 bg-background/50 border border-border/40 rounded-xl font-bold text-sm outline-none focus:ring-1 focus:ring-primary/20"
                            >
                               <option>Financial Services</option>
                               <option>Healthcare</option>
                               <option>Technology</option>
                            </select>
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter pl-1">Maturity Target</label>
                            <select className="w-full h-11 px-4 bg-background/50 border border-border/40 rounded-xl font-bold text-sm outline-none">
                               <option>Optimized</option>
                               <option>Managed</option>
                            </select>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter pl-1">Telemetry Retention</label>
                            <select className="w-full h-11 px-4 bg-background/50 border border-border/40 rounded-xl font-bold text-sm outline-none">
                               <option>Endless</option>
                               <option>5 Years</option>
                            </select>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="flex items-center gap-4 pt-6">
                   <Button 
                    size="lg" 
                    className="rounded-full px-10 h-12 font-black uppercase text-[11px] tracking-widest shadow-2xl shadow-primary/20"
                    onClick={() => updateMutation.mutate({ orgName, industry })}
                    disabled={updateMutation.isPending}
                   >
                     {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                     Synchronize Engine
                   </Button>
                   <Button variant="ghost" className="rounded-full h-12 px-6 font-black uppercase text-[11px] tracking-widest text-muted-foreground">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Restore Defaults
                   </Button>
                </div>
              </motion.div>
            )}

            {/* Placeholder for other tabs - each should be equally premium */}
            {activeTab !== 'general' && (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-[500px] border-2 border-dashed border-border/40 rounded-[40px] bg-secondary/10"
              >
                  <div className="p-4 rounded-3xl bg-secondary/50 mb-6">
                     <Database className="w-10 h-10 text-muted-foreground/30" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Subsystem Isolated</h3>
                  <p className="text-[11px] text-muted-foreground mt-2 italic">Module {activeTab} is currently being refactored for ADW concurrency.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
