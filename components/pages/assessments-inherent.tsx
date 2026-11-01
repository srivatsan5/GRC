'use client'

/**
 * /assessments/inherent?riskId=… — inherent assessment of ONE existing risk.
 * Saving updates the risk's inherent rating / SLE and adds a per_trn_inherent_risk_assessment
 * record. It never creates a risk.
 */
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState, EmptyState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { BandBadge } from '@/components/band-badge'
import { useCreateRow, useRow, useRowPage, useRows, useUpdateRow, type Row } from '@/lib/data'
import { scoreOf, toRisk } from '@/lib/risk'
import { formatDate, formatDateTime } from '@/lib/format'
import { useOrgSettings } from '@/lib/settings'
import { apiErrorMessage } from '@/lib/apiClient'
import { ApprovalBadge, Field, RatingSelect, RcsaStepper, ratingLabel, textareaClass, useDebounced } from '@/components/rcsa/shared'
import { CYCLE_TABLE, RISK_TABLE } from '@/components/rcsa/risk-dialog'

const ASSESSMENT_TABLE = 'per_trn_inherent_risk_assessment'

export function AssessmentsinherentPage() {
  const router = useRouter()
  const [riskId, setRiskId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const read = () => {
      const id = new URLSearchParams(window.location.search).get('riskId')
      setRiskId(id && /^\d+$/.test(id) ? id : null)
      setReady(true)
    }
    read()
    window.addEventListener('popstate', read)
    return () => window.removeEventListener('popstate', read)
  }, [])

  function choose(id: string | null) {
    setRiskId(id)
    router.replace(id ? `/assessments/inherent?riskId=${id}` : '/assessments/inherent', { scroll: false })
  }

  return (
    <div className="space-y-6 font-sans">
      <RcsaStepper active="inherent" />
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-lg font-semibold text-slate-900">Inherent assessment</h1>
        <p className="text-xs text-slate-500">Rate a risk&apos;s likelihood and impact before controls, and record the reasoning.</p>
      </div>
      {!ready ? null : riskId ? <Assessment riskId={riskId} onChange={() => choose(null)} /> : <RiskPicker onPick={id => choose(String(id))} />}
    </div>
  )
}

