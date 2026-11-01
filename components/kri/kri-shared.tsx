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
import { kriLight, thresholdProblem, toKri, toReading, type KriDefinition, type KriDirection, type KriLight, type KriReading } from '@/lib/kri'
import { Field, FieldError, Select } from '@/components/governance/form'
import { LightPill, ThresholdStrip } from '@/components/kri/kri-visuals'

/** Empty string → null, otherwise trimmed text. */
const textOrNull = (v: string) => (v.trim() === '' ? null : v.trim())

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

/** Traffic-light status pill (icon + word). Kept as the shared name used across the KRI pages. */
export function LightBadge({ light, solid, className }: { light: KriLight | null; solid?: boolean; className?: string }) {
  return <LightPill light={light} solid={solid} className={className} />
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.code}` : 'New key risk indicator'}</DialogTitle>
          <DialogDescription>Define what is measured, who owns it and where it turns amber and red. Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="kri-kri_code" label="KRI code" required error={errors.kri_code}>
              <Input id="kri-kri_code" value={draft.kri_code} onChange={set('kri_code')} placeholder="e.g. KRI-IT-001" className="font-mono" {...inv('kri_code')} />
            </Field>
            <Field id="kri-owner_name" label="Owner">
              <Input id="kri-owner_name" value={draft.owner_name} onChange={set('owner_name')} />
            </Field>
          </div>
          <Field id="kri-kri_name" label="Indicator name" required error={errors.kri_name}>
            <Input id="kri-kri_name" value={draft.kri_name} onChange={set('kri_name')} {...inv('kri_name')} />
          </Field>
          <Field id="kri-kri_description" label="Description">
            <Textarea id="kri-kri_description" value={draft.kri_description} onChange={set('kri_description')} rows={2} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field id="kri-kri_category" label="Category">
              <Input id="kri-kri_category" value={draft.kri_category} onChange={set('kri_category')} />
            </Field>
            <Field id="kri-unit_of_measure" label="Unit of measure">
              <Input id="kri-unit_of_measure" value={draft.unit_of_measure} onChange={set('unit_of_measure')} placeholder="%, count, hrs/mo" />
            </Field>
            <Field id="kri-measurement_frequency" label="Frequency">
              <Select id="kri-measurement_frequency" value={draft.measurement_frequency} onChange={set('measurement_frequency')}>
                <option value="">Not set</option>
                {freqOptions.map(f => (
                  <option key={f}>{f}</option>
                ))}
              </Select>
            </Field>
          </div>
          <ThresholdFields draft={draft} set={set} errors={errors} idPrefix="kri" />
          <Field id="kri-is_active" label="Status" className="sm:w-56">
            <Select id="kri-is_active" value={draft.is_active} onChange={set('is_active')}>
              <option value="Y">Active</option>
              <option value="N">Inactive</option>
            </Select>
          </Field>
          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : initial ? 'Save changes' : 'Create indicator'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Direction + green/amber/red inputs, the order-check message and a live threshold-strip preview. */
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
  const live = validateThresholds(draft)
  const ok = Object.keys(live).length === 0
  return (
    <fieldset className="space-y-4 rounded-lg bg-surface-sunken p-4 shadow-[inset_0_0_0_1px_var(--border)]">
      <legend className="sr-only">Thresholds</legend>
      <p className="label-caps" aria-hidden="true">
        Thresholds
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field id={`${idPrefix}-direction`} label="Direction" required className="col-span-2 sm:col-span-1">
          <Select id={`${idPrefix}-direction`} value={draft.direction} onChange={set('direction')}>
            <option value="HIGHER_WORSE">{DIRECTION_LABELS.HIGHER_WORSE}</option>
            <option value="LOWER_WORSE">{DIRECTION_LABELS.LOWER_WORSE}</option>
          </Select>
        </Field>
        <Field id={`${idPrefix}-green_threshold`} label="Green target" required error={errors.green_threshold}>
          <Input id={`${idPrefix}-green_threshold`} type="number" step="any" inputMode="decimal" value={draft.green_threshold} onChange={set('green_threshold')} className="tabular-nums" aria-invalid={!!errors.green_threshold || !!errors.thresholds} />
        </Field>
        <Field id={`${idPrefix}-amber_threshold`} label={`Amber ${op}`} required error={errors.amber_threshold}>
          <Input id={`${idPrefix}-amber_threshold`} type="number" step="any" inputMode="decimal" value={draft.amber_threshold} onChange={set('amber_threshold')} className="tabular-nums" aria-invalid={!!errors.amber_threshold || !!errors.thresholds} />
        </Field>
        <Field id={`${idPrefix}-red_threshold`} label={`Red ${op}`} required error={errors.red_threshold}>
          <Input id={`${idPrefix}-red_threshold`} type="number" step="any" inputMode="decimal" value={draft.red_threshold} onChange={set('red_threshold')} className="tabular-nums" aria-invalid={!!errors.red_threshold || !!errors.thresholds} />
        </Field>
      </div>
      {errors.thresholds ? (
        <FieldError>{errors.thresholds}</FieldError>
      ) : ok ? (
        <ThresholdStrip
          kri={{ amber: Number(draft.amber_threshold), red: Number(draft.red_threshold), green: Number(draft.green_threshold), direction: draft.direction }}
          value={null}
          ring="var(--surface-sunken)"
        />
      ) : (
        <p className="text-caption text-muted-foreground">
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
          <p className="font-mono text-caption text-muted-foreground">{kri.code}</p>
          <DialogTitle>Record a reading</DialogTitle>
          <DialogDescription>
            {kri.name}
            {kri.unit ? ` · ${kri.unit}` : ''}
            {kri.frequency ? ` · ${kri.frequency}` : ''}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <Field id="reading-value" label={`Value${kri.unit ? ` (${kri.unit})` : ''}`} required error={errors.value}>
              <Input id="reading-value" type="number" step="any" inputMode="decimal" autoFocus value={value} onChange={e => setValue(e.target.value)} className="tabular-nums" aria-invalid={!!errors.value} />
            </Field>
            <Field id="reading-date" label="Reading date" required error={errors.date}>
              <Input id="reading-date" type="date" value={date} onChange={e => setDate(e.target.value)} aria-invalid={!!errors.date} />
            </Field>
          </div>
          <div className="space-y-3 rounded-lg bg-surface-sunken p-4 shadow-[inset_0_0_0_1px_var(--border)]" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <span className="label-caps">Resulting status</span>
              {num == null ? <span className="text-caption text-muted-foreground">Enter a value</span> : preview ? <LightBadge light={preview} solid /> : <span className="text-caption text-muted-foreground">Thresholds not set</span>}
            </div>
            <ThresholdStrip kri={kri} value={num != null && Number.isFinite(num) ? num : null} ring="var(--surface-sunken)" />
          </div>
          <Field id="reading-notes" label="Notes" hint={preview === 'RED' ? 'Explain the breach and what is being done about it.' : 'Context for this reading (optional).'}>
            <Textarea id="reading-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </Field>
          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Record reading'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
