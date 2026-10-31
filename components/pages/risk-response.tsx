'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Calendar, MoreVertical, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { oracleService } from '@/lib/oracleService'
import { cn } from '@/lib/utils'

const pipelineColumns = [
  { key: 'Planning', label: 'Planning' },
  { key: 'In Progress', label: 'In Progress' },
  { key: 'On Track', label: 'Operational' },
  { key: 'At Risk', label: 'At Risk' },
  { key: 'Completed', label: 'Completed' },
]

export function RiskResponsePage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')

  // 1. Data Fetching
  const { data: rawResponses = [], isLoading } = useQuery({
    queryKey: ['risk-responses'],
    queryFn: () => oracleService.getControlImplementations(),
  })

  // 2. Normalization
  const responseData = useMemo(() => {
    return rawResponses.map((d: any) => ({
      id: d.uuid || d.control_id || d.id || `RPL-${d.uuid || '101'}`,
      risk: d.control_name || d.name || d.title || d.control_type || d.control_category || 'General Risk Treatment',
      strategy: d.mitigation_type || d.control_clasification || d.strategy || 'Mitigate',
      action: d.control_description || d.description || d.action || 'No description provided',
      owner: d.control_owner || d.mitigation_owner || d.owner || 'Unassigned',
      status: d.is_stage_complted === 'Y' ? 'Completed' : (d.control_frequency || d.status || 'Planning'),
      dueDate: (d.target_date || d.estimated_end_date || d.end_date)?.split('T')[0] || '2026-12-31',
      completion: d.is_stage_complted === 'Y' ? 100 : parseInt(d.progress || d.weightage_value || '25')
    }))
  }, [rawResponses])

  const filtered = responseData.filter((item: any) =>
    item.risk.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(item.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.owner.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getColumnItems = (status: string) => filtered.filter((item: any) => item.status === status)

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
        <p className="text-xs">Loading response plans...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Risk Response & Treatment</h1>
          <p className="text-xs text-slate-500">Track and manage mitigation action stages</p>
        </div>
        <Button 
          size="sm" 
          onClick={() => router.push('/assessments/controls')}
          className="h-8 text-xs font-medium bg-blue-900 hover:bg-blue-800 text-white rounded"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add plan
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded border border-slate-200">
          <span className="text-[11px] text-slate-500 block">Total response plans</span>
          <span className="text-xl font-semibold text-slate-900 tabular-nums">{responseData.length}</span>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <span className="text-[11px] text-emerald-600 block">Completed</span>
          <span className="text-xl font-semibold text-slate-900 tabular-nums">{responseData.filter((r: any) => r.status === 'Completed').length}</span>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <span className="text-[11px] text-blue-600 block">In progress</span>
          <span className="text-xl font-semibold text-slate-900 tabular-nums">{responseData.filter((r: any) => r.status === 'In Progress' || r.status === 'On Track').length}</span>
        </div>
        <div className="p-3 bg-white rounded border border-slate-200">
          <span className="text-[11px] text-amber-600 block">At risk / pending</span>
          <span className="text-xl font-semibold text-slate-900 tabular-nums">{responseData.filter((r: any) => r.status === 'At Risk' || r.status === 'Planning').length}</span>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
          <Input 
            placeholder="Search plans..." 
            className="pl-8 h-8 text-xs bg-white" 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Pipeline Columns */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {pipelineColumns.map(col => {
          const items = getColumnItems(col.key)
          return (
            <div key={col.key} className="bg-slate-100 p-2.5 rounded border border-slate-200 flex flex-col gap-2 min-h-[400px]">
              <div className="flex items-center justify-between pb-1 text-xs font-semibold text-slate-700">
                <span>{col.label}</span>
                <span className="text-[11px] bg-white px-1.5 py-0.2 rounded border border-slate-200 font-mono text-slate-500">{items.length}</span>
              </div>

              <div className="space-y-2">
                {items.map((item: any) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white rounded border border-slate-200 shadow-xs hover:border-slate-300 transition-colors text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-mono">{item.id}</span>
                      <span className="text-slate-600">{item.strategy}</span>
                    </div>

                    <div className="font-medium text-slate-900 line-clamp-2">{item.risk}</div>

                    <div className="space-y-1 pt-1 border-t border-slate-100">
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Progress</span>
                        <span>{item.completion}%</span>
                      </div>
                      <div className="h-1 w-full bg-slate-100 rounded overflow-hidden">
                        <div className="h-full bg-blue-700 rounded" style={{ width: `${item.completion}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span className="truncate max-w-[100px]">{item.owner}</span>
                      <span>{item.dueDate}</span>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="py-8 text-center text-slate-400 text-xs italic">
                    Empty
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
