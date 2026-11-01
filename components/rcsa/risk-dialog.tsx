'use client'

/** Create / edit one row of the risk register (per_trn_identify_risk). */
import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCreateRow, useRows, useUpdateRow, type Row } from '@/lib/data'
import { scoreOf, toRisk } from '@/lib/risk'
import { apiErrorMessage } from '@/lib/apiClient'
import { useOrgSettings } from '@/lib/settings'
import { useAuth } from '@/components/providers/auth-provider'
import { BandBadge } from '@/components/band-badge'
import { Field, RatingSelect, selectClass, textareaClass, useNameOptions } from './shared'

export const RISK_TABLE = 'per_trn_identify_risk'
export const CYCLE_TABLE = 'erm_trn_assessment_cycle'

interface FormState {
  risk_statement: string
  risk_type: string
  process_name: string
  sub_process_name: string
  risk_owner: string
  risk_champion: string
  assessment_cycle_uuid: string
  inherent_likelihood: string
  inherent_impact: string
  inherent_sle: string
}

function initial(risk: Row | null | undefined, cycleUuid?: string | number | null): FormState {
  const r = risk ? toRisk(risk) : null
  return {
    risk_statement: r?.statement ?? '',
    risk_type: r?.category ?? '',
    process_name: r?.process ?? '',
    sub_process_name: r?.subProcess ?? '',
    risk_owner: r?.owner ?? '',
    risk_champion: r?.champion ?? '',
    assessment_cycle_uuid: r?.cycleUuid != null ? String(r.cycleUuid) : cycleUuid != null ? String(cycleUuid) : '',
    inherent_likelihood: r?.inherentLikelihood != null ? String(r.inherentLikelihood) : '',
    inherent_impact: r?.inherentImpact != null ? String(r.inherentImpact) : '',
    inherent_sle: r?.sle != null ? String(r.sle) : '',
  }
}

function validate(f: FormState): Partial<Record<keyof FormState, string>> {
  const e: Partial<Record<keyof FormState, string>> = {}
  if (!f.risk_statement.trim()) e.risk_statement = 'Risk statement is required.'
  else if (f.risk_statement.trim().length > 4000) e.risk_statement = 'Keep the statement under 4000 characters.'
  if (!!f.inherent_likelihood !== !!f.inherent_impact) {
    if (!f.inherent_likelihood) e.inherent_likelihood = 'Rate likelihood too, or leave both unrated.'
    else e.inherent_impact = 'Rate impact too, or leave both unrated.'
  }
  if (f.inherent_sle.trim()) {
    const n = Number(f.inherent_sle)
    if (!Number.isFinite(n) || n < 0) e.inherent_sle = 'Enter a positive amount, or leave it empty.'
  }
  return e
}

