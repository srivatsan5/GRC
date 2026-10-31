'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { 
  Search, 
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { oracleService } from '@/lib/oracleService'

export function AppetiteframeworkPage() {
  const [globalFilter, setGlobalFilter] = useState('')

  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ['appetite-framework'],
    queryFn: () => oracleService.getAppetiteFramework(),
  })

  const data = Array.isArray(rawData) ? rawData : []

  const columnHelper = createColumnHelper<any>()
  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Risk Category',
      cell: info => <span className="font-medium text-slate-900">{info.getValue() || info.row.original.risk_category_name || 'Category'}</span>,
    }),
    columnHelper.accessor('description', {
      header: 'Appetite Statement / Scope',
      cell: info => <span className="text-slate-600">{info.getValue() || info.row.original.desc || 'Standard enterprise risk boundary'}</span>,
    }),
    columnHelper.accessor('status', {
      header: 'Tolerance Level',
      cell: () => <span className="font-semibold text-slate-700">Moderate</span>,
    }),
  ], [])

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
  })

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
        <p className="text-xs">Loading appetite framework...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Risk Appetite Framework</h1>
          <p className="text-xs text-slate-500">Tolerance thresholds and qualitative boundaries by category</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
            <Input 
              placeholder="Search categories..." 
              className="pl-8 h-8 text-xs bg-slate-50" 
              value={globalFilter}
              onChange={e => setGlobalFilter(e.target.value)}
            />
          </div>
        </div>

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
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-slate-400">
                  No appetite categories defined.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
