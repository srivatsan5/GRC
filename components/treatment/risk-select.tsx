'use client'

import React, { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { useRows } from '@/lib/data'
import { toRisk } from '@/lib/risk'
import { labelCls, selectCls, FieldError } from './shared'

/** Pick a risk from the real risk register (with a quick text filter). */
export function RiskSelect({
  id,
  value,
  onChange,
  error,
  disabled,
  label = 'Risk *',
}: {
  id: string
  value: number | null
  onChange: (riskId: number | null) => void
  error?: string
  disabled?: boolean
  label?: string
}) {
  const risksQ = useRows('per_trn_identify_risk')
  const [filter, setFilter] = useState('')
  const risks = useMemo(() => (risksQ.data ?? []).map(toRisk), [risksQ.data])
  const shown = useMemo(() => {
    const t = filter.trim().toLowerCase()
    const list = t
      ? risks.filter(r =>
          [r.statement, r.process, r.category, r.owner, String(r.uuid)].some(v => v && v.toLowerCase().includes(t)),
        )
      : risks
    // Keep the selected risk visible even when it doesn't match the filter.
    const selected = value != null ? risks.find(r => r.uuid === value) : undefined
    return selected && !list.includes(selected) ? [selected, ...list] : list
  }, [risks, filter, value])

  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <div className="space-y-1.5">
        <Input
          id={`${id}-filter`}
          aria-label="Filter risks"
          placeholder={risksQ.isLoading ? 'Loading risks…' : 'Type to filter risks…'}
          value={filter}
          onChange={e => setFilter(e.target.value)}
          disabled={disabled || risksQ.isLoading}
          className="h-8 text-xs"
        />
        <select
          id={id}
          className={selectCls}
          value={value ?? ''}
          onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
          disabled={disabled || risksQ.isLoading}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <option value="">{risksQ.isError ? 'Could not load risks' : 'Select a risk…'}</option>
          {shown.map(r => (
            <option key={r.uuid} value={r.uuid}>
              #{r.uuid} · {(r.statement ?? 'No statement').slice(0, 90)}
            </option>
          ))}
        </select>
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}
