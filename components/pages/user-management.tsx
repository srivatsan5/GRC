'use client'

import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, KeyRound, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth, type Role } from '@/components/providers/auth-provider'
import { usersApi, apiErrorMessage, type ApiUser } from '@/lib/apiClient'

const ROLES: Role[] = ['Administrator', 'Risk Manager', 'Assessor', 'Auditor', 'Viewer']
const USERS_KEY = ['users']

const emptyDraft = { name: '', email: '', role: 'Viewer' as Role, department: '', password: '' }

function formatDate(iso: string | null | undefined) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function UserManagementPage() {
  const { user: currentUser } = useAuth()
  const { toast } = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'All' | Role>('All')
  const [isAdding, setIsAdding] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [formError, setFormError] = useState<string | null>(null)
  const [resetTarget, setResetTarget] = useState<ApiUser | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const { data: users = [], isLoading, isError, error, refetch } = useQuery({ queryKey: USERS_KEY, queryFn: usersApi.list })

  const onFail = (title: string) => (err: unknown) => toast({ title, description: apiErrorMessage(err), variant: 'destructive' })
  const refresh = () => queryClient.invalidateQueries({ queryKey: USERS_KEY })

  const createUser = useMutation({
    mutationFn: usersApi.create,
    onSuccess: u => {
      toast({ title: 'User created', description: `${u.name} can now sign in as ${u.role}.` })
      setDraft(emptyDraft)
      setFormError(null)
      setIsAdding(false)
      refresh()
    },
    onError: err => setFormError(apiErrorMessage(err, 'Could not create the user')),
  })

  const updateUser = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof usersApi.update>[1] }) => usersApi.update(id, patch),
    onSuccess: () => {
      toast({ title: 'User updated' })
      refresh()
    },
    onError: onFail('Could not update the user'),
  })

  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => usersApi.resetPassword(id, password),
    onSuccess: () => {
      toast({ title: 'Password reset', description: 'Share it with the user securely; their old sessions were signed out.' })
      setResetTarget(null)
      setNewPassword('')
    },
    onError: onFail('Could not reset the password'),
  })

  const filtered = useMemo(
    () =>
      users.filter(u => {
        if (roleFilter !== 'All' && u.role !== roleFilter) return false
        if (search && !`${u.name} ${u.email} ${u.department}`.toLowerCase().includes(search.toLowerCase())) return false
        return true
      }),
    [users, search, roleFilter],
  )

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter(u => u.active).length,
      admins: users.filter(u => u.role === 'Administrator' && u.active).length,
      neverSignedIn: users.filter(u => !u.lastLoginAt).length,
    }),
    [users],
  )

  const changeRole = async (u: ApiUser, role: Role) => {
    const ok = await confirm({
      title: `Change ${u.name}'s role to ${role}?`,
      description: 'Their current sessions end immediately and they sign in again with the new permissions.',
      confirmLabel: 'Change role',
    })
    if (ok) updateUser.mutate({ id: u.id, patch: { role } })
  }

  const toggleActive = async (u: ApiUser) => {
    if (u.active) {
      const ok = await confirm({
        title: `Deactivate ${u.name}?`,
        description: 'They are signed out everywhere and can no longer sign in. Their history stays in the audit trail.',
        confirmLabel: 'Deactivate',
        tone: 'danger',
      })
      if (!ok) return
    }
    updateUser.mutate({ id: u.id, patch: { active: !u.active } })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">User &amp; Access Administration</h1>
          <p className="text-xs text-slate-500">Accounts, roles and sign-in access. Every change is recorded in the audit trail.</p>
        </div>
        <Button onClick={() => setIsAdding(true)} size="sm">
          <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
          Add user
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total users', value: stats.total, tone: 'text-slate-900' },
          { label: 'Active accounts', value: stats.active, tone: 'text-emerald-700' },
          { label: 'Active administrators', value: stats.admins, tone: 'text-blue-700' },
          { label: 'Never signed in', value: stats.neverSignedIn, tone: 'text-slate-900' },
        ].map(s => (
          <div key={s.label} className="p-3 bg-white rounded border border-slate-200">
            <div className="text-xs text-slate-500">{s.label}</div>
            <div className={cn('text-xl font-semibold mt-0.5 tabular-nums', s.tone)}>{isLoading ? '–' : s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch justify-between">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <Input
            aria-label="Search users"
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-white"
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs" role="group" aria-label="Filter by role">
          {(['All', ...ROLES] as const).map(r => (
            <button
              key={r}
              type="button"
              aria-pressed={roleFilter === r}
              onClick={() => setRoleFilter(r)}
              className={cn('px-2.5 py-1 rounded text-xs transition-colors', roleFilter === r ? 'bg-white font-medium text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900')}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <div role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center justify-between">
          <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4" aria-hidden="true" />{apiErrorMessage(error, 'Could not load users')}</span>
          <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : (
        <div className="bg-white rounded border border-slate-200 overflow-x-auto">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th className="w-[24%]">Name</th>
                <th className="w-[24%]">Email</th>
                <th className="w-[16%]">Role</th>
                <th className="w-[11%]">Status</th>
                <th className="w-[15%]">Last sign-in</th>
                <th className="w-[10%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" aria-hidden="true" />Loading users…
                  </td>
                </tr>
              )}
              {filtered.map(u => {
                const isSelf = u.id === currentUser?.id
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="font-medium text-slate-900">{u.name}{isSelf && <span className="ml-1.5 text-[10px] text-slate-400">(you)</span>}</div>
                      <div className="text-[11px] text-slate-400">{u.department || '—'}</div>
                    </td>
                    <td className="text-slate-600">{u.email}</td>
                    <td>
                      <select
                        aria-label={`Role for ${u.name}`}
                        value={u.role}
                        disabled={isSelf || updateUser.isPending}
                        onChange={e => changeRole(u, e.target.value as Role)}
                        className="h-7 px-2 rounded border border-slate-200 text-xs bg-white disabled:bg-slate-50"
                      >
                        {ROLES.map(r => <option key={r}>{r}</option>)}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={isSelf || updateUser.isPending}
                        onClick={() => toggleActive(u)}
                        aria-label={`${u.active ? 'Deactivate' : 'Activate'} ${u.name}`}
                        className={cn(
                          'px-2 py-0.5 rounded text-[11px] font-medium border transition-colors disabled:cursor-not-allowed',
                          u.active ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200',
                        )}
                      >
                        {u.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="text-slate-500 text-[11px]">{formatDate(u.lastLoginAt)}</td>
                    <td className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setResetTarget(u)}
                        aria-label={`Reset password for ${u.name}`}
                        title="Reset password"
                        className="h-7 w-7 text-slate-600 hover:bg-slate-100"
                      >
                        <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No users match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add user */}
      <Dialog open={isAdding} onOpenChange={o => { setIsAdding(o); if (!o) setFormError(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>Set an initial password and share it with the person securely. They can change it after signing in.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3 text-xs"
            onSubmit={e => {
              e.preventDefault()
              createUser.mutate(draft)
            }}
          >
            {formError && <p role="alert" className="text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{formError}</p>}
            <div>
              <label htmlFor="nu-name" className="block text-slate-700 font-medium mb-1">Full name</label>
              <Input id="nu-name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className="h-8 text-xs" required minLength={2} />
            </div>
            <div>
              <label htmlFor="nu-email" className="block text-slate-700 font-medium mb-1">Email address</label>
              <Input id="nu-email" type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} className="h-8 text-xs" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="nu-role" className="block text-slate-700 font-medium mb-1">Role</label>
                <select id="nu-role" value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value as Role })} className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white">
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="nu-dept" className="block text-slate-700 font-medium mb-1">Department</label>
                <Input id="nu-dept" value={draft.department} onChange={e => setDraft({ ...draft, department: e.target.value })} className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <label htmlFor="nu-password" className="block text-slate-700 font-medium mb-1">Initial password</label>
              <Input id="nu-password" type="password" autoComplete="new-password" value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })} className="h-8 text-xs" required minLength={12} />
              <p className="mt-1 text-[11px] text-slate-500">At least 12 characters, with letters and numbers.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={createUser.isPending}>{createUser.isPending ? 'Creating…' : 'Create user'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={!!resetTarget} onOpenChange={o => { if (!o) { setResetTarget(null); setNewPassword('') } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>Set a new password for {resetTarget?.name}. Their current sessions end immediately.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={e => {
              e.preventDefault()
              if (resetTarget) resetPassword.mutate({ id: resetTarget.id, password: newPassword })
            }}
          >
            <label htmlFor="rp-password" className="block text-xs font-medium text-slate-700">New password</label>
            <Input id="rp-password" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="h-9" required minLength={12} />
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setResetTarget(null)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={resetPassword.isPending || newPassword.length < 12}>{resetPassword.isPending ? 'Saving…' : 'Reset password'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
