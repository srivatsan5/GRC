'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** "1–25 of 230" with previous / next buttons, for server-paged tables. */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
  busy,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  busy?: boolean
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <nav className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-slate-600" aria-label="Pagination">
      <span aria-live="polite">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => onPage(page - 1)} disabled={busy || page <= 1} aria-label="Previous page">
          <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
        </Button>
        <span className="px-2 tabular-nums">
          Page {page} of {pageCount}
        </span>
        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => onPage(page + 1)} disabled={busy || page >= pageCount} aria-label="Next page">
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
