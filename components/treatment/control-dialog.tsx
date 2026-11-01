'use client'

/**
 * Apply a library control (erm_mst_control) to a risk, or edit an applied control
 * (per_trn_control_implementation). control_id stores the library control's uuid, and an
 * erm_lnk_control_risk row is kept in step so the control library shows the link.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, CircleCheck, Loader2, OctagonAlert, Search } from 'lucide-react'
import { Chip } from '@/components/charter/primitives'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fetchAllRows, useCreateRow, useDeleteRow, useRow, useRowPage, useRows, useUpdateRow, type Row } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { cn } from '@/lib/utils'
import { DASH } from '@/lib/format'
import { RiskSelect } from './risk-select'
import {
  CONTROL_TYPE_OPTIONS,
  CheckboxField,
  ChoiceGroup,
  EFFECTIVENESS_CHOICES,
  FieldError,
  FormSection,
  FREQUENCY_OPTIONS,
  OPERATING_CHOICES,
  helpCls,
  labelCls,
  numOrNull,
  rowId,
  selectCls,
  text,
} from './shared'

const IMPL = 'per_trn_control_implementation'
const LINK = 'erm_lnk_control_risk'
const LIB = 'erm_mst_control'

/** Create / remove erm_lnk_control_risk rows alongside applied controls. */
export function useControlRiskLinks() {
  const createLink = useCreateRow(LINK, { alsoInvalidate: [IMPL, LIB] })
  const deleteLink = useDeleteRow(LINK, { alsoInvalidate: [IMPL, LIB] })

  const link = async (controlUuid: number, riskUuid: number) => {
    const existing = await fetchAllRows(LINK, { control_uuid: controlUuid, risk_uuid: riskUuid })
    if (existing.length === 0) await createLink.mutateAsync({ control_uuid: controlUuid, risk_uuid: riskUuid })
  }

  /** Remove the link unless another applied control still uses this library control on this risk. */
  const unlinkIfUnused = async (controlUuid: number, riskUuid: number, ignoreImplId?: number | null) => {
    const impls = await fetchAllRows(IMPL, { identify_risk_uuid: riskUuid, control_id: controlUuid })
    if (impls.some(i => rowId(i) !== ignoreImplId)) return
    const links = await fetchAllRows(LINK, { control_uuid: controlUuid, risk_uuid: riskUuid })
    for (const l of links) {
      const id = rowId(l)
      if (id != null) await deleteLink.mutateAsync(id)
    }
  }

  return { link, unlinkIfUnused }
}

/** Delete an applied control (after the caller has confirmed) and tidy its library link. */
export function useRemoveAppliedControl() {
  const del = useDeleteRow(IMPL, { alsoInvalidate: [LINK, LIB] })
  const { unlinkIfUnused } = useControlRiskLinks()
  const remove = async (row: Row) => {
    const id = rowId(row)
    if (id == null) return
    await del.mutateAsync(id)
    const controlId = numOrNull(row.control_id)
    const riskId = numOrNull(row.identify_risk_uuid)
    if (controlId != null && riskId != null) {
      try {
        await unlinkIfUnused(controlId, riskId, id)
      } catch (err) {
        toast.warning(`Control removed, but its library link could not be removed: ${apiErrorMessage(err)}`)
      }
    }
  }
  return { remove, isPending: del.isPending }
}

