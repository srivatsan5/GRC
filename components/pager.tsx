'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** "1–25 of 230" with previous / next, and an optional page-size choice (25 / 50 / 100). */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  busy,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  onPageSize?: (size: number) => void
  busy?: boolean
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-body-sm text-foreground-secondary" aria-label="Pagination">
      <span aria-live="polite" className="tabular-nums">
        <span className="font-medium text-foreground">
          {from}–{to}
        </span>{' '}
        of {total}
      </span>
      <div className="flex items-center gap-2">
        {onPageSize && (
          <label className="flex items-center gap-2 text-caption text-muted-foreground">
            Rows
            <select
              value={pageSize}
              onChange={e => onPageSize(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-card px-2 text-body-sm text-foreground focus-ring"
            >
              {[25, 50, 100].map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button variant="secondary" size="icon" onClick={() => onPage(page - 1)} disabled={busy || page <= 1} aria-label="Previous page">
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span className="px-1 tabular-nums">
          Page {page} of {pageCount}
        </span>
        <Button variant="secondary" size="icon" onClick={() => onPage(page + 1)} disabled={busy || page >= pageCount} aria-label="Next page">
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
