'use client'

/**
 * Organisation settings for the whole app (currency, risk bands, idle timeout…),
 * loaded once from the API and shared through React Query.
 */
import React, { useCallback, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { settingsApi, type ApiOrgSettings } from './apiClient'
import { DEFAULT_BANDS, bandOf, type RiskBands } from './risk'
import { formatMoney } from './format'
import { useAuth } from '@/components/providers/auth-provider'

export const DEFAULT_SETTINGS: ApiOrgSettings = {
  orgName: 'Pericope ERM',
  industry: 'Financial Services',
  currency: 'USD',
  idleTimeoutMinutes: 30,
  riskBands: DEFAULT_BANDS,
}

export const SETTINGS_KEY = ['settings'] as const

export function useOrgSettings() {
  const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: settingsApi.get, staleTime: 5 * 60_000 })
  const settings = query.data?.settings ?? DEFAULT_SETTINGS
  const bands: RiskBands = settings.riskBands ?? DEFAULT_BANDS
  const money = useCallback(
    (value: number | null | undefined, opts?: { compact?: boolean }) => formatMoney(value, settings.currency, opts),
    [settings.currency],
  )
  const band = useCallback((score: number | null | undefined) => bandOf(score, bands), [bands])
  return { settings, bands, money, band, stored: query.data?.stored ?? false, query }
}

/** Signs the user out after `idleTimeoutMinutes` without mouse/keyboard/touch activity. */
export function IdleTimeout() {
  const { settings } = useOrgSettings()
  const { logout, isAuthenticated } = useAuth()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    const ms = settings.idleTimeoutMinutes * 60_000
    const reset = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        logout()
      }, ms)
    }
    const events = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'] as const
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      events.forEach(e => window.removeEventListener(e, reset))
      if (timer.current) clearTimeout(timer.current)
    }
  }, [settings.idleTimeoutMinutes, logout, isAuthenticated])

  return null
}

export function SettingsBoundary({ children }: { children: React.ReactNode }) {
  return (
    <>
      <IdleTimeout />
      {children}
    </>
  )
}
