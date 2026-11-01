'use client'

/**
 * /kri — Key risk indicators as cards in the dashboard's breach-tile language: latest reading as a serif
 * figure, status pill with icon, direction-aware delta, and a trend over shaded threshold zones.
 * Breaches are the loud cards (critical wash + keyline). History opens in the detail sheet.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowDownRight, ArrowUpRight, ClipboardPlus, Download, History, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState, EmptyState } from '@/components/data-state'
import { CountUp, Facts, PageHeader, Person, SearchField, ViewTabs } from '@/components/charter/primitives'
import { useDeleteRow } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { DASH, formatDate, toDateInput } from '@/lib/format'
import { LIGHT_STYLES, kriLight, type KriDefinition, type KriLight } from '@/lib/kri'
import { exportCsv } from '@/components/controls/form-bits'
import { Checkbox } from '@/components/governance/form'
import { cn } from '@/lib/utils'
import { KriNav } from '@/components/kri/kri-nav'
import { KriDelta, KriTrendChart, LightPill, ThresholdStrip, fmt, zoneLabels, LIGHT_ICON, LIGHT_VAR } from '@/components/kri/kri-visuals'
import { DIRECTION_LABELS, KRI_READINGS, KriDefinitionDialog, RecordReadingDialog, useDeleteKri, useKriData, type KriWithReadings } from '@/components/kri/kri-shared'

type LightFilter = 'all' | KriLight | 'none'
const SEVERITY: Record<string, number> = { RED: 0, AMBER: 1, GREEN: 2, none: 3 }

/** Figure colour per light (text tokens that pass AA on the card/wash). */
const FIGURE_TONE: Record<KriLight, string> = { RED: 'text-risk-critical-text', AMBER: 'text-kri-amber-fg', GREEN: 'text-foreground' }