function RiskPicker({ onPick }: { onPick: (id: number) => void }) {
  const [page, setPage] = useState(1)
  const [input, setInput] = useState('')
  const search = useDebounced(input)
  const [unratedOnly, setUnratedOnly] = useState(false)
  const q = useRowPage(RISK_TABLE, { page, pageSize: 10, search, sort: 'created_on', order: 'desc', filter: unratedOnly ? { inherent_likelihood: null } : undefined })
  const items = q.data?.items ?? []

  return (
    <div className="bg-white rounded border border-slate-200">
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="pick-search" className="block text-xs text-slate-700 font-medium mb-1">
            Choose the risk to assess
          </label>
          <div className="relative w-80">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <Input
              id="pick-search"
              placeholder="Search statement, process, owner…"
              value={input}
              onChange={e => {
                setInput(e.target.value)
                setPage(1)
              }}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>
        <label htmlFor="pick-unrated" className="flex items-center gap-2 text-xs text-slate-700 pb-1.5">
          <input
            id="pick-unrated"
            type="checkbox"
            checked={unratedOnly}
            onChange={e => {
              setUnratedOnly(e.target.checked)
              setPage(1)
            }}
          />
          Only risks without an inherent likelihood
        </label>
      </div>
      <DataState query={q} empty={items.length === 0} emptyTitle={search || unratedOnly ? 'No risks match' : 'The risk register is empty'} emptyAction={<Link href="/rcsa/identification" className="text-xs text-blue-800 hover:underline">Go to the risk register</Link>}>
        <table className="enterprise-table">
          <thead>
            <tr>
              <th>Risk</th>
              <th>Category</th>
              <th>Owner</th>
              <th>Inherent</th>
              <th className="text-right">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map(row => {
              const r = toRisk(row)
              return (
                <tr key={r.uuid}>
                  <td className="font-medium text-slate-900">{r.statement ?? <span className="italic text-slate-400">No statement recorded</span>}</td>
                  <td>{r.category ?? '—'}</td>
                  <td>{r.owner ?? '—'}</td>
                  <td>
                    <BandBadge score={r.inherentScore} />
                  </td>
                  <td className="text-right">
                    <Button size="sm" variant="outline" onClick={() => onPick(r.uuid)}>
                      Assess
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <Pager page={page} pageSize={10} total={q.data?.total ?? 0} onPage={setPage} busy={q.isFetching} />
      </DataState>
    </div>
  )
}

interface FormState {
  likelihood: string
  impact: string
  sle: string
  owners: string
  description: string
  impactDescription: string
}

function Assessment({ riskId, onChange }: { riskId: string; onChange: () => void }) {
  const { hasPermission } = useAuth()
  const { settings, money } = useOrgSettings()
  const riskQ = useRow(RISK_TABLE, riskId)
  const history = useRows(ASSESSMENT_TABLE, { filter: { identify_risk_uuid: Number(riskId) } })
  const cycleId = riskQ.data ? toRisk(riskQ.data).cycleUuid : null
  const cycle = useRow(CYCLE_TABLE, cycleId)
  const updateRisk = useUpdateRow(RISK_TABLE, { alsoInvalidate: [ASSESSMENT_TABLE] })
  const createRecord = useCreateRow(ASSESSMENT_TABLE)
  const [form, setForm] = useState<FormState>({ likelihood: '', impact: '', sle: '', owners: '', description: '', impactDescription: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [saving, setSaving] = useState(false)
  const canEdit = hasPermission('update') && hasPermission('create')

  const risk = riskQ.data ? toRisk(riskQ.data) : null
  useEffect(() => {
    if (!risk) return
    setForm({
      likelihood: risk.inherentLikelihood != null ? String(risk.inherentLikelihood) : '',
      impact: risk.inherentImpact != null ? String(risk.inherentImpact) : '',
      sle: risk.sle != null ? String(risk.sle) : '',
      owners: risk.owner ?? '',
      description: '',
      impactDescription: '',
    })
    setErrors({})
    // Prefill once per risk, not on background refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [risk?.uuid])

  const records = useMemo(
    () => [...(history.data ?? [])].sort((a, b) => String(b.created_on ?? '').localeCompare(String(a.created_on ?? '')) || Number(b.uuid) - Number(a.uuid)),
    [history.data],
  )

  const set = (k: keyof FormState) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  const l = form.likelihood ? Number(form.likelihood) : null
  const i = form.impact ? Number(form.impact) : null

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const errs: Partial<Record<keyof FormState, string>> = {}
    if (!form.likelihood) errs.likelihood = 'Choose a likelihood.'
    if (!form.impact) errs.impact = 'Choose an impact.'
    if (form.sle.trim()) {
      const n = Number(form.sle)
      if (!Number.isFinite(n) || n < 0) errs.sle = 'Enter a positive amount, or leave it empty.'
    }
    if (!form.description.trim()) errs.description = 'Explain the basis for this rating.'
    setErrors(errs)
    if (Object.keys(errs).length || !risk) return

    setSaving(true)
    try {
      await updateRisk.mutateAsync({ id: risk.uuid, values: { inherent_likelihood: form.likelihood, inherent_impact: form.impact, inherent_sle: form.sle.trim() } })
    } catch (err) {
      toast.error(apiErrorMessage(err))
      setSaving(false)
      return
    }
    try {
      await createRecord.mutateAsync({
        identify_risk_uuid: risk.uuid,
        description: form.description.trim(),
        risk_owners: form.owners.trim(),
        risk_impact_description: form.impactDescription.trim(),
        is_active: 'Y',
      })
      toast.success('Inherent assessment saved')
      setForm(f => ({ ...f, description: '', impactDescription: '' }))
    } catch (err) {
      toast.error(`The rating was saved, but the assessment record was not: ${apiErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DataState query={riskQ}>
      {risk && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section aria-labelledby="risk-heading" className="bg-white rounded border border-slate-200 p-5 space-y-3 lg:col-span-1 h-fit">
            <div className="flex items-start justify-between gap-2">
              <h2 id="risk-heading" className="text-sm font-semibold text-slate-900">
                Risk
              </h2>
              <Button size="sm" variant="ghost" className="text-blue-800" onClick={onChange}>
                Choose another
              </Button>
            </div>
            <p className="text-sm text-slate-900">{risk.statement ?? <span className="italic text-slate-400">No statement recorded</span>}</p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <dt className="text-slate-500">Category</dt>
              <dd className="text-slate-900">{risk.category ?? '—'}</dd>
              <dt className="text-slate-500">Process</dt>
              <dd className="text-slate-900">{[risk.process, risk.subProcess].filter(Boolean).join(' › ') || '—'}</dd>
              <dt className="text-slate-500">Owner</dt>
              <dd className="text-slate-900">{risk.owner ?? '—'}</dd>
              <dt className="text-slate-500">Cycle</dt>
              <dd className="text-slate-900">
                {risk.cycleUuid != null ? (
                  <Link href={`/rcsa/provisioning/${risk.cycleUuid}`} className="text-blue-800 hover:underline">
                    {cycle.data ? cycle.data.cycle_reference || cycle.data.cycle_name : `Cycle #${risk.cycleUuid}`}
                  </Link>
                ) : (
                  '—'
                )}
              </dd>
              <dt className="text-slate-500">Current inherent</dt>
              <dd>
                <BandBadge score={risk.inherentScore} />
              </dd>
              <dt className="text-slate-500">Residual</dt>
              <dd>
                <BandBadge score={risk.residualScore} />
              </dd>
              <dt className="text-slate-500">SLE</dt>
              <dd className="text-slate-900 tabular-nums">{money(risk.sle)}</dd>
              <dt className="text-slate-500">Approval</dt>
              <dd>
                <ApprovalBadge status={risk.approvalStatus} />
              </dd>
            </dl>
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              <Button asChild size="sm" variant="outline">
                <Link href={risk.cycleUuid != null ? `/rcsa/provisioning/${risk.cycleUuid}/controls/${risk.uuid}` : `/rcsa/mitigation/${risk.uuid}`}>Next: controls &rarr;</Link>
              </Button>
            </div>
          </section>

          <div className="lg:col-span-2 space-y-6">
            <section aria-labelledby="assess-heading" className="bg-white rounded border border-slate-200 p-5">
              <h2 id="assess-heading" className="text-sm font-semibold text-slate-900 mb-3">
                New inherent assessment
              </h2>
              {!canEdit ? (
                <p className="text-xs text-slate-500">You have read-only access, so you can view this risk&apos;s assessments but not record a new one.</p>
              ) : (
                <form onSubmit={save} noValidate className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field id="ia-likelihood" label="Likelihood" required error={errors.likelihood}>
                      <RatingSelect id="ia-likelihood" kind="likelihood" value={form.likelihood} onChange={set('likelihood')} invalid={!!errors.likelihood} />
                    </Field>
                    <Field id="ia-impact" label="Impact" required error={errors.impact}>
                      <RatingSelect id="ia-impact" kind="impact" value={form.impact} onChange={set('impact')} invalid={!!errors.impact} />
                    </Field>
                    <div>
                      <span className="block text-xs text-slate-700 font-medium mb-1">Inherent score</span>
                      <div className="h-8 flex items-center">
                        <BandBadge score={scoreOf(l, i)} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field id="ia-sle" label={`Single loss expectancy (${settings.currency})`} error={errors.sle} hint="Optional. Estimated loss from one occurrence.">
                      <Input id="ia-sle" type="number" min={0} step="any" inputMode="decimal" value={form.sle} onChange={e => set('sle')(e.target.value)} className="h-8 text-xs" aria-invalid={!!errors.sle || undefined} />
                    </Field>
                    <Field id="ia-owners" label="Risk owners" hint="Who owns this risk (names or teams).">
                      <Input id="ia-owners" value={form.owners} onChange={e => set('owners')(e.target.value)} className="h-8 text-xs" />
                    </Field>
                  </div>
                  <Field id="ia-description" label="Basis for the rating" required error={errors.description}>
                    <textarea id="ia-description" rows={3} value={form.description} onChange={e => set('description')(e.target.value)} className={textareaClass} aria-invalid={!!errors.description || undefined} aria-describedby={errors.description ? 'ia-description-error' : undefined} placeholder="Causes, evidence and assumptions behind the likelihood and impact." />
                  </Field>
                  <Field id="ia-impact-desc" label="Impact description">
                    <textarea id="ia-impact-desc" rows={3} value={form.impactDescription} onChange={e => set('impactDescription')(e.target.value)} className={textareaClass} placeholder="What happens if the risk occurs, and who is affected." />
                  </Field>
                  {risk.approvalStatus === 'APPROVED' && !hasPermission('approve') && <p className="text-[11px] text-amber-700">This risk is approved. Changing its rating sends it back for review.</p>}
                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <Button type="submit" size="sm" disabled={saving}>
                      {saving ? 'Saving…' : 'Save assessment'}
                    </Button>
                  </div>
                </form>
              )}
            </section>

            <section aria-labelledby="history-heading" className="bg-white rounded border border-slate-200">
              <div className="p-4 border-b border-slate-200">
                <h2 id="history-heading" className="text-sm font-semibold text-slate-900">
                  Previous inherent assessments
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">The rating itself is stored on the risk; these records keep the reasoning given at each assessment.</p>
              </div>
              <DataState query={history} empty={records.length === 0} emptyTitle="No inherent assessments recorded for this risk yet" compact>
                <ul className="divide-y divide-slate-100">
                  {records.map(rec => (
                    <li key={rec.uuid ?? rec.id} className="p-4 text-xs space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-slate-500">
                        <span>{rec.created_on ? formatDateTime(rec.created_on) : formatDate(rec.updated_on)}</span>
                        {rec.created_by && <span>· {String(rec.created_by)}</span>}
                        {rec.is_active === 'N' && <span className="rounded border border-slate-200 bg-slate-50 px-1.5 text-[11px]">Inactive</span>}
                      </div>
                      <p className="text-slate-900 whitespace-pre-line">{rec.description || <span className="italic text-slate-400">No description</span>}</p>
                      {rec.risk_impact_description && (
                        <p className="text-slate-700 whitespace-pre-line">
                          <span className="font-medium">Impact: </span>
                          {rec.risk_impact_description}
                        </p>
                      )}
                      {rec.risk_owners && (
                        <p className="text-slate-600">
                          <span className="font-medium">Owners: </span>
                          {rec.risk_owners}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </DataState>
              {risk.inherentScore != null && (
                <p className="px-4 pb-3 text-[11px] text-slate-500">
                  Current rating: likelihood {ratingLabel('likelihood', risk.inherentLikelihood)}, impact {ratingLabel('impact', risk.inherentImpact)}.
                </p>
              )}
            </section>
          </div>
        </div>
      )}
      {!risk && !riskQ.isLoading && !riskQ.isError && <EmptyState title="Risk not found" />}
    </DataState>
  )
}
