'use client'

import React, { useMemo, useState } from 'react'
import { Target, ShieldCheck, AlertTriangle, Edit3, Save, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { createStore, useStoreSnapshot } from '@/lib/localStore'
import { useToast } from '@/hooks/use-toast'
import { recordAudit } from '@/lib/auditLog'
import { useAuth } from '@/components/providers/auth-provider'

export type AppetitePosture = 'Averse' | 'Cautious' | 'Open' | 'Hungry'

export interface AppetiteStatement {
  id: string
  category: string
  description: string
  posture: AppetitePosture
  tolerance: number // numerical tolerance score (1-25)
  currentExposure: number
  unit: 'Score (1-25)' | 'INR' | 'USD' | '%' | 'Count'
  approvedBy: string
  approvedOn: string
  review: string
}

const SEED: AppetiteStatement[] = [
  { id: 'APP-STR', category: 'Strategic', description: 'Pursue new market entry where ROI ≥ 18% within 24 months.', posture: 'Open', tolerance: 16, currentExposure: 12, unit: 'Score (1-25)', approvedBy: 'Board of Directors', approvedOn: '2026-01-15', review: 'Annual' },
  { id: 'APP-FIN', category: 'Financial', description: 'Net loss in any single quarter not to exceed 2% of revenue.', posture: 'Cautious', tolerance: 12, currentExposure: 9, unit: 'Score (1-25)', approvedBy: 'Audit Committee', approvedOn: '2026-01-15', review: 'Quarterly' },
  { id: 'APP-OPS', category: 'Operational', description: 'Tolerate up to 4 hours of unplanned outage per critical system per month.', posture: 'Cautious', tolerance: 10, currentExposure: 14, unit: 'Score (1-25)', approvedBy: 'COO', approvedOn: '2026-02-01', review: 'Quarterly' },
  { id: 'APP-COMP', category: 'Compliance', description: 'Zero tolerance for regulatory breaches that trigger personal liability.', posture: 'Averse', tolerance: 4, currentExposure: 2, unit: 'Score (1-25)', approvedBy: 'Chief Compliance Officer', approvedOn: '2026-01-20', review: 'Continuous' },
  { id: 'APP-IT', category: 'IT & Cyber', description: 'Accept residual risk only up to amber band for non-customer-facing systems.', posture: 'Cautious', tolerance: 12, currentExposure: 13, unit: 'Score (1-25)', approvedBy: 'CIO', approvedOn: '2026-02-10', review: 'Semi-annual' },
  { id: 'APP-PPL', category: 'People', description: 'Voluntary attrition no greater than 12% annually across critical roles.', posture: 'Open', tolerance: 14, currentExposure: 11, unit: 'Score (1-25)', approvedBy: 'CHRO', approvedOn: '2026-02-12', review: 'Annual' },
  { id: 'APP-VEN', category: 'Vendor', description: 'No critical-tier vendor without an active risk assessment within 12 months.', posture: 'Averse', tolerance: 6, currentExposure: 4, unit: 'Score (1-25)', approvedBy: 'Head of Procurement', approvedOn: '2026-01-30', review: 'Quarterly' },
  { id: 'APP-REP', category: 'Reputation', description: 'No more than 2 negative media events causing > 5% share-price impact per year.', posture: 'Averse', tolerance: 8, currentExposure: 3, unit: 'Score (1-25)', approvedBy: 'CEO', approvedOn: '2026-01-15', review: 'Annual' },
]

export const appetiteStore = createStore<AppetiteStatement>({ key: 'appetite', seed: SEED })

const POSTURE_TONE: Record<AppetitePosture, string> = {
  Averse: 'bg-[#fbeae8] text-[#c74634] border-[#f0b3aa]',
  Cautious: 'bg-[#fef3e2] text-[#e27a00] border-[#fcdba8]',
  Open: 'bg-[#e5f3f7] text-[#00758f] border-[#b3dce6]',
  Hungry: 'bg-[#e8f5ed] text-[#1f7a4d] border-[#b6e2c9]',
}

export function RiskAppetitePage() {
  const items = useStoreSnapshot(appetiteStore)
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<AppetiteStatement | null>(null)

  const stats = useMemo(() => ({
    total: items.length,
    withinAppetite: items.filter(s => s.currentExposure <= s.tolerance).length,
    breached: items.filter(s => s.currentExposure > s.tolerance).length,
    avgTolerance: items.length ? (items.reduce((s, x) => s + x.tolerance, 0) / items.length).toFixed(1) : '0',
  }), [items])

  const startEdit = (s: AppetiteStatement) => { setEditing(s.id); setDraft({ ...s }) }
  const cancelEdit = () => { setEditing(null); setDraft(null) }
  const save = () => {
    if (!draft) return
    appetiteStore.update(draft.id, draft)
    recordAudit({ action: 'UPDATE', entity: 'Risk Appetite', entity_id: draft.id, description: `Updated appetite for ${draft.category}`, after: draft, result: 'SUCCESS' })
    toast({ title: 'Appetite updated', description: draft.category })
    cancelEdit()
  }
  const resetAll = () => {
    appetiteStore.reset()
    recordAudit({ action: 'SETTINGS_CHANGE', entity: 'Risk Appetite', description: 'Reset all appetite statements to defaults', result: 'SUCCESS' })
    toast({ title: 'Reset complete' })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Appetite Framework</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight">Risk Appetite</h1>
          <p className="text-muted-foreground mt-2 font-medium">Board-approved tolerance levels across enterprise risk categories.</p>
        </div>
        {hasPermission('admin') && (
          <Button variant="outline" onClick={resetAll} className="rounded-2xl"><RotateCcw className="w-4 h-4 mr-2" />Reset</Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SCard label="Total statements" value={stats.total} icon={Target} tone="blue" />
        <SCard label="Within appetite" value={stats.withinAppetite} icon={ShieldCheck} tone="emerald" />
        <SCard label="Breaches" value={stats.breached} icon={AlertTriangle} tone="red" />
        <SCard label="Avg tolerance" value={`${stats.avgTolerance} / 25`} icon={Target} tone="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {items.map(s => {
          const isEditing = editing === s.id
          const pct = Math.min(100, (s.currentExposure / Math.max(1, s.tolerance)) * 100)
          const breached = s.currentExposure > s.tolerance
          return (
            <Card key={s.id} className={cn('p-6', breached && 'border-red-200')}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <Badge variant="outline" className="text-[9px] uppercase tracking-widest mb-2">{s.category}</Badge>
                  <h3 className="text-base font-black text-foreground">{isEditing ? (
                    <Input value={draft?.description || ''} onChange={e => setDraft(d => d ? { ...d, description: e.target.value } : d)} />
                  ) : s.description}</h3>
                </div>
                <span className={cn('px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest', POSTURE_TONE[s.posture])}>
                  {s.posture}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tolerance</p>
                  {isEditing ? (
                    <Input type="number" value={draft?.tolerance || 0} onChange={e => setDraft(d => d ? { ...d, tolerance: Number(e.target.value) } : d)} className="mt-1" />
                  ) : (
                    <p className="text-2xl font-black tabular-nums">{s.tolerance} <span className="text-sm font-medium text-muted-foreground">/ 25</span></p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current exposure</p>
                  {isEditing ? (
                    <Input type="number" value={draft?.currentExposure || 0} onChange={e => setDraft(d => d ? { ...d, currentExposure: Number(e.target.value) } : d)} className="mt-1" />
                  ) : (
                    <p className={cn('text-2xl font-black tabular-nums', breached ? 'text-red-600' : 'text-foreground')}>{s.currentExposure}</p>
                  )}
                </div>
              </div>

              <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
                <div className={cn('h-full rounded-full transition-all', breached ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <span>Approved by: <span className="font-bold text-foreground">{s.approvedBy}</span></span>
                <span>Review: <span className="font-bold text-foreground">{s.review}</span></span>
              </div>

              {hasPermission('update') && (
                <div className="flex justify-end gap-2 mt-4">
                  {isEditing ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={cancelEdit}>Cancel</Button>
                      <Button size="sm" onClick={save}><Save className="w-3 h-3 mr-2" />Save</Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => startEdit(s)}><Edit3 className="w-3 h-3 mr-2" />Edit</Button>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function SCard({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: any; tone: 'blue' | 'emerald' | 'amber' | 'red' }) {
  const colorMap = { blue: 'text-blue-600 bg-blue-50', emerald: 'text-emerald-600 bg-emerald-50', amber: 'text-amber-600 bg-amber-50', red: 'text-red-600 bg-red-50' }[tone]
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', colorMap)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-2xl font-black tabular-nums text-foreground">{value}</p>
      </div>
    </Card>
  )
}