export function KriIntelligencePage() {
  const { hasPermission } = useAuth()
  const params = useSearchParams()
  const { data, queries, defsQ } = useKriData()
  const deleteKri = useDeleteKri()
  const [search, setSearch] = useState(() => params.get('q') ?? '')
  const [lightFilter, setLightFilter] = useState<LightFilter>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<KriDefinition | 'new' | null>(null)
  const [recording, setRecording] = useState<KriDefinition | null>(null)
  const [history, setHistory] = useState<number | null>(null)

  // The ⌘K palette links to /kri?q=…; follow it when the param changes while on the page.
  const q = params.get('q')
  useEffect(() => {
    if (q != null) setSearch(q)
  }, [q])

  const pool = useMemo(() => data.filter(d => showInactive || d.kri.active), [data, showInactive])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return pool
      .filter(d => {
        if (lightFilter === 'none' ? d.light != null : lightFilter !== 'all' && d.light !== lightFilter) return false
        if (term && ![d.kri.code, d.kri.name, d.kri.owner, d.kri.category].some(v => v?.toLowerCase().includes(term))) return false
        return true
      })
      .sort((a, b) => SEVERITY[a.light ?? 'none']! - SEVERITY[b.light ?? 'none']!)
  }, [pool, search, lightFilter])

  const totals = useMemo(() => {
    const active = data.filter(d => d.kri.active)
    return {
      total: active.length,
      green: active.filter(d => d.light === 'GREEN').length,
      amber: active.filter(d => d.light === 'AMBER').length,
      red: active.filter(d => d.light === 'RED').length,
      none: active.filter(d => d.light == null).length,
      readings: active.reduce((n, d) => n + d.readings.length, 0),
    }
  }, [data])

  const tabCounts = useMemo(
    () => ({
      all: pool.length,
      RED: pool.filter(d => d.light === 'RED').length,
      AMBER: pool.filter(d => d.light === 'AMBER').length,
      GREEN: pool.filter(d => d.light === 'GREEN').length,
      none: pool.filter(d => d.light == null).length,
    }),
    [pool],
  )

  const handleExport = () => {
    const rows = data.flatMap(d =>
      d.readings.map(r => [d.kri.code, d.kri.name, d.kri.unit, toDateInput(r.date), r.value, r.light ?? kriLight(r.value, d.kri) ?? '', r.breach ? 'Y' : 'N', r.notes]),
    )
    exportCsv('kri-readings.csv', ['KRI code', 'KRI name', 'Unit', 'Reading date', 'Value', 'Traffic light', 'Breach', 'Notes'], rows, 'KRI reading')
  }

  const readingCount = data.reduce((n, d) => n + d.readings.length, 0)
  const filtering = Boolean(search.trim()) || lightFilter !== 'all'
  const historyItem = useMemo(() => (history != null ? data.find(d => d.kri.uuid === history) ?? null : null), [history, data])
  const canRecord = hasPermission('create')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics · Key risk indicators"
        title="Key risk indicators"
        description="Each indicator’s latest recorded reading against its thresholds, with the trend behind it."
        actions={
          <>
            <Button variant="secondary" onClick={handleExport} disabled={readingCount === 0}>
              <Download aria-hidden="true" />
              Export readings
            </Button>
            {hasPermission('create') && (
              <Button onClick={() => setEditing('new')}>
                <Plus aria-hidden="true" />
                New indicator
              </Button>
            )}
          </>
        }
      />

      <KriNav />

      <DataState
        query={queries}
        empty={(defsQ.data?.length ?? 0) === 0}
        emptyTitle="No key risk indicators yet"
        emptyDescription="Define an indicator with its amber and red thresholds, then record readings to track it against appetite."
        emptyAction={
          hasPermission('create') ? (
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden="true" />
              Define the first indicator
            </Button>
          ) : undefined
        }
      >
        <section aria-label="Indicator summary" className="surface-panel grid grid-cols-2 overflow-hidden lg:grid-cols-4">
          <SummaryCell label="Active indicators" value={totals.total} context={`${totals.readings} reading${totals.readings === 1 ? '' : 's'} recorded`} />
          <SummaryCell
            label="Breach"
            light="RED"
            value={totals.red}
            tone={totals.red > 0 ? 'text-risk-critical-text' : undefined}
            context={totals.red > 0 ? 'Latest reading past the red threshold' : 'No indicator in breach'}
            onClick={totals.red > 0 ? () => setLightFilter('RED') : undefined}
          />
          <SummaryCell
            label="Warning"
            light="AMBER"
            value={totals.amber}
            tone={totals.amber > 0 ? 'text-kri-amber-fg' : undefined}
            context={totals.amber > 0 ? 'Between amber and red' : 'None between amber and red'}
            onClick={totals.amber > 0 ? () => setLightFilter('AMBER') : undefined}
          />
          <SummaryCell
            label="Within appetite"
            light="GREEN"
            value={totals.green}
            context={totals.none > 0 ? `${totals.none} without a reading yet` : `${totals.green} of ${totals.total} indicators`}
          />
        </section>

        <div className="space-y-4">
          <ViewTabs<LightFilter>
            label="Filter by status"
            value={lightFilter}
            onChange={setLightFilter}
            views={[
              { value: 'all', label: 'All', count: tabCounts.all },
              { value: 'RED', label: 'Breach', count: tabCounts.RED },
              { value: 'AMBER', label: 'Warning', count: tabCounts.AMBER },
              { value: 'GREEN', label: 'Within appetite', count: tabCounts.GREEN },
              { value: 'none', label: 'No reading', count: tabCounts.none },
            ]}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <SearchField value={search} onChange={setSearch} label="Search indicators" placeholder="Code, name, owner, category…" />
            <Checkbox id="kri-show-inactive" label="Show inactive" checked={showInactive} onChange={setShowInactive} />
            <span className="text-caption text-muted-foreground sm:ml-auto">
              {visible.length} of {pool.length} shown{lightFilter === 'all' ? ' · breaches first' : ''}
            </span>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="surface-panel">
            <EmptyState
              title={filtering ? 'No indicators match' : 'No active indicators'}
              description={filtering ? 'Try another status or clear the search.' : 'Every indicator is inactive. Show inactive ones to review them.'}
              action={
                filtering ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch('')
                      setLightFilter('all')
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
              compact
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {visible.map(d => (
              <KriCard
                key={d.kri.uuid}
                item={d}
                canRecord={canRecord}
                canEdit={hasPermission('update')}
                canDelete={hasPermission('delete')}
                deleting={deleteKri.pending}
                onRecord={() => setRecording(d.kri)}
                onHistory={() => setHistory(d.kri.uuid)}
                onEdit={() => setEditing(d.kri)}
                onDelete={() => deleteKri.run(d.kri)}
              />
            ))}
          </div>
        )}
      </DataState>

      {editing && <KriDefinitionDialog initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {recording && <RecordReadingDialog kri={recording} onClose={() => setRecording(null)} />}
      <HistorySheet
        item={historyItem}
        canDelete={hasPermission('delete')}
        canRecord={canRecord}
        canEdit={hasPermission('update')}
        onRecord={kri => setRecording(kri)}
        onEdit={kri => setEditing(kri)}
        onClose={() => setHistory(null)}
      />
    </div>
  )
}

