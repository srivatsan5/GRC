'use client'

import React, { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Shield, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { createStore, useStoreSnapshot, genId } from '@/lib/localStore'
import { useToast } from '@/hooks/use-toast'
import { recordAudit } from '@/lib/auditLog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'

export interface BcpPlan {
  id: string
  name: string
  scope: string
  rto: number // hours
  rpo: number // hours
  owner: string
  lastTested?: string
  nextTest: string
  status: 'Current' | 'Overdue' | 'Draft'
}

const SEED: BcpPlan[] = [
  { id: 'BCP-001', name: 'Core Payment Gateway Failover', scope: 'Treasury & settlement infrastructure', rto: 4, rpo: 1, owner: 'CTO', lastTested: '2026-03-15', nextTest: '2026-09-15', status: 'Current' },
  { id: 'BCP-002', name: 'Customer Support Escalation Contingency', scope: 'Global contact center routing', rto: 8, rpo: 4, owner: 'COO', lastTested: '2026-04-01', nextTest: '2026-10-01', status: 'Current' },
  { id: 'BCP-003', name: 'Primary Headquarters Site Loss Plan', scope: 'HQ facility & workforce displacement', rto: 48, rpo: 24, owner: 'CHRO', lastTested: '2025-09-20', nextTest: '2026-03-20', status: 'Overdue' },
  { id: 'BCP-004', name: 'Ransomware Containment & Clean Recovery', scope: 'Enterprise active directory & backup isolation', rto: 12, rpo: 4, owner: 'CISO', lastTested: '2026-02-10', nextTest: '2026-08-10', status: 'Current' },
]

export const bcpStore = createStore<BcpPlan>({ key: 'bcp', seed: SEED })

export function BcpPage() {
  const items = useStoreSnapshot(bcpStore)
  const { toast } = useToast()
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const [editing, setEditing] = useState<BcpPlan | null>(null)

  const stats = useMemo(() => ({
    total: items.length,
    current: items.filter(p => p.status === 'Current').length,
    overdue: items.filter(p => p.status === 'Overdue').length,
    avgRto: items.length ? (items.reduce((s, p) => s + p.rto, 0) / items.length).toFixed(1) : '0',
  }), [items])

  const save = (p: BcpPlan) => {
    const isNew = !items.find(x => x.id === p.id)
    if (isNew) {
      bcpStore.add(p)
      recordAudit({ action: 'CREATE', entity: 'BCP Plan', entity_id: p.id, description: `Created plan ${p.name}`, after: p, result: 'SUCCESS' })
      toast({ title: 'Plan created' })
    } else {
      bcpStore.update(p.id, p)
      recordAudit({ action: 'UPDATE', entity: 'BCP Plan', entity_id: p.id, description: `Updated plan ${p.name}`, after: p, result: 'SUCCESS' })
      toast({ title: 'Plan updated' })
    }
    setEditing(null)
  }

  const remove = async (p: BcpPlan) => {
    const ok = await confirm({ title: `Delete ${p.id}?`, description: 'This will remove the BCP plan.', confirmLabel: 'Delete plan', tone: 'danger' })
    if (!ok) return
    bcpStore.remove(p.id)
    recordAudit({ action: 'DELETE', entity: 'BCP Plan', entity_id: p.id, description: `Deleted plan ${p.name}`, before: p, result: 'SUCCESS' })
    toast({ title: 'Plan deleted' })
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Business Continuity Planning (BCP)</h1>
          <p className="text-xs text-slate-500">Recovery Time Objective (RTO) and Recovery Point Objective (RPO) plans</p>
        </div>
        {hasPermission('create') && (
          <Button onClick={() => setEditing(blank())} size="sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New plan
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Total BCP plans</div>
          <div className="text-xl font-semibold text-slate-900 mt-0.5 tabular-nums">{stats.total}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-emerald-600">Current & tested</div>
          <div className="text-xl font-semibold text-emerald-700 mt-0.5 tabular-nums">{stats.current}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-rose-600">Overdue review</div>
          <div className="text-xl font-semibold text-rose-700 mt-0.5 tabular-nums">{stats.overdue}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Average RTO</div>
          <div className="text-xl font-semibold text-slate-900 mt-0.5 tabular-nums">{stats.avgRto} <span className="text-xs font-normal text-slate-400">hours</span></div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <table className="enterprise-table">
          <thead>
            <tr>
              <th className="w-[10%]">ID</th>
              <th className="w-[32%]">Plan name & scope</th>
              <th className="w-[12%] text-right">RTO (hrs)</th>
              <th className="w-[12%] text-right">RPO (hrs)</th>
              <th className="w-[14%]">Owner</th>
              <th className="w-[10%]">Next test</th>
              <th className="w-[10%] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(p => (
              <tr key={p.id}>
                <td className="font-mono text-slate-500">{p.id}</td>
                <td>
                  <div className="font-medium text-slate-900">{p.name}</div>
                  <div className="text-slate-400 text-[11px]">{p.scope}</div>
                </td>
                <td className="text-right font-mono tabular-nums text-slate-900">{p.rto}h</td>
                <td className="text-right font-mono tabular-nums text-slate-900">{p.rpo}h</td>
                <td className="text-slate-600">{p.owner}</td>
                <td>
                  <span className={cn('text-xs', p.status === 'Overdue' ? 'text-red-600 font-semibold' : 'text-slate-600')}>
                    {p.nextTest}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {hasPermission('update') && (
                      <Button variant="ghost" size="icon" onClick={() => setEditing(p)} className="h-7 w-7">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {hasPermission('delete') && (
                      <Button variant="ghost" size="icon" onClick={() => remove(p)} className="h-7 w-7 text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <BcpEditor initial={editing} onCancel={() => setEditing(null)} onSave={save} />}
    </div>
  )
}

function blank(): BcpPlan {
  const next = new Date(); next.setMonth(next.getMonth() + 6)
  return { id: genId('BCP'), name: '', scope: '', rto: 4, rpo: 1, owner: '', nextTest: next.toISOString().slice(0, 10), status: 'Draft' }
}

function BcpEditor({ initial, onCancel, onSave }: { initial: BcpPlan; onCancel: () => void; onSave: (p: BcpPlan) => void }) {
  const [draft, setDraft] = useState<BcpPlan>(initial)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">{initial.name ? `Edit ${draft.id}` : 'Create BCP Plan'}</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-sm">&times;</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Plan name *</label>
            <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Payment failover plan" className="h-8 text-xs" />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Scope</label>
            <Input value={draft.scope} onChange={e => setDraft({ ...draft, scope: e.target.value })} placeholder="Target systems & functions" className="h-8 text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Recovery Time (RTO hours)</label>
              <Input type="number" value={draft.rto} onChange={e => setDraft({ ...draft, rto: Number(e.target.value) || 1 })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Recovery Point (RPO hours)</label>
              <Input type="number" value={draft.rpo} onChange={e => setDraft({ ...draft, rpo: Number(e.target.value) || 1 })} className="h-8 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Plan owner</label>
              <Input value={draft.owner} onChange={e => setDraft({ ...draft, owner: e.target.value })} placeholder="e.g. CTO" className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Status</label>
              <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as BcpPlan['status'] })} className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white">
                <option>Current</option>
                <option>Overdue</option>
                <option>Draft</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={() => onSave(draft)}>Save plan</Button>
        </div>
      </div>
    </div>
  )
}
