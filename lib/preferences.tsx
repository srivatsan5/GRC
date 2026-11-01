'use client'

/**
 * Per-user display preferences: table density (comfortable 44 px / compact 32 px rows).
 * Stored in localStorage per user and applied as <html data-density="compact">, which the
 * tokens in app/globals.css read (--row-height, --control-height, --badge-height).
 * Theme (light/dark) is handled by next-themes.
 */
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/auth-provider'

export type Density = 'comfortable' | 'compact'
const EVENT = 'pericope:density'

function key(userId: string | undefined) {
  return `pericope_density:${userId ?? 'anon'}`
}

function read(userId: string | undefined): Density {
  try {
    return localStorage.getItem(key(userId)) === 'compact' ? 'compact' : 'comfortable'
  } catch {
    return 'comfortable'
  }
}

function apply(d: Density) {
  if (d === 'compact') document.documentElement.dataset.density = 'compact'
  else delete document.documentElement.dataset.density
}

export function useDensity(): [Density, (d: Density) => void] {
  const { user } = useAuth()
  const [density, setDensityState] = useState<Density>('comfortable')

  useEffect(() => {
    setDensityState(read(user?.id))
    const onChange = () => setDensityState(read(user?.id))
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [user?.id])

  const userId = user?.id
  const setDensity = useCallback(
    (d: Density) => {
      try { localStorage.setItem(key(userId), d) } catch { /* private mode */ }
      apply(d)
      setDensityState(d)
      window.dispatchEvent(new Event(EVENT))
    },
    [userId],
  )
  return [density, setDensity]
}

/** Applies the signed-in user's saved density to <html>. Mount once inside the auth provider. */
export function DensityBoundary() {
  const { user } = useAuth()
  useEffect(() => {
    apply(read(user?.id))
  }, [user?.id])
  return null
}
