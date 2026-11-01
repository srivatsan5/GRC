'use client'

/**
 * Shared KRI pieces: one hook that joins definitions with their readings, the
 * traffic-light badge, and the definition / reading forms used by /kri,
 * /kri/configuration and /kri/matrix.
 */
import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useCreateRow, useDeleteRow, useRows, useUpdateRow, fetchAllRows, type Row } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { DASH, daysUntil, formatNumber } from '@/lib/format'
import { LIGHT_STYLES, kriLight, thresholdProblem, toKri, toReading, type KriDefinition, type KriDirection, type KriLight, type KriReading } from '@/lib/kri'
import { cn } from '@/lib/utils'
import { Field, selectClass, textOrNull } from '@/components/controls/form-bits'

export const KRI_DEFS = 'erm_mst_kri_definition'
export const KRI_READINGS = 'erm_trn_kri_readings'

export const DIRECTION_LABELS: Record<KriDirection, string> = {
  HIGHER_WORSE: 'Higher is worse',
  LOWER_WORSE: 'Lower is worse',
}

const time = (d: string) => {
  const t = new Date(d).getTime()
  return Number.isNaN(t) ? 0 : t
}

export interface KriWithReadings {
  kri: KriDefinition
  /** Oldest first. */
  readings: KriReading[]
  latest: KriReading | null
  previous: KriReading | null
  /** Light of the latest reading, computed from the current thresholds. */
  light: KriLight | null
}

/** Definitions joined with their readings (sorted by reading date). */
export function useKriData() {
  const defsQ = useRows(KRI_DEFS)
  const readingsQ = useRows(KRI_READINGS)
  const data = useMemo<KriWithReadings[]>(() => {
    const byKri = new Map<number, KriReading[]>()
    for (const r of (readingsQ.data ?? []).map(toReading)) {
      if (!Number.isFinite(r.value)) continue
      const list = byKri.get(r.kriUuid) ?? []
      list.push(r)
      byKri.set(r.kriUuid, list)
    }
    return (defsQ.data ?? [])
      .map(toKri)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
      .map(kri => {
        const readings = (byKri.get(kri.uuid) ?? []).sort((a, b) => time(a.date) - time(b.date) || a.uuid - b.uuid)
        const latest = readings[readings.length - 1] ?? null
        const previous = readings[readings.length - 2] ?? null
        return { kri, readings, latest, previous, light: latest ? kriLight(latest.value, kri) : null }
      })
  }, [defsQ.data, readingsQ.data])
  return { defsQ, readingsQ, data, queries: [defsQ, readingsQ] }
}

export function LightBadge({ light, className }: { light: KriLight | null; className?: string }) {
  if (!light) return <span className={cn('inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500', className)}>No reading</span>
  const s = LIGHT_STYLES[light]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium', s.bg, s.text, s.border, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} aria-hidden="true" />
      {light === 'GREEN' ? 'Green' : light === 'AMBER' ? 'Amber' : 'Red'} · {s.label}
    </span>
  )
}

/** "Amber ≥ 8 · Red ≥ 12" (or ≤ for lower-is-worse). */
export function thresholdText(kri: Pick<KriDefinition, 'green' | 'amber' | 'red' | 'direction'>) {
  const op = kri.direction === 'HIGHER_WORSE' ? '≥' : '≤'
  if (kri.amber == null || kri.red == null) return 'Thresholds not set'
  return `Green target ${formatNumber(kri.green, 4)} · Amber ${op} ${formatNumber(kri.amber, 4)} · Red ${op} ${formatNumber(kri.red, 4)}`
}

export function formatValue(v: number | null | undefined, unit: string | null) {
  if (v == null) return DASH
  return `${formatNumber(v, 4)}${unit ? ` ${unit}` : ''}`
}

