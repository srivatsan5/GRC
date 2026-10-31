'use client'

import React, { useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { createStore, useStoreSnapshot, genId } from '@/lib/localStore'
import { useToast } from '@/hooks/use-toast'
import { recordAudit } from '@/lib/auditLog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'

export type VendorTier = 'Critical' | 'High' | 'Medium' | 'Low'

export interface Vendor {
  id: string
  name: string
  category: string
  tier: VendorTier
  country: string
  contractValue: number
  riskScore: number // 1-100
  lastAssessment: string
  nextReview: string
  contact: string
  status: 'Active' | 'Onboarding' | 'Offboarding'
  findings: number
}

const SEED: Vendor[] = [
  { id: 'V-0001', name: 'Cloudbase Hosting Ltd', category: 'Cloud Infrastructure', tier: 'Critical', country: 'IE', contractValue: 1250000, riskScore: 78, lastAssessment: '2026-03-12', nextReview: '2026-09-12', contact: 'partners@cloudbase.io', status: 'Active', findings: 2 },
  { id: 'V-0002', name: 'Sentinel Cybersecurity', category: 'Managed Security', tier: 'Critical', country: 'US', contractValue: 820000, riskScore: 91, lastAssessment: '2026-04-20', nextReview: '2026-10-20', contact: 'msa@sentinel.com', status: 'Active', findings: 0 },
  { id: 'V-0003', name: 'PayStream Analytics', category: 'Financial Data', tier: 'High', country: 'GB', contractValue: 410000, riskScore: 64, lastAssessment: '2026-02-08', nextReview: '2026-08-08', contact: 'risk@paystream.co.uk', status: 'Active', findings: 1 },
  { id: 'V-0004', name: 'TextWorks Translations', category: 'Localization', tier: 'Low', country: 'IN', contractValue: 65000, riskScore: 32, lastAssessment: '2025-12-15', nextReview: '2026-12-15', contact: 'hello@textworks.in', status: 'Active', findings: 0 },
  { id: 'V-0005', name: 'Apex HR Outsourcing', category: 'HR Services', tier: 'High', country: 'PH', contractValue: 320000, riskScore: 55, lastAssessment: '2026-01-30', nextReview: '2026-07-30', contact: 'compliance@apexhr.ph', status: 'Active', findings: 3 },
  { id: 'V-0006', name: 'Streamline Print Co', category: 'Logistics', tier: 'Medium', country: 'DE', contractValue: 180000, riskScore: 41, lastAssessment: '2026-03-01', nextReview: '2026-09-01', contact: 'sales@streamline.de', status: 'Active', findings: 0 },
]

export const vendorStore = createStore<Vendor>({ key: 'vendors', seed: SEED })

export function VendorRiskPage() {
  const items = useStoreSnapshot(vendorStore)
  const { toast } = useToast()
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<'All' | VendorTier>('All')
  const [editing, setEditing] = useState<Vendor | null>(null)

  const filtered = useMemo(() => items.filter(v => {
    if (tierFilter !== 'All' && v.tier !== tierFilter) return false
    if (search && !`${v.name} ${v.category} ${v.id} ${v.country}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [items, search, tierFilter])

  const stats = useMemo(() => ({
    total: items.length,
    critical: items.filter(v => v.tier === 'Critical').length,
    overdue: items.filter(v => new Date(v.nextReview) < new Date()).length,
    findings: items.reduce((s, v) => s + v.findings, 0),
  }), [items])

  const save = (v: Vendor) => {
    const isNew = !items.find(x => x.id === v.id)
    if (isNew) {
      vendorStore.add(v)
      recordAudit({ action: 'CREATE', entity: 'Vendor', entity_id: v.id, description: `Onboarded vendor ${v.name}`, after: v, result: 'SUCCESS' })
      toast({ title: 'Vendor created' })
    } else {
      vendorStore.update(v.id, v)
      recordAudit({ action: 'UPDATE', entity: 'Vendor', entity_id: v.id, description: `Updated vendor ${v.name}`, after: v, result: 'SUCCESS' })
      toast({ title: 'Vendor updated' })
    }
    setEditing(null)
  }

  const remove = async (v: Vendor) => {
    const ok = await confirm({ title: `Remove ${v.name}?`, description: 'This will permanently remove the vendor record.', confirmLabel: 'Remove vendor', tone: 'danger' })
    if (!ok) return
    vendorStore.remove(v.id)
    recordAudit({ action: 'DELETE', entity: 'Vendor', entity_id: v.id, description: `Removed vendor ${v.name}`, before: v, result: 'SUCCESS' })
    toast({ title: 'Vendor removed' })
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Third-Party Risk Management (TPRM)</h1>
          <p className="text-xs text-slate-500">Tiered vendor risk assessment, contract tracking, and review cadence</p>
        </div>
        {hasPermission('create') && (
          <Button onClick={() => setEditing(blank())} size="sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Onboard vendor
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Active vendors</div>
          <div className="text-xl font-semibold text-slate-900 mt-0.5 tabular-nums">{stats.total}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-rose-600">Critical-tier vendors</div>
          <div className="text-xl font-semibold text-rose-700 mt-0.5 tabular-nums">{stats.critical}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-amber-600">Reviews overdue</div>
          <div className="text-xl font-semibold text-amber-700 mt-0.5 tabular-nums">{stats.overdue}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Open audit findings</div>
          <div className="text-xl font-semibold text-slate-900 mt-0.5 tabular-nums">{stats.findings}</div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch justify-between">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
          <Input 
            placeholder="Search vendors..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-8 h-8 text-xs bg-white" 
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
          {(['All', 'Critical', 'High', 'Medium', 'Low'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTierFilter(t)}
              className={cn(
                'px-2.5 py-1 rounded text-xs transition-colors',
                tierFilter === t ? 'bg-white font-medium text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
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
              <th className="w-[10%]">ID</th>
              <th className="w-[26%]">Vendor name & domain</th>
              <th className="w-[12%]">Tier</th>
              <th className="w-[10%]">Country</th>
              <th className="w-[14%] text-right">Contract value</th>
              <th className="w-[14%]">Risk score</th>
              <th className="w-[14%] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(v => (
              <tr key={v.id}>
                <td className="font-mono text-slate-500">{v.id}</td>
                <td>
                  <div className="font-medium text-slate-900">{v.name}</div>
                  <div className="text-slate-400 text-[11px]">{v.category}</div>
                </td>
                <td>
                  <StatusBadge status={v.tier === 'Critical' ? 'critical' : v.tier === 'High' ? 'high' : v.tier === 'Medium' ? 'warning' : 'low'} label={v.tier} />
                </td>
                <td className="text-slate-600 font-mono text-xs">{v.country}</td>
                <td className="text-right font-medium tabular-nums text-slate-900">
                  ${v.contractValue.toLocaleString()}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 rounded overflow-hidden">
                      <div className={cn('h-full rounded', v.riskScore > 70 ? 'bg-red-600' : v.riskScore > 50 ? 'bg-amber-500' : 'bg-emerald-600')} style={{ width: `${v.riskScore}%` }} />
                    </div>
                    <span className="font-medium tabular-nums text-xs">{v.riskScore}/100</span>
                  </div>
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {hasPermission('update') && (
                      <Button variant="ghost" size="icon" onClick={() => setEditing(v)} className="h-7 w-7">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {hasPermission('delete') && (
                      <Button variant="ghost" size="icon" onClick={() => remove(v)} className="h-7 w-7 text-red-600 hover:bg-red-50">
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
                  No vendors found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && <VendorEditor initial={editing} onCancel={() => setEditing(null)} onSave={save} />}
    </div>
  )
}

function blank(): Vendor {
  return {
    id: genId('V'),
    name: '', category: 'Cloud Infrastructure', tier: 'Medium',
    country: 'US', contractValue: 100000, riskScore: 50,
    lastAssessment: new Date().toISOString().slice(0, 10),
    nextReview: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    contact: '', status: 'Active', findings: 0,
  }
}

function VendorEditor({ initial, onCancel, onSave }: { initial: Vendor; onCancel: () => void; onSave: (v: Vendor) => void }) {
  const [draft, setDraft] = useState<Vendor>(initial)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">{initial.name ? `Edit ${draft.name}` : 'Onboard Vendor'}</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-sm">&times;</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Vendor name *</label>
            <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Company name" className="h-8 text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Category</label>
              <Input value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Risk tier</label>
              <select value={draft.tier} onChange={e => setDraft({ ...draft, tier: e.target.value as VendorTier })} className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white">
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Contract value (USD)</label>
              <Input type="number" value={draft.contractValue} onChange={e => setDraft({ ...draft, contractValue: Number(e.target.value) || 0 })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Risk score (1-100)</label>
              <Input type="number" min={1} max={100} value={draft.riskScore} onChange={e => setDraft({ ...draft, riskScore: Number(e.target.value) || 1 })} className="h-8 text-xs" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={() => onSave(draft)}>Save vendor</Button>
        </div>
      </div>
    </div>
  )
}
