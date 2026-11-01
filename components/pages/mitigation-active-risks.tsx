'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ListChecks, ShieldCheck, ShieldOff, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LifecycleStepper } from '@/components/charter/lifecycle-stepper'
import { Chip, CountUp, PageHeader, Panel, Person, SearchField, Segmented, Stat } from '@/components/charter/primitives'
import { DataState } from '@/components/data-state'
import { Pager, useClampPage } from '@/components/pager'
import { BandBadge } from '@/components/band-badge'
import { useRows } from '@/lib/data'
import { currentScore, toRisk } from '@/lib/risk'
import { useOrgSettings } from '@/lib/settings'
import { DASH } from '@/lib/format'
import { FigureStrip, isActionComplete, numOrNull, pageSlice } from '@/components/treatment/shared'

const PAGE_SIZE = 25
type Scope = 'needs' | 'above' | 'nocontrols' | 'all'

export function MitigationActiveRisksPage() {
  const { bands } = useOrgSettings()
  const risksQ = useRows('per_trn_identify_risk')
  const implQ = useRows('per_trn_control_implementation')
  const plansQ = useRows('per_trn_risk_monitoring')
  // Same coverage rule as the dashboard: an applied control OR a control-library link.
  const linksQ = useRows('erm_lnk_control_risk')

  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<Scope>('needs')
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [search, scope])

  const rows = useMemo(() => {
    const controlCount = new Map<number, number>()
    for (const c of implQ.data ?? []) {
      const id = numOrNull(c.identify_risk_uuid)
      if (id != null) controlCount.set(id, (controlCount.get(id) ?? 0) + 1)
    }
    for (const l of linksQ.data ?? []) {
      const id = numOrNull(l.risk_uuid)
      if (id != null && !controlCount.has(id)) controlCount.set(id, 1)
    }
    const planCount = new Map<number, { total: number; open: number }>()
    for (const p of plansQ.data ?? []) {
      const id = numOrNull(p.identify_risk_uuid)
      if (id == null) continue
      const cur = planCount.get(id) ?? { total: 0, open: 0 }
      cur.total++
      if (!isActionComplete(p)) cur.open++
      planCount.set(id, cur)
    }
    return (risksQ.data ?? [])
      .map(toRisk)
      .filter(r => r.isActive && Number.isFinite(r.uuid))
      .map(r => {
        const score = currentScore(r)
        const controls = controlCount.get(r.uuid) ?? 0
        const above = score != null && score >= bands.high
        return { risk: r, score, controls, plans: planCount.get(r.uuid) ?? { total: 0, open: 0 }, above, noControls: controls === 0 }
      })
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.risk.uuid - b.risk.uuid)
  }, [risksQ.data, implQ.data, plansQ.data, bands.high, linksQ.data])

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter(x => {
      if (scope === 'needs' && !(x.above || x.noControls)) return false
      if (scope === 'above' && !x.above) return false
      if (scope === 'nocontrols' && !x.noControls) return false
      if (!term) return true
      const r = x.risk
      return [r.statement, r.process, r.category, r.owner, r.referenceNumber, String(r.uuid)].some(v => v && v.toLowerCase().includes(term))
    })
  }, [rows, scope, search])

  const counts = {
    needs: rows.filter(x => x.above || x.noControls).length,
    above: rows.filter(x => x.above).length,
    nocontrols: rows.filter(x => x.noControls).length,
    unrated: rows.filter(x => x.score == null).length,
  }
  const loaded = !!(risksQ.data && implQ.data && plansQ.data)
  const of = (n: number) => (rows.length ? `${n} of ${rows.length} active risks` : 'No active risks')

  useClampPage(page, shown.length, PAGE_SIZE, setPage)

  return (
    <div className="space-y-6">
      <LifecycleStepper current="controls" />

      <PageHeader
        eyebrow="RCSA · Step 4"
        title="Controls & mitigation"
        description={`Active risks that need treatment: rated at or above the High band (score ≥ ${bands.high}, from Settings), or with no controls applied.`}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/assessments/controls">
                <ShieldCheck aria-hidden="true" />
                Control testing
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/monitoring/action-plan">
                <ListChecks aria-hidden="true" />
                Action plans
              </Link>
            </Button>
          </>
        }
      />

      <FigureStrip>
        <Stat label="Need treatment" loading={!loaded} value={<CountUp value={counts.needs} />} tone={counts.needs > 0 ? 'text-risk-high-text' : undefined} context={of(counts.needs)} />
        <Stat label={`At or above High (≥ ${bands.high})`} loading={!loaded} value={<CountUp value={counts.above} />} context="By current score: residual, else inherent" />
        <Stat label="No controls applied" loading={!loaded} value={<CountUp value={counts.nocontrols} />} context={of(counts.nocontrols)} />
        <Stat
          label={
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="hatch inline-block size-3 rounded-[3px] bg-risk-unrated-bg shadow-[inset_0_0_0_1px_var(--risk-unrated-border)]" />
              Not rated yet
            </span>
          }
          loading={!loaded}
          value={<CountUp value={counts.unrated} />}
          context={
            counts.unrated > 0 ? (
              <Link href="/assessments/inherent" className="rounded-xs font-medium text-primary hover:underline focus-ring">
                Rate now
              </Link>
            ) : (
              'Every active risk is rated'
            )
          }
        />
      </FigureStrip>

      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-full overflow-x-auto">
        <Segmented<Scope>
          label="Show"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'needs', label: 'Needs treatment', count: loaded ? counts.needs : undefined },
            { value: 'above', label: `≥ High`, count: loaded ? counts.above : undefined },
            { value: 'nocontrols', label: 'No controls', count: loaded ? counts.nocontrols : undefined },
            { value: 'all', label: 'All active', count: loaded ? rows.length : undefined },
          ]}
          className="w-max"
        />
        </div>
        <SearchField value={search} onChange={setSearch} label="Search risks" placeholder="Statement, reference, process, owner…" className="sm:ml-auto" />
      </div>

      <Panel bodyClassName="p-0">
        <DataState
          query={[risksQ, implQ, plansQ]}
          empty={shown.length === 0}
          emptyTitle={rows.length === 0 ? 'The risk register is empty' : scope === 'needs' && !search ? 'Nothing needs treatment' : 'No risks match'}
          emptyDescription={
            rows.length === 0
              ? 'Identify risks in an assessment cycle first.'
              : scope === 'needs' && !search
                ? 'Every active risk is below the High band and has at least one control.'
                : 'Change the filter or search to see other risks.'
          }
          emptyAction={
            rows.length === 0 ? (
              <Button asChild>
                <Link href="/rcsa/identification">Go to the risk register</Link>
              </Button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table min-w-[1000px]">
              <thead>
                <tr>
                  <th className="pl-6">Risk</th>
                  <th>Owner</th>
                  <th>Current</th>
                  <th>Why listed</th>
                  <th data-numeric>Controls</th>
                  <th data-numeric>Plans open / total</th>
                  <th className="pr-6 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageSlice(shown, page, PAGE_SIZE).map(({ risk: r, score, controls, plans, above, noControls }) => {
                  const ref = r.referenceNumber ?? `#${r.uuid}`
                  const controlsHref = r.cycleUuid != null ? `/rcsa/provisioning/${r.cycleUuid}/controls/${r.uuid}` : `/risks/${r.uuid}`
                  return (
                    <tr key={r.uuid}>
                      <td className="max-w-[380px] py-2 pl-6">
                        <Link href={`/risks/${r.uuid}`} className="block truncate rounded-xs font-medium text-foreground hover:text-primary hover:underline focus-ring" title={r.statement ?? undefined}>
                          {r.statement ?? <span className="text-muted-foreground">No statement recorded</span>}
                        </Link>
                        <span className="block truncate text-caption text-muted-foreground" title={[ref, r.process].filter(Boolean).join(' · ')}>
                          <span className="font-mono">{ref}</span>
                          {r.process && ` · ${r.process}`}
                        </span>
                      </td>
                      <td className="max-w-[180px]">
                        <Person name={r.owner} />
                      </td>
                      <td className="whitespace-nowrap">
                        <BandBadge score={score} rateHref={score == null ? '/assessments/inherent' : undefined} />
                      </td>
                      <td>
                        <span className="flex flex-wrap gap-1.5">
                          {above && (
                            <Chip tone="danger" icon={TriangleAlert}>
                              Score ≥ {bands.high}
                            </Chip>
                          )}
                          {noControls && (
                            <Chip tone="warning" icon={ShieldOff}>
                              No controls
                            </Chip>
                          )}
                          {!above && !noControls && <span className="text-muted-foreground">{DASH}</span>}
                        </span>
                      </td>
                      <td data-numeric className={controls === 0 ? 'text-muted-foreground' : undefined}>
                        {controls}
                      </td>
                      <td data-numeric>
                        <span className={plans.open > 0 ? 'text-foreground' : 'text-muted-foreground'}>{plans.open}</span>
                        <span className="text-muted-foreground"> / {plans.total}</span>
                      </td>
                      <td className="pr-6">
                        <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="secondary" size="sm">
                          <Link href={controlsHref} aria-label={`Controls for ${r.statement ?? ref}`}>
                            Controls
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="icon">
                          <Link href={`/risks/${r.uuid}`} aria-label={`Open risk ${ref}`}>
                            <ArrowRight aria-hidden="true" />
                          </Link>
                        </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={shown.length} onPage={setPage} />
        </DataState>
      </Panel>
    </div>
  )
}
