'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Minus, ClipboardPlus, History, Download, Search } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState, EmptyState } from '@/components/data-state'
import { useDeleteRow } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { formatDate, formatNumber, toDateInput } from '@/lib/format'
import { kriLight, type KriDefinition, type KriLight } from '@/lib/kri'
import { cn } from '@/lib/utils'
import { Stat, exportCsv, selectClass } from '@/components/controls/form-bits'
import {
  DIRECTION_LABELS,
  KRI_READINGS,
  KriDefinitionDialog,
  LightBadge,
  RecordReadingDialog,
  formatValue,
  thresholdText,
  useDeleteKri,
  useKriData,
  type KriWithReadings,
} from '@/components/kri/kri-shared'

const LINE_COLOR: Record<KriLight, string> = { GREEN: '#059669', AMBER: '#d97706', RED: '#dc2626' }

type LightFilter = 'all' | KriLight | 'none'

export function KriIntelligencePage() {
  const { hasPermission } = useAuth()
  const { data, queries, defsQ } = useKriData()
  const deleteKri = useDeleteKri()
  const [search, setSearch] = useState('')
  const [lightFilter, setLightFilter] = useState<LightFilter>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<KriDefinition | 'new' | null>(null)
  const [recording, setRecording] = useState<KriDefinition | null>(null)
  const [history, setHistory] = useState<KriWithReadings | null>(null)

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return data.filter(d => {
      if (!showInactive && !d.kri.active) return false
      if (lightFilter === 'none' ? d.light != null : lightFilter !== 'all' && d.light !== lightFilter) return false
      if (term && ![d.kri.code, d.kri.name, d.kri.owner, d.kri.category].some(v => v?.toLowerCase().includes(term))) return false
      return true
    })
  }, [data, search, lightFilter, showInactive])

  const totals = useMemo(() => {
    const active = data.filter(d => d.kri.active)
    return {
      total: active.length,
      green: active.filter(d => d.light === 'GREEN').length,
      amber: active.filter(d => d.light === 'AMBER').length,
      red: active.filter(d => d.light === 'RED').length,
      none: active.filter(d => d.light == null).length,
    }
  }, [data])

  const handleExport = () => {
    const rows = data.flatMap(d =>
      d.readings.map(r => [d.kri.code, d.kri.name, d.kri.unit, toDateInput(r.date), r.value, r.light ?? kriLight(r.value, d.kri) ?? '', r.breach ? 'Y' : 'N', r.notes]),
    )
    exportCsv('kri-readings.csv', ['KRI code', 'KRI name', 'Unit', 'Reading date', 'Value', 'Traffic light', 'Breach', 'Notes'], rows, 'KRI reading')
  }

  const readingCount = data.reduce((n, d) => n + d.readings.length, 0)
  const filtering = Boolean(search.trim()) || lightFilter !== 'all'
  const latestOf = useMemo(() => (history ? data.find(d => d.kri.uuid === history.kri.uuid) ?? null : null), [history, data])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Key Risk Indicators</h1>
          <p className="text-xs text-slate-500">
            Current values are the latest recorded reading.{' '}
            <Link href="/kri/matrix" className="text-blue-700 hover:underline">
              Readings matrix
            </Link>{' '}
            ·{' '}
            <Link href="/kri/configuration" className="text-blue-700 hover:underline">
              Threshold configuration
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={readingCount === 0}>
            <Download className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            Export readings
          </Button>
          {hasPermission('create') && (
            <Button onClick={() => setEditing('new')} size="sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
              New indicator
            </Button>
          )}
        </div>
      </div>

      <DataState
        query={queries}
        empty={(defsQ.data?.length ?? 0) === 0}
        emptyTitle="No key risk indicators defined yet"
        emptyDescription="Define an indicator with thresholds, then record readings to track it."
        emptyAction={
          hasPermission('create') ? (
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
              New indicator
            </Button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Stat label="Active indicators" value={totals.total} />
          <Stat label="Green" value={totals.green} tone="green" />
          <Stat label="Amber warnings" value={totals.amber} tone="amber" />
          <Stat label="Red breaches" value={totals.red} tone="red" />
          <Stat label="No reading yet" value={totals.none} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end justify-between">
          <div className="relative w-full sm:w-72">
            <label htmlFor="kri-search" className="sr-only">
              Search indicators
            </label>
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <Input id="kri-search" placeholder="Search code, name, owner, category…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs bg-white" />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 pb-1.5" htmlFor="kri-show-inactive">
              <input id="kri-show-inactive" type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
              Show inactive
            </label>
            <div>
              <label htmlFor="kri-light-filter" className="block text-[11px] text-slate-500 mb-0.5">
                Status
              </label>
              <select id="kri-light-filter" className={`${selectClass} w-40`} value={lightFilter} onChange={e => setLightFilter(e.target.value as LightFilter)}>
                <option value="all">All statuses</option>
                <option value="GREEN">Green</option>
                <option value="AMBER">Amber</option>
                <option value="RED">Red</option>
                <option value="none">No reading</option>
              </select>
            </div>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="bg-white rounded border border-slate-200">
            <EmptyState title={filtering ? 'No indicators match these filters' : 'No active indicators'} compact />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visible.map(d => (
              <KriCard
                key={d.kri.uuid}
                item={d}
                canRecord={hasPermission('create')}
                canEdit={hasPermission('update')}
                canDelete={hasPermission('delete')}
                deleting={deleteKri.pending}
                onRecord={() => setRecording(d.kri)}
                onHistory={() => setHistory(d)}
                onEdit={() => setEditing(d.kri)}
                onDelete={() => deleteKri.run(d.kri)}
              />
            ))}
          </div>
        )}
      </DataState>

      {editing && <KriDefinitionDialog initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {recording && <RecordReadingDialog kri={recording} onClose={() => setRecording(null)} />}
      {history && latestOf && <HistoryDialog item={latestOf} canDelete={hasPermission('delete')} onClose={() => setHistory(null)} />}
    </div>
  )
}