/** Delete a KRI definition and its readings, after confirmation. */
export function useDeleteKri() {
  const confirm = useConfirm()
  const delDef = useDeleteRow(KRI_DEFS, { alsoInvalidate: [KRI_READINGS] })
  const delReading = useDeleteRow(KRI_READINGS)
  const run = async (kri: KriDefinition) => {
    const ok = await confirm({
      title: `Delete ${kri.code}?`,
      description: `This removes "${kri.name}" and all of its recorded readings.`,
      confirmLabel: 'Delete KRI',
      tone: 'danger',
    })
    if (!ok) return
    try {
      const readings = await fetchAllRows(KRI_READINGS, { kri_uuid: kri.uuid })
      for (const r of readings) await delReading.mutateAsync(r.uuid)
      await delDef.mutateAsync(kri.uuid)
      toast.success(`KRI ${kri.code} deleted`)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }
  return { run, pending: delDef.isPending || delReading.isPending }
}

// ------------------------------------------------------------- definition form

interface DefDraft {
  kri_code: string
  kri_name: string
  kri_description: string
  kri_category: string
  owner_name: string
  unit_of_measure: string
  measurement_frequency: string
  green_threshold: string
  amber_threshold: string
  red_threshold: string
  direction: KriDirection
  is_active: 'Y' | 'N'
}

const s = (v: unknown) => (v == null ? '' : String(v))

function toDefDraft(kri: KriDefinition | null): DefDraft {
  return {
    kri_code: kri?.code ?? '',
    kri_name: kri?.name ?? '',
    kri_description: kri?.description ?? '',
    kri_category: kri?.category ?? '',
    owner_name: kri?.owner ?? '',
    unit_of_measure: kri?.unit ?? '',
    measurement_frequency: kri?.frequency ?? '',
    green_threshold: s(kri?.green),
    amber_threshold: s(kri?.amber),
    red_threshold: s(kri?.red),
    direction: kri?.direction ?? 'HIGHER_WORSE',
    is_active: kri && !kri.active ? 'N' : 'Y',
  }
}

export const FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-annual', 'Annual'] as const

export function validateThresholds(d: Pick<DefDraft, 'green_threshold' | 'amber_threshold' | 'red_threshold' | 'direction'>) {
  const e: Partial<Record<'green_threshold' | 'amber_threshold' | 'red_threshold' | 'thresholds', string>> = {}
  const vals = { green_threshold: d.green_threshold, amber_threshold: d.amber_threshold, red_threshold: d.red_threshold }
  for (const [k, v] of Object.entries(vals) as [keyof typeof vals, string][]) {
    if (v.trim() === '') e[k] = 'Required'
    else if (!Number.isFinite(Number(v))) e[k] = 'Enter a number'
  }
  if (!e.green_threshold && !e.amber_threshold && !e.red_threshold) {
    const p = thresholdProblem(Number(d.green_threshold), Number(d.amber_threshold), Number(d.red_threshold), d.direction)
    if (p) e.thresholds = p
  }
  return e
}

export function KriDefinitionDialog({ initial, onClose }: { initial: KriDefinition | null; onClose: () => void }) {
  const [draft, setDraft] = useState<DefDraft>(() => toDefDraft(initial))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const create = useCreateRow(KRI_DEFS)
  const update = useUpdateRow(KRI_DEFS)
  const busy = create.isPending || update.isPending
  const set = (k: keyof DefDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setDraft(d => ({ ...d, [k]: e.target.value }))
  const inv = (k: string) => (errors[k] ? { 'aria-invalid': true, 'aria-describedby': `kri-${k}-error` } : {})

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e: Record<string, string> = { ...validateThresholds(draft) }
    if (!draft.kri_code.trim()) e.kri_code = 'KRI code is required'
    if (!draft.kri_name.trim()) e.kri_name = 'KRI name is required'
    setErrors(e)
    if (Object.keys(e).length) return
    const values: Row = {
      kri_code: draft.kri_code.trim(),
      kri_name: draft.kri_name.trim(),
      kri_description: textOrNull(draft.kri_description),
      kri_category: textOrNull(draft.kri_category),
      owner_name: textOrNull(draft.owner_name),
      unit_of_measure: textOrNull(draft.unit_of_measure),
      measurement_frequency: draft.measurement_frequency || null,
      green_threshold: Number(draft.green_threshold),
      amber_threshold: Number(draft.amber_threshold),
      red_threshold: Number(draft.red_threshold),
      direction: draft.direction,
      is_active: draft.is_active,
    }
    try {
      if (initial) {
        await update.mutateAsync({ id: initial.uuid, values })
        toast.success(`KRI ${values.kri_code} updated`)
      } else {
        await create.mutateAsync(values)
        toast.success(`KRI ${values.kri_code} created`)
      }
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const freqOptions = draft.measurement_frequency && !(FREQUENCIES as readonly string[]).includes(draft.measurement_frequency) ? [draft.measurement_frequency, ...FREQUENCIES] : FREQUENCIES

  return (
    <Dialog open onOpenChange={o => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">{initial ? `Edit ${initial.code}` : 'New key risk indicator'}</DialogTitle>
          <DialogDescription className="text-xs">Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 text-xs" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="kri-kri_code" label="KRI code" required error={errors.kri_code}>
              <Input id="kri-kri_code" value={draft.kri_code} onChange={set('kri_code')} placeholder="e.g. KRI-IT-001" className="h-8 text-xs" {...inv('kri_code')} />
            </Field>
            <Field id="kri-owner_name" label="Owner">
              <Input id="kri-owner_name" value={draft.owner_name} onChange={set('owner_name')} className="h-8 text-xs" />
            </Field>
          </div>
          <Field id="kri-kri_name" label="Indicator name" required error={errors.kri_name}>
            <Input id="kri-kri_name" value={draft.kri_name} onChange={set('kri_name')} className="h-8 text-xs" {...inv('kri_name')} />
          </Field>
          <Field id="kri-kri_description" label="Description">
            <Textarea id="kri-kri_description" value={draft.kri_description} onChange={set('kri_description')} rows={2} className="text-xs" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field id="kri-kri_category" label="Category">
              <Input id="kri-kri_category" value={draft.kri_category} onChange={set('kri_category')} className="h-8 text-xs" />
            </Field>
            <Field id="kri-unit_of_measure" label="Unit of measure">
              <Input id="kri-unit_of_measure" value={draft.unit_of_measure} onChange={set('unit_of_measure')} placeholder="e.g. %, count, hrs/month" className="h-8 text-xs" />
            </Field>
            <Field id="kri-measurement_frequency" label="Measurement frequency">
              <select id="kri-measurement_frequency" className={selectClass} value={draft.measurement_frequency} onChange={set('measurement_frequency')}>
                <option value="">Not set</option>
                {freqOptions.map(f => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
          </div>
          <ThresholdFields draft={draft} set={set} errors={errors} idPrefix="kri" />
          <Field id="kri-is_active" label="Status">
            <select id="kri-is_active" className={`${selectClass} sm:w-48`} value={draft.is_active} onChange={set('is_active')}>
              <option value="Y">Active</option>
              <option value="N">Inactive</option>
            </select>
          </Field>
          <DialogFooter className="pt-2 border-t border-slate-200">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Saving…' : 'Save KRI'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Direction + green/amber/red inputs, with the order-check message. */
export function ThresholdFields({
  draft,
  set,
  errors,
  idPrefix,
}: {
  draft: Pick<DefDraft, 'green_threshold' | 'amber_threshold' | 'red_threshold' | 'direction'>
  set: (k: 'green_threshold' | 'amber_threshold' | 'red_threshold' | 'direction') => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  errors: Record<string, string>
  idPrefix: string
}) {
  const op = draft.direction === 'HIGHER_WORSE' ? '≥' : '≤'
  return (
    <fieldset className="space-y-2 rounded border border-slate-200 p-3">
      <legend className="px-1 text-xs font-medium text-slate-700">Thresholds</legend>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Field id={`${idPrefix}-direction`} label="Direction" required>
          <select id={`${idPrefix}-direction`} className={selectClass} value={draft.direction} onChange={set('direction')}>
            <option value="HIGHER_WORSE">{DIRECTION_LABELS.HIGHER_WORSE}</option>
            <option value="LOWER_WORSE">{DIRECTION_LABELS.LOWER_WORSE}</option>
          </select>
        </Field>
        <Field id={`${idPrefix}-green_threshold`} label="Green (target)" required error={errors.green_threshold}>
          <Input id={`${idPrefix}-green_threshold`} type="number" step="any" value={draft.green_threshold} onChange={set('green_threshold')} className="h-8 text-xs" aria-invalid={!!errors.green_threshold || !!errors.thresholds} />
        </Field>
        <Field id={`${idPrefix}-amber_threshold`} label={`Amber (${op})`} required error={errors.amber_threshold}>
          <Input id={`${idPrefix}-amber_threshold`} type="number" step="any" value={draft.amber_threshold} onChange={set('amber_threshold')} className="h-8 text-xs" aria-invalid={!!errors.amber_threshold || !!errors.thresholds} />
        </Field>
        <Field id={`${idPrefix}-red_threshold`} label={`Red (${op})`} required error={errors.red_threshold}>
          <Input id={`${idPrefix}-red_threshold`} type="number" step="any" value={draft.red_threshold} onChange={set('red_threshold')} className="h-8 text-xs" aria-invalid={!!errors.red_threshold || !!errors.thresholds} />
        </Field>
      </div>
      {errors.thresholds ? (
        <p role="alert" className="text-[11px] text-red-600">
          {errors.thresholds}
        </p>
      ) : (
        <p className="text-[11px] text-slate-500">
          A reading turns amber at the amber value and red at the red value ({draft.direction === 'HIGHER_WORSE' ? 'or above' : 'or below'}).
        </p>
      )}
    </fieldset>
  )
}

// ---------------------------------------------------------------- reading form

/** Today's local date as YYYY-MM-DD. */
function todayInput() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function RecordReadingDialog({ kri, onClose }: { kri: KriDefinition; onClose: () => void }) {
  const [value, setValue] = useState('')
  const [date, setDate] = useState(todayInput)
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const create = useCreateRow(KRI_READINGS)
  const num = value.trim() === '' ? null : Number(value)
  const preview = num != null && Number.isFinite(num) ? kriLight(num, kri) : null

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e: Record<string, string> = {}
    if (num == null) e.value = 'Enter the measured value'
    else if (!Number.isFinite(num)) e.value = 'Enter a number'
    if (!date) e.date = 'Enter the reading date'
    else {
      const d = daysUntil(date)
      if (d == null) e.date = 'Enter a valid date'
      else if (d > 0) e.date = 'A reading can’t be dated in the future'
    }
    setErrors(e)
    if (Object.keys(e).length) return
    const light = kriLight(num, kri)
    try {
      await create.mutateAsync({
        kri_uuid: kri.uuid,
        reading_value: num,
        reading_date: date,
        traffic_light: light,
        is_breach: light === 'RED' ? 'Y' : 'N',
        breach_notes: textOrNull(notes),
      })
      toast.success(`Reading recorded for ${kri.code}${light ? ` (${light.toLowerCase()})` : ''}`)
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  return (
    <Dialog open onOpenChange={o => !o && !create.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Record reading · {kri.code}</DialogTitle>
          <DialogDescription className="text-xs">
            {kri.name}. {thresholdText(kri)}
            {kri.unit ? ` (${kri.unit})` : ''}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 text-xs" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field id="reading-value" label={`Value${kri.unit ? ` (${kri.unit})` : ''}`} required error={errors.value}>
              <Input id="reading-value" type="number" step="any" value={value} onChange={e => setValue(e.target.value)} className="h-8 text-xs" aria-invalid={!!errors.value} />
            </Field>
            <Field id="reading-date" label="Reading date" required error={errors.date}>
              <Input id="reading-date" type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-xs" aria-invalid={!!errors.date} />
            </Field>
          </div>
          <Field id="reading-notes" label="Notes" hint="Explain a breach or the context of this reading">
            <Textarea id="reading-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-xs" />
          </Field>
          <div className="flex items-center gap-2 text-xs text-slate-600" aria-live="polite">
            Resulting status: {num == null ? <span className="text-slate-400">enter a value</span> : preview ? <LightBadge light={preview} /> : <span className="text-slate-500">thresholds not set, no status</span>}
          </div>
          <DialogFooter className="pt-2 border-t border-slate-200">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Record reading'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
