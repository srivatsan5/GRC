'use client'

/**
 * Charter app shell: persistent collapsible sidebar (248 px / 64 px rail) on the stone ground,
 * and an inset rounded work area with the top bar (breadcrumbs, ⌘K search, organisation,
 * attention bell, user menu). Below lg the sidebar becomes a drawer.
 */
import { useEffect, useState } from 'react'
import { Eye, Menu, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/providers/auth-provider'
import { useOrgSettings } from '@/lib/settings'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Breadcrumbs } from './breadcrumbs'
import { AttentionBell } from './attention-bell'
import { UserMenu } from './user-menu'
import { CommandPalette } from './command-palette'
import { Brand, NavList, Sidebar } from './sidebar'

const COLLAPSE_KEY = 'pericope_sidebar_collapsed'

export function AppShell({ children, className }: { children: React.ReactNode; className?: string }) {
  const { hasPermission } = useAuth()
  const { settings } = useOrgSettings()
  const [collapsed, setCollapsed] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [palette, setPalette] = useState(false)
  const readOnly = !hasPermission('create') && !hasPermission('update')

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1') } catch { /* noop */ }
  }, [])
  const toggle = () => {
    setCollapsed(c => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1') } catch { /* noop */ }
      return !c
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex min-h-dvh bg-sidebar print:min-h-0 print:bg-transparent">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow-popover">
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggle={toggle} />

      <div className="flex min-w-0 flex-1 flex-col lg:py-2 lg:pr-2 print:p-0">
        <div className="flex min-h-full flex-1 flex-col bg-background lg:rounded-xl print:min-h-0 print:bg-transparent lg:shadow-[0_0_0_1px_var(--border)] print:shadow-none">
          <header className="sticky top-0 z-30 flex h-(--layout-topbar-height) shrink-0 items-center gap-3 border-b border-transparent bg-background/90 px-4 backdrop-blur-[2px] sm:px-6 lg:rounded-t-xl lg:px-(--layout-page-gutter) print:hidden">
            <button type="button" onClick={() => setDrawer(true)} aria-label="Open navigation" className="inline-flex size-9 items-center justify-center rounded-md text-foreground-secondary hover:bg-hover lg:hidden focus-ring">
              <Menu className="size-5" aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1">
              <Breadcrumbs />
            </div>
            <button
              type="button"
              onClick={() => setPalette(true)}
              className="hidden h-9 w-80 items-center gap-2.5 rounded-md bg-card px-3 text-left text-body-sm text-muted-foreground shadow-[0_0_0_1px_var(--border-strong)] hover:bg-surface-raised md:flex focus-ring"
            >
              <Search className="size-4" aria-hidden="true" />
              <span className="flex-1 truncate">Search risks, controls and pages</span>
              <kbd className="rounded-xs px-1.5 font-mono text-[11px] text-muted-foreground shadow-[inset_0_0_0_1px_var(--border-strong)]">⌘K</kbd>
            </button>
            <button type="button" onClick={() => setPalette(true)} aria-label="Search" className="inline-flex size-9 items-center justify-center rounded-md text-foreground-secondary hover:bg-hover md:hidden focus-ring">
              <Search className="size-[18px]" aria-hidden="true" />
            </button>
            <span className="hidden max-w-48 truncate text-body-sm text-foreground-secondary xl:block" title="Organisation">
              {settings.orgName}
            </span>
            {readOnly && (
              <span className="hidden items-center gap-1.5 rounded-sm bg-muted px-2 py-0.5 text-caption text-foreground-secondary shadow-[inset_0_0_0_1px_var(--border)] sm:inline-flex" title="Your role can view but not change records">
                <Eye className="size-3.5" aria-hidden="true" /> Read-only
              </span>
            )}
            <AttentionBell />
            <UserMenu />
          </header>

          <main id="main" tabIndex={-1} className={cn('mx-auto w-full max-w-(--layout-content-max) flex-1 px-4 pt-6 pb-16 outline-none sm:px-6 lg:px-(--layout-page-gutter) lg:pt-8', className)}>
            {children}
          </main>
          <footer className="flex items-center justify-between px-4 pb-5 text-caption text-muted-foreground sm:px-6 lg:px-(--layout-page-gutter) print:hidden">
            <span>Pericope ERM</span>
            <span>v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
          </footer>
        </div>
      </div>

      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="overflow-y-auto bg-sidebar p-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Pages of Pericope ERM</SheetDescription>
          <div className="mb-5 px-1">
            <Brand />
          </div>
          <NavList onNavigate={() => setDrawer(false)} />
        </SheetContent>
      </Sheet>
      <CommandPalette open={palette} onOpenChange={setPalette} />
    </div>
  )
}
