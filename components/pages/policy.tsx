'use client'

import React, { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Search, BookOpen, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { createStore, useStoreSnapshot, genId } from '@/lib/localStore'
import { useToast } from '@/hooks/use-toast'
import { recordAudit } from '@/lib/auditLog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'

export interface Policy {
  id: string
  code: string
  title: string
  category: string
  version: string
  owner: string
  effectiveDate: string
  nextReview: string
  acknowledgmentPct: number
  status: 'Active' | 'Draft' | 'Retired'
  linkedControls: string[]
}

const SEED: Policy[] = [
  { id: 'POL-001', code: 'POL-IT-001', title: 'Acceptable Use Policy', category: 'IT & Cyber', version: '3.2', owner: 'CISO', effectiveDate: '2026-01-01', nextReview: '2027-01-01', acknowledgmentPct: 96, status: 'Active', linkedControls: ['CTL-001'] },
  { id: 'POL-002', code: 'POL-FIN-002', title: 'Treasury & Payments Policy', category: 'Financial', version: '4.1', owner: 'CFO', effectiveDate: '2025-10-01', nextReview: '2026-10-01', acknowledgmentPct: 91, status: 'Active', linkedControls: ['CTL-002', 'CTL-007'] },
  { id: 'POL-003', code: 'POL-PRIV-003', title: 'Personal Data Protection Policy (GDPR)', category: 'Compliance', version: '2.5', owner: 'CCO', effectiveDate: '2025-05-25', nextReview: '2026-05-25', acknowledgmentPct: 88, status: 'Active', linkedControls: ['CTL-004'] },
  { id: 'POL-004', code: 'POL-HR-004', title: 'Code of Conduct', category: 'People', version: '5.0', owner: 'CHRO', effectiveDate: '2026-01-15', nextReview: '2027-01-15', acknowledgmentPct: 99, status: 'Active', linkedControls: [] },
  { id: 'POL-005', code: 'POL-VEN-005', title: 'Third-party Risk Management Policy', category: 'Vendor', version: '1.3', owner: 'Head of Procurement', effectiveDate: '2025-11-01', nextReview: '2026-11-01', acknowledgmentPct: 82, status: 'Active', linkedControls: ['CTL-006'] },
]

export const policyStore = createStore<Policy>({ key: 'policy', seed: SEED })

export function PolicyPage() {
  const items = useStoreSnapshot(policyStore)
  const { toast } = useToast()
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const [editing, setEditing] = useState<Policy | null>(null)

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter(p => p.status === 'Active').length,
    avgAck: items.length ? Math.round(items.reduce((s, p) => s + p.acknowledgmentPct, 0) / items.length) : 0,
    overdue: items.filter(p => new Date(p.nextReview) < new Date()).length,
  }), [items])

  const save = (p: Policy) => {
    const isNew = !items.find(x => x.id === p.id)
    if (isNew) { policyStore.add(p); recordAudit({ action: 'CREATE', entity: 'Policy', entity_id: p.id, description: `Created policy ${p.title}`, after: p, result: 'SUCCESS' }); toast({ title: 'Policy created' }) }
    else { policyStore.update(p.id, p); recordAudit({ action: 'UPDATE', entity: 'Policy', entity_id: p.id, description: `Updated policy ${p.title}`, after: p, result: 'SUCCESS' }); toast({ title: 'Policy updated' }) }
    setEditing(null)
  }

  const remove = async (p: Policy) => {
    const ok = await confirm({ title: `Delete ${p.code}?`, description: 'This will remove the policy document record.', confirmLabel: 'Delete policy', tone: 'danger' })
    if (!ok) return
    policyStore.remove(p.id)
    recordAudit({ action: 'DELETE', entity: 'Policy', entity_id: p.id, description: `Deleted policy ${p.title}`, before: p, result: 'SUCCESS' })
    toast({ title: 'Policy deleted' })
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Policy Management Center</h1>
          <p className="text-xs text-slate-500">Governance policies, versioning, acknowledgment metrics, and control linkage</p>
        </div>
        {hasPermission('create') && (
          <Button onClick={() => setEditing(blank())} size="sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New policy
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Total policies</div>
          <div className="text-xl font-semibold text-slate-900 mt-0.5 tabular-nums">{stats.total}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-emerald-600">Active policies</div>
          <div className="text-xl font-semibold text-emerald-700 mt-0.5 tabular-nums">{stats.active}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Average acknowledgment</div>
          <div className="text-xl font-semibold text-slate-900 mt-0.5 tabular-nums">{stats.avgAck}%</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-amber-600">Reviews overdue</div>
          <div className="text-xl font-semibold text-amber-700 mt-0.5 tabular-nums">{stats.overdue}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <table className="enterprise-table">
          <thead>
            <tr>
              <th className="w-[12%]">Code</th>
              <th className="w-[30%]">Policy title</th>
              <th className="w-[12%]">Category</th>
              <th className="w-[8%]">Version</th>
              <th className="w-[14%]">Owner</th>
              <th className="w-[12%]">Acknowledgment</th>
              <th className="w-[12%] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(p => (
              <tr key={p.id}>
                <td className="font-mono text-slate-500">{p.code}</td>
                <td>
                  <div className="font-medium text-slate-900">{p.title}</div>
                </td>
                <td>
                  <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">{p.category}</span>
                </td>
                <td className="font-mono text-xs text-slate-600">v{p.version}</td>
                <td className="text-slate-600">{p.owner}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 rounded overflow-hidden">
                      <div className={cn('h-full rounded', p.acknowledgmentPct > 90 ? 'bg-emerald-600' : 'bg-amber-500')} style={{ width: `${p.acknowledgmentPct}%` }} />
                    </div>
                    <span className="text-xs font-medium tabular-nums">{p.acknowledgmentPct}%</span>
                  </div>
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

      {editing && <PolicyEditor initial={editing} onCancel={() => setEditing(null)} onSave={save} />}
    </div>
  )
}

function blank(): Policy {
  const next = new Date(); next.setFullYear(next.getFullYear() + 1)
  return { id: genId('POL'), code: '', title: '', category: 'Operations', version: '1.0', owner: '', effectiveDate: new Date().toISOString().slice(0, 10), nextReview: next.toISOString().slice(0, 10), acknowledgmentPct: 0, status: 'Draft', linkedControls: [] }
}

function PolicyEditor({ initial, onCancel, onSave }: { initial: Policy; onCancel: () => void; onSave: (p: Policy) => void }) {
  const [draft, setDraft] = useState<Policy>(initial)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">{initial.title ? `Edit ${draft.code}` : 'New Policy'}</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-sm">&times;</button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Code *</label>
              <Input value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} placeholder="POL-IT-001" className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Version</label>
              <Input value={draft.version} onChange={e => setDraft({ ...draft, version: e.target.value })} placeholder="1.0" className="h-8 text-xs" />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Title *</label>
            <Input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Information Security Policy" className="h-8 text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Owner</label>
              <Input value={draft.owner} onChange={e => setDraft({ ...draft, owner: e.target.value })} placeholder="e.g. CISO" className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Category</label>
              <Input value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} placeholder="IT & Cyber" className="h-8 text-xs" />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Acknowledgment rate (%)</label>
            <Input type="number" min={0} max={100} value={draft.acknowledgmentPct} onChange={e => setDraft({ ...draft, acknowledgmentPct: Number(e.target.value) || 0 })} className="h-8 text-xs" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={() => onSave(draft)}>Save policy</Button>
        </div>
      </div>
    </div>
  )
}
