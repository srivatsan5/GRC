'use client'

import React from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiErrorCode, apiErrorMessage } from '@/lib/apiClient'
import { BAND_STYLES, BANDS, type Band } from '@/lib/risk'
import { formatNumber, formatPct, pctOf } from '@/lib/format'

interface QueryLike {
  isLoading: boolean
  isError: boolean
  error: unknown
}

/** A white card with a small uppercase title and an optional action on the right. */
export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('bg-white rounded border border-slate-200', className)}>
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">{title}</h2>
        {action}
      </div>
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

/**
 * A KPI tile that links to its module. While any of `queries` is loading it shows a spinner;
 * if one failed it says so (or "Not set up yet" when the table isn't provisioned) instead of a number.
 */
export function StatTile({
  title,
  href,
  queries,
  value,
  sub,
  tone,
}: {
  title: string
  href: string
  queries: QueryLike[]
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: 'danger' | 'warning'
}) {
  const failed = queries.find(q => q.isError)
  const loading = queries.some(q => q.isLoading)
  return (
    <Link
      href={href}
      className="block p-4 bg-white rounded border border-slate-200 hover:border-slate-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
    >
      <div className="text-xs font-medium text-slate-500">{title}</div>
      {failed ? (
        <>
          <div className="text-2xl font-semibold text-slate-300 mt-1">—</div>
          <div className="text-[11px] text-slate-500 mt-0.5" title={apiErrorMessage(failed.error)}>
            {apiErrorCode(failed.error) === 'NOT_PROVISIONED' ? 'Not set up in the database yet' : 'Couldn’t load'}
          </div>
        </>
      ) : loading ? (
        <div className="h-[3.25rem] flex items-center" role="status" aria-label="Loading">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" aria-hidden="true" />
        </div>
      ) : (
        <>
          <div className={cn('text-2xl font-semibold mt-1 tabular-nums', tone === 'danger' ? 'text-red-700' : tone === 'warning' ? 'text-amber-700' : 'text-slate-900')}>
            {value}
          </div>
          {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
        </>
      )}
    </Link>
  )
}

/** Horizontal bars for a list of counts, with share of `total`. */
export function BarList({
  items,
  total,
  limit,
  valueLabel,
}: {
  items: { name: string; count: number; extra?: React.ReactNode }[]
  total: number
  limit?: number
  valueLabel?: (count: number) => React.ReactNode
}) {
  const shown = limit ? items.slice(0, limit) : items
  const max = Math.max(1, ...shown.map(i => i.count))
  return (
    <div className="space-y-2.5">
      {shown.map(item => (
        <div key={item.name} className="space-y-1">
          <div className="flex justify-between gap-3 text-xs text-slate-700">
            <span className="truncate" title={item.name}>{item.name}</span>
            <span className="font-medium tabular-nums whitespace-nowrap">
              {valueLabel ? valueLabel(item.count) : formatNumber(item.count)}
              {total > 0 && !valueLabel && <span className="text-slate-400 font-normal"> · {formatPct(pctOf(item.count, total))}</span>}
              {item.extra}
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded overflow-hidden">
            <div className="h-full bg-blue-700 rounded" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
      {limit && items.length > limit && <p className="text-[11px] text-slate-400">+ {items.length - limit} more</p>}
    </div>
  )
}

/** Band counts table: one row per band, a column per set of counts (e.g. inherent / residual). */
export function BandCountTable({ columns }: { columns: { label: string; counts: Record<Band | 'Not rated', number> }[] }) {
  return (
    <table className="enterprise-table">
      <thead>
        <tr>
          <th>Band</th>
          {columns.map(c => (
            <th key={c.label} className="text-right">{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...BANDS].reverse().map(b => (
          <tr key={b}>
            <td>
              <span className="inline-flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', BAND_STYLES[b].dot)} aria-hidden="true" />
                {b}
              </span>
            </td>
            {columns.map(c => (
              <td key={c.label} className="text-right tabular-nums">{c.counts[b]}</td>
            ))}
          </tr>
        ))}
        <tr>
          <td className="text-slate-500">Not rated</td>
          {columns.map(c => (
            <td key={c.label} className="text-right tabular-nums text-slate-500">{c.counts['Not rated']}</td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}
