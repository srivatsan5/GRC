'use client'

import { cn } from '@/lib/utils'
import { BAND_STYLES } from '@/lib/risk'
import { useOrgSettings } from '@/lib/settings'

/** Score + band chip ("12 · High"), or "Not rated" when there is no score. */
export function BandBadge({ score, className }: { score: number | null | undefined; className?: string }) {
  const { band } = useOrgSettings()
  const b = band(score)
  if (!b) return <span className={cn('inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500', className)}>Not rated</span>
  const s = BAND_STYLES[b]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium', s.bg, s.text, s.border, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} aria-hidden="true" />
      <span className="tabular-nums">{score}</span> · {b}
    </span>
  )
}
