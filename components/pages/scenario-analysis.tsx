'use client'

import React, { useMemo, useState } from 'react'
import { Plus, Play, Trash2, Pencil, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { createStore, useStoreSnapshot, genId } from '@/lib/localStore'
import { useToast } from '@/hooks/use-toast'
import { recordAudit } from '@/lib/auditLog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'

export interface Scenario {
  id: string
  name: string
  description: string
  type: 'Stress Test' | 'What-if' | 'Reverse Stress' | 'Tail Risk'
  category: string
  shockMagnitude: number // percent
  baselineLoss: number
  stressedLoss: number
  probability: number // 1-100
  owner: string
  lastRun?: string
}

const SEED: Scenario[] = [
  { id: 'SC-001', name: 'Severe Foreign Exchange Devaluation', description: '20% currency depreciation against USD over 90 days.', type: 'Stress Test', category: 'Financial', shockMagnitude: 20, baselineLoss: 1200000, stressedLoss: 4800000, probability: 12, owner: 'CFO', lastRun: '2026-04-12' },
  { id: 'SC-002', name: 'Primary Cloud Region Infrastructure Outage', description: 'Primary cloud data center region offline for 24 hours.', type: 'What-if', category: 'IT & Cyber', shockMagnitude: 100, baselineLoss: 50000, stressedLoss: 920000, probability: 6, owner: 'CIO', lastRun: '2026-03-30' },
  { id: 'SC-003', name: 'Major Strategic Customer Attrition', description: 'Top-3 enterprise customer cancellation within single quarter.', type: 'Tail Risk', category: 'Strategic', shockMagnitude: 30, baselineLoss: 0, stressedLoss: 6300000, probability: 4, owner: 'CRO', lastRun: '2026-02-15' },
]

export const scenarioStore = createStore<Scenario>({ key: 'scenarios', seed: SEED })

export function ScenarioPage() {
  const items = useStoreSnapshot(scenarioStore)
  const { toast } = useToast()
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const [editing, setEditing] = useState<Scenario | null>(null)

  const stats = useMemo(() => ({
    total: items.length,
    avgImpact: items.length ? Math.round(items.reduce((s, x) => s + (x.stressedLoss - x.baselineLoss), 0) / items.length) : 0,
    maxLoss: items.length ? Math.max(...items.map(x => x.stressedLoss)) : 0,
    runs: items.filter(x => x.lastRun).length,
  }), [items])

  const save = (s: Scenario) => {
    const isNew = !items.find(x => x.id === s.id)
    if (isNew) { scenarioStore.add(s); recordAudit({ action: 'CREATE', entity: 'Scenario', entity_id: s.id, description: `Created scenario ${s.name}`, after: s, result: 'SUCCESS' }); toast({ title: 'Scenario created' }) }
    else { scenarioStore.update(s.id, s); recordAudit({ action: 'UPDATE', entity: 'Scenario', entity_id: s.id, description: `Updated scenario ${s.name}`, after: s, result: 'SUCCESS' }); toast({ title: 'Scenario updated' }) }
    setEditing(null)
  }

  const remove = async (s: Scenario) => {
    const ok = await confirm({ title: `Delete ${s.id}?`, description: 'This action cannot be undone.', confirmLabel: 'Delete scenario', tone: 'danger' })
    if (!ok) return
    scenarioStore.remove(s.id)
    recordAudit({ action: 'DELETE', entity: 'Scenario', entity_id: s.id, description: `Deleted scenario ${s.name}`, before: s, result: 'SUCCESS' })
    toast({ title: 'Scenario deleted' })
  }

  const run = (s: Scenario) => {
    scenarioStore.update(s.id, { lastRun: new Date().toISOString().slice(0, 10) })
    recordAudit({ action: 'UPDATE', entity: 'Scenario', entity_id: s.id, description: `Ran stress test scenario: ${s.name}`, result: 'SUCCESS' })
    toast({ title: `Stress test complete`, description: `${s.name} executed.` })
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Scenario Analysis & Stress Testing</h1>
          <p className="text-xs text-slate-500">Probabilistic shock modeling and loss simulation across enterprise portfolios</p>
        </div>
        {hasPermission('create') && (
          <Button onClick={() => setEditing(blank())} size="sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New scenario
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Modeled scenarios</div>
          <div className="text-xl font-semibold text-slate-900 mt-0.5 tabular-nums">{stats.total}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Average shock impact</div>
          <div className="text-xl font-semibold text-slate-900 mt-0.5 tabular-nums">${stats.avgImpact.toLocaleString()}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-rose-600">Max plausible loss</div>
          <div className="text-xl font-semibold text-rose-700 mt-0.5 tabular-nums">${stats.maxLoss.toLocaleString()}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-emerald-600">Simulations executed</div>
          <div className="text-xl font-semibold text-emerald-700 mt-0.5 tabular-nums">{stats.runs}</div>
        </div>
      </div>

      {/* Scenarios Table */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <table className="enterprise-table">
          <thead>
            <tr>
              <th className="w-[10%]">ID</th>
              <th className="w-[30%]">Scenario name & shock</th>
              <th className="w-[12%]">Type</th>
              <th className="w-[12%] text-right">Baseline loss</th>
              <th className="w-[14%] text-right">Stressed loss</th>
              <th className="w-[10%]">Last run</th>
              <th className="w-[12%] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(s => (
              <tr key={s.id}>
                <td className="font-mono text-slate-500">{s.id}</td>
                <td>
                  <div className="font-medium text-slate-900">{s.name}</div>
                  <div className="text-slate-400 text-[11px]">{s.description}</div>
                </td>
                <td>
                  <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">{s.type}</span>
                </td>
                <td className="text-right font-medium tabular-nums text-slate-600">${s.baselineLoss.toLocaleString()}</td>
                <td className="text-right font-semibold tabular-nums text-rose-700">${s.stressedLoss.toLocaleString()}</td>
                <td className="text-slate-500 text-[11px] font-mono">{s.lastRun || 'Never'}</td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {hasPermission('update') && (
                      <Button variant="outline" size="sm" onClick={() => run(s)} className="h-7 text-xs">
                        <Play className="w-3 h-3 mr-1" /> Run
                      </Button>
                    )}
                    {hasPermission('update') && (
                      <Button variant="ghost" size="icon" onClick={() => setEditing(s)} className="h-7 w-7">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {hasPermission('delete') && (
                      <Button variant="ghost" size="icon" onClick={() => remove(s)} className="h-7 w-7 text-red-600 hover:bg-red-50">
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

      {editing && <ScEditor initial={editing} onCancel={() => setEditing(null)} onSave={save} />}
    </div>
  )
}

function blank(): Scenario {
  return { id: genId('SC'), name: '', description: '', type: 'Stress Test', category: 'Financial', shockMagnitude: 10, baselineLoss: 0, stressedLoss: 0, probability: 5, owner: '' }
}

function ScEditor({ initial, onCancel, onSave }: { initial: Scenario; onCancel: () => void; onSave: (s: Scenario) => void }) {
  const [draft, setDraft] = useState<Scenario>(initial)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">{initial.name ? `Edit ${draft.id}` : 'Create Stress Scenario'}</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-sm">&times;</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Scenario title *</label>
            <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. 20% Currency Devaluation" className="h-8 text-xs" />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Description</label>
            <textarea
              value={draft.description}
              onChange={e => setDraft({ ...draft, description: e.target.value })}
              rows={2}
              className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
              placeholder="Macro shock parameters and assumptions..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Scenario type</label>
              <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as Scenario['type'] })} className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white">
                <option>Stress Test</option>
                <option>What-if</option>
                <option>Reverse Stress</option>
                <option>Tail Risk</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Shock magnitude (%)</label>
              <Input type="number" value={draft.shockMagnitude} onChange={e => setDraft({ ...draft, shockMagnitude: Number(e.target.value) || 0 })} className="h-8 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Baseline loss (USD)</label>
              <Input type="number" value={draft.baselineLoss} onChange={e => setDraft({ ...draft, baselineLoss: Number(e.target.value) || 0 })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Stressed loss (USD)</label>
              <Input type="number" value={draft.stressedLoss} onChange={e => setDraft({ ...draft, stressedLoss: Number(e.target.value) || 0 })} className="h-8 text-xs" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={() => onSave(draft)}>Save scenario</Button>
        </div>
      </div>
    </div>
  )
}
