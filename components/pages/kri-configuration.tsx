'use client'

/**
 * /kri/configuration — a focused thresholds editor for KRI definitions, with inline validation and a
 * live threshold-strip preview of where the latest reading would fall.
 * Full definition editing (names, owners, descriptions) lives on /kri.
 */
import React, { useState } from 'react'
import Link from 'next/link'
import { RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState } from '@/components/data-state'
import { Callout, PageHeader, Panel } from '@/components/charter/primitives'
import { useUpdateRow } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { kriLight, type KriDirection } from '@/lib/kri'
import { cn } from '@/lib/utils'
import { FieldError, Select } from '@/components/governance/form'
import { KriNav } from '@/components/kri/kri-nav'
import { LightPill, ThresholdStrip, fmt } from '@/components/kri/kri-visuals'
import { DIRECTION_LABELS, KRI_DEFS, useKriData, validateThresholds, type KriWithReadings } from '@/components/kri/kri-shared'

export function KriconfigurationPage() {
  const { hasPermission } = useAuth()
  const { data, queries, defsQ } = useKriData()
  const canEdit = hasPermission('update')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics · Key risk indicators"
        title="Thresholds"
        description="Set the direction and the green, amber and red thresholds of each indicator. The strip previews where the latest reading falls."
      />
      <KriNav />

      {!canEdit && <Callout tone="info">You can review thresholds here. Your role can view them but not change them.</Callout>}

      <Panel bodyClassName="p-0" title="Indicator thresholds" meta={`${data.length} indicator${data.length === 1 ? '' : 's'}`}>
        <div className="pt-4">
          <DataState
            query={queries}
            empty={(defsQ.data?.length ?? 0) === 0}
            emptyTitle="No indicators yet"
            emptyDescription="Create indicators on the Indicators page first."
            emptyAction={
              <Button asChild variant="secondary">
                <Link href="/kri">Go to indicators</Link>
              </Button>
            }
          >
            <div className="relative overflow-x-auto border-t">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th className="min-w-[220px] pl-6">Indicator</th>
                    <th>Direction</th>
                    <th>Green target</th>
                    <th>Amber</th>
                    <th>Red</th>
                    <th className="min-w-[220px]">Preview with latest reading</th>
                    {canEdit && (
                      <th className="pr-6 text-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
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
      </Panel>
      <p className="text-caption text-muted-foreground">
        Changing thresholds doesn’t rewrite the status stored on past readings; it changes how the latest value is assessed from now on. Edit names and owners on{' '}
        <Link href="/kri" className="text-primary hover:underline focus-ring rounded-xs">
          Indicators
        </Link>
        .
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

  // Inline validation as you type (order + numbers); the save button re-validates.
  const live = validateThresholds(draft)
  const previewOk = Object.keys(live).length === 0
  const shown: Record<string, string | undefined> = dirty ? { ...live, ...errors } : errors
  const nums = { green: Number(draft.green_threshold), amber: Number(draft.amber_threshold), red: Number(draft.red_threshold) }
  const preview = latest && previewOk ? kriLight(latest.value, { amber: nums.amber, red: nums.red, direction: draft.direction }) : null
  const before = latest ? kriLight(latest.value, kri) : null

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
    <td className="py-3 align-top">
      <label htmlFor={id(k)} className="sr-only">
        {label} threshold for {kri.code}
      </label>
      <div className="flex items-center gap-1.5">
        <span className="w-3 text-caption text-muted-foreground" aria-hidden="true">
          {k === 'green_threshold' ? '' : op}
        </span>
        <Input
          id={id(k)}
          type="number"
          step="any"
          inputMode="decimal"
          value={draft[k]}
          onChange={set(k)}
          disabled={!canEdit}
          className="h-8 w-20 tabular-nums"
          aria-invalid={!!shown[k] || !!shown.thresholds}
          aria-describedby={shown[k] ? `${id(k)}-error` : shown.thresholds ? id('order-error') : undefined}
        />
      </div>
      {shown[k] && (
        <FieldError id={`${id(k)}-error`} className="ml-[18px]">
          {shown[k]}
        </FieldError>
      )}
    </td>
  )

  return (
    <>
      <tr aria-selected={dirty || undefined}>
        <td className={cn('py-3 pl-6 align-top', dirty && 'shadow-[inset_3px_0_0_var(--primary)]')}>
          <span className="block truncate font-medium text-foreground" title={kri.name}>
            {kri.name}
          </span>
          <span className="block truncate font-mono text-caption text-muted-foreground">
            {kri.code} · {kri.unit ?? 'No unit'}
            {!kri.active && ' · Inactive'}
          </span>
        </td>
        <td className="py-3 align-top">
          <label htmlFor={id('direction')} className="sr-only">
            Direction for {kri.code}
          </label>
          <Select id={id('direction')} wrapperClassName="w-[156px]" className="h-8" value={draft.direction} onChange={set('direction')} disabled={!canEdit}>
            <option value="HIGHER_WORSE">{DIRECTION_LABELS.HIGHER_WORSE}</option>
            <option value="LOWER_WORSE">{DIRECTION_LABELS.LOWER_WORSE}</option>
          </Select>
        </td>
        {numInput('green_threshold', 'Green')}
        {numInput('amber_threshold', 'Amber')}
        {numInput('red_threshold', 'Red')}
        <td className="py-3 align-top">
          {previewOk ? (
            <div className="space-y-2 pt-2">
              <ThresholdStrip kri={{ amber: nums.amber, red: nums.red, green: nums.green, direction: draft.direction }} value={latest?.value} labels={false} />
              <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground tabular-nums">
                <LightPill light={latest ? preview : null} />
                {latest ? (
                  <span>
                    {fmt(latest.value)}
                    {kri.unit ? ` ${kri.unit}` : ''}
                    {dirty && before !== preview && before ? ` · was ${before === 'RED' ? 'Breach' : before === 'AMBER' ? 'Warning' : 'Within appetite'}` : ''}
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="pt-1.5 text-caption text-muted-foreground">Fix the thresholds to preview</p>
          )}
        </td>
        {canEdit && (
          <td className="py-3 pr-6 text-right align-top whitespace-nowrap">
            <div className="inline-flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => {
                  setDraft(original)
                  setErrors({})
                }}
                disabled={!dirty || update.isPending}
                aria-label={`Undo changes to ${kri.code}`}
              >
                <RotateCcw aria-hidden="true" />
              </Button>
              <Button className="h-8 px-3" variant={dirty ? 'primary' : 'secondary'} onClick={save} disabled={!dirty || update.isPending || !previewOk}>
                <Save aria-hidden="true" />
                {update.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </td>
        )}
      </tr>
      {shown.thresholds && (
        <tr>
          <td colSpan={canEdit ? 7 : 6} className="pl-6 !pt-0">
            <FieldError id={id('order-error')} className="mt-0">
              {kri.code}: {shown.thresholds}
            </FieldError>
          </td>
        </tr>
      )}
    </>
  )
}
