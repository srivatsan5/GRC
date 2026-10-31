'use client'

import React, { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
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

export type ControlType = 'Preventive' | 'Detective' | 'Corrective' | 'Compensating'
export type ControlNature = 'Manual' | 'Automated' | 'Hybrid'
export type ControlFrequency = 'Continuous' | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annual' | 'Event-driven'

export interface Control {
  id: string
  code: string
  name: string
  description: string
  type: ControlType
  nature: ControlNature
  frequency: ControlFrequency
  owner: string
  framework: string[]
  designEffectiveness: number // 1-5
  operatingEffectiveness: number // 1-5
  linkedRisks: string[]
  lastTested?: string
  status: 'Active' | 'Retired' | 'Draft'
}

const SEED: Control[] = [
  { id: 'CTL-001', code: 'CTL-IT-AUTH-01', name: 'MFA on all production systems', description: 'Multi-factor authentication enforced for all administrative access to production environments.', type: 'Preventive', nature: 'Automated', frequency: 'Continuous', owner: 'CISO', framework: ['ISO 27001', 'SOX'], designEffectiveness: 5, operatingEffectiveness: 5, linkedRisks: ['R-001', 'R-014'], lastTested: '2026-04-15', status: 'Active' },
  { id: 'CTL-002', code: 'CTL-FIN-REC-02', name: 'Daily bank reconciliation', description: 'Treasury team reconciles bank statements daily against ERP entries.', type: 'Detective', nature: 'Manual', frequency: 'Daily', owner: 'CFO', framework: ['SOX'], designEffectiveness: 4, operatingEffectiveness: 4, linkedRisks: ['R-003'], lastTested: '2026-05-01', status: 'Active' },
  { id: 'CTL-003', code: 'CTL-OPS-INC-03', name: 'Incident response playbook', description: 'Documented IR procedures with named owners and 1-hour activation SLA.', type: 'Corrective', nature: 'Hybrid', frequency: 'Event-driven', owner: 'COO', framework: ['ISO 27001'], designEffectiveness: 4, operatingEffectiveness: 3, linkedRisks: ['R-007', 'R-012'], lastTested: '2026-03-22', status: 'Active' },
  { id: 'CTL-004', code: 'CTL-COMP-TRN-04', name: 'Annual GDPR training', description: 'All employees complete mandatory GDPR awareness training annually.', type: 'Preventive', nature: 'Automated', frequency: 'Annual', owner: 'Chief Compliance Officer', framework: ['GDPR'], designEffectiveness: 5, operatingEffectiveness: 4, linkedRisks: ['R-005'], lastTested: '2026-01-10', status: 'Active' },
  { id: 'CTL-005', code: 'CTL-IT-BCK-05', name: 'Encrypted off-site backup', description: 'Nightly encrypted backups stored in geo-redundant storage with 30-day retention.', type: 'Preventive', nature: 'Automated', frequency: 'Daily', owner: 'CIO', framework: ['ISO 27001', 'SOX'], designEffectiveness: 5, operatingEffectiveness: 5, linkedRisks: ['R-009'], lastTested: '2026-04-30', status: 'Active' },
  { id: 'CTL-006', code: 'CTL-VEN-DUE-06', name: 'Vendor due-diligence questionnaire', description: 'Risk-based DDQ executed prior to onboarding any new vendor handling sensitive data.', type: 'Preventive', nature: 'Manual', frequency: 'Event-driven', owner: 'Head of Procurement', framework: ['ISO 27001'], designEffectiveness: 3, operatingEffectiveness: 3, linkedRisks: ['R-018'], status: 'Active' },
  { id: 'CTL-007', code: 'CTL-FIN-SOD-07', name: 'Segregation of duties — payments', description: 'Maker–checker control: no single user can both initiate and approve payments > $10K.', type: 'Preventive', nature: 'Automated', frequency: 'Continuous', owner: 'CFO', framework: ['SOX'], designEffectiveness: 5, operatingEffectiveness: 5, linkedRisks: ['R-004'], lastTested: '2026-05-12', status: 'Active' },
  { id: 'CTL-008', code: 'CTL-COMP-MON-08', name: 'Regulatory horizon scanning', description: 'Quarterly review of regulatory changes affecting in-scope jurisdictions.', type: 'Detective', nature: 'Manual', frequency: 'Quarterly', owner: 'Chief Compliance Officer', framework: ['GDPR', 'SOX'], designEffectiveness: 3, operatingEffectiveness: 2, linkedRisks: ['R-010'], status: 'Active' },
]

export const controlsStore = createStore<Control>({ key: 'controls', seed: SEED })

export function ControlLibraryPage() {
  const items = useStoreSnapshot(controlsStore)
  const { toast } = useToast()
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const [editing, setEditing] = useState<Control | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'All' | ControlType>('All')

  const filtered = useMemo(() => items.filter(c => {
    if (typeFilter !== 'All' && c.type !== typeFilter) return false
    if (search && !`${c.name} ${c.code} ${c.owner} ${c.framework.join(' ')}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [items, search, typeFilter])

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter(c => c.status === 'Active').length,
    preventive: items.filter(c => c.type === 'Preventive').length,
    avgEff: items.length ? (items.reduce((s, c) => s + (c.designEffectiveness + c.operatingEffectiveness) / 2, 0) / items.length).toFixed(1) : '0',
  }), [items])

  const handleSave = (c: Control) => {
    const isNew = !items.find(x => x.id === c.id)
    if (isNew) {
      controlsStore.add(c)
      recordAudit({ action: 'CREATE', entity: 'Control', entity_id: c.id, description: `Created control ${c.code} – ${c.name}`, after: c, result: 'SUCCESS' })
      toast({ title: 'Control created', description: c.name })
    } else {
      controlsStore.update(c.id, c)
      recordAudit({ action: 'UPDATE', entity: 'Control', entity_id: c.id, description: `Updated control ${c.code}`, after: c, result: 'SUCCESS' })
      toast({ title: 'Control updated', description: c.name })
    }
    setEditing(null)
  }

  const handleDelete = async (c: Control) => {
    const ok = await confirm({
      title: `Delete ${c.code}?`,
      description: `This will remove "${c.name}" from the library.`,
      confirmLabel: 'Delete control',
      tone: 'danger',
    })
    if (!ok) return
    controlsStore.remove(c.id)
    recordAudit({ action: 'DELETE', entity: 'Control', entity_id: c.id, description: `Deleted control ${c.code}`, before: c, result: 'SUCCESS' })
    toast({ title: 'Control deleted', description: c.name })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Control Library</h1>
          <p className="text-xs text-slate-500">Central register of internal controls and effectiveness ratings</p>
        </div>
        {hasPermission('create') && (
          <Button onClick={() => setEditing(blank())} size="sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New control
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Total controls</div>
          <div className="text-xl font-semibold text-slate-900 mt-0.5 tabular-nums">{stats.total}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Active controls</div>
          <div className="text-xl font-semibold text-emerald-700 mt-0.5 tabular-nums">{stats.active}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Preventive controls</div>
          <div className="text-xl font-semibold text-blue-700 mt-0.5 tabular-nums">{stats.preventive}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Average effectiveness</div>
          <div className="text-xl font-semibold text-slate-900 mt-0.5 tabular-nums">{stats.avgEff} <span className="text-xs text-slate-400 font-normal">/ 5</span></div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch justify-between">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
          <Input 
            placeholder="Search controls..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-8 h-8 text-xs bg-white" 
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
          {(['All', 'Preventive', 'Detective', 'Corrective', 'Compensating'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={cn(
                'px-2.5 py-1 rounded text-xs transition-colors',
                typeFilter === t ? 'bg-white font-medium text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <table className="enterprise-table">
          <thead>
            <tr>
              <th className="w-[12%]">Code</th>
              <th className="w-[30%]">Control name & description</th>
              <th className="w-[12%]">Type</th>
              <th className="w-[14%]">Owner</th>
              <th className="w-[12%]">Frequency</th>
              <th className="w-[12%]">Effectiveness</th>
              <th className="w-[8%] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td className="font-mono text-slate-500">{c.code}</td>
                <td>
                  <div className="font-medium text-slate-900">{c.name}</div>
                  <div className="text-slate-500 text-[11px] line-clamp-1">{c.description}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.framework.map(f => (
                      <span key={f} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">{f}</span>
                    ))}
                  </div>
                </td>
                <td>
                  <StatusBadge status={c.type === 'Preventive' ? 'info' : c.type === 'Detective' ? 'warning' : 'critical'} label={c.type} />
                </td>
                <td className="text-slate-600">{c.owner}</td>
                <td className="text-slate-600">{c.frequency}</td>
                <td>
                  <span className="font-medium text-slate-900 tabular-nums">D: {c.designEffectiveness}/5 &middot; O: {c.operatingEffectiveness}/5</span>
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {hasPermission('update') && (
                      <Button variant="ghost" size="icon" onClick={() => setEditing(c)} className="h-7 w-7">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {hasPermission('delete') && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c)} className="h-7 w-7 text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No controls found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && <ControlEditor initial={editing} onCancel={() => setEditing(null)} onSave={handleSave} />}
    </div>
  )
}

function blank(): Control {
  return {
    id: genId('CTL'),
    code: '', name: '', description: '',
    type: 'Preventive', nature: 'Manual', frequency: 'Monthly',
    owner: '', framework: [],
    designEffectiveness: 3, operatingEffectiveness: 3,
    linkedRisks: [], status: 'Draft',
  }
}

function ControlEditor({ initial, onSave, onCancel }: { initial: Control; onSave: (c: Control) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Control>(initial)
  const isNew = !initial.code

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">{isNew ? 'Create Control' : `Edit ${draft.code}`}</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-sm">&times;</button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Control code *</label>
              <Input
                value={draft.code}
                onChange={e => setDraft({ ...draft, code: e.target.value })}
                placeholder="e.g. CTL-IT-001"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Owner *</label>
              <Input
                value={draft.owner}
                onChange={e => setDraft({ ...draft, owner: e.target.value })}
                placeholder="e.g. CISO"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Control name *</label>
            <Input
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder="Descriptive title of control"
              className="h-8 text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Description</label>
            <textarea
              value={draft.description}
              onChange={e => setDraft({ ...draft, description: e.target.value })}
              rows={2}
              className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
              placeholder="Control objectives and implementation details..."
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Type</label>
              <select
                value={draft.type}
                onChange={e => setDraft({ ...draft, type: e.target.value as ControlType })}
                className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white"
              >
                <option>Preventive</option>
                <option>Detective</option>
                <option>Corrective</option>
                <option>Compensating</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Frequency</label>
              <select
                value={draft.frequency}
                onChange={e => setDraft({ ...draft, frequency: e.target.value as ControlFrequency })}
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
            <div>
              <label className="block text-slate-700 font-medium mb-1">Nature</label>
              <select
                value={draft.nature}
                onChange={e => setDraft({ ...draft, nature: e.target.value as ControlNature })}
                className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white"
              >
                <option>Automated</option>
                <option>Manual</option>
                <option>Hybrid</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Design effectiveness (1-5)</label>
              <Input
                type="number"
                min={1}
                max={5}
                value={draft.designEffectiveness}
                onChange={e => setDraft({ ...draft, designEffectiveness: Number(e.target.value) || 1 })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Operating effectiveness (1-5)</label>
              <Input
                type="number"
                min={1}
                max={5}
                value={draft.operatingEffectiveness}
                onChange={e => setDraft({ ...draft, operatingEffectiveness: Number(e.target.value) || 1 })}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={() => onSave(draft)}>Save control</Button>
        </div>
      </div>
    </div>
  )
}