function SummaryCell({
  label,
  value,
  context,
  light,
  tone,
  onClick,
}: {
  label: string
  value: number
  context: string
  light?: KriLight
  tone?: string
  onClick?: () => void
}) {
  const Icon = light ? LIGHT_ICON[light] : null
  const body = (
    <>
      <p className="label-caps flex items-center gap-1.5">
        {Icon && <Icon className={cn('size-3.5', LIGHT_STYLES[light!].text)} aria-hidden="true" />}
        {label}
      </p>
      <p className={cn('figure text-figure text-foreground', tone)}>
        <CountUp value={value} />
      </p>
      <p className="text-body-sm text-muted-foreground">{context}</p>
    </>
  )
  const cls = 'flex min-w-0 flex-col gap-2 border-border px-6 py-5 [&:nth-child(n+3)]:border-t lg:[&:nth-child(n+3)]:border-t-0 [&:nth-child(even)]:border-l lg:[&:not(:first-child)]:border-l'
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cn(cls, 'text-left transition-colors duration-(--duration-fast) ease-out hover:bg-hover focus-ring')}>
        {body}
      </button>
    )
  return <div className={cls}>{body}</div>
}

function Meta({ kri }: { kri: KriDefinition }) {
  const DirIcon = kri.direction === 'HIGHER_WORSE' ? ArrowUpRight : ArrowDownRight
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
      <span>{kri.owner ?? 'No owner'}</span>
      <span aria-hidden="true">·</span>
      <span>{kri.frequency ?? 'Frequency not set'}</span>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1">
        <DirIcon className="size-3.5" aria-hidden="true" />
        {DIRECTION_LABELS[kri.direction]}
      </span>
    </p>
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
  const { kri, readings, latest, previous, light } = item
  const breach = light === 'RED'
  const warn = light === 'AMBER'
  const labels = zoneLabels(kri)
  const zoneOrder: KriLight[] = kri.direction === 'HIGHER_WORSE' ? ['GREEN', 'AMBER', 'RED'] : ['RED', 'AMBER', 'GREEN']

  return (
    <article
      aria-labelledby={`kri-${kri.uuid}-name`}
      className={cn(
        'flex min-w-0 flex-col gap-4 rounded-lg p-5 sm:p-6',
        breach
          ? 'bg-risk-critical-bg shadow-[inset_0_0_0_1px_var(--risk-critical-text)]'
          : warn
            ? 'bg-card shadow-[inset_0_0_0_1px_var(--kri-amber),var(--elevation-panel)]'
            : 'surface-panel',
        !kri.active && 'opacity-80',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <LightPill light={light} solid />
          <span className="font-mono text-caption text-muted-foreground">{kri.code}</span>
          {kri.category && <span className="text-caption text-muted-foreground">· {kri.category}</span>}
          {!kri.active && <span className="rounded-xs bg-muted px-1.5 text-caption text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]">Inactive</span>}
        </div>
        {(canEdit || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mt-1.5 -mr-2 size-8" aria-label={`More actions for ${kri.code}`}>
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil aria-hidden="true" /> Edit indicator
                </DropdownMenuItem>
              )}
              {canEdit && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem variant="destructive" disabled={deleting} onSelect={onDelete}>
                  <Trash2 aria-hidden="true" /> Delete indicator
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1">
        <div className="min-w-0 space-y-1">
          <h2 id={`kri-${kri.uuid}-name`} className="font-display text-section text-foreground">
            {kri.name}
          </h2>
          <Meta kri={kri} />
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <p className={cn('figure text-figure leading-none', light ? FIGURE_TONE[light] : 'text-muted-foreground')}>
            {latest ? fmt(latest.value) : DASH}
            {latest && kri.unit && <span className="ml-1 font-sans text-caption text-muted-foreground">{kri.unit}</span>}
          </p>
          <KriDelta kri={kri} latest={latest} previous={previous} />
        </div>
      </div>

      {readings.length > 0 ? (
        <div className={cn(breach && '-mx-1 rounded-md bg-card px-1 pt-1')}>
          <KriTrendChart kri={kri} readings={readings} />
        </div>
      ) : (
        <div className="flex h-[132px] flex-col items-center justify-center gap-1 rounded-md bg-surface-sunken text-center shadow-[inset_0_0_0_1px_var(--border)]">
          <p className="text-body-sm text-foreground-secondary">No readings recorded yet</p>
          <p className="text-caption text-muted-foreground">The trend appears after the first reading.</p>
        </div>
      )}

      {labels.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-foreground-secondary tabular-nums" aria-label="Thresholds">
          {labels.map((l, i) => (
            <li key={l} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-xs" style={{ background: LIGHT_VAR[zoneOrder[i]!].solid }} />
              {l}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-caption text-muted-foreground">Thresholds not set</p>
      )}

      <div className={cn('mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4', breach && 'border-risk-critical-border')}>
        <span className="text-caption text-muted-foreground tabular-nums">
          {latest ? `Read ${formatDate(latest.date)}` : 'Never read'} · {readings.length} reading{readings.length === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="h-8 px-3" onClick={onHistory} aria-label={`History of ${kri.code}`}>
            <History aria-hidden="true" />
            History
          </Button>
          {canRecord && (
            <Button variant={breach ? 'primary' : 'secondary'} className="h-8 px-3" onClick={onRecord} aria-label={`Record a reading for ${kri.code}`}>
              <ClipboardPlus aria-hidden="true" />
              Record reading
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

function HistorySheet({
  item,
  canDelete,
  canRecord,
  canEdit,
  onRecord,
  onEdit,
  onClose,
}: {
  item: KriWithReadings | null
  canDelete: boolean
  canRecord: boolean
  canEdit: boolean
  onRecord: (kri: KriDefinition) => void
  onEdit: (kri: KriDefinition) => void
  onClose: () => void
}) {
  const confirm = useConfirm()
  const del = useDeleteRow(KRI_READINGS)

  const remove = async (kri: KriDefinition, uuid: number, date: string) => {
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
    <Sheet open={item != null} onOpenChange={o => !o && onClose()}>
      <SheetContent aria-describedby={item ? `kri-sheet-${item.kri.uuid}-desc` : undefined}>
        {item && <HistoryBody item={item} canDelete={canDelete} busy={del.isPending} onDelete={(uuid, date) => remove(item.kri, uuid, date)} />}
        {item && (canEdit || canRecord) && (
          <SheetFooter className="justify-between">
            <span className="hidden text-caption text-muted-foreground sm:inline">Changes are logged to the audit trail</span>
            <div className="ml-auto flex gap-2">
              {canEdit && (
                <Button variant="secondary" onClick={() => onEdit(item.kri)}>
                  <Pencil aria-hidden="true" />
                  Edit
                </Button>
              )}
              {canRecord && (
                <Button onClick={() => onRecord(item.kri)}>
                  <ClipboardPlus aria-hidden="true" />
                  Record reading
                </Button>
              )}
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}

function HistoryBody({ item, canDelete, busy, onDelete }: { item: KriWithReadings; canDelete: boolean; busy: boolean; onDelete: (uuid: number, date: string) => void }) {
  const { kri, readings, latest, previous, light } = item
  const rows = [...readings].reverse()
  return (
    <>
      <SheetHeader className="gap-3 border-b pr-14">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-caption text-muted-foreground">{kri.code}</span>
          <LightPill light={light} solid />
        </div>
        <SheetTitle className="text-title leading-tight">{kri.name}</SheetTitle>
        <SheetDescription id={`kri-sheet-${kri.uuid}-desc`}>{kri.description ?? 'Reading history and thresholds for this indicator.'}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <Facts
            items={[
              { label: 'Owner', value: <Person name={kri.owner} /> },
              { label: 'Category', value: kri.category ?? DASH },
              { label: 'Frequency', value: kri.frequency ?? DASH },
              { label: 'Direction', value: DIRECTION_LABELS[kri.direction] },
            ]}
          />
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="label-caps">Latest</span>
            <p className={cn('figure text-figure leading-none', light ? FIGURE_TONE[light] : 'text-muted-foreground')}>
              {latest ? fmt(latest.value) : DASH}
              {latest && kri.unit && <span className="ml-1 font-sans text-caption text-muted-foreground">{kri.unit}</span>}
            </p>
            <KriDelta kri={kri} latest={latest} previous={previous} />
          </div>
        </div>

        <ThresholdStrip kri={kri} value={latest?.value} />

        {readings.length > 0 && (
          <section aria-labelledby={`kri-sheet-${kri.uuid}-trend`} className="space-y-2">
            <h3 id={`kri-sheet-${kri.uuid}-trend`} className="font-display text-section text-foreground">
              Trend
            </h3>
            <KriTrendChart kri={kri} readings={readings} height={200} />
          </section>
        )}

        <section aria-labelledby={`kri-sheet-${kri.uuid}-hist`} className="space-y-3">
          <h3 id={`kri-sheet-${kri.uuid}-hist`} className="flex items-baseline justify-between font-display text-section text-foreground">
            Readings
            <span className="font-sans text-caption text-muted-foreground">{rows.length} recorded</span>
          </h3>
          {rows.length === 0 ? (
            <EmptyState title="No readings yet" description="Record the first reading to start the history." compact />
          ) : (
            <div className="relative -mx-6 overflow-x-auto border-y">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th className="pl-6">Date</th>
                    <th data-numeric className="text-right">
                      Value
                    </th>
                    <th data-numeric className="text-right">
                      Change
                    </th>
                    <th>Status</th>
                    <th>Notes</th>
                    {canDelete && (
                      <th className="pr-6 text-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const prev = rows[i + 1]
                    const delta = prev ? r.value - prev.value : null
                    const worse = delta != null && (kri.direction === 'HIGHER_WORSE' ? delta > 0 : delta < 0)
                    return (
                      <tr key={r.uuid}>
                        <td className="pl-6 whitespace-nowrap tabular-nums">{formatDate(r.date)}</td>
                        <td data-numeric className="text-right font-medium tabular-nums">
                          {fmt(r.value)}
                        </td>
                        <td data-numeric className={cn('text-right tabular-nums', delta == null || delta === 0 ? 'text-muted-foreground' : worse ? 'text-status-danger-fg' : 'text-status-success-fg')}>
                          {delta == null ? DASH : delta === 0 ? '0' : `${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))}`}
                        </td>
                        <td>
                          <LightPill light={r.light ?? kriLight(r.value, kri)} />
                        </td>
                        <td className="max-w-[180px] truncate text-foreground-secondary" title={r.notes ?? undefined}>
                          {r.notes ?? DASH}
                        </td>
                        {canDelete && (
                          <td className="pr-6 text-right">
                            <Button variant="ghost" size="icon" className="size-8 text-status-danger-fg" onClick={() => onDelete(r.uuid, r.date)} disabled={busy} aria-label={`Delete reading of ${formatDate(r.date)}`}>
                              <Trash2 aria-hidden="true" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-caption text-muted-foreground">Status shows the light recorded with each reading; change is against the reading before it.</p>
        </section>
      </div>
    </>
  )
}