export function RiskDialog({
  open,
  onOpenChange,
  risk,
  cycleUuid,
  lockCycle,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The row to edit; omit to create. */
  risk?: Row | null
  /** Default (or fixed, with lockCycle) assessment cycle for a new risk. */
  cycleUuid?: string | number | null
  lockCycle?: boolean
  onSaved?: (row: Row) => void
}) {
  const editing = !!risk
  const { settings } = useOrgSettings()
  const { hasPermission } = useAuth()
  const [form, setForm] = useState<FormState>(() => initial(risk, cycleUuid))
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const create = useCreateRow(RISK_TABLE)
  const update = useUpdateRow(RISK_TABLE)
  const cycles = useRows(CYCLE_TABLE, { enabled: open && !lockCycle })
  const allRisks = useRows(RISK_TABLE, { enabled: open })

  useEffect(() => {
    if (open) {
      setForm(initial(risk, cycleUuid))
      setErrors({})
    }
    // Reset only when the dialog opens or the record changes, not on every background refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, risk?.uuid, cycleUuid])

  const used = useMemo(() => (allRisks.data ?? []).map(toRisk), [allRisks.data])
  const categories = useNameOptions(open ? 'per_mst_risk_category' : null, useMemo(() => used.map(r => r.category), [used]))
  const processes = useNameOptions(open ? 'per_mst_business_process' : null, useMemo(() => used.map(r => r.process), [used]))
  const owners = useMemo(() => [...new Set(used.flatMap(r => [r.owner, r.champion]).filter((x): x is string => !!x))].sort(), [used])

  const set = (k: keyof FormState) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  const l = form.inherent_likelihood ? Number(form.inherent_likelihood) : null
  const i = form.inherent_impact ? Number(form.inherent_impact) : null
  const busy = create.isPending || update.isPending
  const wasApproved = editing && String(risk?.approval_status ?? '').toUpperCase() === 'APPROVED'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    const values: Row = {
      risk_statement: form.risk_statement.trim(),
      risk_type: form.risk_type.trim(),
      process_name: form.process_name.trim(),
      sub_process_name: form.sub_process_name.trim(),
      risk_owner: form.risk_owner.trim(),
      risk_champion: form.risk_champion.trim(),
      inherent_likelihood: form.inherent_likelihood,
      inherent_impact: form.inherent_impact,
      inherent_sle: form.inherent_sle.trim(),
    }
    if (!lockCycle || !editing) values.assessment_cycle_uuid = form.assessment_cycle_uuid
    try {
      const saved = editing ? await update.mutateAsync({ id: risk!.uuid ?? risk!.id, values }) : await create.mutateAsync(values)
      toast.success(editing ? 'Risk updated' : 'Risk added to the register')
      onOpenChange(false)
      onSaved?.(saved)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-white border-slate-200 rounded-lg p-5 text-xs max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-slate-900">{editing ? 'Edit risk' : 'Add risk'}</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {editing ? 'Update the risk details and its inherent rating.' : 'Record a risk with its inherent likelihood and impact. Ratings can be added later.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-3">
          <Field id="risk-statement" label="Risk statement" required error={errors.risk_statement}>
            <textarea id="risk-statement" rows={3} value={form.risk_statement} onChange={e => set('risk_statement')(e.target.value)} className={textareaClass} aria-invalid={!!errors.risk_statement || undefined} aria-describedby={errors.risk_statement ? 'risk-statement-error' : undefined} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="risk-category" label="Category">
              <Input id="risk-category" list="risk-category-options" value={form.risk_type} onChange={e => set('risk_type')(e.target.value)} className="h-8 text-xs" />
              <datalist id="risk-category-options">{categories.map(c => <option key={c} value={c} />)}</datalist>
            </Field>
            {!lockCycle && (
              <Field id="risk-cycle" label="Assessment cycle" hint={cycles.isError ? 'Cycles could not be loaded.' : undefined}>
                <select id="risk-cycle" value={form.assessment_cycle_uuid} onChange={e => set('assessment_cycle_uuid')(e.target.value)} className={selectClass}>
                  <option value="">No cycle</option>
                  {(cycles.data ?? []).map(c => (
                    <option key={c.uuid} value={String(c.uuid)}>
                      {c.cycle_reference ? `${c.cycle_reference} · ` : ''}
                      {c.cycle_name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field id="risk-process" label="Business process">
              <Input id="risk-process" list="risk-process-options" value={form.process_name} onChange={e => set('process_name')(e.target.value)} className="h-8 text-xs" />
              <datalist id="risk-process-options">{processes.map(c => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field id="risk-subprocess" label="Sub-process">
              <Input id="risk-subprocess" value={form.sub_process_name} onChange={e => set('sub_process_name')(e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field id="risk-owner" label="Risk owner">
              <Input id="risk-owner" list="risk-people-options" value={form.risk_owner} onChange={e => set('risk_owner')(e.target.value)} className="h-8 text-xs" />
            </Field>
            <Field id="risk-champion" label="Risk champion">
              <Input id="risk-champion" list="risk-people-options" value={form.risk_champion} onChange={e => set('risk_champion')(e.target.value)} className="h-8 text-xs" />
            </Field>
            <datalist id="risk-people-options">{owners.map(c => <option key={c} value={c} />)}</datalist>
          </div>

          <fieldset className="rounded border border-slate-200 p-3 space-y-3">
            <legend className="px-1 text-xs font-semibold text-slate-900">Inherent rating</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field id="risk-likelihood" label="Likelihood" error={errors.inherent_likelihood}>
                <RatingSelect id="risk-likelihood" kind="likelihood" value={form.inherent_likelihood} onChange={set('inherent_likelihood')} invalid={!!errors.inherent_likelihood} />
              </Field>
              <Field id="risk-impact" label="Impact" error={errors.inherent_impact}>
                <RatingSelect id="risk-impact" kind="impact" value={form.inherent_impact} onChange={set('inherent_impact')} invalid={!!errors.inherent_impact} />
              </Field>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <span>Inherent score (likelihood × impact)</span>
              <BandBadge score={scoreOf(l, i)} />
            </div>
            <Field id="risk-sle" label={`Single loss expectancy (${settings.currency})`} error={errors.inherent_sle} hint="Optional. The estimated loss from one occurrence.">
              <Input id="risk-sle" type="number" min={0} step="any" inputMode="decimal" value={form.inherent_sle} onChange={e => set('inherent_sle')(e.target.value)} className="h-8 text-xs" aria-invalid={!!errors.inherent_sle || undefined} />
            </Field>
          </fieldset>

          {wasApproved && !hasPermission('approve') && <p className="text-[11px] text-amber-700">This risk is approved. Saving changes sends it back for review.</p>}

          <DialogFooter className="pt-2 border-t border-slate-200">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add risk'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
