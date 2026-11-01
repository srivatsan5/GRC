'use client'

/** /kri/matrix — each KRI against its last six recorded readings, coloured by traffic light. */
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataState, EmptyState } from '@/components/data-state'
import { formatDate, formatNumber, toDateInput } from '@/lib/format'
import { LIGHT_STYLES, kriLight, type KriLight, type KriReading } from '@/lib/kri'
import { cn } from '@/lib/utils'
import { exportCsv } from '@/components/controls/form-bits'
import { DIRECTION_LABELS, LightBadge, thresholdText, useKriData } from '@/components/kri/kri-shared'

const SLOTS = 6

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">KRI readings matrix</h1>
          <p className="text-xs text-slate-500">
            Each indicator’s last {SLOTS} recorded readings, oldest to latest, coloured by the traffic light recorded with the reading. Record readings on{' '}
            <Link href="/kri" className="text-blue-700 hover:underline">
              Key Risk Indicators
            </Link>
            .
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative w-full sm:w-72">
          <label htmlFor="kri-matrix-search" className="sr-only">
            Search indicators
          </label>
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <Input id="kri-matrix-search" placeholder="Search code, name, owner, category…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs bg-white" />
        </div>
        <div className="flex items-center gap-4">
          <ul className="flex items-center gap-3 text-[11px] text-slate-600" aria-label="Legend">
            {(['GREEN', 'AMBER', 'RED'] as const).map(l => (
              <li key={l} className="flex items-center gap-1">
                <span className={cn('h-2.5 w-2.5 rounded-sm', LIGHT_STYLES[l].dot)} aria-hidden="true" />
                {LIGHT_STYLES[l].label}
              </li>
            ))}
          </ul>
          <label className="flex items-center gap-1.5 text-xs text-slate-600" htmlFor="kri-matrix-inactive">
            <input id="kri-matrix-inactive" type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
        </div>
      </div>

      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <DataState query={queries} empty={(defsQ.data?.length ?? 0) === 0} emptyTitle="No KRI definitions yet" emptyDescription="Define indicators and record readings on the Key Risk Indicators page.">
          {rows.length === 0 ? (
            <EmptyState title="No indicators match" compact />
          ) : (
            <div className="overflow-x-auto">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th className="min-w-[220px]">Indicator</th>
                    {Array.from({ length: SLOTS }, (_, i) => (
                      <th key={i} className="text-center">
                        {i === SLOTS - 1 ? 'Latest' : `−${SLOTS - 1 - i}`}
                      </th>
                    ))}
                    <th>Current status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(d => (
                    <tr key={d.kri.uuid}>
                      <th scope="row" className="text-left font-normal">
                        <div className="font-mono text-[11px] text-slate-500">{d.kri.code}</div>
                        <div className="font-medium text-slate-900">{d.kri.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {d.kri.unit ?? 'No unit'} · {DIRECTION_LABELS[d.kri.direction]}
                          {!d.kri.active && ' · Inactive'}
                        </div>
                        <div className="text-[10px] text-slate-400">{thresholdText(d.kri)}</div>
                      </th>
                      {d.slots.map((r, i) => {
                        if (!r)
                          return (
                            <td key={i} className="text-center text-slate-300">
                              <span className="sr-only">No reading</span>
                              <span aria-hidden="true">—</span>
                            </td>
                          )
                        const l = lightOf(r, d)
                        const st = l ? LIGHT_STYLES[l] : null
                        return (
                          <td key={r.uuid} className="text-center p-1">
                            <div
                              className={cn('rounded border px-2 py-1.5', st ? [st.bg, st.border, st.text] : 'bg-slate-50 border-slate-200 text-slate-600')}
                              title={r.notes ?? undefined}
                            >
                              <div className="text-xs font-semibold tabular-nums">{formatNumber(r.value, 4)}</div>
                              <div className="text-[10px] opacity-80">{formatDate(r.date)}</div>
                              <span className="sr-only">{l ? `, ${LIGHT_STYLES[l].label}` : ', no status'}</span>
                            </div>
                          </td>
                        )
                      })}
                      <td>
                        <LightBadge light={d.light} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataState>
      </div>
      <p className="text-[11px] text-slate-500">Current status applies today’s thresholds to the latest reading; cell colours show the status recorded at the time of each reading.</p>
    </div>
  )
}
