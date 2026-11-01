/** Navigation model shared by the sidebar, breadcrumbs and the command palette. */
import {
  Activity, BarChart3, BookOpen, Briefcase, CheckCheck, FileText, GitBranch, Grid3x3, History, LayoutDashboard,
  LifeBuoy, OctagonAlert, SlidersHorizontal, Target, TrendingDown, Users, type LucideIcon,
} from 'lucide-react'

export type Gate = 'admin' | 'audit'

export interface NavItem {
  label: string
  href: string
  icon?: LucideIcon
  /** RCSA lifecycle step number (shown instead of an icon) */
  step?: number
  gate?: Gate
  /** Show the approvals-waiting count */
  badge?: 'approvals'
  /** Extra route prefixes that belong to this item (highlight + breadcrumbs) */
  also?: string[]
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  { items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }] },
  {
    label: 'RCSA lifecycle',
    items: [
      { label: 'Assessment cycles', href: '/rcsa/provisioning', step: 1, also: ['/risk-assessments/list'] },
      { label: 'Risk register', href: '/rcsa/identification', step: 2, also: ['/risks', '/risk-identification', '/risk-planning'] },
      { label: 'Inherent assessment', href: '/assessments/inherent', step: 3 },
      { label: 'Controls & mitigation', href: '/rcsa/mitigation', step: 4, also: ['/assessments/controls', '/risk-response'] },
      { label: 'Monitoring', href: '/rcsa/monitoring', step: 5, also: ['/monitoring'] },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { label: 'Heatmaps', href: '/heatmaps', icon: Grid3x3 },
      { label: 'Residual analysis', href: '/assessments/residual', icon: TrendingDown, also: ['/assessments/access', '/risk-assessments/dashboard', '/risk-assessment'] },
      { label: 'Key risk indicators', href: '/kri', icon: Activity },
      { label: 'Reports', href: '/reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Controls & policy',
    items: [
      { label: 'Control library', href: '/control-library', icon: BookOpen },
      { label: 'Risk appetite', href: '/risk-appetite', icon: Target, also: ['/appetite'] },
      { label: 'Approvals', href: '/workflow', icon: CheckCheck, badge: 'approvals' },
      { label: 'Policies', href: '/policy', icon: FileText },
    ],
  },
  {
    label: 'Enterprise risk',
    items: [
      { label: 'Vendors', href: '/vendor-risk', icon: Briefcase },
      { label: 'Incidents', href: '/incidents', icon: OctagonAlert },
      { label: 'Business continuity', href: '/bcp', icon: LifeBuoy, also: ['/asset-library'] },
      { label: 'Scenarios', href: '/scenario', icon: GitBranch },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Audit trail', href: '/audit-trail', icon: History, gate: 'audit' },
      { label: 'Users', href: '/users', icon: Users, gate: 'admin' },
      { label: 'Settings', href: '/settings', icon: SlidersHorizontal, gate: 'admin' },
    ],
  },
]

/** Pages reachable from the command palette that are not top-level navigation items. */
export const MORE_PAGES: { label: string; href: string; section: string; gate?: Gate }[] = [
  { label: 'RCSA overview', href: '/rcsa', section: 'RCSA lifecycle' },
  { label: 'Action plans', href: '/monitoring/action-plan', section: 'RCSA lifecycle' },
  { label: 'Mitigation plan hierarchy', href: '/monitoring/actions-hierarchy', section: 'RCSA lifecycle' },
  { label: 'Treatment pipeline', href: '/risk-response', section: 'RCSA lifecycle' },
  { label: 'Control testing', href: '/assessments/controls', section: 'RCSA lifecycle' },
  { label: 'Assessment analytics', href: '/assessments/access', section: 'Analytics' },
  { label: 'Assessment progress', href: '/risk-assessments/dashboard', section: 'Analytics' },
  { label: 'Risk assessment overview', href: '/risk-assessment', section: 'Analytics' },
  { label: 'KRI matrix', href: '/kri/matrix', section: 'Analytics' },
  { label: 'KRI thresholds', href: '/kri/configuration', section: 'Analytics' },
  { label: 'Business process library', href: '/asset-library', section: 'Enterprise risk' },
]

const PAGE_TITLES: Record<string, string> = Object.fromEntries([
  ...NAV.flatMap(g => g.items.map(i => [i.href, i.label])),
  ...MORE_PAGES.map(p => [p.href, p.label]),
])

/** The nav item a path belongs to (longest prefix wins). */
export function navItemFor(path: string): { item: NavItem; group: NavGroup } | null {
  // A risk's controls page lives under its cycle but belongs to the controls stage.
  if (/^\/rcsa\/provisioning\/[^/]+\/controls\//.test(path)) path = '/rcsa/mitigation'
  let best: { item: NavItem; group: NavGroup; len: number } | null = null
  for (const group of NAV) {
    for (const item of group.items) {
      for (const p of [item.href, ...(item.also ?? [])]) {
        if ((path === p || path.startsWith(p + '/')) && (!best || p.length > best.len)) best = { item, group, len: p.length }
      }
    }
  }
  return best ? { item: best.item, group: best.group } : null
}

export function pageTitle(path: string): string | null {
  return PAGE_TITLES[path] ?? null
}
