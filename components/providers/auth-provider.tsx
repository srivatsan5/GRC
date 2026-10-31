'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { LoginPage } from '@/components/pages/login'
import { recordAudit } from '@/lib/auditLog'

export type Role = 'Administrator' | 'Risk Manager' | 'Assessor' | 'Auditor' | 'Viewer'

export interface AppUser {
  id: string
  name: string
  email: string
  role: Role
  department: string
  active: boolean
  lastLogin?: string
}

interface AuthContextType {
  isAuthenticated: boolean
  user: AppUser | null
  users: AppUser[]
  login: (email?: string) => void
  logout: () => void
  switchUser: (userId: string) => void
  switchRole: (role: Role) => void
  setUsers: (users: AppUser[]) => void
  hasPermission: (action: 'create' | 'read' | 'update' | 'delete' | 'admin') => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const DEFAULT_USERS: AppUser[] = [
  { id: 'U-001', name: 'Srivatsan B', email: 'srivatsan@pericope.local', role: 'Administrator', department: 'Risk Office', active: true, lastLogin: new Date().toISOString() },
  { id: 'U-002', name: 'Priya Sharma', email: 'priya.sharma@pericope.local', role: 'Risk Manager', department: 'Finance', active: true, lastLogin: '2026-05-26T09:14:00Z' },
  { id: 'U-003', name: 'Anthony Muller', email: 'anthony.muller@pericope.local', role: 'Assessor', department: 'Operations', active: true, lastLogin: '2026-05-25T11:20:00Z' },
  { id: 'U-004', name: 'Lin Wei', email: 'lin.wei@pericope.local', role: 'Auditor', department: 'Internal Audit', active: true, lastLogin: '2026-05-22T16:48:00Z' },
  { id: 'U-005', name: 'Karen Diaz', email: 'karen.diaz@pericope.local', role: 'Viewer', department: 'Compliance', active: false, lastLogin: '2026-03-19T08:00:00Z' },
]

const PERMISSIONS: Record<Role, Set<string>> = {
  Administrator: new Set(['create', 'read', 'update', 'delete', 'admin']),
  'Risk Manager': new Set(['create', 'read', 'update', 'delete']),
  Assessor: new Set(['create', 'read', 'update']),
  Auditor: new Set(['read']),
  Viewer: new Set(['read']),
}

const USERS_KEY = 'pericope_users_v1'
const CURRENT_USER_KEY = 'pericope_current_user'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [user, setUser] = useState<AppUser | null>(null)
  const [users, setUsersState] = useState<AppUser[]>(DEFAULT_USERS)

  useEffect(() => {
    try {
      const storedUsers = localStorage.getItem(USERS_KEY)
      if (storedUsers) setUsersState(JSON.parse(storedUsers))
    } catch { /* noop */ }

    const storedAuth = sessionStorage.getItem('pericope_auth')
    const storedUser = sessionStorage.getItem(CURRENT_USER_KEY)
    if (storedAuth === 'true' && storedUser) {
      try {
        setUser(JSON.parse(storedUser))
        setIsAuthenticated(true)
      } catch {
        setIsAuthenticated(false)
      }
    } else {
      setIsAuthenticated(false)
    }
  }, [])

  const setUsers = useCallback((next: AppUser[]) => {
    setUsersState(next)
    try { localStorage.setItem(USERS_KEY, JSON.stringify(next)) } catch { /* noop */ }
  }, [])

  const login = useCallback((email?: string) => {
    const pool = users.length ? users : DEFAULT_USERS
    const target = email
      ? pool.find(u => u.email.toLowerCase() === email.toLowerCase() && u.active)
      : pool.find(u => u.role === 'Administrator')
    const next = target || pool[0]
    const stamped: AppUser = { ...next, lastLogin: new Date().toISOString() }
    sessionStorage.setItem('pericope_auth', 'true')
    sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(stamped))
    setUser(stamped)
    setIsAuthenticated(true)
    recordAudit({
      action: 'LOGIN',
      entity: 'Session',
      entity_id: stamped.id,
      description: `User ${stamped.name} signed in`,
      result: 'SUCCESS',
      actor: stamped,
    })
  }, [users])

  const switchUser = useCallback((userId: string) => {
    const target = users.find(u => u.id === userId) || DEFAULT_USERS.find(u => u.id === userId)
    if (!target) return
    const stamped: AppUser = { ...target, lastLogin: new Date().toISOString() }
    sessionStorage.setItem('pericope_auth', 'true')
    sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(stamped))
    setUser(stamped)
    recordAudit({
      action: 'ROLE_CHANGE',
      entity: 'Persona',
      entity_id: stamped.id,
      description: `Switched active persona to ${stamped.name} (${stamped.role})`,
      result: 'SUCCESS',
      actor: stamped,
    })
  }, [users])

  const switchRole = useCallback((role: Role) => {
    const target = users.find(u => u.role === role) || DEFAULT_USERS.find(u => u.role === role)
    if (target) {
      switchUser(target.id)
    } else if (user) {
      const updated: AppUser = { ...user, role }
      sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated))
      setUser(updated)
    }
  }, [users, user, switchUser])

  const logout = useCallback(() => {
    if (user) {
      recordAudit({
        action: 'LOGOUT',
        entity: 'Session',
        entity_id: user.id,
        description: `User ${user.name} signed out`,
        result: 'SUCCESS',
        actor: user,
      })
    }
    sessionStorage.removeItem('pericope_auth')
    sessionStorage.removeItem(CURRENT_USER_KEY)
    setUser(null)
    setIsAuthenticated(false)
  }, [user])

  const hasPermission = useCallback((action: 'create' | 'read' | 'update' | 'delete' | 'admin') => {
    if (!user) return false
    return PERMISSIONS[user.role].has(action)
  }, [user])

  if (isAuthenticated === null) return null

  if (!isAuthenticated) {
    return (
      <AuthContext.Provider value={{ isAuthenticated: false, user: null, users, login, logout, switchUser, switchRole, setUsers, hasPermission }}>
        <LoginPage />
      </AuthContext.Provider>
    )
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated: true, user, users, login, logout, switchUser, switchRole, setUsers, hasPermission }}>
      {children}
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
