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
import { FieldError, labelCls, numOrNull, rowId, text } from './shared'

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

  return (
    <Dialog open={open} onOpenChange={o => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base text-slate-900">{editing ? 'Edit action plan' : 'New action plan'}</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">An action that treats a risk, with an owner, target dates and progress.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="ap-title" className={labelCls}>
              Title *
            </label>
            <Input
              id="ap-title"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? 'ap-title-error' : undefined}
            />
            <FieldError id="ap-title-error" message={errors.title} />
          </div>

          {riskId == null && <RiskSelect id="ap-risk" value={form.riskId} onChange={v => set('riskId', v)} error={errors.risk} />}

          <div>
            <label htmlFor="ap-goal" className={labelCls}>
              Goal
            </label>
            <Textarea id="ap-goal" rows={2} value={form.goal} onChange={e => set('goal', e.target.value)} />
          </div>
          <div>
            <label htmlFor="ap-root" className={labelCls}>
              Root cause
            </label>
            <Textarea id="ap-root" rows={2} value={form.rootCause} onChange={e => set('rootCause', e.target.value)} />
          </div>
          <div>
            <label htmlFor="ap-owner" className={labelCls}>
              Owner
            </label>
            <Input id="ap-owner" value={form.owner} onChange={e => set('owner', e.target.value)} placeholder="Person or team responsible" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dateField('estStart', 'Planned start')}
            {dateField('estEnd', 'Target end')}
            {dateField('actStart', 'Actual start')}
            {dateField('actEnd', 'Actual end')}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label htmlFor="ap-pct" className={labelCls}>
                Completion (%)
              </label>
              <Input
                id="ap-pct"
                type="number"
                min={0}
                max={100}
                step={1}
                value={form.complete ? '100' : form.pct}
                disabled={form.complete}
                onChange={e => set('pct', e.target.value)}
                aria-invalid={!!errors.pct}
                aria-describedby={errors.pct ? 'ap-pct-error' : undefined}
              />
              <FieldError id="ap-pct-error" message={errors.pct} />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <input id="ap-complete" type="checkbox" className="h-4 w-4" checked={form.complete} onChange={e => set('complete', e.target.checked)} />
              <label htmlFor="ap-complete" className="text-sm text-slate-700">
                Mark as complete
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" aria-hidden="true" />}
            {editing ? 'Save changes' : 'Create action plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
