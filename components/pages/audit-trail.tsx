'use client'

import React, { useMemo, useState, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table'
import {
  Search,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { listAudit, AuditEntry } from '@/lib/auditLog'
import { useToast } from '@/hooks/use-toast'

export function AuditTrailPage() {
  const { toast } = useToast()
  const [globalFilter, setGlobalFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'timestamp', desc: true }])
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setEntries(listAudit())
    setLoading(false)
    const handler = () => setEntries(listAudit())
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const filteredByDate = useMemo(() => {
    return entries.filter(e => {
      if (dateFrom && e.timestamp < dateFrom) return false
      if (dateTo && e.timestamp > dateTo + 'T23:59:59') return false
      return true
    })
  }, [entries, dateFrom, dateTo])

  const stats = useMemo(() => ({
    total: entries.length,
    create: entries.filter(e => e.action === 'CREATE').length,
    update: entries.filter(e => e.action === 'UPDATE' || e.action === 'SETTINGS_CHANGE' || e.action === 'ROLE_CHANGE').length,
    delete: entries.filter(e => e.action === 'DELETE').length,
  }), [entries])

  const exportCSV = () => {
    const headers = ['ID', 'Timestamp', 'Actor ID', 'Actor Name', 'Role', 'Action', 'Entity', 'Entity ID', 'Description', 'Result', 'Source']
    const rows = filteredByDate.map(e => [
      e.id,
      e.timestamp,
      e.actor_id,
      `"${e.actor_name}"`,
      e.actor_role,
      e.action,
      `"${e.entity}"`,
      e.entity_id || '',
      `"${(e.description || '').replace(/"/g, '""')}"`,
      e.result,
      e.source,
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pericope_audit_log_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Audit log exported to CSV' })
  }

  const columnHelper = createColumnHelper<AuditEntry>()

  const columns = useMemo(() => [
    columnHelper.accessor('timestamp', {
      header: 'Timestamp',
      cell: info => {
        const d = new Date(info.getValue())
        return (
          <div className="font-mono text-xs text-slate-600">
            <span>{d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        )
      },
    }),
    columnHelper.accessor('action', {
      header: 'Action',
      cell: info => {
        const val = info.getValue()
        return (
          <span className="font-mono text-xs font-semibold text-slate-700">
            {val.replace('_', ' ')}
          </span>
        )
      },
    }),
    columnHelper.accessor('actor_name', {
      header: 'User',
      cell: info => (
        <div>
          <span className="font-medium text-slate-900 block">{info.getValue()}</span>
          <span className="text-[11px] text-slate-400">{info.row.original.actor_role}</span>
        </div>
      ),
    }),
    columnHelper.accessor('entity', {
      header: 'Entity / Target',
      cell: info => (
        <div>
          <span className="text-slate-800">{info.getValue()}</span>
          {info.row.original.entity_id && (
            <span className="text-[11px] text-slate-400 font-mono ml-1">#{info.row.original.entity_id}</span>
          )}
        </div>
      ),
    }),
    columnHelper.accessor('description', {
      header: 'Event summary',
      cell: info => <span className="text-slate-600 line-clamp-1">{info.getValue()}</span>,
    }),
    columnHelper.accessor('result', {
      header: 'Result',
      cell: info => (
        <span className={cn(
          'text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded border',
          info.getValue() === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
        )}>
          {info.getValue()}
        </span>
      ),
    }),
  ], [])

  const table = useReactTable({
    data: filteredByDate,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  })

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
        <p className="text-xs">Loading audit records...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Audit Trail</h1>
          <p className="text-xs text-slate-500">Immutable chronological record of all system events and data changes</p>
        </div>
        <Button onClick={exportCSV} variant="outline" size="sm">
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Total logged events</div>
          <div className="text-xl font-semibold text-slate-900 mt-0.5 tabular-nums">{stats.total}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Create operations</div>
          <div className="text-xl font-semibold text-blue-700 mt-0.5 tabular-nums">{stats.create}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Update / Modifications</div>
          <div className="text-xl font-semibold text-amber-700 mt-0.5 tabular-nums">{stats.update}</div>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <div className="text-xs text-slate-500">Delete operations</div>
          <div className="text-xl font-semibold text-slate-900 mt-0.5 tabular-nums">{stats.delete}</div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch justify-between">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="Search audit trail..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="pl-8 h-8 text-xs bg-white"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Date from:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="h-8 px-2 border border-slate-200 rounded text-xs bg-white"
          />
          <span className="text-slate-500">To:</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="h-8 px-2 border border-slate-200 rounded text-xs bg-white"
          />
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo('') }} className="h-8 text-xs">
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <table className="enterprise-table">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No audit events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())} &middot; {filteredByDate.length} entries
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-7 px-2"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-7 px-2"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
