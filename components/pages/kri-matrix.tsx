'use client'

/** /kri/matrix — each KRI against its last six recorded readings, cells tinted by traffic light (icon + value). */
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataState, EmptyState } from '@/components/data-state'
import { PageHeader, Panel, SearchField } from '@/components/charter/primitives'
import { formatDate, toDateInput } from '@/lib/format'
import { LIGHT_STYLES, kriLight, type KriLight, type KriReading } from '@/lib/kri'
import { cn } from '@/lib/utils'
import { exportCsv } from '@/components/controls/form-bits'
import { Checkbox } from '@/components/governance/form'
import { KriNav } from '@/components/kri/kri-nav'
import { LIGHT_ICON, LIGHT_VAR, LightPill, fmt } from '@/components/kri/kri-visuals'
import { DIRECTION_LABELS, thresholdText, useKriData } from '@/components/kri/kri-shared'

const SLOTS = 6
const slotLabel = (i: number) => (i === SLOTS - 1 ? 'Latest' : i === SLOTS - 2 ? 'Previous' : `−${SLOTS - 1 - i}`)

export function KrimatrixPage() {
  const { data, queries, defsQ } = useKriData()
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return data
      .filter(d => showInactive || d.kri.active)
      .filter(d => !term || [d.kri.code, d.kri.name, d.kri.owner, d.kri.category].some(v => v?.toLowerCase().includes(term)))
      .map(d => {
        const last = d.readings.slice(-SLOTS)
        // Right-align so the latest reading is always in the last column.
        const slots: (KriReading | null)[] = [...Array<null>(SLOTS - last.length).fill(null), ...last]
        return { ...d, slots }
      })
  }, [data, search, showInactive])

  const lightOf = (r: KriReading, d: (typeof rows)[number]): KriLight | null => r.light ?? kriLight(r.value, d.kri)

  const handleExport = () => {
    const header = ['KRI code', 'KRI name', 'Unit', ...Array.from({ length: SLOTS }, (_, i) => (i === SLOTS - 1 ? 'Latest' : `Latest −${SLOTS - 1 - i}`)).flatMap(h => [`${h} date`, `${h} value`, `${h} light`])]
    exportCsv(
      'kri-matrix.csv',
      header,
      rows.map(d => [d.kri.code, d.kri.name, d.kri.unit, ...d.slots.flatMap(r => (r ? [toDateInput(r.date), r.value, lightOf(r, d) ?? ''] : ['', '', '']))]),
      'KRI matrix',
    )
  }

  const breaches = rows.reduce((n, d) => n + d.slots.filter(r => r && lightOf(r, d) === 'RED').length, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics · Key risk indicators"
        title="Readings matrix"
        description={`Each indicator’s last ${SLOTS} recorded readings, oldest to latest, tinted by the status recorded with each reading.`}
        actions={
          <Button variant="secondary" onClick={handleExport} disabled={rows.length === 0}>
            <Download aria-hidden="true" />
            Export CSV
          </Button>
        }
      />
      <KriNav />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SearchField value={search} onChange={setSearch} label="Search indicators" placeholder="Code, name, owner, category…" />
        <Checkbox id="kri-matrix-inactive" label="Show inactive" checked={showInactive} onChange={setShowInactive} />
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-foreground-secondary sm:ml-auto" aria-label="Legend">
          {(['GREEN', 'AMBER', 'RED'] as const).map(l => (
            <li key={l} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs" style={{ background: LIGHT_VAR[l].solid }} aria-hidden="true" />
              {LIGHT_STYLES[l].label}
            </li>
          ))}
        </ul>
      </div>

      <Panel bodyClassName="p-0" title="Last six readings" meta={`${rows.length} indicator${rows.length === 1 ? '' : 's'} · ${breaches} breach reading${breaches === 1 ? '' : 's'} shown`}>
        <div className="pt-4">
          <DataState
            query={queries}
            empty={(defsQ.data?.length ?? 0) === 0}
            emptyTitle="No indicators yet"
            emptyDescription="Define indicators and record readings on the Indicators page."
            emptyAction={
              <Button variant="secondary" asChild>
                <Link href="/kri">Go to indicators</Link>
              </Button>
            }
          >
            {rows.length === 0 ? (
              <EmptyState title="No indicators match" description="Clear the search or show inactive indicators." compact />
            ) : (
              <div className="relative overflow-x-auto border-t">
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th className="min-w-[260px] pl-6">Indicator</th>
                      {Array.from({ length: SLOTS }, (_, i) => (
                        <th key={i} className={cn('text-center', i === SLOTS - 1 && 'text-foreground')}>
                          {slotLabel(i)}
                        </th>
                      ))}
                      <th className="pr-6">Current status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(d => (
                      <tr key={d.kri.uuid}>
                        <td className="max-w-[320px] pl-6">
                          <span className="block truncate font-medium text-foreground" title={d.kri.name}>
                            {d.kri.name}
                          </span>
                          <span className="block truncate font-mono text-caption text-muted-foreground" title={thresholdText(d.kri)}>
                            {d.kri.code} · {d.kri.unit ?? 'No unit'} · {DIRECTION_LABELS[d.kri.direction]}
                            {!d.kri.active && ' · Inactive'}
                          </span>
                        </td>
                        {d.slots.map((r, i) => {
                          if (!r)
                            return (
                              <td key={`empty-${i}`} className="px-1.5 py-1.5 text-center">
                                <span className="flex h-12 min-w-[84px] items-center justify-center rounded-sm text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]">
                                  <span className="sr-only">No reading</span>
                                  <span aria-hidden="true">—</span>
                                </span>
                              </td>
                            )
                          const l = lightOf(r, d)
                          const st = l ? LIGHT_STYLES[l] : null
                          const Icon = l ? LIGHT_ICON[l] : null
                          const latest = i === SLOTS - 1
                          return (
                            <td key={r.uuid} className="px-1.5 py-1.5 text-center">
                              <span
                                className={cn(
                                  'flex h-12 min-w-[84px] flex-col items-center justify-center rounded-sm px-2',
                                  st ? [st.bg, st.text] : 'bg-muted text-foreground-secondary',
                                  latest && l === 'RED' && 'shadow-[inset_0_0_0_1px_var(--risk-critical-text)]',
                                )}
                                title={r.notes ?? undefined}
                              >
                                <span className="inline-flex items-center gap-1 text-body-sm font-semibold tabular-nums">
                                  {Icon && <Icon className="size-3.5" aria-hidden="true" />}
                                  {fmt(r.value)}
                                </span>
                                <span className="text-[11px] leading-4 opacity-80 tabular-nums">{formatDate(r.date, { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                                <span className="sr-only">{l ? `, ${LIGHT_STYLES[l].label}` : ', no status'}</span>
                              </span>
                            </td>
                          )
                        })}
                        <td className="pr-6">
                          <LightPill light={d.light} solid />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataState>
        </div>
      </Panel>
      <p className="text-caption text-muted-foreground">Current status applies today’s thresholds to the latest reading; cell tints show the status recorded at the time of each reading.</p>
    </div>
  )
}
