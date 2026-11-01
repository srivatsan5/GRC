'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/providers/auth-provider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAttentionItems } from '@/components/attention-items'
import { NAV, navItemFor, type NavItem } from './nav'

function useVisibleNav() {
  const { hasPermission } = useAuth()
  return NAV.map(g => ({ ...g, items: g.items.filter(i => !i.gate || hasPermission(i.gate)) })).filter(g => g.items.length)
}

export function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 rounded-md focus-ring" aria-label="Pericope, go to dashboard">
      <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary font-display text-[20px] italic leading-none text-primary-foreground shadow-button">
        P
      </span>
      {!collapsed && <span className="font-display text-[22px] leading-none tracking-[-0.01em] text-foreground">Pericope</span>}
    </Link>
  )
}

function NavLink({ item, active, collapsed, count, onNavigate }: { item: NavItem; active: boolean; collapsed: boolean; count?: number; onNavigate?: () => void }) {
  const Icon = item.icon
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex h-8 items-center gap-2.5 rounded-[7px] px-2.5 text-body-sm transition-[background-color,box-shadow,color] duration-(--duration-fast) ease-out focus-ring',
        active ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-panel' : 'text-sidebar-foreground hover:bg-hover hover:text-foreground',
        collapsed && 'justify-center px-0',
      )}
    >
      {item.step != null ? (
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex size-[18px] shrink-0 items-center justify-center rounded-full font-display text-[11px] leading-none',
            active ? 'bg-primary text-primary-foreground' : 'text-foreground-secondary shadow-[inset_0_0_0_1px_var(--border-strong)]',
          )}
        >
          {item.step}
        </span>
      ) : (
        Icon && <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-sidebar-foreground')} aria-hidden="true" />
      )}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
      {!collapsed && count != null && count > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums" aria-label={`${count} waiting`}>
          {count}
        </span>
      )}
      {collapsed && count != null && count > 0 && <span className="sr-only">{count} waiting</span>}
    </Link>
  )
  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="relative block">
          {link}
          {count != null && count > 0 && <span aria-hidden="true" className="absolute top-1 right-1.5 size-2 rounded-full bg-primary" />}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}{count ? ` · ${count}` : ''}</TooltipContent>
    </Tooltip>
  )
}

/** Navigation list (used by the desktop sidebar and the mobile drawer). */
export function NavList({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const path = usePathname()
  const groups = useVisibleNav()
  const current = navItemFor(path)?.item.href
  const { items } = useAttentionItems()
  const approvals = items.filter(i => i.id.startsWith('wf-')).length
  return (
    <TooltipProvider delayDuration={200}>
      <nav aria-label="Main" className="space-y-5">
        {groups.map((g, gi) => (
          <div key={g.label ?? gi}>
            {g.label && !collapsed && <p className="label-caps mb-1.5 px-2.5">{g.label}</p>}
            {g.label && collapsed && <div aria-hidden="true" className="mx-3 mb-2 border-t border-sidebar-border" />}
            <ul className="space-y-0.5">
              {g.items.map(item => (
                <li key={item.href}>
                  <NavLink item={item} active={current === item.href} collapsed={collapsed} count={item.badge === 'approvals' ? approvals : undefined} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </TooltipProvider>
  )
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className="sticky top-0 hidden h-dvh flex-col bg-sidebar transition-[width] duration-(--duration-slow) ease-out lg:flex print:hidden"
      style={{ width: collapsed ? 'var(--layout-sidebar-rail)' : 'var(--layout-sidebar-width)' }}
      aria-label="Sidebar"
    >
      <div className={cn('flex h-(--layout-topbar-height) shrink-0 items-center', collapsed ? 'justify-center' : 'justify-between pr-2 pl-5')}>
        <Brand collapsed={collapsed} />
        {!collapsed && (
          <button type="button" onClick={onToggle} aria-label="Collapse sidebar" className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground focus-ring">
            <PanelLeftClose className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className={cn('min-h-0 flex-1 overflow-y-auto pb-4', collapsed ? 'px-2.5' : 'px-3')}>
        <NavList collapsed={collapsed} />
      </div>
      {collapsed && (
        <div className="flex justify-center pb-4">
          <button type="button" onClick={onToggle} aria-label="Expand sidebar" className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground focus-ring">
            <PanelLeftOpen className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </aside>
  )
}
