'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Check,
  CircleCheck,
  Download,
  Eye,
  KeyRound,
  LogIn,
  LogOut,
  OctagonAlert,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Chip, CountUp, FilterChip, PageHeader, Panel, Person, SearchField } from '@/components/charter/primitives'
import { ExportCsvButton, Headline, HeadlineCell, Toolbar } from '@/components/controls/charter-bits'
import { ErrorState, EmptyState, LoadingState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { auditApi, apiErrorMessage, type ApiAuditEntry as AuditEntry } from '@/lib/apiClient'
import { recordAudit } from '@/lib/auditLog'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
const ACTIONS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: Tone }> = {
  CREATE: { label: 'Create', icon: Plus, tone: 'neutral' },
  UPDATE: { label: 'Update', icon: Pencil, tone: 'neutral' },
  DELETE: { label: 'Delete', icon: Trash2, tone: 'warning' },
  APPROVE: { label: 'Approve', icon: Check, tone: 'info' },
  REJECT: { label: 'Reject', icon: X, tone: 'info' },
  LOGIN: { label: 'Sign in', icon: LogIn, tone: 'neutral' },
  LOGIN_FAILED: { label: 'Failed sign-in', icon: OctagonAlert, tone: 'danger' },
  LOGOUT: { label: 'Sign out', icon: LogOut, tone: 'neutral' },
  EXPORT: { label: 'Export', icon: Download, tone: 'neutral' },
  VIEW: { label: 'View', icon: Eye, tone: 'neutral' },
  SETTINGS_CHANGE: { label: 'Settings', icon: Settings2, tone: 'info' },
  ROLE_CHANGE: { label: 'Role change', icon: UserCog, tone: 'info' },
  USER_CREATE: { label: 'User created', icon: UserPlus, tone: 'info' },
  USER_UPDATE: { label: 'User updated', icon: UserCog, tone: 'info' },
  PASSWORD_CHANGE: { label: 'Password', icon: KeyRound, tone: 'info' },
}
const actionMeta = (a: string) => ACTIONS[a] ?? { label: a.replace(/_/g, ' ').toLowerCase(), icon: Activity, tone: 'neutral' as Tone }

