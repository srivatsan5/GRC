'use client'

/**
 * Heatmaps page (Charter, DESIGN_HANDOFF §6): the large 5×5 matrix with a side list of the selected
 * cell's risks, inherent / residual / movement modes, the band legend from settings and the unrated note.
 */
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowRight, ArrowUp, Equal, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DataState } from '@/components/data-state'
import { BandBadge, RiskMovement } from '@/components/band-badge'
import { useAuth } from '@/components/providers/auth-provider'
import { Callout, CountUp, PageHeader, Panel, Person, Segmented } from '@/components/charter/primitives'
import { HeatmapLegend, RiskHeatmap, riskRef, risksInCell, type CellRef, type HeatmapMode } from '@/components/charter/heatmap'
import { IMPACT_LABELS, LIKELIHOOD_LABELS, bandCounts, type Risk } from '@/lib/risk'
import { useOrgSettings } from '@/lib/settings'
import { riskLabel, useRisks } from '@/components/analytics/risk-data'

const MODE_TITLES: Record<HeatmapMode, string> = {
  inherent: 'Inherent risk matrix',
  residual: 'Residual risk matrix',
  movement: 'Inherent → residual movement',
}

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many)

function hottestCell(risks: Risk[], mode: HeatmapMode): CellRef | null {
  let best: CellRef | null = null
  for (let l = 5; l >= 1; l--)
    for (let i = 5; i >= 1; i--)
      if (risksInCell(risks, mode, { l, i }).length && (!best || l * i > best.l * best.i)) best = { l, i }
  return best
}