function LibraryControlPicker({
  value,
  onPick,
  appliedIds,
  error,
}: {
  value: number | null
  onPick: (row: Row) => void
  appliedIds: Set<number>
  error?: string
}) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(t)
  }, [search])
  const pageQ = useRowPage(LIB, { page: 1, pageSize: 8, search: debounced, sort: 'control_code', order: 'asc' })
  const selectedQ = useRow(LIB, value)
  const items = pageQ.data?.items ?? []

  return (
    <div>
      <label htmlFor="ctl-lib-search" className={labelCls}>
        Library control <span className="text-status-danger-fg" aria-hidden="true">*</span>
      </label>
      {value != null && (
        <div className="mb-2 flex items-center gap-3 rounded-md bg-accent px-3 py-2 shadow-[inset_3px_0_0_var(--primary)]">
          <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 text-body-sm">
            <span className="text-muted-foreground">Selected </span>
            {selectedQ.data ? (
              <>
                <span className="font-mono text-caption text-foreground-secondary">{text(selectedQ.data.control_code) ?? DASH}</span>{' '}
                <span className="font-medium text-foreground">{text(selectedQ.data.control_name) ?? `Control #${value}`}</span>
              </>
            ) : selectedQ.isError ? (
              <span className="text-foreground">Control #{value} (not found in the library)</span>
            ) : (
              <span className="text-muted-foreground">Loading…</span>
            )}
          </span>
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id="ctl-lib-search"
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by code, name, owner or framework…"
          className="pl-9"
          aria-invalid={!!error}
          aria-describedby={error ? 'ctl-lib-error' : 'ctl-lib-help'}
        />
      </div>
      <div className="mt-2 max-h-56 overflow-y-auto rounded-md bg-card shadow-[inset_0_0_0_1px_var(--border)]" role="listbox" aria-label="Library controls">
        {pageQ.isLoading ? (
          <div className="space-y-2 p-3" aria-label="Loading library">
            <span className="skeleton block h-4 w-3/4" />
            <span className="skeleton block h-4 w-1/2" />
          </div>
        ) : pageQ.isError ? (
          <p className="flex items-center gap-2 p-3 text-body-sm text-status-danger-fg">
            <OctagonAlert className="size-4" aria-hidden="true" />
            {apiErrorMessage(pageQ.error)}
          </p>
        ) : items.length === 0 ? (
          <p className="p-3 text-body-sm text-muted-foreground">
            {debounced ? 'No library controls match this search.' : 'The control library is empty. Add controls in the Control library first.'}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map(c => {
              const id = rowId(c)!
              const selected = id === value
              const retired = String(c.status ?? '').toLowerCase() === 'retired'
              const applied = appliedIds.has(id) && !selected
              const meta = [text(c.control_type), text(c.frequency), text(c.owner_name)].filter(Boolean).join(' · ')
              return (
                <li key={id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={retired || applied}
                    onClick={() => onPick(c)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-(--duration-fast) ease-out focus-ring hover:bg-hover disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-transparent',
                      selected && 'bg-accent shadow-[inset_3px_0_0_var(--primary)] hover:bg-accent',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm font-medium text-foreground">{text(c.control_name) ?? `Control #${id}`}</span>
                      <span className="block truncate text-caption text-muted-foreground">
                        <span className="font-mono">{text(c.control_code) ?? DASH}</span>
                        {meta && ` · ${meta}`}
                      </span>
                    </span>
                    {applied ? (
                      <Chip tone="neutral" icon={Check}>Applied</Chip>
                    ) : retired ? (
                      <Chip tone="neutral" icon={null}>Retired</Chip>
                    ) : selected ? (
                      <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {error ? (
        <FieldError id="ctl-lib-error" message={error} />
      ) : (
        <p id="ctl-lib-help" className={helpCls}>
          {(pageQ.data?.total ?? 0) > items.length
            ? `Showing ${items.length} of ${pageQ.data?.total}. Refine the search to find others.`
            : 'Retired controls and controls already applied to this risk cannot be chosen.'}
        </p>
      )}
    </div>
  )
}

interface FormState {
  riskId: number | null
  controlId: number | null
  controlType: string
  frequency: string
  design: string
  operating: string
  evidence: string
  complete: boolean
}

function initialState(row: Row | null | undefined, riskId: number | null | undefined): FormState {
  return {
    riskId: numOrNull(row?.identify_risk_uuid) ?? riskId ?? null,
    controlId: numOrNull(row?.control_id),
    controlType: text(row?.control_type) ?? '',
    frequency: text(row?.control_frequency) ?? '',
    design: text(row?.control_design_effectiveness) ?? '',
    operating: text(row?.control_effectiveness_rating) ?? '',
    evidence: text(row?.evidence_notes) ?? '',
    complete: row?.is_stage_complted === 'Y',
  }
}

/** Keep a legacy value visible in a select even when it isn't one of the standard options. */
function withCurrent(options: readonly string[], current: string): string[] {
  return current && !options.includes(current) ? [current, ...options] : [...options]
}
function withCurrentChoice<T extends { value: string; label: string }>(options: T[], current: string): { value: string; label: string }[] {
  return current && !options.some(o => o.value === current) ? [...options, { value: current, label: current }] : options
}

export function ControlImplementationDialog({
  open,
  onOpenChange,
  row,
  riskId,
  defaultRiskId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The applied control to edit; omit to apply a new one. */
  row?: Row | null
  /** Fix the risk (the risk picker is hidden). */
  riskId?: number | null
  /** Pre-select a risk in the picker (still changeable). */
  defaultRiskId?: number | null
}) {
  const editing = !!row
  const [form, setForm] = useState<FormState>(() => initialState(row, riskId ?? defaultRiskId))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initialState(row, riskId ?? defaultRiskId))
      setErrors({})
    }
  }, [open, row, riskId, defaultRiskId])

  const create = useCreateRow(IMPL, { alsoInvalidate: [LINK, LIB] })
  const update = useUpdateRow(IMPL, { alsoInvalidate: [LINK, LIB] })
  const { link, unlinkIfUnused } = useControlRiskLinks()

  const appliedQ = useRows(IMPL, { filter: { identify_risk_uuid: form.riskId ?? 0 }, enabled: open && form.riskId != null })
  const appliedIds = useMemo(() => {
    const s = new Set<number>()
    for (const r of appliedQ.data ?? []) {
      if (editing && rowId(r) === rowId(row)) continue
      const c = numOrNull(r.control_id)
      if (c != null) s.add(c)
    }
    return s
  }, [appliedQ.data, editing, row])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (form.riskId == null) e.risk = 'Choose the risk this control mitigates.'
    const originalControl = numOrNull(row?.control_id)
    if (form.controlId == null && (!editing || originalControl != null)) e.control = 'Choose a control from the library.'
    if (form.controlId != null && appliedIds.has(form.controlId)) e.control = 'This library control is already applied to this risk.'
    if (form.evidence.length > 4000) e.evidence = 'Evidence notes must be at most 4000 characters.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    const values: Row = {
      identify_risk_uuid: form.riskId,
      risk_uuid: form.riskId,
      control_id: form.controlId,
      control_type: form.controlType,
      control_frequency: form.frequency,
      control_design_effectiveness: form.design,
      control_effectiveness_rating: form.operating,
      evidence_notes: form.evidence.trim(),
      is_stage_complted: form.complete ? 'Y' : 'N',
    }
    setSaving(true)
    try {
      const id = rowId(row)
      if (editing && id != null) {
        await update.mutateAsync({ id, values })
      } else {
        await create.mutateAsync(values)
      }
      // Keep the control library's control–risk links in step.
      try {
        const oldControl = numOrNull(row?.control_id)
        const oldRisk = numOrNull(row?.identify_risk_uuid)
        if (form.controlId != null && form.riskId != null) await link(form.controlId, form.riskId)
        if (editing && oldControl != null && oldRisk != null && (oldControl !== form.controlId || oldRisk !== form.riskId)) {
          await unlinkIfUnused(oldControl, oldRisk)
        }
      } catch (err) {
        toast.warning(`Saved, but the control library link could not be updated: ${apiErrorMessage(err)}`)
      }
      toast.success(editing ? 'Applied control updated' : 'Control applied to the risk')
      onOpenChange(false)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit applied control' : 'Apply a control'}</DialogTitle>
          <DialogDescription>Link a control from the library to the risk and record how well it is designed and operating.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <FormSection title="Control">
            {riskId == null && <RiskSelect id="ctl-risk" value={form.riskId} onChange={v => set('riskId', v)} error={errors.risk} />}

            <LibraryControlPicker
              value={form.controlId}
              appliedIds={appliedIds}
              error={errors.control}
              onPick={c => {
                setForm(f => ({
                  ...f,
                  controlId: rowId(c),
                  controlType: f.controlType || text(c.control_type) || '',
                  frequency: f.frequency || text(c.frequency) || '',
                }))
              }}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ctl-type" className={labelCls}>
                  Control type
                </label>
                <select id="ctl-type" className={selectCls} value={form.controlType} onChange={e => set('controlType', e.target.value)}>
                  <option value="">Not set</option>
                  {withCurrent(CONTROL_TYPE_OPTIONS, form.controlType).map(o => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ctl-frequency" className={labelCls}>
                  Frequency
                </label>
                <select id="ctl-frequency" className={selectCls} value={form.frequency} onChange={e => set('frequency', e.target.value)}>
                  <option value="">Not set</option>
                  {withCurrent(FREQUENCY_OPTIONS, form.frequency).map(o => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>
          </FormSection>

          <FormSection title="Effectiveness">
            <ChoiceGroup
              legend="Design effectiveness"
              name="ctl-design"
              value={form.design}
              onChange={v => set('design', v)}
              options={withCurrentChoice(EFFECTIVENESS_CHOICES, form.design)}
              help="Would the control mitigate the risk if it operated as designed?"
            />
            <ChoiceGroup
              legend="Operating effectiveness (test result)"
              name="ctl-operating"
              value={form.operating}
              onChange={v => set('operating', v)}
              options={withCurrentChoice(OPERATING_CHOICES, form.operating)}
              help="The result of the latest test of the control in operation."
            />
            <div>
              <label htmlFor="ctl-evidence" className={labelCls}>
                Evidence notes
              </label>
              <Textarea
                id="ctl-evidence"
                rows={3}
                value={form.evidence}
                onChange={e => set('evidence', e.target.value)}
                placeholder="What was tested, the sample, where the evidence is filed…"
                aria-invalid={!!errors.evidence}
                aria-describedby={errors.evidence ? 'ctl-evidence-error' : 'ctl-evidence-help'}
              />
              {errors.evidence ? (
                <FieldError id="ctl-evidence-error" message={errors.evidence} />
              ) : (
                <p id="ctl-evidence-help" className={helpCls}>
                  {form.evidence.length} / 4000 characters
                </p>
              )}
            </div>
            <CheckboxField id="ctl-complete" checked={form.complete} onChange={v => set('complete', v)} label="Assessment of this control is complete" help="Marks the test as finished for this cycle." />
          </FormSection>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {editing ? 'Save changes' : 'Apply control'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
