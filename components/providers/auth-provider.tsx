'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LoginPage } from '@/components/pages/login'
import { authApi, UNAUTHORIZED_EVENT, type ApiUser } from '@/lib/apiClient'

export type Role = 'Administrator' | 'Risk Manager' | 'Assessor' | 'Auditor' | 'Viewer'

export type AppUser = ApiUser

/** UI-level actions mapped onto the server's permission names. */
type UiAction = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'admin' | 'audit'
const UI_TO_SERVER: Record<UiAction, string> = {
  create: 'create',
  read: 'read',
  update: 'update',
  delete: 'delete',
  approve: 'approve',
  admin: 'users:manage',
  audit: 'audit:read',
}

interface AuthContextType {
  isAuthenticated: boolean
  user: AppUser | null
  permissions: string[]
  /** Throws with a readable message when sign-in fails. */
  login: (email: string, password: string) => Promise<void>
  /** Signs out everywhere by default; `{ allDevices: false }` ends only this browser's session. */
  logout: (opts?: { allDevices?: boolean }) => Promise<void>
  /** Re-read the session (e.g. after changing the password). */
  refresh: () => Promise<void>
  hasPermission: (action: UiAction) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Kept only so the audit helper can label events while a request is in flight.
const CURRENT_USER_KEY = 'pericope_current_user'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'checking' | 'signed-in' | 'signed-out'>('checking')
  const [user, setUser] = useState<AppUser | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [sessionMessage, setSessionMessage] = useState<string | null>(null)

  const applySession = useCallback((session: { user: AppUser; permissions: string[] } | null) => {
    if (session) {
      setUser(session.user)
      setPermissions(session.permissions)
      setStatus('signed-in')
      try { sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(session.user)) } catch { /* noop */ }
    } else {
      setUser(null)
      setPermissions([])
      setStatus('signed-out')
      try { sessionStorage.removeItem(CURRENT_USER_KEY) } catch { /* noop */ }
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      applySession(await authApi.me())
    } catch {
      applySession(null)
    }
  }, [applySession])

  // Restore an existing session on first load.
  useEffect(() => {
    refresh()
  }, [refresh])

  // Any 401 from the API means the session ended (expired, signed out elsewhere, role changed).
  useEffect(() => {
    const onUnauthorized = () => {
      setSessionMessage('Your session has ended. Please sign in again.')
      queryClient.clear()
      applySession(null)
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [applySession, queryClient])

  const login = useCallback(async (email: string, password: string) => {
    const session = await authApi.login(email, password)
    setSessionMessage(null)
    queryClient.clear()
    applySession(session)
  }, [applySession, queryClient])

  const logout = useCallback(async (opts?: { allDevices?: boolean }) => {
    try {
      await authApi.logout(opts?.allDevices ?? true)
    } finally {
      queryClient.clear()
      applySession(null)
    }
  }, [applySession, queryClient])

  const hasPermission = useCallback(
    (action: UiAction) => permissions.includes(UI_TO_SERVER[action]),
    [permissions],
  )

  const value: AuthContextType = {
    isAuthenticated: status === 'signed-in',
    user,
    permissions,
    login,
    logout,
    refresh,
    hasPermission,
  }

  if (status === 'checking') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background" role="status" aria-live="polite">
        <span className="flex items-center gap-3 text-body-sm text-muted-foreground"><span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-md bg-primary font-display text-[20px] italic leading-none text-primary-foreground shadow-button">P</span>Loading Pericope…</span>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={value}>
      {status === 'signed-in' ? children : <LoginPage notice={sessionMessage} />}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
