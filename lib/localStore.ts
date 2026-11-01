/**
 * Lightweight, typed local store with seed support and cross-tab reactivity.
 *
 * Used by all the enterprise modules (KRI, Control Library, Risk Appetite,
 * Workflow, TPRM, Incidents, BCP, Scenario, Policy, Heatmaps) to provide real
 * CRUD that works regardless of backend availability. Data is persisted to
 * localStorage so user actions survive page reloads and sync across tabs.
 */

import { useEffect, useState } from 'react'

export interface StoreOptions<T> {
  key: string
  seed: T[]
  version?: number
}

export interface StoreApi<T> {
  key: string
  list(): T[]
  get(id: string): T | undefined
  add(item: T): T
  update(id: string, patch: Partial<T>): T | undefined
  remove(id: string): boolean
  reset(): void
  subscribe(fn: () => void): () => void
}

const REGISTERED_STORES: StoreApi<any>[] = []

function makeKey(opts: StoreOptions<any>) {
  const v = opts.version ?? 1
  return `pericope_store_${opts.key}_v${v}`
}

export function createStore<T extends { id: string }>(opts: StoreOptions<T>): StoreApi<T> {
  const storageKey = makeKey(opts)
  const listeners = new Set<() => void>()

  function load(): T[] {
    if (typeof window === 'undefined') return [...opts.seed]
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) {
        localStorage.setItem(storageKey, JSON.stringify(opts.seed))
        return [...opts.seed]
      }
      return JSON.parse(raw) as T[]
    } catch {
      return [...opts.seed]
    }
  }

  function persist(items: T[]) {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(storageKey, JSON.stringify(items))
    } catch { /* ignore quota */ }
    listeners.forEach(fn => fn())
  }

  // Cross-tab synchronization
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === storageKey) {
        listeners.forEach(fn => fn())
      }
    })
  }

  const store: StoreApi<T> = {
    key: opts.key,
    list: () => load(),
    get: (id: string) => load().find(x => x.id === id),
    add: (item: T) => {
      const next = [...load(), item]
      persist(next)
      return item
    },
    update: (id: string, patch: Partial<T>) => {
      const items = load()
      const idx = items.findIndex(x => x.id === id)
      if (idx === -1) return undefined
      items[idx] = { ...items[idx], ...patch }
      persist(items)
      return items[idx]
    },
    remove: (id: string) => {
      const items = load()
      const next = items.filter(x => x.id !== id)
      if (next.length === items.length) return false
      persist(next)
      return true
    },
    reset: () => persist([...opts.seed]),
    subscribe: (fn: () => void) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
  }

  REGISTERED_STORES.push(store)
  return store
}

export function resetAllDemoStores(): void {
  REGISTERED_STORES.forEach(store => store.reset())
}

export function useStoreSnapshot<T extends { id: string }>(store: StoreApi<T>): T[] {
  const [snapshot, setSnapshot] = useState<T[]>(() => store.list())
  useEffect(() => {
    setSnapshot(store.list())
    return store.subscribe(() => setSnapshot(store.list()))
  }, [store])
  return snapshot
}

export function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}
