'use client'

/**
 * /kri/configuration — a focused thresholds editor for KRI definitions.
 * Full definition editing (names, owners, descriptions) lives on /kri.
 */
import React, { useState } from 'react'
import Link from 'next/link'
import { Save, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState } from '@/components/data-state'
import { useUpdateRow } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { kriLight, type KriDirection } from '@/lib/kri'
import { selectClass } from '@/components/controls/form-bits'
import { DIRECTION_LABELS, KRI_DEFS, LightBadge, formatValue, useKriData, validateThresholds, type KriWithReadings } from '@/components/kri/kri-shared'

export function KriconfigurationPage() {
  const { hasPermission } = useAuth()
  const { data, queries, defsQ } = useKriData()
  const canEdit = hasPermission('update')

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-500" aria-hidden="true" />
            KRI threshold configuration
          </h1>
          <p className="text-xs text-slate-500">
            Set the direction and the green / amber / red thresholds of each indicator. To add indicators or change their details, use{' '}
            <Link href="/kri" className="text-blue-700 hover:underline">
              Key Risk Indicators
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <DataState
          query={queries}
          empty={(defsQ.data?.length ?? 0) === 0}
          emptyTitle="No KRI definitions yet"
          emptyDescription="Create indicators on the Key Risk Indicators page first."
          emptyAction={
            <Button asChild size="sm" variant="outline">
              <Link href="/kri">Go to Key Risk Indicators</Link>
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Indicator</th>
                  <th>Direction</th>
                  <th>Green (target)</th>
                  <th>Amber</th>
                  <th>Red</th>
                  <th>Latest reading</th>
                  <th>Status with these thresholds</th>
                  {canEdit && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data.map(d => (
                  <ThresholdRow key={d.kri.uuid} item={d} canEdit={canEdit} />
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </div>
      <p className="text-[11px] text-slate-500">
        Changing thresholds doesn’t rewrite the status stored on past readings; it changes how the latest value is assessed from now on.
      </p>
    </div>
  )
}

type Draft = { green_threshold: string; amber_threshold: string; red_threshold: string; direction: KriDirection }

const s = (v: number | null) => (v == null ? '' : String(v))

function ThresholdRow({ item, canEdit }: { item: KriWithReadings; canEdit: boolean }) {
  const { kri, latest } = item
  const original: Draft = { green_threshold: s(kri.green), amber_threshold: s(kri.amber), red_threshold: s(kri.red), direction: kri.direction }
  const [draft, setDraft] = useState<Draft>(original)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const update = useUpdateRow(KRI_DEFS)
  const dirty = (Object.keys(original) as (keyof Draft)[]).some(k => original[k] !== draft[k])
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setDraft(d => ({ ...d, [k]: e.target.value }))
    setErrors({})
  }

  const nums = { green: Number(draft.green_threshold), amber: draft.amber_threshold === '' ? null : Number(draft.amber_threshold), red: draft.red_threshold === '' ? null : Number(draft.red_threshold) }
  const previewOk = Object.keys(validateThresholds(draft)).length === 0
  const preview = latest && previewOk ? kriLight(latest.value, { amber: nums.amber, red: nums.red, direction: draft.direction }) : null

  const save = async () => {
    const e = validateThresholds(draft)
    setErrors(e)
    if (Object.keys(e).length) return
    try {
      await update.mutateAsync({
        id: kri.uuid,
        values: { green_threshold: Number(draft.green_threshold), amber_threshold: Number(draft.amber_threshold), red_threshold: Number(draft.red_threshold), direction: draft.direction },
      })
      toast.success(`Thresholds for ${kri.code} saved`)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const id = (k: string) => `thr-${kri.uuid}-${k}`
  const op = draft.direction === 'HIGHER_WORSE' ? '≥' : '≤'
  const numInput = (k: 'green_threshold' | 'amber_threshold' | 'red_threshold', label: string) => (
    <td>
      <label htmlFor={id(k)} className="sr-only">
        {label} threshold for {kri.code}
      </label>
      <div className="flex items-center gap-1">
        {k !== 'green_threshold' && <span className="text-slate-400 text-[11px]" aria-hidden="true">{op}</span>}
        <Input
          id={id(k)}
          type="number"
          step="any"
          value={draft[k]}
          onChange={set(k)}
          disabled={!canEdit}
          className="h-7 w-24 text-xs"
          aria-invalid={!!errors[k] || !!errors.thresholds}
        />
      </div>
      {errors[k] && <p className="text-[11px] text-red-600 mt-0.5">{errors[k]}</p>}
    </td>
  )

  return (
    <>
      <tr>
        <td>
          <div className="font-mono text-[11px] text-slate-500">{kri.code}</div>
          <div className="font-medium text-slate-900">{kri.name}</div>
          <div className="text-[11px] text-slate-500">
            {kri.unit ?? 'No unit'}
            {!kri.active && ' · Inactive'}
          </div>
        </td>
        <td>
          <label htmlFor={id('direction')} className="sr-only">
            Direction for {kri.code}
          </label>
          <select id={id('direction')} className={`${selectClass} w-36`} value={draft.direction} onChange={set('direction')} disabled={!canEdit}>
            <option value="HIGHER_WORSE">{DIRECTION_LABELS.HIGHER_WORSE}</option>
            <option value="LOWER_WORSE">{DIRECTION_LABELS.LOWER_WORSE}</option>
          </select>
        </td>
        {numInput('green_threshold', 'Green')}
        {numInput('amber_threshold', 'Amber')}
        {numInput('red_threshold', 'Red')}
        <td className="tabular-nums whitespace-nowrap">{latest ? formatValue(latest.value, kri.unit) : <span className="text-slate-400">No readings</span>}</td>
        <td>{latest ? previewOk ? <LightBadge light={preview} /> : <span className="text-[11px] text-slate-400">Fix thresholds to preview</span> : <LightBadge light={null} />}</td>
        {canEdit && (
          <td className="text-right whitespace-nowrap">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDraft(original); setErrors({}) }} disabled={!dirty || update.isPending} aria-label={`Undo changes to ${kri.code}`}>
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
            <Button size="sm" className="h-7 px-2 text-xs ml-1" onClick={save} disabled={!dirty || update.isPending}>
              <Save className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
          </td>
        )}
      </tr>
      {errors.thresholds && (
        <tr>
          <td colSpan={canEdit ? 8 : 7} className="!pt-0">
            <p role="alert" className="text-[11px] text-red-600">
              {kri.code}: {errors.thresholds}
            </p>
          </td>
        </tr>
      )}
    </>
  )
}
