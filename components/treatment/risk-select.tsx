'use client'

import React, { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
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
        {label.endsWith(' *') ? (
          <>
            {label.slice(0, -2)} <span className="text-status-danger-fg" aria-hidden="true">*</span>
          </>
        ) : (
          label
        )}
      </label>
      <div className="grid gap-2 sm:grid-cols-[200px_minmax(0,1fr)]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={`${id}-filter`}
            type="search"
            aria-label="Filter risks"
            placeholder={risksQ.isLoading ? 'Loading risks…' : 'Filter risks…'}
            value={filter}
            onChange={e => setFilter(e.target.value)}
            disabled={disabled || risksQ.isLoading}
            className="pl-9"
          />
        </div>
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
              {r.referenceNumber ?? `#${r.uuid}`} · {(r.statement ?? 'No statement recorded').slice(0, 90)}
            </option>
          ))}
        </select>
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}
