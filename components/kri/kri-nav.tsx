'use client'

/** Sub-navigation shared by the three KRI pages: Indicators · Readings matrix · Thresholds. */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, Grid3x3, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/kri', label: 'Indicators', icon: Activity },
  { href: '/kri/matrix', label: 'Readings matrix', icon: Grid3x3 },
  { href: '/kri/configuration', label: 'Thresholds', icon: SlidersHorizontal },
] as const

export function KriNav() {
  const path = usePathname()
  return (
    <nav aria-label="Key risk indicator views" className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[9px] bg-surface-sunken p-[3px] shadow-[inset_0_0_0_1px_var(--border)]">
      {LINKS.map(l => {
        const current = path === l.href
        const Icon = l.icon
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'inline-flex h-8 items-center gap-2 rounded-[6px] px-2.5 sm:px-3 text-body-sm font-medium whitespace-nowrap transition-[background-color,box-shadow,color] duration-(--duration-fast) ease-out focus-ring',
              current ? 'bg-card text-foreground shadow-panel' : 'text-foreground-secondary hover:text-foreground',
            )}
          >
            <Icon className="hidden size-4 text-muted-foreground sm:block" aria-hidden="true" />
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
