'use client'

/** Readable breadcrumbs: section › page › record name (never raw ids). */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { useRow } from '@/lib/data'
import { navItemFor, pageTitle } from './nav'

function truncate(s: string, n = 56) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

function useRecordCrumbs(path: string): { label: string; href?: string }[] {
  const seg = path.split('/').filter(Boolean)
  // /rcsa/provisioning/:cycle[/controls/:risk]
  const cycleId = seg[0] === 'rcsa' && seg[1] === 'provisioning' && seg[2] ? seg[2] : null
  const cycleRiskId = cycleId && seg[3] === 'controls' && seg[4] ? seg[4] : null
  // /risks/:id  ·  /rcsa/mitigation/:id
  const riskId = cycleRiskId ?? ((seg[0] === 'risks' && seg[1]) || (seg[0] === 'rcsa' && seg[1] === 'mitigation' && seg[2]) || null)
  const cycle = useRow('erm_trn_assessment_cycle', cycleId)
  const risk = useRow('per_trn_identify_risk', riskId)
  const out: { label: string; href?: string }[] = []
  if (cycleId) {
    out.push({ label: cycle.data?.cycle_name ? truncate(String(cycle.data.cycle_name)) : cycle.isError ? 'Cycle not found' : 'Assessment cycle', href: cycleRiskId ? `/rcsa/provisioning/${cycleId}` : undefined })
  }
  if (riskId) {
    out.push({ label: risk.data ? truncate(String(risk.data.risk_statement ?? 'Risk without a statement')) : risk.isError ? 'Risk not found' : 'Risk' })
  }
  return out
}

export function Breadcrumbs() {
  const path = usePathname()
  const nav = navItemFor(path)
  const records = useRecordCrumbs(path)
  const crumbs: { label: string; href?: string }[] = []
  if (nav?.group.label) crumbs.push({ label: nav.group.label })
  if (nav) crumbs.push({ label: nav.item.label, href: nav.item.href !== path ? nav.item.href : undefined })
  const exact = pageTitle(path)
  if (exact && exact !== nav?.item.label) crumbs.push({ label: exact })
  crumbs.push(...records)
  if (!crumbs.length) return null
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-body-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
              {c.href && !last ? (
                <Link href={c.href} className="truncate text-muted-foreground hover:text-foreground focus-ring rounded-xs">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={last ? 'truncate font-medium text-foreground' : 'truncate text-muted-foreground'}>
                  {c.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
