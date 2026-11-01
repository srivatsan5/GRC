'use client'

import React, { useState } from 'react'
import { Loader2, Lock, OctagonAlert, TriangleAlert } from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import { apiErrorMessage } from '@/lib/apiClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Sign-in: a quiet brand moment on the stone ground — the "P" mark and serif wordmark,
 * one ivory panel with a serif heading, labelled fields and the single primary action.
 */
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
    <main className="flex min-h-dvh flex-col bg-background px-5 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center">
        <div className="mb-8 flex items-center justify-center gap-3" aria-label="Pericope">
          <span aria-hidden="true" className="inline-flex size-10 items-center justify-center rounded-md bg-primary font-display text-[26px] leading-none text-primary-foreground italic shadow-button">
            P
          </span>
          <span className="font-display text-[30px] leading-none tracking-[-0.015em] text-foreground">Pericope</span>
        </div>

        <section aria-labelledby="signin-title" className="surface-raised px-6 py-8 sm:px-9 sm:py-10">
          <p className="label-caps">Enterprise risk management</p>
          <h1 id="signin-title" className="mt-2 font-display text-title text-foreground">
            Sign in
          </h1>
          <p className="mt-2 text-body text-muted-foreground">Use the email address and password your administrator set up for you.</p>

          {(error || notice) && (
            <div
              role="alert"
              className={
                error
                  ? 'mt-6 flex items-start gap-2.5 rounded-md bg-status-danger-bg px-3.5 py-3 text-body-sm text-status-danger-fg'
                  : 'mt-6 flex items-start gap-2.5 rounded-md bg-status-warning-bg px-3.5 py-3 text-body-sm text-status-warning-fg'
              }
            >
              {error ? <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
              <span>{error ?? notice}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-5" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-body-sm font-medium text-foreground">
                Email address
              </label>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-10"
                placeholder="name@company.com"
                aria-invalid={!!error}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="block text-body-sm font-medium text-foreground">
                Password
              </label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="h-10"
                aria-invalid={!!error}
                required
              />
            </div>

            <Button type="submit" size="lg" disabled={isLoading || !email || !password} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <p className="mt-6 border-t pt-5 text-body-sm text-muted-foreground">Forgotten your password? Ask a Pericope administrator to reset it.</p>
        </section>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-caption text-muted-foreground">
          <Lock className="size-3.5" aria-hidden="true" />
          Every sign-in is recorded in the audit trail
        </p>
      </div>
    </main>
  )
}
