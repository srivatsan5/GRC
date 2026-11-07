'use client'

import { useMemo } from 'react'
import { useRows, type Row } from '@/lib/data'

/**
 * Applied controls (per_trn_control_implementation) store type, frequency and design effectiveness
 * either as text (rows saved by this app) or as ids into small lookup tables (rows loaded by the
 * database install). These helpers show the name in both cases.
 */
export interface ControlLookups {
  type: Map<string, string>
  freq: Map<string, string>
  design: Map<string, string>
}

function names(rows: Row[] | undefined, col: string): Map<string, string> {
  const m = new Map<string, string>()
  for (const r of rows ?? []) {
    const v = r[col]
    if (v != null && String(v).trim()) m.set(String(r.uuid), String(v).trim())
  }
  return m
}

export function useControlLookups(): ControlLookups {
  const type = useRows('per_mst_control_type')
  const freq = useRows('per_mst_control_frequency')
  const design = useRows('per_mst_control_design_effectiveness')
  return useMemo(
    () => ({ type: names(type.data, 'control_type'), freq: names(freq.data, 'control_frequency'), design: names(design.data, 'control_design_effectiveness') }),
    [type.data, freq.data, design.data],
  )
}

/** The stored value as a name: text is returned as stored, an id is looked up (null when unknown). */
export function lookupName(value: unknown, table: Map<string, string>): string | null {
  if (value == null) return null
  const v = String(value).trim()
  if (!v) return null
  return /^\d+$/.test(v) ? (table.get(v) ?? null) : v
}
