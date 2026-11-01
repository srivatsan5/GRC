'use client'

import React, { useState } from 'react'
import { AlertCircle, Loader2, Shield } from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import { apiErrorMessage } from '@/lib/apiClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LoginPage({ notice }: { notice?: string | null }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(apiErrorMessage(err, 'Sign-in failed. Please try again.'))
      setPassword('')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-blue-900 text-white mb-3">
            <Shield className="w-5 h-5" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Pericope ERM</h1>
          <p className="text-xs text-slate-500 mt-1">Enterprise Risk Management</p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm rounded-lg border border-slate-200 sm:px-8">
          {(error || notice) && (
            <div
              role="alert"
              className={`mb-4 flex items-start gap-2 rounded border px-3 py-2 text-xs ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
              <span>{error ?? notice}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-slate-700">Email address</label>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="mt-1 h-9 text-sm"
                placeholder="name@company.com"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-medium text-slate-700">Password</label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="mt-1 h-9 text-sm"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full h-9 text-sm font-medium bg-blue-900 hover:bg-blue-800 text-white rounded"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" /> Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <p className="mt-5 text-[11px] leading-relaxed text-slate-500">
            Forgotten your password? Ask a Pericope administrator to reset it.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Pericope Enterprise Risk Management &middot; All sign-ins are logged
        </p>
      </div>
    </div>
  )
}
