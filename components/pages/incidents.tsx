'use client'

import React, { useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, Search, AlertOctagon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { createStore, useStoreSnapshot, genId } from '@/lib/localStore'
import { useToast } from '@/hooks/use-toast'
import { recordAudit } from '@/lib/auditLog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'

export type IncidentSeverity = 'Critical' | 'High' | 'Medium' | 'Low'
export type IncidentStatus = 'Open' | 'Investigating' | 'Mitigated' | 'Closed'

export interface Incident {
  id: string
  title: string
  description: string
  severity: IncidentSeverity
  status: IncidentStatus
  category: string
  reportedBy: string
  assignedTo: string
  reportedOn: string
  closedOn?: string
  linkedRisks: string[]
  rootCause?: string
  correctiveAction?: string
}

const SEED: Incident[] = [
  { id: 'INC-001', title: 'Payment gateway API 503 latency spike during peak settlement', description: 'Payment API returned 503 for 12 minutes during morning batch run.', severity: 'High', status: 'Mitigated', category: 'IT & Cyber', reportedBy: 'Anthony Muller', assignedTo: 'IT Operations', reportedOn: '2026-05-10', closedOn: '2026-05-10', linkedRisks: ['R-009'], rootCause: 'Auto-scaling buffer saturation.', correctiveAction: 'Pre-warm container capacity ahead of scheduled batches.' },
  { id: 'INC-002', title: 'Spear-phishing email targeting treasury team members', description: 'Targeted emails sent to accounts payable staff. Caught by security filter.', severity: 'Medium', status: 'Closed', category: 'IT & Cyber', reportedBy: 'Lin Wei', assignedTo: 'IT Security', reportedOn: '2026-05-03', closedOn: '2026-05-07', linkedRisks: ['R-014'], rootCause: 'External social engineering campaign.', correctiveAction: 'Updated email gateway heuristics.' },
  { id: 'INC-003', title: 'Delayed daily bank reconciliation report generation', description: 'Treasury reconciliation report delayed by 2 hours due to ETL job timeout.', severity: 'Medium', status: 'Investigating', category: 'Financial', reportedBy: 'Priya Sharma', assignedTo: 'Data Operations', reportedOn: '2026-05-08', linkedRisks: ['R-003'] },
  { id: 'INC-004', title: 'Vendor V-0005 security notice regarding subcontractor', description: 'Apex HR reported a contained breach affecting subcontractor test environment.', severity: 'Critical', status: 'Open', category: 'Vendor', reportedBy: 'Priya Sharma', assignedTo: 'CISO', reportedOn: '2026-05-15', linkedRisks: ['R-018'] },
]

export const incidentStore = createStore<Incident>({ key: 'incidents', seed: SEED })

export function IncidentsPage() {
  const items = useStoreSnapshot(incidentStore)
  const { toast } = useToast()
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const [editing, setEditing] = useState<Incident | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | IncidentStatus>('All')

  const filtered = useMemo(() => items.filter(i => {
    if (statusFilter !== 'All' && i.status !== statusFilter) return false
    if (search && !`${i.title} ${i.category} ${i.id} ${i.assignedTo}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [items, search, statusFilter])

  const stats = useMemo(() => ({
    open: items.filter(i => i.status === 'Open' || i.status === 'Investigating').length,
    critical: items.filter(i => i.severity === 'Critical').length,
    closed: items.filter(i => i.status === 'Closed').length,
    total: items.length,
  }), [items])

  const save = (i: Incident) => {
    const isNew = !items.find(x => x.id === i.id)
    if (isNew) {
      incidentStore.add(i)
      recordAudit({ action: 'CREATE', entity: 'Incident', entity_id: i.id, description: `Reported incident: ${i.title}`, after: i, result: 'SUCCESS' })
      toast({ title: 'Incident reported' })
    } else {
      incidentStore.update(i.id, i)
      recordAudit({ action: 'UPDATE', entity: 'Incident', entity_id: i.id, description: `Updated incident: ${i.title}`, after: i, result: 'SUCCESS' })
      toast({ title: 'Incident updated' })
    }
    setEditing(null)
  }

  const remove = async (i: Incident) => {
    const ok = await confirm({ title: `Delete ${i.id}?`, description: 'This will remove the incident record from the tracker.', confirmLabel: 'Delete incident', tone: 'danger' })
    if (!ok) return
    incidentStore.remove(i.id)
    recordAudit({ action: 'DELETE', entity: 'Incident', entity_id: i.id, description: `Deleted incident: ${i.title}`, before: i, result: 'SUCCESS' })
    toast({ title: 'Incident deleted' })
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Incident & Loss Event Management</h1>
          <p className="text-xs text-slate-500">Log, investigate, and remediate loss events linked to enterprise risks</p>
        </div>
        {hasPermission('create') && (
          <Button onClick={() => setEditing(blank())} size="sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Report incident
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Total incidents</div>
          <div className="text-xl font-semibold text-slate-900 mt-0.5 tabular-nums">{stats.total}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-amber-600">Active / Investigating</div>
          <div className="text-xl font-semibold text-amber-700 mt-0.5 tabular-nums">{stats.open}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-rose-600">Critical severity</div>
          <div className="text-xl font-semibold text-rose-700 mt-0.5 tabular-nums">{stats.critical}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-emerald-600">Resolved & closed</div>
          <div className="text-xl font-semibold text-emerald-700 mt-0.5 tabular-nums">{stats.closed}</div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch justify-between">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
          <Input 
            placeholder="Search incidents..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-8 h-8 text-xs bg-white" 
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
          {(['All', 'Open', 'Investigating', 'Mitigated', 'Closed'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-2.5 py-1 rounded text-xs transition-colors',
                statusFilter === s ? 'bg-white font-medium text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              {s}
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
              <th className="w-[32%]">Incident title & summary</th>
              <th className="w-[12%]">Severity</th>
              <th className="w-[12%]">Status</th>
              <th className="w-[14%]">Assigned to</th>
              <th className="w-[10%]">Reported</th>
              <th className="w-[10%] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.id}>
                <td className="font-mono text-slate-500">{i.id}</td>
                <td>
                  <div className="font-medium text-slate-900">{i.title}</div>
                  <div className="text-slate-500 text-[11px] line-clamp-1">{i.description}</div>
                  {i.rootCause && (
                    <div className="text-[11px] text-slate-400 mt-0.5 font-mono">Root cause: {i.rootCause}</div>
                  )}
                </td>
                <td>
                  <StatusBadge status={i.severity === 'Critical' ? 'critical' : i.severity === 'High' ? 'high' : 'medium'} label={i.severity} />
                </td>
                <td>
                  <StatusBadge status={i.status === 'Closed' ? 'completed' : i.status === 'Mitigated' ? 'success' : 'warning'} label={i.status} />
                </td>
                <td className="text-slate-600">{i.assignedTo}</td>
                <td className="text-slate-500 font-mono text-xs">{i.reportedOn}</td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {hasPermission('update') && (
                      <Button variant="ghost" size="icon" onClick={() => setEditing(i)} className="h-7 w-7">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {hasPermission('delete') && (
                      <Button variant="ghost" size="icon" onClick={() => remove(i)} className="h-7 w-7 text-red-600 hover:bg-red-50">
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
                  No incident records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && <IncidentEditor initial={editing} onCancel={() => setEditing(null)} onSave={save} />}
    </div>
  )
}

function blank(): Incident {
  return { id: genId('INC'), title: '', description: '', severity: 'Medium', status: 'Open', category: 'Operations', reportedBy: '', assignedTo: '', reportedOn: new Date().toISOString().slice(0, 10), linkedRisks: [] }
}

function IncidentEditor({ initial, onCancel, onSave }: { initial: Incident; onCancel: () => void; onSave: (i: Incident) => void }) {
  const [draft, setDraft] = useState<Incident>(initial)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">{initial.title ? `Edit ${draft.id}` : 'Report Incident'}</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-sm">&times;</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Incident title *</label>
            <Input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Database replication delay" className="h-8 text-xs" />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Description</label>
            <textarea
              value={draft.description}
              onChange={e => setDraft({ ...draft, description: e.target.value })}
              rows={2}
              className="w-full p-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
              placeholder="Incident details, observed symptoms..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Severity</label>
              <select value={draft.severity} onChange={e => setDraft({ ...draft, severity: e.target.value as IncidentSeverity })} className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white">
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Status</label>
              <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as IncidentStatus })} className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white">
                <option>Open</option>
                <option>Investigating</option>
                <option>Mitigated</option>
                <option>Closed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Assigned owner</label>
              <Input value={draft.assignedTo} onChange={e => setDraft({ ...draft, assignedTo: e.target.value })} placeholder="e.g. IT Security" className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Category</label>
              <Input value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Root cause analysis</label>
            <Input value={draft.rootCause || ''} onChange={e => setDraft({ ...draft, rootCause: e.target.value })} placeholder="Identified root cause (if known)" className="h-8 text-xs" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={() => onSave(draft)}>Save incident</Button>
        </div>
      </div>
    </div>
  )
}