function Trend({ item }: { item: KriWithReadings }) {
  const { latest, previous, kri } = item
  if (!latest || !previous) return null
  const delta = latest.value - previous.value
  if (delta === 0)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
        <Minus className="w-3 h-3" aria-hidden="true" /> No change since {formatDate(previous.date)}
      </span>
    )
  const worse = kri.direction === 'HIGHER_WORSE' ? delta > 0 : delta < 0
  const Icon = delta > 0 ? TrendingUp : TrendingDown
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px]', worse ? 'text-red-700' : 'text-emerald-700')}>
      <Icon className="w-3 h-3" aria-hidden="true" />
      {delta > 0 ? '+' : ''}
      {formatNumber(delta, 4)} vs {formatDate(previous.date)} ({worse ? 'worsening' : 'improving'})
    </span>
  )
}

function KriCard({
  item,
  canRecord,
  canEdit,
  canDelete,
  deleting,
  onRecord,
  onHistory,
  onEdit,
  onDelete,
}: {
  item: KriWithReadings
  canRecord: boolean
  canEdit: boolean
  canDelete: boolean
  deleting: boolean
  onRecord: () => void
  onHistory: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { kri, readings, latest, light } = item
  const color = light ? LINE_COLOR[light] : '#64748b'
  const chartData = readings.map(r => ({ date: r.date, label: formatDate(r.date, { month: 'short', year: '2-digit' }), value: r.value }))

  return (
    <article
      aria-labelledby={`kri-${kri.uuid}-name`}
      className={cn('p-4 bg-white rounded border space-y-3', light === 'RED' ? 'border-red-300' : light === 'AMBER' ? 'border-amber-300' : 'border-slate-200')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-slate-500">{kri.code}</span>
            {kri.category && <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 rounded border border-slate-200">{kri.category}</span>}
            {!kri.active && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded border border-slate-200">Inactive</span>}
          </div>
          <h2 id={`kri-${kri.uuid}-name`} className="text-xs font-semibold text-slate-900 mt-1">
            {kri.name}
          </h2>
          <p className="text-[11px] text-slate-500">
            Owner: {kri.owner ?? 'Unassigned'} · {kri.frequency ?? 'Frequency not set'} · {DIRECTION_LABELS[kri.direction]}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {canEdit && (
            <Button variant="ghost" size="icon" onClick={onEdit} className="h-7 w-7 text-slate-600" aria-label={`Edit ${kri.code}`}>
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="icon" onClick={onDelete} disabled={deleting} className="h-7 w-7 text-red-600 hover:bg-red-50" aria-label={`Delete ${kri.code}`}>
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">{latest ? formatNumber(latest.value, 4) : '—'}</span>
            {latest && kri.unit && <span className="text-xs text-slate-500">{kri.unit}</span>}
          </div>
          <div className="text-[11px] text-slate-500">{latest ? `Latest reading ${formatDate(latest.date)}` : 'No readings recorded yet'}</div>
          <Trend item={item} />
        </div>
        <LightBadge light={light} />
      </div>

      {readings.length > 0 ? (
        <div className="h-28 w-full" role="img" aria-label={`${kri.name}: ${readings.length} readings from ${formatDate(readings[0]!.date)} to ${formatDate(latest!.date)}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="#94a3b8" axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" axisLine={false} tickLine={false} width={32} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ fontSize: '11px', borderRadius: '4px' }}
                labelFormatter={(_, payload) => formatDate(payload?.[0]?.payload?.date)}
                formatter={(v: number) => [formatValue(v, kri.unit), 'Value']}
              />
              {kri.amber != null && <ReferenceLine y={kri.amber} stroke="#d97706" strokeDasharray="3 3" />}
              {kri.red != null && <ReferenceLine y={kri.red} stroke="#dc2626" strokeDasharray="3 3" />}
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 2.5, fill: color }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-28 flex items-center justify-center rounded border border-dashed border-slate-200 text-[11px] text-slate-400">No history to chart yet</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
        <span>{thresholdText(kri)}</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onHistory} disabled={readings.length === 0}>
            <History className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            History ({readings.length})
          </Button>
          {canRecord && (
            <Button size="sm" className="h-7 px-2 text-xs" onClick={onRecord}>
              <ClipboardPlus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              Record reading
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

function HistoryDialog({ item, canDelete, onClose }: { item: KriWithReadings; canDelete: boolean; onClose: () => void }) {
  const confirm = useConfirm()
  const del = useDeleteRow(KRI_READINGS)
  const { kri } = item
  const rows = [...item.readings].reverse()

  const remove = async (uuid: number, date: string) => {
    const ok = await confirm({ title: 'Delete this reading?', description: `The ${formatDate(date)} reading for ${kri.code} will be removed.`, confirmLabel: 'Delete reading', tone: 'danger' })
    if (!ok) return
    try {
      await del.mutateAsync(uuid)
      toast.success('Reading deleted')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">Reading history · {kri.code}</DialogTitle>
          <DialogDescription className="text-xs">
            {kri.name}. {thresholdText(kri)}
          </DialogDescription>
        </DialogHeader>
        {rows.length === 0 ? (
          <EmptyState title="No readings" compact />
        ) : (
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="text-right">Value</th>
                <th>Status when recorded</th>
                <th>Notes</th>
                {canDelete && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.uuid}>
                  <td className="whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="text-right tabular-nums">{formatValue(r.value, kri.unit)}</td>
                  <td>
                    <LightBadge light={r.light ?? kriLight(r.value, kri)} />
                  </td>
                  <td className="text-slate-600">{r.notes ?? '—'}</td>
                  {canDelete && (
                    <td className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-600 hover:bg-red-50"
                        onClick={() => remove(r.uuid, r.date)}
                        disabled={del.isPending}
                        aria-label={`Delete reading of ${formatDate(r.date)}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DialogContent>
    </Dialog>
  )
}
