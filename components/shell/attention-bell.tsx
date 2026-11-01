'use client'

import Link from 'next/link'
import { Bell, CheckCheck, Clock, OctagonAlert, TriangleAlert } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useAttentionItems, type AttentionItem } from '@/components/attention-items'

const GROUPS: { key: string; title: string; match: (i: AttentionItem) => boolean }[] = [
  { key: 'kri', title: 'KRI breaches & warnings', match: i => i.id.startsWith('kri-') },
  { key: 'plans', title: 'Overdue action plans', match: i => i.id.startsWith('plans-') },
  { key: 'wf', title: 'Approvals waiting for you', match: i => i.id.startsWith('wf-') },
]

export function AttentionBell() {
  const { items, loading } = useAttentionItems()
  const n = items.length
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={n ? `Needs your attention: ${n} item${n === 1 ? '' : 's'}` : 'Nothing needs your attention'}
          className="relative inline-flex size-9 items-center justify-center rounded-md text-foreground-secondary hover:bg-hover hover:text-foreground focus-ring"
        >
          <Bell className="size-[18px]" aria-hidden="true" />
          {n > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-risk-critical px-1 text-[10px] leading-none font-semibold text-risk-critical-fg tabular-nums">
              {n}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-baseline justify-between border-b px-4 py-3">
          <p className="font-display text-body-lg text-foreground">Needs attention</p>
          <Link href="/workflow" className="text-caption font-medium text-primary hover:underline focus-ring rounded-xs">
            Open inbox
          </Link>
        </div>
        <div className="max-h-[60dvh] overflow-y-auto px-4 pb-3">
          {loading && n === 0 && <p className="py-4 text-body-sm text-muted-foreground">Checking…</p>}
          {!loading && n === 0 && (
            <p className="flex items-center gap-2 py-4 text-body-sm text-muted-foreground">
              <CheckCheck className="size-4 text-status-success-fg" aria-hidden="true" /> Nothing needs your attention right now.
            </p>
          )}
          {GROUPS.map(g => {
            const list = items.filter(g.match)
            if (!list.length) return null
            return (
              <div key={g.key}>
                <p className="label-caps pt-3 pb-1">
                  {g.title} <span className="tabular-nums">{list.length}</span>
                </p>
                <ul className="divide-y divide-border">
                  {list.map(i => {
                    const Icon = i.tone === 'red' ? OctagonAlert : i.tone === 'amber' ? TriangleAlert : g.key === 'plans' ? Clock : CheckCheck
                    return (
                      <li key={i.id}>
                        <Link href={i.href} className="flex items-start gap-3 rounded-sm py-2.5 hover:bg-hover focus-ring">
                          <Icon
                            className={cn('mt-0.5 size-4 shrink-0', i.tone === 'red' ? 'text-status-danger-fg' : i.tone === 'amber' ? 'text-status-warning-fg' : 'text-primary')}
                            aria-hidden="true"
                          />
                          <span className="min-w-0">
                            <span className="block text-body-sm font-medium text-foreground">{i.title}</span>
                            <span className="block truncate text-caption text-muted-foreground">{i.body}</span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
