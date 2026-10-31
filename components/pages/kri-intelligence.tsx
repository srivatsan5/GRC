'use client'

import React, { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { createStore, useStoreSnapshot, genId } from '@/lib/localStore'
import { useToast } from '@/hooks/use-toast'
import { recordAudit } from '@/lib/auditLog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'

export interface KRI {
  id: string
  code: string
  name: string
  category: string
  owner: string
  unit: string
  greenThreshold: number
  amberThreshold: number
  redThreshold: number
  currentValue: number
  direction: 'higher-worse' | 'lower-worse'
  history: { date: string; value: number }[]
  active: boolean
}

const SEED: KRI[] = [
  {
    id: 'KRI-001', code: 'KRI-IT-001', name: 'Unplanned IT Outage Hours', category: 'IT & Cyber',
    owner: 'CIO', unit: 'hrs/month', greenThreshold: 4, amberThreshold: 8, redThreshold: 12, currentValue: 7.2,
    direction: 'higher-worse',
    history: monthly(2.1, 3.4, 4.8, 5.2, 6.9, 7.2), active: true,
  },
  {
    id: 'KRI-002', code: 'KRI-OPS-002', name: 'Critical Customer Support Escalations', category: 'Operations',
    owner: 'COO', unit: 'count/week', greenThreshold: 10, amberThreshold: 25, redThreshold: 40, currentValue: 22,
    direction: 'higher-worse',
    history: monthly(8, 12, 15, 19, 24, 22), active: true,
  },
  {
    id: 'KRI-003', code: 'KRI-FIN-003', name: 'Operating Cash Buffer', category: 'Financial',
    owner: 'CFO', unit: 'days', greenThreshold: 45, amberThreshold: 30, redThreshold: 15, currentValue: 38,
    direction: 'lower-worse',
    history: monthly(50, 48, 44, 40, 39, 38), active: true,
  },
  {
    id: 'KRI-004', code: 'KRI-COMP-004', name: 'Overdue Audit Remediation Items', category: 'Compliance',
    owner: 'Compliance Officer', unit: 'count', greenThreshold: 3, amberThreshold: 8, redThreshold: 15, currentValue: 6,
    direction: 'higher-worse',
    history: monthly(2, 3, 4, 5, 5, 6), active: true,
  },
]

function monthly(...vals: number[]) {
  const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May']
  return vals.map((value, i) => ({ date: months[i], value }))
}

export const kriStore = createStore<KRI>({ key: 'kri', seed: SEED })

function statusOf(kri: KRI): 'green' | 'amber' | 'red' {
  const v = kri.currentValue
  if (kri.direction === 'higher-worse') {
    if (v >= kri.redThreshold) return 'red'
    if (v >= kri.amberThreshold) return 'amber'
    return 'green'
  } else {
    if (v <= kri.redThreshold) return 'red'
    if (v <= kri.amberThreshold) return 'amber'
    return 'green'
  }
}

export function KriIntelligencePage() {
  const items = useStoreSnapshot(kriStore)
  const { toast } = useToast()
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const [editing, setEditing] = useState<KRI | null>(null)
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'green' | 'amber' | 'red'>('all')

  const filtered = useMemo(() => {
    return items.filter(k => {
      if (statusFilter !== 'all' && statusOf(k) !== statusFilter) return false
      if (filter && !`${k.name} ${k.code} ${k.owner} ${k.category}`.toLowerCase().includes(filter.toLowerCase())) return false
      return true
    })
  }, [items, filter, statusFilter])

  const totals = useMemo(() => ({
    total: items.length,
    breaches: items.filter(k => statusOf(k) === 'red').length,
    warnings: items.filter(k => statusOf(k) === 'amber').length,
    healthy: items.filter(k => statusOf(k) === 'green').length,
  }), [items])

  const handleSave = (kri: KRI) => {
    const isNew = !items.find(x => x.id === kri.id)
    if (isNew) {
      kriStore.add(kri)
      recordAudit({ action: 'CREATE', entity: 'KRI', entity_id: kri.id, description: `Created KRI ${kri.code} – ${kri.name}`, after: kri, result: 'SUCCESS' })
      toast({ title: 'KRI created', description: kri.name })
    } else {
      kriStore.update(kri.id, kri)
      recordAudit({ action: 'UPDATE', entity: 'KRI', entity_id: kri.id, description: `Updated KRI ${kri.code}`, after: kri, result: 'SUCCESS' })
      toast({ title: 'KRI updated', description: kri.name })
    }
    setEditing(null)
  }

  const handleQuickReading = (kri: KRI, newValue: number) => {
    const nextHistory = [...kri.history, { date: 'Now', value: newValue }]
    const updated = { ...kri, currentValue: newValue, history: nextHistory }
    kriStore.update(kri.id, updated)
    const newStatus = statusOf(updated)
    recordAudit({
      action: 'UPDATE',
      entity: 'KRI Reading',
      entity_id: kri.id,
      description: `Logged new reading for ${kri.code}: ${newValue} ${kri.unit} (Status: ${newStatus})`,
      result: 'SUCCESS',
    })
    toast({ title: 'Reading logged', description: `${kri.name}: ${newValue} ${kri.unit}` })
  }

  const handleDelete = async (kri: KRI) => {
    const ok = await confirm({
      title: `Delete ${kri.code}?`,
      description: `This will remove "${kri.name}" from telemetry tracking.`,
      confirmLabel: 'Delete KRI',
      tone: 'danger',
    })
    if (!ok) return
    kriStore.remove(kri.id)
    recordAudit({ action: 'DELETE', entity: 'KRI', entity_id: kri.id, description: `Deleted KRI ${kri.code} – ${kri.name}`, before: kri, result: 'SUCCESS' })
    toast({ title: 'KRI deleted', description: kri.name })
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Key Risk Indicators (KRI)</h1>
          <p className="text-xs text-slate-500">Continuous telemetry and operational threshold monitoring</p>
        </div>
        {hasPermission('create') && (
          <Button onClick={() => setEditing(blankKri())} size="sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New indicator
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Tracked indicators</div>
          <div className="text-xl font-semibold text-slate-900 mt-0.5 tabular-nums">{totals.total}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-emerald-600">Normal / Healthy</div>
          <div className="text-xl font-semibold text-emerald-700 mt-0.5 tabular-nums">{totals.healthy}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-amber-600">Amber warnings</div>
          <div className="text-xl font-semibold text-amber-700 mt-0.5 tabular-nums">{totals.warnings}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-rose-600">Red breaches</div>
          <div className="text-xl font-semibold text-rose-700 mt-0.5 tabular-nums">{totals.breaches}</div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch justify-between">
        <Input 
          placeholder="Filter KRIs..." 
          value={filter} 
          onChange={e => setFilter(e.target.value)} 
          className="h-8 text-xs bg-white w-72" 
        />
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
          {(['all', 'green', 'amber', 'red'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-2.5 py-1 rounded text-xs capitalize transition-colors',
                statusFilter === s ? 'bg-white font-medium text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of KRI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(kri => (
          <KriCard
            key={kri.id}
            kri={kri}
            onEdit={() => setEditing(kri)}
            onDelete={() => handleDelete(kri)}
            onQuickReading={(val) => handleQuickReading(kri, val)}
            canEdit={hasPermission('update')}
            canDelete={hasPermission('delete')}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full p-8 text-center text-slate-400 bg-white rounded border border-slate-200 text-xs">
            No Key Risk Indicators match the selected filters.
          </div>
        )}
      </div>

      {editing && (
        <KriEditor
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

function blankKri(): KRI {
  return {
    id: genId('KRI'),
    code: '',
    name: '',
    category: 'Operations',
    owner: '',
    unit: 'count',
    greenThreshold: 5,
    amberThreshold: 10,
    redThreshold: 20,
    currentValue: 0,
    direction: 'higher-worse',
    history: monthly(0, 0, 0, 0, 0, 0),
    active: true,
  }
}

function KriCard({ kri, onEdit, onDelete, onQuickReading, canEdit, canDelete }: { kri: KRI; onEdit: () => void; onDelete: () => void; onQuickReading: (val: number) => void; canEdit: boolean; canDelete: boolean }) {
  const status = statusOf(kri)
  const isBreach = status === 'red'
  const isWarning = status === 'amber'
  const [newReadingVal, setNewReadingVal] = useState<string>('')
  const [showLogInput, setShowLogInput] = useState(false)

  const statusLabel = isBreach ? 'Breach (Red)' : isWarning ? 'Warning (Amber)' : 'Normal (Green)'
  const chartColor = isBreach ? '#dc2626' : isWarning ? '#d97706' : '#16a34a'

  return (
    <div className={cn(
      'p-4 bg-white rounded border transition-colors space-y-3',
      isBreach ? 'border-red-300' : isWarning ? 'border-amber-300' : 'border-slate-200'
    )}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-slate-400">{kri.code}</span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">{kri.category}</span>
          </div>
          <h3 className="text-xs font-semibold text-slate-900 mt-1">{kri.name}</h3>
          <p className="text-[11px] text-slate-500">Owner: {kri.owner || 'Unassigned'}</p>
        </div>

        <div className="flex items-center gap-1">
          {canEdit && (
            <Button variant="ghost" size="icon" onClick={() => setShowLogInput(!showLogInput)} title="Log metric reading" className="h-7 w-7 text-slate-500">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          )}
          {canEdit && (
            <Button variant="ghost" size="icon" onClick={onEdit} className="h-7 w-7 text-slate-500">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="icon" onClick={onDelete} className="h-7 w-7 text-red-600 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Value & Status Row */}
      <div className="flex items-baseline justify-between pt-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-slate-900 tabular-nums">{kri.currentValue}</span>
          <span className="text-xs text-slate-500">{kri.unit}</span>
        </div>
        <StatusBadge status={status === 'red' ? 'critical' : status === 'amber' ? 'warning' : 'success'} label={statusLabel} />
      </div>

      {/* Quick Reading Simulator Bar */}
      {showLogInput && (
        <div className="p-2 bg-slate-50 rounded border border-slate-200 flex items-center gap-2 text-xs">
          <span className="text-slate-600 whitespace-nowrap">New value:</span>
          <Input
            type="number"
            value={newReadingVal}
            onChange={e => setNewReadingVal(e.target.value)}
            placeholder="e.g. 15"
            className="h-7 text-xs bg-white w-24"
          />
          <Button
            size="sm"
            onClick={() => {
              const val = Number(newReadingVal)
              if (!isNaN(val)) {
                onQuickReading(val)
                setShowLogInput(false)
                setNewReadingVal('')
              }
            }}
            className="h-7 text-xs"
          >
            Update
          </Button>
        </div>
      )}

      {/* Mini Trend Line */}
      <div className="h-24 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={kri.history} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#94a3b8" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" axisLine={false} tickLine={false} width={28} />
            <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '4px' }} />
            <ReferenceLine y={kri.amberThreshold} stroke="#d97706" strokeDasharray="3 3" />
            <ReferenceLine y={kri.redThreshold} stroke="#dc2626" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2} dot={{ r: 2.5, fill: chartColor }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Threshold bands summary */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
        <span>Green: &le; {kri.greenThreshold}</span>
        <span>Amber: &le; {kri.amberThreshold}</span>
        <span>Red: &ge; {kri.redThreshold}</span>
      </div>
    </div>
  )
}

function KriEditor({ initial, onCancel, onSave }: { initial: KRI; onCancel: () => void; onSave: (kri: KRI) => void }) {
  const [draft, setDraft] = useState<KRI>(initial)

  const submit = () => {
    if (!draft.code || !draft.name) return
    onSave({ ...draft, currentValue: Number(draft.currentValue) })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">{initial.code ? `Edit ${draft.code}` : 'New Indicator'}</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-sm">&times;</button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">KRI code *</label>
              <Input value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} placeholder="KRI-IT-001" className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Owner *</label>
              <Input value={draft.owner} onChange={e => setDraft({ ...draft, owner: e.target.value })} placeholder="e.g. CIO" className="h-8 text-xs" />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Indicator title *</label>
            <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Unplanned Outage Hours" className="h-8 text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Category</label>
              <select className="h-8 px-2 border border-slate-200 rounded text-xs w-full bg-white" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
                {['IT & Cyber', 'Operations', 'Financial', 'Compliance', 'People', 'Vendor'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Unit of measure</label>
              <Input value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })} placeholder="hrs/mo, %, count" className="h-8 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Green bound</label>
              <Input type="number" value={draft.greenThreshold} onChange={e => setDraft({ ...draft, greenThreshold: Number(e.target.value) })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Amber limit</label>
              <Input type="number" value={draft.amberThreshold} onChange={e => setDraft({ ...draft, amberThreshold: Number(e.target.value) })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Red breach</label>
              <Input type="number" value={draft.redThreshold} onChange={e => setDraft({ ...draft, redThreshold: Number(e.target.value) })} className="h-8 text-xs" />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Current telemetry value</label>
            <Input type="number" value={draft.currentValue} onChange={e => setDraft({ ...draft, currentValue: Number(e.target.value) })} className="h-8 text-xs" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={submit}>Save KRI</Button>
        </div>
      </div>
    </div>
  )
}