const CHANGE_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'SETTINGS_CHANGE', 'ROLE_CHANGE', 'USER_CREATE', 'USER_UPDATE', 'APPROVE', 'REJECT']
const timeFmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function AuditTrailPage() {
  const [globalFilter, setGlobalFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'timestamp', desc: true }])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 })
  // The server-side, hash-chained audit log (newest first).
  const auditQuery = useQuery({ queryKey: ['audit', 'list'], queryFn: () => auditApi.list({ limit: 1000 }), staleTime: 15_000 })
  const chainQuery = useQuery({ queryKey: ['audit', 'verify'], queryFn: auditApi.verify, staleTime: 60_000 })
  const entries: AuditEntry[] = useMemo(() => auditQuery.data?.items ?? [], [auditQuery.data])

  const filtered = useMemo(() => {
    // Date pickers are in local time; compare against local-midnight boundaries.
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : -Infinity
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Infinity
    return entries.filter(e => {
      const t = new Date(e.timestamp).getTime()
      if (t < from || t > to) return false
      if (actionFilter && e.action !== actionFilter) return false
      if (resultFilter && e.result !== resultFilter) return false
      return true
    })
  }, [entries, dateFrom, dateTo, actionFilter, resultFilter])

  const stats = useMemo(() => {
    const times = entries.map(e => new Date(e.timestamp).getTime()).filter(Number.isFinite)
    return {
      total: entries.length,
      changes: entries.filter(e => CHANGE_ACTIONS.includes(e.action)).length,
      created: entries.filter(e => e.action === 'CREATE').length,
      updated: entries.filter(e => e.action === 'UPDATE').length,
      deleted: entries.filter(e => e.action === 'DELETE').length,
      signIns: entries.filter(e => e.action === 'LOGIN').length,
      failedSignIns: entries.filter(e => e.action === 'LOGIN_FAILED').length,
      failures: entries.filter(e => e.result !== 'SUCCESS').length,
      actors: new Set(entries.map(e => e.actor_id)).size,
      oldest: times.length ? new Date(Math.min(...times)).toISOString() : null,
    }
  }, [entries])

  const actionOptions = useMemo(
    () => Array.from(new Set(entries.map(e => e.action))).sort().map(a => ({ value: a, label: actionMeta(a).label })),
    [entries],
  )

  const exportCSV = () => {
    const headers = ['Seq', 'ID', 'Timestamp', 'Actor ID', 'Actor Name', 'Actor Email', 'Role', 'Action', 'Entity', 'Entity ID', 'Description', 'Result', 'Source', 'Hash']
    // Quote every field and neutralise spreadsheet formulas (=, +, -, @) so the export is safe to open in Excel.
    const cell = (v: unknown) => {
      let t = v == null ? '' : String(v)
      if (/^[=+\-@\t\r]/.test(t) && !/^[+-]?\d+(\.\d+)?$/.test(t)) t = `'${t}`
      return `"${t.replace(/"/g, '""')}"`
    }
    const rows = table.getFilteredRowModel().rows.map(r => r.original).map(e =>
      [e.seq, e.id, e.timestamp, e.actor_id, e.actor_name, e.actor_email, e.actor_role, e.action, e.entity, e.entity_id, e.description, e.result, e.source, e.hash].map(cell),
    )
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pericope_audit_log_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${rows.length} audit entries to CSV`)
    recordAudit({ action: 'EXPORT', entity: 'Audit Trail', description: `Exported ${rows.length} audit entries to CSV`, result: 'SUCCESS' })
  }

  const columnHelper = createColumnHelper<AuditEntry>()

  const columns = useMemo(
    () => [
      columnHelper.accessor('timestamp', {
        header: 'Time',
        sortingFn: (a, b) => new Date(a.original.timestamp).getTime() - new Date(b.original.timestamp).getTime(),
        cell: info => {
          const d = new Date(info.getValue())
          return (
            <div className="py-1 whitespace-nowrap tabular-nums">
              <div className="text-foreground">{formatDate(info.getValue())}</div>
              <div className="text-caption text-muted-foreground">{timeFmt(d)}</div>
            </div>
          )
        },
      }),
      columnHelper.accessor('actor_name', {
        header: 'Actor',
        cell: info => <Person name={info.getValue() || info.row.original.actor_email || null} detail={info.row.original.actor_role} emptyLabel="System" className="max-w-[180px]" />,
      }),
      columnHelper.accessor('action', {
        header: 'Action',
        cell: info => {
          const m = actionMeta(info.getValue())
          return (
            <Chip tone={m.tone} icon={m.icon}>
              {m.label}
            </Chip>
          )
        },
      }),
      columnHelper.accessor('entity', {
        header: 'Entity',
        cell: info => (
          <div className="max-w-[180px] py-1">
            <div className="truncate text-foreground" title={info.getValue()}>
              {info.getValue()}
            </div>
            {info.row.original.entity_id && <div className="truncate font-mono text-caption text-muted-foreground">#{info.row.original.entity_id}</div>}
          </div>
        ),
      }),
      columnHelper.accessor('description', {
        header: 'Description',
        cell: info => (
          <span className="line-clamp-2 max-w-[360px] text-foreground-secondary" title={info.getValue()}>
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('result', {
        header: 'Result',
        cell: info =>
          info.getValue() === 'SUCCESS' ? (
            <Chip tone="success" icon={CircleCheck}>
              Success
            </Chip>
          ) : (
            <Chip tone="danger" icon={OctagonAlert}>
              Failed
            </Chip>
          ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: { globalFilter, sorting, pagination },
    onGlobalFilterChange: v => {
      setGlobalFilter(v)
      setPagination(p => ({ ...p, pageIndex: 0 }))
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
  })

  const shownTotal = table.getFilteredRowModel().rows.length
  const anyFilter = !!(globalFilter || dateFrom || dateTo || actionFilter || resultFilter)
  const resetPage = () => setPagination(p => ({ ...p, pageIndex: 0 }))
  const loading = auditQuery.isLoading

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Audit trail"
        description="The server-recorded, tamper-evident history of every sign-in and data change. Each entry is hash-chained to the one before it."
        actions={<ExportCsvButton onClick={exportCSV} disabled={loading || shownTotal === 0} />}
      />
      <div className="-mt-2">
        <IntegritySeal query={chainQuery} />
      </div>

      {!auditQuery.isError && (
        <Headline label="Audit figures">
          <HeadlineCell
            label="Entries loaded"
            loading={loading}
            value={<CountUp value={stats.total} />}
            context={stats.oldest ? `Since ${formatDate(stats.oldest)} · ${stats.actors} actor${stats.actors === 1 ? '' : 's'}` : 'No entries yet'}
          />
          <HeadlineCell label="Data changes" loading={loading} value={<CountUp value={stats.changes} />} context={`${stats.created} created · ${stats.updated} updated · ${stats.deleted} deleted`} />
          <HeadlineCell
            label="Sign-ins"
            loading={loading}
            value={<CountUp value={stats.signIns} />}
            context={stats.failedSignIns ? `${stats.failedSignIns} failed attempt${stats.failedSignIns === 1 ? '' : 's'}` : 'No failed attempts'}
          />
          <HeadlineCell
            label="Failed actions"
            loading={loading}
            value={<CountUp value={stats.failures} />}
            tone={stats.failures > 0 ? 'text-status-danger-fg' : undefined}
            context={stats.failures ? 'Rejected by the server or denied' : 'Every recorded action succeeded'}
          />
        </Headline>
      )}

      <Toolbar>
        <SearchField label="Search the audit trail" placeholder="Actor, entity, description…" value={globalFilter} onChange={v => table.setGlobalFilter(v)} />
        <FilterChip
          label="Action"
          value={actionFilter}
          onChange={v => {
            setActionFilter(v)
            resetPage()
          }}
          options={actionOptions}
        />
        <FilterChip
          label="Result"
          value={resultFilter}
          onChange={v => {
            setResultFilter(v)
            resetPage()
          }}
          options={[
            { value: 'SUCCESS', label: 'Success' },
            { value: 'FAILURE', label: 'Failed' },
          ]}
        />
        <div className="flex items-center gap-2">
          <label htmlFor="audit-from" className="text-body-sm text-muted-foreground">
            From
          </label>
          <Input
            id="audit-from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={e => {
              setDateFrom(e.target.value)
              resetPage()
            }}
            className="w-[150px]"
          />
          <label htmlFor="audit-to" className="text-body-sm text-muted-foreground">
            to
          </label>
          <Input
            id="audit-to"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={e => {
              setDateTo(e.target.value)
              resetPage()
            }}
            className="w-[150px]"
          />
        </div>
        {anyFilter && (
          <Button
            variant="ghost"
            onClick={() => {
              table.setGlobalFilter('')
              setDateFrom('')
              setDateTo('')
              setActionFilter('')
              setResultFilter('')
              resetPage()
            }}
          >
            Clear
          </Button>
        )}
      </Toolbar>

      <Panel bodyClassName="p-0" className="overflow-hidden">
        {auditQuery.isError ? (
          <ErrorState error={new Error(apiErrorMessage(auditQuery.error, 'Could not load the audit trail'))} onRetry={() => auditQuery.refetch()} />
        ) : loading ? (
          <div className="px-6">
            <LoadingState label="Loading audit records…" />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState title="No audit entries yet" description="Sign-ins and data changes appear here as soon as they happen." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="enterprise-table min-w-[1000px]">
                <thead>
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header, i) => {
                        const sorted = header.column.getIsSorted()
                        const isTime = header.column.id === 'timestamp'
                        return (
                          <th key={header.id} scope="col" className={cn(i === 0 && 'pl-6', i === headerGroup.headers.length - 1 && 'pr-6')} aria-sort={isTime ? (sorted === 'asc' ? 'ascending' : 'descending') : undefined}>
                            {isTime ? (
                              <button type="button" onClick={header.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 rounded-xs uppercase focus-ring hover:text-foreground">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {sorted === 'asc' ? <ArrowUp className="size-3.5" aria-hidden="true" /> : <ArrowDown className="size-3.5" aria-hidden="true" />}
                                <span className="sr-only">{sorted === 'asc' ? 'oldest first' : 'newest first'}, change order</span>
                              </button>
                            ) : (
                              flexRender(header.column.columnDef.header, header.getContext())
                            )}
                          </th>
                        )
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map(row => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell, i, all) => (
                        <td key={cell.id} className={cn(i === 0 && 'pl-6', i === all.length - 1 && 'pr-6')}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shownTotal === 0 ? (
              <EmptyState title="No entries match these filters" description="Try a different search, action or date range." compact />
            ) : (
              <Pager
                page={pagination.pageIndex + 1}
                pageSize={pagination.pageSize}
                total={shownTotal}
                onPage={p => setPagination(s => ({ ...s, pageIndex: p - 1 }))}
                onPageSize={n => setPagination({ pageIndex: 0, pageSize: n })}
              />
            )}
          </>
        )}
      </Panel>
    </div>
  )
}

/**
 * The hash-chain integrity seal: "Integrity verified · N entries · checked 14:05" (success, shield-check),
 * or a loud danger seal naming the broken entry. Re-verify re-runs the server check.
 */
function IntegritySeal({ query }: { query: { data?: { valid: boolean; entries: number; brokenAt?: number; reason?: string }; isLoading: boolean; isError: boolean; isFetching: boolean; dataUpdatedAt: number; error: unknown; refetch: () => unknown } }) {
  const reverify = (
    <button
      type="button"
      onClick={() => query.refetch()}
      disabled={query.isFetching}
      aria-label="Verify the hash chain again"
      title="Verify again"
      className="inline-flex size-7 items-center justify-center rounded-full text-current opacity-80 transition-opacity hover:bg-card/60 hover:opacity-100 focus-ring disabled:opacity-50"
    >
      <RefreshCw className={cn('size-3.5', query.isFetching && 'animate-spin')} aria-hidden="true" />
    </button>
  )
  if (query.isLoading) {
    return (
      <span role="status" className="inline-flex h-control items-center gap-2 rounded-full bg-surface-sunken px-3.5 text-body-sm text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]">
        <ShieldCheck className="size-4" aria-hidden="true" />
        Verifying hash chain…
      </span>
    )
  }
  if (query.isError || !query.data) {
    return (
      <span className="inline-flex h-control items-center gap-2 rounded-full bg-surface-sunken pr-1.5 pl-3.5 text-body-sm text-foreground-secondary shadow-[inset_0_0_0_1px_var(--border-strong)]" title={apiErrorMessage(query.error)}>
        <ShieldAlert className="size-4" aria-hidden="true" />
        Integrity not checked
        {reverify}
      </span>
    )
  }
  const checked = query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : null
  if (query.data.valid) {
    return (
      <span
        role="status"
        className="inline-flex h-control items-center gap-2.5 rounded-full bg-status-success-bg pr-1.5 pl-1.5 text-body-sm text-status-success-fg shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--status-success-fg)_28%,transparent)]"
      >
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-card/70 shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--status-success-fg)_24%,transparent)]">
          <ShieldCheck className="size-4" aria-hidden="true" />
        </span>
        <span className="whitespace-nowrap">
          <span className="font-semibold">Integrity verified</span>
          <span className="opacity-80">
            {' '}
            · <span className="tabular-nums">{query.data.entries.toLocaleString()}</span> entries{checked && ` · ${checked}`}
          </span>
        </span>
        {reverify}
      </span>
    )
  }
  return (
    <span role="alert" className="inline-flex min-h-(--control-height) items-center gap-2.5 rounded-full bg-status-danger-bg py-1 pr-1.5 pl-1.5 text-body-sm text-status-danger-fg shadow-[inset_0_0_0_1px_var(--status-danger-fg)]">
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-status-danger-fg text-status-danger-bg">
        <ShieldAlert className="size-4" aria-hidden="true" />
      </span>
      <span>
        <span className="font-semibold">Integrity check failed</span>
        <span className="opacity-90">
          {' '}
          at entry <span className="font-mono">{query.data.brokenAt}</span>
          {query.data.reason && ` · ${query.data.reason}`}
        </span>
      </span>
      {reverify}
    </span>
  )
}
