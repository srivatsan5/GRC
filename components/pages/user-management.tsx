'use client'

import React, { useMemo, useState } from 'react'
import { Plus, Trash2, Search, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { recordAudit } from '@/lib/auditLog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth, AppUser, Role } from '@/components/providers/auth-provider'

const ROLES: Role[] = ['Administrator', 'Risk Manager', 'Assessor', 'Auditor', 'Viewer']

export function UserManagementPage() {
  const { users, setUsers, user: currentUser, hasPermission } = useAuth()
  const { toast } = useToast()
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'All' | Role>('All')
  const [isAdding, setIsAdding] = useState(false)
  const [draft, setDraft] = useState<Omit<AppUser, 'id' | 'lastLogin'>>({ name: '', email: '', role: 'Viewer', department: 'Operations', active: true })

  const filtered = useMemo(() => users.filter(u => {
    if (roleFilter !== 'All' && u.role !== roleFilter) return false
    if (search && !`${u.name} ${u.email} ${u.department}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [users, search, roleFilter])

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.active).length,
    admins: users.filter(u => u.role === 'Administrator').length,
    roleCount: new Set(users.map(u => u.role)).size,
  }), [users])

  const addUser = () => {
    if (!hasPermission('admin')) { toast({ title: 'Insufficient permission', variant: 'destructive' }); return }
    if (!draft.name || !draft.email) { toast({ title: 'Name and email required', variant: 'destructive' }); return }
    const id = `U-${String(users.length + 1).padStart(3, '0')}`
    const created: AppUser = { ...draft, id }
    setUsers([...users, created])
    recordAudit({ action: 'CREATE', entity: 'User', entity_id: id, description: `Created ${created.role} ${created.name}`, after: created, result: 'SUCCESS' })
    toast({ title: 'User created' })
    setDraft({ name: '', email: '', role: 'Viewer', department: 'Operations', active: true })
    setIsAdding(false)
  }

  const changeRole = (id: string, role: Role) => {
    const before = users.find(u => u.id === id)
    const next = users.map(u => u.id === id ? { ...u, role } : u)
    setUsers(next)
    if (before) recordAudit({ action: 'ROLE_CHANGE', entity: 'User', entity_id: id, description: `Changed role of ${before.name} from ${before.role} to ${role}`, before, after: { ...before, role }, result: 'SUCCESS' })
  }

  const toggleActive = (id: string) => {
    const before = users.find(u => u.id === id)
    const next = users.map(u => u.id === id ? { ...u, active: !u.active } : u)
    setUsers(next)
    if (before) recordAudit({ action: 'UPDATE', entity: 'User', entity_id: id, description: `${!before.active ? 'Activated' : 'Deactivated'} ${before.name}`, before, after: { ...before, active: !before.active }, result: 'SUCCESS' })
  }

  const removeUser = async (id: string) => {
    const target = users.find(u => u.id === id); if (!target) return
    if (target.id === currentUser?.id) { toast({ title: 'You cannot delete your own account', variant: 'destructive' }); return }
    const ok = await confirm({ title: `Remove ${target.name}?`, description: 'All access for this user will be revoked.', confirmLabel: 'Remove user', tone: 'danger' })
    if (!ok) return
    setUsers(users.filter(u => u.id !== id))
    recordAudit({ action: 'DELETE', entity: 'User', entity_id: id, description: `Removed user ${target.name}`, before: target, result: 'SUCCESS' })
    toast({ title: 'User removed' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">User & Access Administration</h1>
          <p className="text-xs text-slate-500">Manage user accounts and role-based permissions</p>
        </div>
        {hasPermission('admin') && (
          <Button onClick={() => setIsAdding(true)} size="sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add user
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Total users</div>
          <div className="text-xl font-semibold text-slate-900 mt-0.5 tabular-nums">{stats.total}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Active accounts</div>
          <div className="text-xl font-semibold text-emerald-700 mt-0.5 tabular-nums">{stats.active}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Administrators</div>
          <div className="text-xl font-semibold text-blue-700 mt-0.5 tabular-nums">{stats.admins}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Distinct roles</div>
          <div className="text-xl font-semibold text-slate-900 mt-0.5 tabular-nums">{stats.roleCount}</div>
        </div>
      </div>

      {!hasPermission('admin') && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 flex items-center gap-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>Read-only view. Only Administrators can modify user accounts or assign roles.</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch justify-between">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
          <Input 
            placeholder="Search users..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-8 h-8 text-xs bg-white" 
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
          {(['All', ...ROLES] as const).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r as any)}
              className={cn(
                'px-2.5 py-1 rounded text-xs transition-colors',
                roleFilter === r ? 'bg-white font-medium text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <table className="enterprise-table">
          <thead>
            <tr>
              <th className="w-[10%]">ID</th>
              <th className="w-[25%]">Name</th>
              <th className="w-[25%]">Email</th>
              <th className="w-[18%]">Role</th>
              <th className="w-[12%]">Status</th>
              <th className="w-[10%] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td className="font-mono text-slate-500">{u.id}</td>
                <td>
                  <div className="font-medium text-slate-900">{u.name}</div>
                  <div className="text-[11px] text-slate-400">{u.department}</div>
                </td>
                <td className="text-slate-600">{u.email}</td>
                <td>
                  <select
                    value={u.role}
                    disabled={!hasPermission('admin')}
                    onChange={e => changeRole(u.id, e.target.value as Role)}
                    className="h-7 px-2 rounded border border-slate-200 text-xs bg-white disabled:bg-slate-50"
                  >
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td>
                  <button
                    disabled={!hasPermission('admin')}
                    onClick={() => toggleActive(u.id)}
                    className={cn(
                      'px-2 py-0.5 rounded text-[11px] font-medium border transition-colors',
                      u.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                    )}
                  >
                    {u.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!hasPermission('admin') || u.id === currentUser?.id}
                    onClick={() => removeUser(u.id)}
                    className="h-7 w-7 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Add User</h2>
              <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600 text-sm">&times;</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Full name *</label>
                <Input
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Jane Doe"
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Email address *</label>
                <Input
                  type="email"
                  value={draft.email}
                  onChange={e => setDraft({ ...draft, email: e.target.value })}
                  placeholder="name@company.com"
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Role</label>
                  <select
                    value={draft.role}
                    onChange={e => setDraft({ ...draft, role: e.target.value as Role })}
                    className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white"
                  >
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Department</label>
                  <Input
                    value={draft.department}
                    onChange={e => setDraft({ ...draft, department: e.target.value })}
                    placeholder="e.g. Operations"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button variant="outline" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button size="sm" onClick={addUser}>Create user</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
