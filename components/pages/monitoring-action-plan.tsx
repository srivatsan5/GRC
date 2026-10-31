'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Filter, MoreVertical, LayoutGrid, List, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/fade-in'
import { motion, AnimatePresence } from 'framer-motion'
import { oracleService } from '@/lib/oracleService'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export function MonitoringactionplanPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('action')
  const [searchTerm, setSearchTerm] = useState('')
  
  const { data: rawData = [], isLoading: loading } = useQuery({
    queryKey: ['monitoring-actions'],
    queryFn: () => oracleService.getMonitoringActionPlan()
  })

  // Ensure data is array
  const data = Array.isArray(rawData) ? rawData : []
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [owner, setOwner] = useState('')

  const createMutation = useMutation({
    mutationFn: (payload: any) => oracleService.createRiskMonitoring(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-actions'] })
      toast.success("Action Plan provisioned successfully.")
      setIsDialogOpen(false)
      setTitle('')
      setGoal('')
      setOwner('')
    },
    onError: (err: any) => {
      toast.error(`Provisioning failed: ${err.message}`)
    }
  })

  const handleCreate = () => {
    if (!title || !goal) {
      toast.error("Please fill in action plan details.")
      return
    }
    
    createMutation.mutate({
      monitoring_title: title,
      monitoring_goal: goal,
      mitigation_owner: owner || 'Unassigned',
      is_stage_complted: 'N',
      approval_status: 'DRAFT',
      completion_pct: 0,
    })
  }

  const filtered = data.filter(d => 
    (d.monitoring_title || d.control_name || d.name || d.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (d.monitoring_goal || d.root_cause || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          <p className="text-xs text-slate-500">Loading action plans...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 pb-10 flex flex-col h-full">
      <FadeIn delay={0.1} direction="none">
        <div className="border-b border-border/50 px-6 py-5 bg-background/50 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">Action Plans Tracker</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5 font-medium">Manage and track granular remediation tasks</p>
          </div>
          <div className="flex items-center gap-3">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button size="sm" className="gap-2 h-8 text-xs font-semibold shadow-[var(--shadow-md)]">
                    <Plus className="w-3.5 h-3.5" />
                    New Action Plan
                  </Button>
                </motion.div>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] bg-white border-blue-50">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-blue-900">Provision Action Plan</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Plan Directive</label>
                    <Input 
                      placeholder="e.g. Audit Remediation Pipeline" 
                      value={title} 
                      onChange={e => setTitle(e.target.value)} 
                      className="border-blue-100 focus-visible:ring-blue-500 bg-blue-50/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Objective Goal</label>
                    <Select onValueChange={setGoal} value={goal}>
                      <SelectTrigger className="border-blue-100 focus:ring-blue-500 bg-blue-50/50">
                        <SelectValue placeholder="Select objective goal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Automate compliance collection">Automate compliance collection</SelectItem>
                        <SelectItem value="Audit Remediation">Audit Remediation</SelectItem>
                        <SelectItem value="Risk Posture Enhancement">Risk Posture Enhancement</SelectItem>
                        <SelectItem value="Threshold Optimization">Threshold Optimization</SelectItem>
                        <SelectItem value="Policy Review">Policy Review</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Assigned Executor</label>
                    <Select onValueChange={setOwner} value={owner}>
                      <SelectTrigger className="border-blue-100 focus:ring-blue-500 bg-blue-50/50">
                        <SelectValue placeholder="Select assigned executor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SYSADMIN">SYSADMIN</SelectItem>
                        <SelectItem value="RISK_OFFICER">RISK_OFFICER</SelectItem>
                        <SelectItem value="COMPLIANCE_LEAD">COMPLIANCE_LEAD</SelectItem>
                        <SelectItem value="AUDITOR">AUDITOR</SelectItem>
                        <SelectItem value="CISO">CISO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 mt-4" 
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Initialize Implementation
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </FadeIn>

      <div className="p-6 flex-1 flex flex-col min-h-0">
        <FadeIn delay={0.2}>
          <div className="mb-6 flex justify-between items-center bg-card border border-border/50 p-2 rounded-lg shadow-sm">
            
            <div className="flex items-center gap-1 bg-secondary/30 p-1 rounded-md border border-border/50 ml-1">
              <button 
                onClick={() => setActiveTab('action')}
                className={`px-3 py-1.5 rounded text-[12px] font-semibold transition-all ${activeTab === 'action' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
              >
                Action Plans
              </button>
              <button 
                onClick={() => setActiveTab('mitigation')}
                className={`px-3 py-1.5 rounded text-[12px] font-semibold transition-all ${activeTab === 'mitigation' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
              >
                Mitigation Plans
              </button>
            </div>

            <div className="relative max-w-sm flex-1 ml-6">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${activeTab === 'action' ? 'action' : 'mitigation'} plans...`}
                className="pl-9 h-9 text-[13px] bg-background border-border/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 ml-4">
              <Button variant="outline" size="sm" className="h-9 w-9 p-0 bg-background border-border/50">
                <Filter className="w-4 h-4 text-muted-foreground" />
              </Button>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0 bg-background border-border/50">
                <LayoutGrid className="w-4 h-4 text-muted-foreground" />
              </Button>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0 bg-secondary border-border/50 shadow-inner">
                <List className="w-4 h-4 text-foreground" />
              </Button>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.3} className="flex-1 min-h-0">
          <div className="glass-card rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-[12px] whitespace-nowrap">
                <thead className="sticky top-0 z-10 bg-secondary/90 backdrop-blur-md border-b border-border/50 shadow-sm">
                  <tr className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                    <th className="px-5 py-3 sticky left-0 bg-secondary/90 z-20 border-r border-border/50">ID</th>
                    <th className="px-5 py-3 min-w-[200px]">Plan Name</th>
                    <th className="px-5 py-3 min-w-[250px]">Description</th>
                    <th className="px-5 py-3">Owner</th>
                    <th className="px-5 py-3 min-w-[150px]">Root Cause</th>
                    <th className="px-5 py-3 font-mono">Target Date</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Overdue Status</th>
                    <th className="px-5 py-3">Priority</th>
                    <th className="px-5 py-3 min-w-[200px]">Latest Updates</th>
                    <th className="px-5 py-3 border-l border-border/50">Mitigations</th>
                    <th className="px-3 py-3 text-center sticky right-0 bg-secondary/90 z-20 border-l border-border/50 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">Act</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {filtered.map((row, idx) => (
                      <motion.tr 
                        layout="position"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        key={row.ID || row.PLAN_ID || idx} 
                        className="border-b border-border/30 hover:bg-secondary/20 transition-colors last:border-0 group"
                      >
                        <td className="px-5 py-4 font-mono font-semibold text-muted-foreground sticky left-0 bg-background group-hover:bg-secondary/20 transition-colors border-r border-border/50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          {row.uuid || row.control_id || row.ID || 'N/A'}
                        </td>
                        <td className="px-5 py-4 font-bold text-foreground">{row.control_name || row.name || row.title || 'Unnamed Control'}</td>
                        <td className="px-5 py-4 text-muted-foreground truncate max-w-[250px]">{row.control_description || row.description || 'No description provided'}</td>
                        <td className="px-5 py-4 font-medium">
                          <span className="flex items-center gap-2 text-foreground">
                            <span className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                              {(row.owner || 'U').split(' ').map((n: string) => n[0]).join('')}
                            </span>
                            {row.owner || 'Unassigned'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground bg-secondary/10 truncate max-w-[150px]">{row.root_cause || 'General Issue'}</td>
                        <td className="px-5 py-4 font-mono text-muted-foreground">{row.target_date || '2026-12-31'}</td>
                        <td className="px-5 py-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wider">
                            {row.is_stage_complted === 'Y' ? 'Completed' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${row.is_stage_complted !== 'Y' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {row.is_stage_complted !== 'Y' ? 'At Risk' : 'On Track'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-500`}>
                            <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500`} />
                            Normal
                          </span>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground truncate max-w-[200px] text-[11px] font-medium italic">"No updates logged"</td>
                        <td className="px-5 py-4 border-l border-border/50 font-mono text-[11px] font-semibold text-muted-foreground">{row.mitigate_risk || row.mitigates || 'N/A'}</td>
                        <td className="px-3 py-4 text-center sticky right-0 bg-background group-hover:bg-secondary/20 transition-colors border-l border-border/50 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground transition-colors">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-lg rounded-xl">
                              <DropdownMenuItem onClick={() => router.push(`/risk-assessments/dashboard?actionId=${row.uuid || row.id}`)} className="text-[11px] font-bold hover:bg-secondary cursor-pointer uppercase tracking-wider text-muted-foreground">
                                Assess Risk
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/monitoring?actionId=${row.uuid || row.id}`)} className="text-[11px] font-bold hover:bg-secondary cursor-pointer uppercase tracking-wider text-muted-foreground">
                                Update Status
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                  <p className="font-medium text-xs">No {activeTab} plans found.</p>
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 p-2.5 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center px-4">
              <span>{filtered.length} {activeTab === 'action' ? 'action' : 'mitigation'} plans</span>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
