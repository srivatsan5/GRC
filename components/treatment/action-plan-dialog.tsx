'use client'

/** Create / edit an action plan (per_trn_risk_monitoring) using its real columns. */
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCreateRow, useDeleteRow, useUpdateRow, type Row } from '@/lib/data'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { apiErrorMessage } from '@/lib/apiClient'
import { toDateInput } from '@/lib/format'
import { RiskSelect } from './risk-select'
import { Meter } from '@/components/charter/primitives'
import { CheckboxField, FieldError, FormSection, helpCls, labelCls, numOrNull, rowId, text } from './shared'

export const MONITORING = 'per_trn_risk_monitoring'

/** Confirm, then delete an action plan. */
export function useDeleteActionPlan() {
  const del = useDeleteRow(MONITORING)
  const confirm = useConfirm()
  const remove = async (row: Row) => {
    const id = rowId(row)
    if (id == null) return
    const ok = await confirm({
      title: 'Delete this action plan?',
      description: `“${text(row.monitoring_title) ?? `Action plan #${id}`}” will be permanently deleted.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await del.mutateAsync(id)
      toast.success('Action plan deleted')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }
  return { remove, isPending: del.isPending }
}

interface FormState {
  title: string
  goal: string
  rootCause: string
  owner: string
  riskId: number | null
  estStart: string
  estEnd: string
  actStart: string
  actEnd: string
  pct: string
  complete: boolean
}

function initial(row: Row | null | undefined, riskId: number | null | undefined): FormState {
  const pct = numOrNull(row?.completion_pct)
  return {
    title: text(row?.monitoring_title) ?? '',
    goal: text(row?.monitoring_goal) ?? '',
    rootCause: text(row?.root_cause) ?? '',
    owner: text(row?.mitigation_owner) ?? '',
    riskId: numOrNull(row?.identify_risk_uuid) ?? riskId ?? null,
    estStart: toDateInput(text(row?.estimated_start_date)),
    estEnd: toDateInput(text(row?.estimated_end_date)),
    actStart: toDateInput(text(row?.actual_start_date)),
    actEnd: toDateInput(text(row?.actual_end_date)),
    pct: pct == null ? '' : String(pct),
    complete: row?.is_stage_complted === 'Y',
  }
}

export function ActionPlanDialog({
  open,
  onOpenChange,
  row,
  riskId,
  defaultRiskId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  row?: Row | null
  /** Fix the risk (hides the risk picker). */
  riskId?: number | null
  /** Pre-select a risk in the picker (still changeable). */
  defaultRiskId?: number | null
}) {
  const editing = !!row
  const [form, setForm] = useState<FormState>(() => initial(row, riskId ?? defaultRiskId))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const create = useCreateRow(MONITORING)
  const update = useUpdateRow(MONITORING)
  const saving = create.isPending || update.isPending

  useEffect(() => {
    if (open) {
      setForm(initial(row, riskId ?? defaultRiskId))
      setErrors({})
    }
  }, [open, row, riskId, defaultRiskId])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = 'A title is required.'
    if (form.riskId == null) e.risk = 'Choose the risk this action plan treats.'
    if (form.estStart && form.estEnd && form.estEnd < form.estStart) e.estEnd = 'Target end must be on or after the planned start.'
    if (form.actStart && form.actEnd && form.actEnd < form.actStart) e.actEnd = 'Actual end must be on or after the actual start.'
    if (form.actEnd && !form.actStart) e.actStart = 'Enter the actual start date too.'
    if (form.pct !== '') {
      const n = Number(form.pct)
      if (!Number.isFinite(n) || n < 0 || n > 100) e.pct = 'Completion must be between 0 and 100.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    const pct = form.complete ? 100 : form.pct === '' ? null : Math.round(Number(form.pct))
    const values: Row = {
      monitoring_title: form.title.trim(),
      monitoring_goal: form.goal.trim(),
      root_cause: form.rootCause.trim(),
      mitigation_owner: form.owner.trim(),
      identify_risk_uuid: form.riskId,
      risk_uuid: form.riskId,
      estimated_start_date: form.estStart,
      estimated_end_date: form.estEnd,
      actual_start_date: form.actStart,
      actual_end_date: form.actEnd,
      completion_pct: pct,
      is_stage_complted: form.complete || pct === 100 ? 'Y' : 'N',
    }
    try {
      const id = rowId(row)
      if (editing && id != null) await update.mutateAsync({ id, values })
      else await create.mutateAsync(values)
      toast.success(editing ? 'Action plan updated' : 'Action plan created')
      onOpenChange(false)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const dateField = (key: 'estStart' | 'estEnd' | 'actStart' | 'actEnd', label: string) => (
    <div>
      <label htmlFor={`ap-${key}`} className={labelCls}>
        {label}
      </label>
      <Input
        id={`ap-${key}`}
        type="date"
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `ap-${key}-error` : undefined}
      />
      <FieldError id={`ap-${key}-error`} message={errors[key]} />
    </div>
  )

  const pctNum = form.complete ? 100 : form.pct === '' ? null : Number(form.pct)
  const pctValid = pctNum != null && Number.isFinite(pctNum) && pctNum >= 0 && pctNum <= 100

  return (
    <Dialog open={open} onOpenChange={o => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit action plan' : 'New action plan'}</DialogTitle>
          <DialogDescription>An action that treats a risk, with an owner, target dates and progress.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <FormSection title="Action">
            <div>
              <label htmlFor="ap-title" className={labelCls}>
                Title <span className="text-status-danger-fg" aria-hidden="true">*</span>
              </label>
              <Input
                id="ap-title"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="e.g. Automate the daily reconciliation"
                aria-invalid={!!errors.title}
                aria-required="true"
                aria-describedby={errors.title ? 'ap-title-error' : undefined}
              />
              <FieldError id="ap-title-error" message={errors.title} />
            </div>

            {riskId == null && <RiskSelect id="ap-risk" value={form.riskId} onChange={v => set('riskId', v)} error={errors.risk} />}

            <div>
              <label htmlFor="ap-owner" className={labelCls}>
                Owner
              </label>
              <Input id="ap-owner" value={form.owner} onChange={e => set('owner', e.target.value)} placeholder="Person or team responsible" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ap-goal" className={labelCls}>
                  Goal
                </label>
                <Textarea id="ap-goal" rows={2} value={form.goal} onChange={e => set('goal', e.target.value)} placeholder="What does done look like?" />
              </div>
              <div>
                <label htmlFor="ap-root" className={labelCls}>
                  Root cause
                </label>
                <Textarea id="ap-root" rows={2} value={form.rootCause} onChange={e => set('rootCause', e.target.value)} placeholder="Why the risk exists" />
              </div>
            </div>
          </FormSection>

          <FormSection title="Schedule">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {dateField('estStart', 'Planned start')}
              {dateField('estEnd', 'Target end')}
              {dateField('actStart', 'Actual start')}
              {dateField('actEnd', 'Actual end')}
            </div>
            <p className={helpCls}>Overdue is worked out from the target end date; an actual end date marks the plan complete.</p>
          </FormSection>

          <FormSection title="Progress">
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
              <div>
                <label htmlFor="ap-pct" className={labelCls}>
                  Completion (%)
                </label>
                <Input
                  id="ap-pct"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={1}
                  value={form.complete ? '100' : form.pct}
                  disabled={form.complete}
                  onChange={e => set('pct', e.target.value)}
                  aria-invalid={!!errors.pct}
                  aria-describedby={errors.pct ? 'ap-pct-error' : undefined}
                  className="tabular-nums"
                />
                <FieldError id="ap-pct-error" message={errors.pct} />
              </div>
              <div className="space-y-3 sm:pt-[30px]">
                <Meter value={pctValid ? pctNum : null} label="Completion preview" tone={pctValid && pctNum! >= 100 ? 'bg-status-success' : 'bg-primary'} />
                <CheckboxField id="ap-complete" checked={form.complete} onChange={v => set('complete', v)} label="Mark as complete" help="Sets completion to 100%." />
              </div>
            </div>
          </FormSection>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {editing ? 'Save changes' : 'Create action plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
