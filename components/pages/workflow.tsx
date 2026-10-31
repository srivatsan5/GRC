'use client'

import React, { useMemo, useState } from 'react'
import { Plus, Check, X, Search, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { createStore, useStoreSnapshot, genId } from '@/lib/localStore'
import { useToast } from '@/hooks/use-toast'
import { recordAudit } from '@/lib/auditLog'
import { useAuth } from '@/components/providers/auth-provider'

export type WorkflowStatus = 'Pending' | 'In Review' | 'Approved' | 'Rejected'

export interface WorkflowItem {
  id: string
  title: string
  type: 'Risk Assessment' | 'Mitigation Plan' | 'Control Change' | 'Policy Update' | 'Risk Acceptance'
  submittedBy: string
  submittedOn: string
  approvers: { name: string; role: string; decision?: 'Approved' | 'Rejected'; on?: string; comment?: string }[]
  status: WorkflowStatus
  amount?: number
  business: string
}

const SEED: WorkflowItem[] = [
  { id: 'WF-001', title: 'Q1 2026 IT Risk Assessment Sign-off', type: 'Risk Assessment', submittedBy: 'Anthony Muller', submittedOn: '2026-05-12', approvers: [{ name: 'Priya Sharma', role: 'Risk Manager', decision: 'Approved', on: '2026-05-13' }, { name: 'Srivatsan B', role: 'Administrator' }], status: 'In Review', business: 'Information Technology' },
  { id: 'WF-002', title: 'Mitigation plan — Cloud DLP Enforcement', type: 'Mitigation Plan', submittedBy: 'Anthony Muller', submittedOn: '2026-05-10', approvers: [{ name: 'Priya Sharma', role: 'Risk Manager' }], status: 'Pending', business: 'Information Technology', amount: 245000 },
  { id: 'WF-003', title: 'Policy update — Acceptable Use v3.2', type: 'Policy Update', submittedBy: 'Lin Wei', submittedOn: '2026-05-08', approvers: [{ name: 'Priya Sharma', role: 'Risk Manager', decision: 'Approved', on: '2026-05-09' }, { name: 'Srivatsan B', role: 'Administrator', decision: 'Approved', on: '2026-05-10' }], status: 'Approved', business: 'Human Resources' },
  { id: 'WF-004', title: 'Formal risk acceptance — Vendor V-0042', type: 'Risk Acceptance', submittedBy: 'Priya Sharma', submittedOn: '2026-05-05', approvers: [{ name: 'Srivatsan B', role: 'Administrator', decision: 'Rejected', on: '2026-05-06', comment: 'Need additional compensating controls' }], status: 'Rejected', business: 'Procurement' },
]

export const workflowStore = createStore<WorkflowItem>({ key: 'workflow', seed: SEED })

export function WorkflowPage() {
  const items = useStoreSnapshot(workflowStore)
  const { toast } = useToast()
  const { hasPermission, user } = useAuth()
  const [filter, setFilter] = useState<'All' | WorkflowStatus>('All')
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Partial<WorkflowItem>>({ type: 'Risk Assessment', business: 'Information Technology' })

  const filtered = useMemo(() => filter === 'All' ? items : items.filter(i => i.status === filter), [items, filter])

  const stats = useMemo(() => ({
    pending: items.filter(i => i.status === 'Pending' || i.status === 'In Review').length,
    approved: items.filter(i => i.status === 'Approved').length,
    rejected: items.filter(i => i.status === 'Rejected').length,
    total: items.length,
  }), [items])

  const decide = (id: string, decision: 'Approved' | 'Rejected') => {
    const it = items.find(x => x.id === id)
    if (!it) return
    const idx = it.approvers.findIndex(a => !a.decision)
    if (idx === -1) return
    const updated = { ...it }
    updated.approvers = [...it.approvers]
    updated.approvers[idx] = {
      ...updated.approvers[idx],
      name: user?.name || updated.approvers[idx].name,
      role: user?.role || updated.approvers[idx].role,
      decision,
      on: new Date().toISOString().slice(0, 10),
    }
    const allApproved = updated.approvers.every(a => a.decision === 'Approved')
    const anyReject = updated.approvers.some(a => a.decision === 'Rejected')
    updated.status = anyReject ? 'Rejected' : allApproved ? 'Approved' : 'In Review'
    workflowStore.update(id, updated)
    recordAudit({ action: decision === 'Approved' ? 'APPROVE' : 'REJECT', entity: 'Workflow', entity_id: id, description: `${decision} – ${it.title}`, after: updated, result: 'SUCCESS' })
    toast({ title: `${decision}`, description: it.title })
  }

  const submit = () => {
    if (!draft.title || !draft.type || !draft.business) return
    const item: WorkflowItem = {
      id: genId('WF'),
      title: draft.title!,
      type: draft.type as WorkflowItem['type'],
      submittedBy: user?.name || 'Assessor',
      submittedOn: new Date().toISOString().slice(0, 10),
      approvers: [{ name: 'Priya Sharma', role: 'Risk Manager' }, { name: 'Srivatsan B', role: 'Administrator' }],
      status: 'Pending',
      business: draft.business!,
    }
    workflowStore.add(item)
    recordAudit({ action: 'CREATE', entity: 'Workflow', entity_id: item.id, description: `Submitted ${item.type}: ${item.title}`, after: item, result: 'SUCCESS' })
    toast({ title: 'Submitted for approval', description: item.title })
    setAdding(false)
    setDraft({ type: 'Risk Assessment', business: 'Information Technology' })
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Workflow & Maker–Checker Approvals</h1>
          <p className="text-xs text-slate-500">Multi-stage approval chains for risk acceptances, policies, and mitigation plans</p>
        </div>
        {hasPermission('create') && (
          <Button onClick={() => setAdding(true)} size="sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Submit request
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Total requests</div>
          <div className="text-xl font-semibold text-slate-900 mt-0.5 tabular-nums">{stats.total}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-amber-600">Pending review</div>
          <div className="text-xl font-semibold text-amber-700 mt-0.5 tabular-nums">{stats.pending}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-emerald-600">Approved</div>
          <div className="text-xl font-semibold text-emerald-700 mt-0.5 tabular-nums">{stats.approved}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-rose-600">Rejected</div>
          <div className="text-xl font-semibold text-rose-700 mt-0.5 tabular-nums">{stats.rejected}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs w-fit">
        {(['All', 'Pending', 'In Review', 'Approved', 'Rejected'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'px-2.5 py-1 rounded text-xs transition-colors',
              filter === s ? 'bg-white font-medium text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filtered.map(it => {
          const canAct = hasPermission('admin') || (hasPermission('update') && user && it.approvers.some(a => !a.decision && a.name === user.name))
          return (
            <div key={it.id} className="p-4 bg-white rounded border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-400">{it.id}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">{it.type}</span>
                    <span className="text-[10px] text-slate-400">{it.business}</span>
                  </div>
                  <h3 className="text-xs font-semibold text-slate-900 mt-1">{it.title}</h3>
                  <p className="text-[11px] text-slate-500">Submitted by {it.submittedBy} on {it.submittedOn}</p>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={it.status === 'Approved' ? 'approved' : it.status === 'Rejected' ? 'rejected' : 'in-review'} label={it.status} />
                  {canAct && (it.status === 'Pending' || it.status === 'In Review') && (
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" onClick={() => decide(it.id, 'Approved')} className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white">
                        <Check className="w-3.5 h-3.5 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => decide(it.id, 'Rejected')} className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50">
                        <X className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Approvers chain */}
              <div className="flex items-center gap-2 text-[11px] pt-2 border-t border-slate-100 flex-wrap">
                <span className="text-slate-400">Approval chain:</span>
                {it.approvers.map((a, i) => (
                  <span
                    key={i}
                    className={cn(
                      'px-2 py-0.5 rounded border text-[11px]',
                      a.decision === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium' :
                      a.decision === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200 font-medium' :
                      'bg-slate-50 text-slate-500 border-slate-200'
                    )}
                  >
                    {a.name} ({a.role}): {a.decision || 'Pending'}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-slate-400 bg-white rounded border border-slate-200 text-xs">
            No approval requests found.
          </div>
        )}
      </div>

      {/* Submit Modal */}
      {adding && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Submit Request for Approval</h2>
              <button onClick={() => setAdding(false)} className="text-slate-400 hover:text-slate-600 text-sm">&times;</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Request title *</label>
                <Input value={draft.title || ''} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Q1 IT Risk Assessment Sign-off" className="h-8 text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Request type</label>
                  <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as WorkflowItem['type'] })} className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white">
                    <option>Risk Assessment</option>
                    <option>Mitigation Plan</option>
                    <option>Control Change</option>
                    <option>Policy Update</option>
                    <option>Risk Acceptance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Department</label>
                  <Input value={draft.business || ''} onChange={e => setDraft({ ...draft, business: e.target.value })} placeholder="e.g. Information Technology" className="h-8 text-xs" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
              <Button size="sm" onClick={submit}>Submit request</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
