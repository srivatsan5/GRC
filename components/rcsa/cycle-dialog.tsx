'use client'

/** Create / edit an assessment cycle (erm_trn_assessment_cycle). */
import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCreateRow, useRows, useUpdateRow, type Row } from '@/lib/data'
import { toDateInput } from '@/lib/format'
import { apiErrorMessage } from '@/lib/apiClient'
import { Field, selectClass, textareaClass } from './shared'
import { CYCLE_TABLE } from './risk-dialog'

export const CYCLE_STATUSES = ['Planned', 'In Progress', 'Under Review', 'Completed'] as const

const STATUS_STYLE: Record<string, string> = {
  Planned: 'bg-slate-50 text-slate-700 border-slate-200',
  'In Progress': 'bg-blue-50 text-blue-800 border-blue-200',
  'Under Review': 'bg-amber-50 text-amber-800 border-amber-200',
  Completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}

export function CycleStatusBadge({ status }: { status: string | null | undefined }) {
  const s = status && STATUS_STYLE[status] ? status : null
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${s ? STATUS_STYLE[s] : 'bg-slate-50 text-slate-500 border-slate-200'}`}>{status || '—'}</span>
}

/** Next `RCSA-<year>-<seq>` reference, from the references already stored. */
export function nextCycleReference(cycles: Row[], year: number): string {
  const re = new RegExp(`^RCSA-${year}-(\\d+)$`, 'i')
  const max = cycles.reduce((m, c) => {
    const hit = re.exec(String(c.cycle_reference ?? '').trim())
    return hit ? Math.max(m, Number(hit[1])) : m
  }, 0)
  return `RCSA-${year}-${String(max + 1).padStart(3, '0')}`
}

interface FormState {
  cycle_reference: string
  cycle_name: string
  cycle_type: string
  cycle_period: string
  cycle_start_date: string
  cycle_end_date: string
  submission_deadline: string
  status: string
  notes: string
}

function initial(c: Row | null | undefined): FormState {
  return {
    cycle_reference: c?.cycle_reference ?? '',
    cycle_name: c?.cycle_name ?? '',
    cycle_type: c?.cycle_type ?? 'RCSA',
    cycle_period: c?.cycle_period ?? '',
    cycle_start_date: toDateInput(c?.cycle_start_date),
    cycle_end_date: toDateInput(c?.cycle_end_date),
    submission_deadline: toDateInput(c?.submission_deadline),
    status: c?.status ?? 'Planned',
    notes: c?.notes ?? '',
  }
}

function validate(f: FormState) {
  const e: Partial<Record<keyof FormState, string>> = {}
  if (!f.cycle_name.trim()) e.cycle_name = 'Cycle name is required.'
  if (f.cycle_start_date && f.cycle_end_date && f.cycle_start_date > f.cycle_end_date) e.cycle_end_date = 'End date must be on or after the start date.'
  if (f.submission_deadline) {
    if (f.cycle_start_date && f.submission_deadline < f.cycle_start_date) e.submission_deadline = 'Deadline must be within the cycle (on or after the start date).'
    else if (f.cycle_end_date && f.submission_deadline > f.cycle_end_date) e.submission_deadline = 'Deadline must be within the cycle (on or before the end date).'
  }
  if (!CYCLE_STATUSES.includes(f.status as (typeof CYCLE_STATUSES)[number])) e.status = 'Choose a status.'
  return e
}

export function CycleDialog({ open, onOpenChange, cycle, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; cycle?: Row | null; onSaved?: (row: Row) => void }) {
  const editing = !!cycle
  const [form, setForm] = useState<FormState>(() => initial(cycle))
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [refTouched, setRefTouched] = useState(false)
  const all = useRows(CYCLE_TABLE, { enabled: open && !editing })
  const create = useCreateRow(CYCLE_TABLE)
  const update = useUpdateRow(CYCLE_TABLE)

  useEffect(() => {
    if (open) {
      setForm(initial(cycle))
      setErrors({})
      setRefTouched(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cycle?.uuid])

  const year = form.cycle_start_date ? Number(form.cycle_start_date.slice(0, 4)) : new Date().getFullYear()
  const suggested = useMemo(() => (all.data ? nextCycleReference(all.data, year) : ''), [all.data, year])
  useEffect(() => {
    if (!editing && !refTouched && suggested) setForm(f => ({ ...f, cycle_reference: suggested }))
  }, [editing, refTouched, suggested])

  const set = (k: keyof FormState) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  const busy = create.isPending || update.isPending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    const values: Row = {
      cycle_reference: form.cycle_reference.trim(),
      cycle_name: form.cycle_name.trim(),
      cycle_type: form.cycle_type.trim(),
      cycle_period: form.cycle_period.trim(),
      cycle_year: form.cycle_start_date ? Number(form.cycle_start_date.slice(0, 4)) : '',
      cycle_start_date: form.cycle_start_date,
      cycle_end_date: form.cycle_end_date,
      submission_deadline: form.submission_deadline,
      status: form.status,
      notes: form.notes.trim(),
    }
    try {
      const saved = editing ? await update.mutateAsync({ id: cycle!.uuid ?? cycle!.id, values }) : await create.mutateAsync(values)
      toast.success(editing ? 'Cycle updated' : 'Assessment cycle created')
      onOpenChange(false)
      onSaved?.(saved)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white border-slate-200 rounded-lg p-5 text-xs max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-slate-900">{editing ? 'Edit assessment cycle' : 'New assessment cycle'}</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">A cycle groups the risks assessed together in one RCSA round.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="cycle-name" label="Cycle name" required error={errors.cycle_name} className="sm:col-span-2">
              <Input id="cycle-name" value={form.cycle_name} onChange={e => set('cycle_name')(e.target.value)} className="h-8 text-xs" aria-invalid={!!errors.cycle_name || undefined} />
            </Field>
            <Field id="cycle-ref" label="Reference" hint={!editing && suggested ? `Next free reference for ${year}: ${suggested}` : undefined}>
              <Input
                id="cycle-ref"
                value={form.cycle_reference}
                onChange={e => {
                  setRefTouched(true)
                  set('cycle_reference')(e.target.value)
                }}
                className="h-8 text-xs font-mono"
              />
            </Field>
            <Field id="cycle-status" label="Status" required error={errors.status}>
              <select id="cycle-status" value={form.status} onChange={e => set('status')(e.target.value)} className={selectClass}>
                {CYCLE_STATUSES.map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field id="cycle-type" label="Type">
              <Input id="cycle-type" value={form.cycle_type} onChange={e => set('cycle_type')(e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field id="cycle-period" label="Period" hint="e.g. Q1, H2, Annual">
              <Input id="cycle-period" value={form.cycle_period} onChange={e => set('cycle_period')(e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field id="cycle-start" label="Start date">
              <Input id="cycle-start" type="date" value={form.cycle_start_date} onChange={e => set('cycle_start_date')(e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field id="cycle-end" label="End date" error={errors.cycle_end_date}>
              <Input id="cycle-end" type="date" value={form.cycle_end_date} onChange={e => set('cycle_end_date')(e.target.value)} className="h-8 text-xs" aria-invalid={!!errors.cycle_end_date || undefined} />
            </Field>
            <Field id="cycle-deadline" label="Submission deadline" error={errors.submission_deadline}>
              <Input id="cycle-deadline" type="date" value={form.submission_deadline} onChange={e => set('submission_deadline')(e.target.value)} className="h-8 text-xs" aria-invalid={!!errors.submission_deadline || undefined} />
            </Field>
            <Field id="cycle-notes" label="Notes" className="sm:col-span-2">
              <textarea id="cycle-notes" rows={2} value={form.notes} onChange={e => set('notes')(e.target.value)} className={textareaClass} />
            </Field>
          </div>
          <DialogFooter className="pt-2 border-t border-slate-200">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create cycle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
