'use client'

/** Create / edit an assessment cycle (erm_trn_assessment_cycle). */
import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCreateRow, useRows, useUpdateRow, type Row } from '@/lib/data'
import { toDateInput } from '@/lib/format'
import { apiErrorMessage } from '@/lib/apiClient'
import { FormField, NativeSelect, describedBy } from '@/components/cycles/form'
import { CycleStatusChip } from '@/components/cycles/cycle-bits'
import { CYCLE_TABLE } from './risk-dialog'

export const CYCLE_STATUSES = ['Planned', 'In Progress', 'Under Review', 'Completed'] as const

/** Cycle status chip (icon + word). Kept under its old name for existing imports. */
export function CycleStatusBadge({ status }: { status: string | null | undefined }) {
  return <CycleStatusChip status={status} />
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
    // Re-run on open as well: the reset above clears the reference each time the dialog opens.
    if (open && !editing && !refTouched && suggested) setForm(f => ({ ...f, cycle_reference: suggested }))
  }, [open, editing, refTouched, suggested])

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

  const hintRef = !editing && suggested ? `Suggested: the next free ${year} reference` : undefined
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <p className="label-caps">RCSA · Assessment cycle</p>
          <DialogTitle>{editing ? `Edit ${cycle?.cycle_name || 'assessment cycle'}` : 'New assessment cycle'}</DialogTitle>
          <DialogDescription>A cycle groups the risks assessed together in one RCSA round, with its period and submission deadline.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-5">
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <FormField id="cycle-name" label="Cycle name" required error={errors.cycle_name} className="sm:col-span-2">
              <Input
                id="cycle-name"
                value={form.cycle_name}
                onChange={e => set('cycle_name')(e.target.value)}
                placeholder="e.g. Q1 2027 Enterprise RCSA"
                aria-invalid={!!errors.cycle_name || undefined}
                aria-describedby={describedBy('cycle-name', errors.cycle_name)}
                autoFocus
              />
            </FormField>
            <FormField id="cycle-ref" label="Reference" hint={hintRef}>
              <Input
                id="cycle-ref"
                value={form.cycle_reference}
                onChange={e => {
                  setRefTouched(true)
                  set('cycle_reference')(e.target.value)
                }}
                className="font-mono"
                aria-describedby={describedBy('cycle-ref', undefined, !!hintRef)}
              />
            </FormField>
            <FormField id="cycle-status" label="Status" required error={errors.status} aside={<CycleStatusChip status={form.status} />}>
              <NativeSelect
                id="cycle-status"
                value={form.status}
                onChange={e => set('status')(e.target.value)}
                aria-invalid={!!errors.status || undefined}
                aria-describedby={describedBy('cycle-status', errors.status)}
              >
                {CYCLE_STATUSES.map(s => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="cycle-type" label="Type">
              <Input id="cycle-type" value={form.cycle_type} onChange={e => set('cycle_type')(e.target.value)} />
            </FormField>
            <FormField id="cycle-period" label="Period" hint="e.g. Q1, H2, Annual">
              <Input id="cycle-period" value={form.cycle_period} onChange={e => set('cycle_period')(e.target.value)} aria-describedby="cycle-period-hint" />
            </FormField>
          </div>

          <fieldset className="space-y-3 rounded-lg bg-surface-sunken p-4 shadow-[inset_0_0_0_1px_var(--border)]">
            <legend className="sr-only">Schedule</legend>
            <p className="label-caps" aria-hidden="true">
              Schedule
            </p>
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
              <FormField id="cycle-start" label="Start date">
                <Input id="cycle-start" type="date" value={form.cycle_start_date} onChange={e => set('cycle_start_date')(e.target.value)} />
              </FormField>
              <FormField id="cycle-end" label="End date" error={errors.cycle_end_date}>
                <Input
                  id="cycle-end"
                  type="date"
                  value={form.cycle_end_date}
                  onChange={e => set('cycle_end_date')(e.target.value)}
                  aria-invalid={!!errors.cycle_end_date || undefined}
                  aria-describedby={describedBy('cycle-end', errors.cycle_end_date)}
                />
              </FormField>
              <FormField id="cycle-deadline" label="Submission deadline" error={errors.submission_deadline}>
                <Input
                  id="cycle-deadline"
                  type="date"
                  value={form.submission_deadline}
                  onChange={e => set('submission_deadline')(e.target.value)}
                  aria-invalid={!!errors.submission_deadline || undefined}
                  aria-describedby={describedBy('cycle-deadline', errors.submission_deadline)}
                />
              </FormField>
            </div>
            <p className="text-caption text-muted-foreground">The deadline must fall inside the cycle&apos;s period.</p>
          </fieldset>

          <FormField id="cycle-notes" label="Notes" hint="Scope, participants or anything assessors should know.">
            <Textarea id="cycle-notes" rows={3} value={form.notes} onChange={e => set('notes')(e.target.value)} aria-describedby="cycle-notes-hint" />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create cycle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
