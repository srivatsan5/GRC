'use client'

/**
 * ⌘K command palette: pages (role-aware), live record search through the API, and quick actions.
 * Records open their own page (risks → /risks/:id) or their register pre-filtered with ?q=.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Command as Cmdk } from 'cmdk'
import { ArrowRight, BookOpen, Briefcase, CornerDownLeft, FileText, Activity, LogOut, Moon, OctagonAlert, Plus, Rows4, Search, ShieldAlert, Sun } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { useRowPage } from '@/lib/data'
import { useDensity } from '@/lib/preferences'
import { MORE_PAGES, NAV } from './nav'

function useDebounced<T>(v: T, ms = 200) {
  const [d, setD] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return d
}

const RECORD_SOURCES = [
  { table: 'per_trn_identify_risk', label: 'Risks', icon: ShieldAlert, title: (r: Record<string, unknown>) => String(r.risk_statement ?? `Risk #${r.uuid}`), sub: (r: Record<string, unknown>) => [r.assessment_reference_number, r.process_name].filter(Boolean).join(' · '), href: (r: Record<string, unknown>) => `/risks/${r.uuid}` },
  { table: 'erm_mst_control', label: 'Controls', icon: BookOpen, title: (r: Record<string, unknown>) => String(r.control_name ?? r.control_code), sub: (r: Record<string, unknown>) => String(r.control_code ?? ''), href: (r: Record<string, unknown>) => `/control-library?q=${encodeURIComponent(String(r.control_code ?? ''))}` },
  { table: 'erm_mst_kri_definition', label: 'Key risk indicators', icon: Activity, title: (r: Record<string, unknown>) => String(r.kri_name ?? r.kri_code), sub: (r: Record<string, unknown>) => String(r.kri_code ?? ''), href: (r: Record<string, unknown>) => `/kri?q=${encodeURIComponent(String(r.kri_code ?? ''))}` },
  { table: 'erm_mst_vendor', label: 'Vendors', icon: Briefcase, title: (r: Record<string, unknown>) => String(r.vendor_name), sub: (r: Record<string, unknown>) => [r.tier, r.category].filter(Boolean).join(' · '), href: (r: Record<string, unknown>) => `/vendor-risk?q=${encodeURIComponent(String(r.vendor_name ?? ''))}` },
  { table: 'erm_mst_policy', label: 'Policies', icon: FileText, title: (r: Record<string, unknown>) => String(r.title), sub: (r: Record<string, unknown>) => String(r.policy_code ?? ''), href: (r: Record<string, unknown>) => `/policy?q=${encodeURIComponent(String(r.policy_code ?? ''))}` },
  { table: 'erm_trn_incident', label: 'Incidents', icon: OctagonAlert, title: (r: Record<string, unknown>) => String(r.title), sub: (r: Record<string, unknown>) => [r.incident_ref, r.severity].filter(Boolean).join(' · '), href: (r: Record<string, unknown>) => `/incidents?q=${encodeURIComponent(String(r.title ?? ''))}` },
] as const

function RecordGroup({ source, query, go }: { source: (typeof RECORD_SOURCES)[number]; query: string; go: (href: string) => void }) {
  const q = useRowPage(source.table, { page: 1, pageSize: 5, search: query }, { enabled: query.length >= 2 })
  const rows = query.length >= 2 ? q.data?.items ?? [] : []
  if (!rows.length) return null
  const Icon = source.icon
  return (
    <Cmdk.Group heading={`${source.label}${q.data?.total && q.data.total > rows.length ? ` · ${q.data.total} matches` : ''}`}>
      {rows.map(r => (
        <Cmdk.Item key={`${source.table}-${r.uuid}`} value={`${source.table}-${r.uuid}-${query}`} onSelect={() => go(source.href(r))} className="palette-item">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body-sm text-foreground">{source.title(r)}</span>
            {source.sub(r) && <span className="block truncate font-mono text-caption text-muted-foreground">{source.sub(r)}</span>}
          </span>
        </Cmdk.Item>
      ))}
    </Cmdk.Group>
  )
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter()
  const { hasPermission, logout } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const [density, setDensity] = useDensity()
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query.trim())

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const go = (href: string) => {
    onOpenChange(false)
    router.push(href)
  }
  const run = (fn: () => void) => {
    onOpenChange(false)
    fn()
  }

  const pages = [
    ...NAV.flatMap(g => g.items.filter(i => !i.gate || hasPermission(i.gate)).map(i => ({ label: i.label, href: i.href, section: g.label ?? 'Overview' }))),
    ...MORE_PAGES.filter(p => !p.gate || hasPermission(p.gate)),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">Search pages, risks, controls and other records, or run an action.</DialogDescription>
        <Cmdk label="Search" loop className="flex flex-col [&_[cmdk-group-heading]]:label-caps [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5">
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Cmdk.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search risks, controls, vendors and pages…"
              className="h-13 flex-1 bg-transparent text-body-lg text-foreground placeholder:text-muted-foreground outline-none"
            />
            <kbd className="rounded-xs px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground shadow-[inset_0_0_0_1px_var(--border-strong)]">Esc</kbd>
          </div>
          <Cmdk.List className="max-h-[min(60dvh,480px)] overflow-y-auto px-2 pb-2 [&_[cmdk-item]]:flex [&_[cmdk-item]]:cursor-pointer [&_[cmdk-item]]:items-center [&_[cmdk-item]]:gap-3 [&_[cmdk-item]]:rounded-md [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2 [&_[cmdk-item][data-selected=true]]:bg-accent">
            <Cmdk.Empty className="px-3 py-8 text-center text-body-sm text-muted-foreground">
              {debounced.length >= 2 ? `No pages or records match “${debounced}”.` : 'Type to search.'}
            </Cmdk.Empty>
            {RECORD_SOURCES.map(s => (
              <RecordGroup key={s.table} source={s} query={debounced} go={go} />
            ))}
            <Cmdk.Group heading="Pages">
              {pages.map(p => (
                <Cmdk.Item key={p.href} value={`${p.label} ${p.section}`} onSelect={() => go(p.href)}>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="flex-1 text-body-sm text-foreground">{p.label}</span>
                  <span className="text-caption text-muted-foreground">{p.section}</span>
                </Cmdk.Item>
              ))}
            </Cmdk.Group>
            <Cmdk.Group heading="Actions">
              {hasPermission('create') && (
                <>
                  <Cmdk.Item value="Add a risk new risk" onSelect={() => go('/rcsa/identification?new=1')}>
                    <Plus className="size-4 text-muted-foreground" aria-hidden="true" /> <span className="flex-1 text-body-sm">Add a risk</span>
                  </Cmdk.Item>
                  <Cmdk.Item value="Record a KRI reading" onSelect={() => go('/kri')}>
                    <Activity className="size-4 text-muted-foreground" aria-hidden="true" /> <span className="flex-1 text-body-sm">Record a KRI reading</span>
                  </Cmdk.Item>
                  <Cmdk.Item value="Submit a request for approval" onSelect={() => go('/workflow?new=1')}>
                    <CornerDownLeft className="size-4 text-muted-foreground" aria-hidden="true" /> <span className="flex-1 text-body-sm">Submit a request for approval</span>
                  </Cmdk.Item>
                </>
              )}
              <Cmdk.Item value={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`} onSelect={() => run(() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'))}>
                {resolvedTheme === 'dark' ? <Sun className="size-4 text-muted-foreground" aria-hidden="true" /> : <Moon className="size-4 text-muted-foreground" aria-hidden="true" />}
                <span className="flex-1 text-body-sm">Switch to {resolvedTheme === 'dark' ? 'light' : 'dark'} theme</span>
              </Cmdk.Item>
              <Cmdk.Item value={`Use ${density === 'compact' ? 'comfortable' : 'compact'} density`} onSelect={() => run(() => setDensity(density === 'compact' ? 'comfortable' : 'compact'))}>
                <Rows4 className="size-4 text-muted-foreground" aria-hidden="true" /> <span className="flex-1 text-body-sm">Use {density === 'compact' ? 'comfortable' : 'compact'} rows</span>
              </Cmdk.Item>
              <Cmdk.Item value="Sign out log out" onSelect={() => run(() => logout())}>
                <LogOut className="size-4 text-muted-foreground" aria-hidden="true" /> <span className="flex-1 text-body-sm">Sign out</span>
              </Cmdk.Item>
            </Cmdk.Group>
          </Cmdk.List>
        </Cmdk>
      </DialogContent>
    </Dialog>
  )
}
