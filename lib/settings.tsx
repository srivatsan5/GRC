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

const ACTIVITY_KEY = 'pericope_last_activity'

/**
 * Signs the user out of this browser after `idleTimeoutMinutes` without activity in ANY tab:
 * tabs share the last-activity time through localStorage, so an idle background tab never
 * signs out a tab you are working in. Only this browser's session ends (other devices stay signed in).
 */
export function IdleTimeout() {
  const { settings } = useOrgSettings()
  const { logout, isAuthenticated } = useAuth()
  const lastWrite = useRef(0)

  useEffect(() => {
    if (!isAuthenticated) return
    const limit = settings.idleTimeoutMinutes * 60_000
    const touch = () => {
      const now = Date.now()
      if (now - lastWrite.current < 5_000) return // throttle storage writes
      lastWrite.current = now
      try { localStorage.setItem(ACTIVITY_KEY, String(now)) } catch { /* private mode */ }
    }
    const lastActivity = () => {
      try { return Number(localStorage.getItem(ACTIVITY_KEY)) || Date.now() } catch { return lastWrite.current || Date.now() }
    }
    lastWrite.current = 0
    touch()
    const events = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'] as const
    events.forEach(e => window.addEventListener(e, touch, { passive: true }))
    const check = setInterval(() => {
      if (Date.now() - lastActivity() >= limit) logout({ allDevices: false })
    }, 30_000)
    return () => {
      events.forEach(e => window.removeEventListener(e, touch))
      clearInterval(check)
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