export function HeatmapsPage() {
  const { bands } = useOrgSettings()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('create')
  const [mode, setMode] = useState<HeatmapMode>('inherent')
  const [picked, setPicked] = useState<CellRef | null | undefined>(undefined)

  const risksQ = useRisks()
  const allRisks = risksQ.data
  const risks = useMemo(() => (allRisks ?? []).filter(r => r.isActive), [allRisks])

  const which = mode === 'inherent' ? 'inherent' : 'residual'
  const counts = useMemo(() => bandCounts(risks.map(r => (which === 'inherent' ? r.inherentScore : r.residualScore)), bands), [risks, which, bands])

  const unrated = useMemo(
    () => risks.filter(r => (mode === 'inherent' ? r.inherentScore == null : mode === 'residual' ? r.residualScore == null : r.inherentScore == null || r.residualScore == null)).length,
    [risks, mode],
  )
  const onMap = risks.length - unrated

  const movement = useMemo(() => {
    const both = risks.filter(r => r.inherentScore != null && r.residualScore != null)
    const d = (r: Risk) => (r.residualScore ?? 0) - (r.inherentScore ?? 0)
    return {
      both: both.length,
      reduced: both.filter(r => d(r) < 0).length,
      unchanged: both.filter(r => d(r) === 0).length,
      increased: both.filter(r => d(r) > 0).length,
      inherentOnly: risks.filter(r => r.inherentScore != null && r.residualScore == null).length,
    }
  }, [risks])

  const autoCell = useMemo(() => hottestCell(risks, mode), [risks, mode])
  const selected = picked === undefined ? autoCell : picked
  const selectedRisks = useMemo(() => {
    if (!selected) return []
    return [...risksInCell(risks, mode, selected)].sort((a, b) => (b.inherentScore ?? 0) - (a.inherentScore ?? 0))
  }, [risks, mode, selected])

  const modeWord = mode === 'movement' ? 'inherent and residual' : which
  const rateHref = mode === 'inherent' ? '/assessments/inherent' : '/assessments/residual'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Analytics"
        title="Risk heatmaps"
        description="Likelihood × impact from the ratings recorded on each active risk. Select a cell to list its risks."
      />

      <DataState
        query={risksQ}
        empty={risks.length === 0}
        emptyTitle="No risks in the register yet"
        emptyDescription="The heatmaps fill in as risks are identified and rated."
        emptyAction={
          canCreate ? (
            <Link href="/rcsa/identification?new=1" className="text-body-sm font-medium text-primary hover:underline">
              Identify a risk
            </Link>
          ) : undefined
        }
      >
        {/* Headline figures */}
        <section aria-label="Headline figures" className="surface-panel grid grid-cols-2 overflow-hidden lg:grid-cols-4">
          <Cell label="Active risks" value={risks.length} context={`${onMap} on this map · ${unrated} not rated`} />
          {mode === 'movement' ? (
            <>
              <Cell label="Rated both ways" value={movement.both} context={`${movement.inherentOnly} with inherent only`} className="border-l" />
              <Cell label="Score reduced" value={movement.reduced} context={`${movement.unchanged} unchanged`} className="border-t lg:border-t-0 lg:border-l" />
              <Cell
                label="Score increased"
                value={movement.increased}
                tone={movement.increased > 0 ? 'text-risk-critical-text' : undefined}
                context={movement.increased > 0 ? 'Residual above inherent: check the ratings' : 'No residual above inherent'}
                className="border-t border-l lg:border-t-0"
              />
            </>
          ) : (
            <>
              <Cell label={`Rated (${which})`} value={risks.length - counts['Not rated']} context={`of ${risks.length} active risks`} className="border-l" />
              <Cell
                label="High & critical"
                value={counts.High + counts.Critical}
                tone={counts.Critical > 0 ? 'text-risk-critical-text' : counts.High > 0 ? 'text-risk-high-text' : undefined}
                context={`${counts.Critical} critical · ${counts.High} high`}
                className="border-t lg:border-t-0 lg:border-l"
              />
              <Cell label="Moderate & low" value={counts.Moderate + counts.Low} context={`${counts.Moderate} moderate · ${counts.Low} low`} className="border-t border-l lg:border-t-0" />
            </>
          )}
        </section>

        {unrated > 0 && (
          <Callout
            hatch
            action={
              <Link href={rateHref} className="inline-flex items-center gap-1 rounded-xs text-body-sm font-medium text-primary hover:underline focus-ring">
                {mode === 'inherent' ? 'Rate inherent risk' : 'Assess residual risk'} <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            }
          >
            {unrated} of {risks.length} active {plural(risks.length, 'risk has', 'risks have')} no {modeWord} rating, so {unrated === 1 ? 'it is' : 'they are'} missing from this map.
          </Callout>
        )}

        <Panel
          title={MODE_TITLES[mode]}
          meta={<span className="hidden whitespace-nowrap sm:inline">{`${onMap} of ${risks.length} risks placed`}</span>}
          actions={
            <Segmented
              label="Heatmap mode"
              value={mode}
              onChange={m => {
                setMode(m)
                setPicked(undefined)
              }}
              options={[
                { value: 'inherent', label: 'Inherent' },
                { value: 'residual', label: 'Residual' },
                { value: 'movement', label: 'Movement' },
              ]}
            />
          }
          bodyClassName="pt-5"
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
            <div className="flex min-w-0 flex-col gap-5">
              <div className="relative -mx-6 overflow-x-auto px-6 pb-1">
                <RiskHeatmap risks={risks} mode={mode} selected={selected} onSelect={c => setPicked(c)} showDetail={false} className="min-w-[460px]" />
              </div>
              <HeatmapLegend unrated={unrated} rateHref={rateHref} />
              {mode === 'movement' && (
                <p className="text-caption text-muted-foreground">
                  Cells show where risks sit after controls (residual). Dashed arrows run from the inherent cell; darker arrows carry more risks.
                </p>
              )}
            </div>

            {/* Side list of the selected cell */}
            <aside aria-label="Risks in the selected cell" aria-live="polite" className="flex min-w-0 flex-col rounded-lg bg-surface-sunken shadow-[inset_0_0_0_1px_var(--border)]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
                {selected ? (
                  <>
                    <BandBadge score={selected.l * selected.i} />
                    <span className="text-body-sm text-foreground-secondary">
                      {LIKELIHOOD_LABELS[selected.l - 1]} × {IMPACT_LABELS[selected.i - 1]}
                    </span>
                    <span className="ml-auto text-caption text-muted-foreground tabular-nums">
                      {selectedRisks.length} {plural(selectedRisks.length, 'risk')}
                    </span>
                  </>
                ) : (
                  <span className="label-caps">Selected cell</span>
                )}
              </div>
              {!selected && <p className="px-4 py-6 text-body-sm text-muted-foreground">Select a cell to list its risks. Use the arrow keys to move between cells.</p>}
              {selected && selectedRisks.length === 0 && <p className="px-4 py-6 text-body-sm text-muted-foreground">No risks sit in this cell.</p>}
              {selectedRisks.length > 0 && (
                <ul className="divide-y overflow-y-auto xl:max-h-[520px]">
                  {selectedRisks.map(r => (
                    <li key={r.uuid} className="flex flex-col gap-2 px-4 py-3.5">
                      <div className="min-w-0">
                        <p className="font-display text-body-lg text-foreground" title={riskLabel(r)}>
                          {r.statement ?? 'No statement recorded'}
                        </p>
                        <p className="truncate font-mono text-caption text-muted-foreground" title={riskRef(r)}>
                          {riskRef(r)}
                          {r.process && <span className="font-sans"> · {r.process}</span>}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <BandBadge score={r.inherentScore} kind="Inherent" />
                        <ArrowRight className="size-3.5 text-muted-foreground" aria-label="to residual" />
                        <RiskMovement inherent={r.inherentScore} residual={r.residualScore} />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <Person name={r.owner} />
                        <Link href={`/risks/${r.uuid}`} className="inline-flex shrink-0 items-center gap-1 rounded-xs text-body-sm font-medium text-primary hover:underline focus-ring">
                          Open risk <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        </Panel>

        {mode === 'movement' && (
          <Panel title="Movement after controls" meta={`${movement.both} risks rated both ways`} bodyClassName="p-0" className="max-w-xl">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Residual compared with inherent</th>
                  <th data-numeric className="text-right">
                    Risks
                  </th>
                </tr>
              </thead>
              <tbody>
                <MoveRow icon={<ArrowDown className="size-4 text-status-success-fg" aria-hidden="true" />} label="Reduced" n={movement.reduced} />
                <MoveRow icon={<Equal className="size-4 text-muted-foreground" aria-hidden="true" />} label="Unchanged" n={movement.unchanged} />
                <MoveRow icon={<ArrowUp className="size-4 text-status-danger-fg" aria-hidden="true" />} label="Increased" n={movement.increased} />
                <MoveRow icon={<Minus className="size-4 text-muted-foreground" aria-hidden="true" />} label="Residual not assessed" n={movement.inherentOnly} />
              </tbody>
            </table>
          </Panel>
        )}
      </DataState>
    </div>
  )
}

function Cell({ label, value, context, tone, className }: { label: string; value: number; context: string; tone?: string; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2 px-5 py-5 sm:px-7', className)}>
      <p className="label-caps">{label}</p>
      <p className={cn('figure text-figure', tone ?? 'text-foreground')}>
        <CountUp value={value} />
      </p>
      <p className="text-body-sm text-muted-foreground tabular-nums">{context}</p>
    </div>
  )
}

function MoveRow({ icon, label, n }: { icon: React.ReactNode; label: string; n: number }) {
  return (
    <tr>
      <td>
        <span className="inline-flex items-center gap-2">
          {icon}
          {label}
        </span>
      </td>
      <td data-numeric className="text-right tabular-nums">
        {n}
      </td>
    </tr>
  )
}
