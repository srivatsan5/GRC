'use client'

import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, CircleSlash, KeyRound, Plus, UserCheck, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Chip, CountUp, FilterChip, PageHeader, Panel, Person, SearchField } from '@/components/charter/primitives'
import { FormError, FormField, HatchChip, Headline, HeadlineCell, Muted, Toolbar, nativeSelectClass } from '@/components/controls/charter-bits'
import { EmptyState, ErrorState, LoadingState } from '@/components/data-state'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth, type Role } from '@/components/providers/auth-provider'
import { usersApi, apiErrorMessage, type ApiUser } from '@/lib/apiClient'

const ROLES: Role[] = ['Administrator', 'Risk Manager', 'Assessor', 'Auditor', 'Viewer']
const USERS_KEY = ['users']

const emptyDraft = { name: '', email: '', role: 'Viewer' as Role, department: '', password: '' }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export function UserManagementPage() {
  const { user: currentUser } = useAuth()
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'All' | Role>('All')
  const [statusFilter, setStatusFilter] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [formError, setFormError] = useState<string | null>(null)
  const [resetTarget, setResetTarget] = useState<ApiUser | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const { data: users = [], isLoading, isError, error, refetch } = useQuery({ queryKey: USERS_KEY, queryFn: usersApi.list })

  const onFail = (title: string) => (err: unknown) => toast.error(title, { description: apiErrorMessage(err) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: USERS_KEY })

  const createUser = useMutation({
    mutationFn: usersApi.create,
    onSuccess: u => {
      toast.success('User created', { description: `${u.name} can now sign in as ${u.role}.` })
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
      toast.success('User updated')
      refresh()
    },
    onError: onFail('Could not update the user'),
  })

  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => usersApi.resetPassword(id, password),
    onSuccess: () => {
      toast.success('Password reset', { description: 'Share it with the user securely; their old sessions were signed out.' })
      setResetTarget(null)
      setNewPassword('')
    },
    onError: onFail('Could not reset the password'),
  })

  const filtered = useMemo(
    () =>
      users.filter(u => {
        if (roleFilter !== 'All' && u.role !== roleFilter) return false
        if (statusFilter && (statusFilter === 'active') !== u.active) return false
        if (search && !`${u.name} ${u.email} ${u.department}`.toLowerCase().includes(search.toLowerCase())) return false
        return true
      }),
    [users, search, roleFilter, statusFilter],
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

  const neverLabel = (iso: string | null | undefined) => (iso ? formatDate(iso) : null)
  const anyFilter = !!search || roleFilter !== 'All' || !!statusFilter

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Accounts, roles and sign-in access. Role changes and deactivations end the person’s sessions; every change is recorded in the audit trail."
        actions={
          <Button onClick={() => setIsAdding(true)}>
            <Plus aria-hidden="true" />
            Add user
          </Button>
        }
      />

      {!isError && (
        <Headline label="User figures">
          <HeadlineCell label="Users" loading={isLoading} value={<CountUp value={stats.total} />} context={`${stats.total - stats.active} inactive`} />
          <HeadlineCell label="Active accounts" loading={isLoading} value={<CountUp value={stats.active} />} context="Can sign in today" />
          <HeadlineCell
            label="Active administrators"
            loading={isLoading}
            value={<CountUp value={stats.admins} />}
            tone={stats.admins < 2 ? 'text-status-warning-fg' : undefined}
            context={stats.admins < 2 ? 'Consider a second administrator' : 'Full access, including users and settings'}
          />
          <HeadlineCell label="Never signed in" loading={isLoading} value={<CountUp value={stats.neverSignedIn} />} context="Accounts not used yet" />
        </Headline>
      )}

      <Toolbar>
        <SearchField label="Search users" placeholder="Name, email, department…" value={search} onChange={setSearch} />
        <FilterChip label="Role" value={roleFilter === 'All' ? '' : roleFilter} onChange={v => setRoleFilter((v || 'All') as 'All' | Role)} options={ROLES.map(r => ({ value: r, label: r }))} />
        <FilterChip
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
        {anyFilter && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('')
              setRoleFilter('All')
              setStatusFilter('')
            }}
          >
            Clear
          </Button>
        )}
      </Toolbar>

      <Panel bodyClassName="p-0" className="overflow-hidden">
        {isError ? (
          <ErrorState error={new Error(apiErrorMessage(error, 'Could not load users'))} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="px-6">
            <LoadingState label="Loading users…" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title={users.length ? 'No users match these filters' : 'No users yet'} description={users.length ? 'Try a different search, role or status.' : 'Add the people who will use Pericope.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="enterprise-table min-w-[900px]">
              <thead>
                <tr>
                  <th scope="col" className="pl-6">User</th>
                  <th scope="col">Department</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last sign-in</th>
                  <th scope="col" className="pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const isSelf = u.id === currentUser?.id
                  const last = neverLabel(u.lastLoginAt)
                  return (
                    <tr key={u.id}>
                      <td className="pl-6">
                        <div className="flex items-center gap-2 py-1.5">
                          <Person name={u.name} detail={u.email} className="max-w-[300px]" />
                          {isSelf && <Chip tone="neutral" icon={null}>You</Chip>}
                        </div>
                      </td>
                      <td>
                        <Muted>{u.department || '—'}</Muted>
                      </td>
                      <td>
                        <label className="sr-only" htmlFor={`role-${u.id}`}>
                          Role for {u.name}
                        </label>
                        <select
                          id={`role-${u.id}`}
                          value={u.role}
                          disabled={isSelf || updateUser.isPending}
                          title={isSelf ? 'You can’t change your own role' : undefined}
                          onChange={e => changeRole(u, e.target.value as Role)}
                          className={cn(nativeSelectClass, 'h-8 w-[150px] text-body-sm')}
                        >
                          {ROLES.map(r => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {u.active ? (
                          <Chip tone="success" icon={CircleCheck}>
                            Active
                          </Chip>
                        ) : (
                          <Chip tone="neutral" icon={CircleSlash}>
                            Inactive
                          </Chip>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        {last ? (
                          <div className="py-1.5 tabular-nums">
                            <div className="text-foreground">{last}</div>
                            <div className="text-caption text-muted-foreground">{new Date(u.lastLoginAt!).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        ) : (
                          <HatchChip>Never signed in</HatchChip>
                        )}
                      </td>
                      <td className="pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="secondary" size="sm" onClick={() => setResetTarget(u)} aria-label={`Reset password for ${u.name}`}>
                            <KeyRound aria-hidden="true" />
                            Reset password
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isSelf || updateUser.isPending}
                            onClick={() => toggleActive(u)}
                            aria-label={`${u.active ? 'Deactivate' : 'Activate'} ${u.name}`}
                            title={isSelf ? 'You can’t deactivate yourself' : undefined}
                            className={u.active ? 'hover:bg-status-danger-bg hover:text-status-danger-fg' : undefined}
                          >
                            {u.active ? <UserX aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
                            {u.active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Add user */}
      <Dialog
        open={isAdding}
        onOpenChange={o => {
          setIsAdding(o)
          if (!o) setFormError(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>Set an initial password and share it with the person securely. They can change it after signing in.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault()
              createUser.mutate(draft)
            }}
          >
            {formError && <FormError>{formError}</FormError>}
            <FormField id="nu-name" label="Full name" required>
              <Input id="nu-name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} required minLength={2} autoComplete="off" />
            </FormField>
            <FormField id="nu-email" label="Email address" required>
              <Input id="nu-email" type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} required autoComplete="off" />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="nu-role" label="Role" required>
                <select id="nu-role" value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value as Role })} className={nativeSelectClass}>
                  {ROLES.map(r => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </FormField>
              <FormField id="nu-dept" label="Department">
                <Input id="nu-dept" value={draft.department} onChange={e => setDraft({ ...draft, department: e.target.value })} />
              </FormField>
            </div>
            <FormField id="nu-password" label="Initial password" required hint="At least 12 characters, with letters and numbers.">
              <Input id="nu-password" type="password" autoComplete="new-password" value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })} required minLength={12} />
            </FormField>
            <DialogFooter className="border-t pt-4">
              <Button type="button" variant="secondary" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? 'Creating…' : 'Create user'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog
        open={!!resetTarget}
        onOpenChange={o => {
          if (!o) {
            setResetTarget(null)
            setNewPassword('')
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>Set a new password for {resetTarget?.name}. Their current sessions end immediately.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault()
              if (resetTarget) resetPassword.mutate({ id: resetTarget.id, password: newPassword })
            }}
          >
            <FormField id="rp-password" label="New password" required hint="At least 12 characters, with letters and numbers.">
              <Input id="rp-password" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={12} />
            </FormField>
            <DialogFooter className="border-t pt-4">
              <Button type="button" variant="secondary" onClick={() => setResetTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={resetPassword.isPending || newPassword.length < 12}>
                {resetPassword.isPending ? 'Saving…' : 'Reset password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
