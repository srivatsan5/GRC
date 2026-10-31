'use client'

import React, { useState } from 'react'
import {
  Lock,
  User,
  ArrowRight,
  Loader2,
  Shield,
} from 'lucide-react'
import { useAuth, Role } from '@/components/providers/auth-provider'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const ROLES_LIST: Array<{
  id: string
  name: string
  email: string
  role: Role
  department: string
}> = [
  { id: 'U-001', name: 'Srivatsan B', email: 'srivatsan@pericope.local', role: 'Administrator', department: 'Risk Office' },
  { id: 'U-002', name: 'Priya Sharma', email: 'priya.sharma@pericope.local', role: 'Risk Manager', department: 'Finance' },
  { id: 'U-003', name: 'Anthony Muller', email: 'anthony.muller@pericope.local', role: 'Assessor', department: 'Operations' },
  { id: 'U-004', name: 'Lin Wei', email: 'lin.wei@pericope.local', role: 'Auditor', department: 'Internal Audit' },
  { id: 'U-005', name: 'Karen Diaz', email: 'karen.diaz@pericope.local', role: 'Viewer', department: 'Compliance' },
]

export function LoginPage() {
  const { login } = useAuth()
  const { toast } = useToast()

  const [email, setEmail] = useState('srivatsan@pericope.local')
  const [password, setPassword] = useState('Demo123!')
  const [isLoading, setIsLoading] = useState(false)

  const handleCredentialsLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    setTimeout(() => {
      const matched = ROLES_LIST.find(u => u.email.toLowerCase() === email.toLowerCase())
      if (matched && password.length >= 6) {
        login(matched.email)
      } else {
        toast({
          title: 'Sign-in failed',
          description: matched ? 'Invalid password.' : 'No user found with that email.',
          variant: 'destructive',
        })
        setIsLoading(false)
      }
    }, 400)
  }

  const handleQuickRoleSelect = (userEmail: string) => {
    login(userEmail)
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-blue-900 text-white mb-3">
            <Shield className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Pericope ERM</h1>
          <p className="text-xs text-slate-500 mt-1">Enterprise Risk Management</p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm rounded-lg border border-slate-200 sm:px-8 space-y-6">
          <form onSubmit={handleCredentialsLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">Email address</label>
              <div className="mt-1 relative">
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="h-9 text-xs"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Password</label>
              <div className="mt-1 relative">
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="h-9 text-xs"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full h-9 text-xs font-medium bg-blue-900 hover:bg-blue-800 text-white rounded"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-slate-400 text-[11px]">Or sign in as</span>
            </div>
          </div>

          <div className="space-y-1.5">
            {ROLES_LIST.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleQuickRoleSelect(p.email)}
                className="w-full px-3 py-2 text-left rounded border border-slate-200 hover:bg-slate-50 flex items-center justify-between text-xs transition-colors"
              >
                <div>
                  <span className="font-medium text-slate-900">{p.name}</span>
                  <span className="text-slate-500 ml-1.5 text-[11px]">({p.department})</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-normal text-slate-600">
                  {p.role}
                </Badge>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Pericope Enterprise Risk Management &middot; System access is logged
        </p>
      </div>
    </div>
  )
}
