'use client'

/**
 * /assessments/inherent?riskId=… — inherent assessment of ONE existing risk.
 * Saving updates the risk's inherent rating / SLE and adds a per_trn_inherent_risk_assessment
 * record. It never creates a risk.
 */
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, ExternalLink, History, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/components/providers/auth-provider'
import { DataState, EmptyState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { BandBadge, RiskMovement } from '@/components/band-badge'
import { LifecycleStepper } from '@/components/charter/lifecycle-stepper'
import { RiskHeatmap } from '@/components/charter/heatmap'
import { ApprovalBadge, Callout, PageHeader, Panel, Person, SearchField, ViewTabs } from '@/components/charter/primitives'
import { useCreateRow, useRow, useRowPage, useRows, useUpdateRow, type Row } from '@/lib/data'
import { BAND_STYLES, IMPACT_LABELS, LIKELIHOOD_LABELS, scoreOf, toRisk } from '@/lib/risk'
import { formatDate, formatDateTime } from '@/lib/format'
import { useOrgSettings } from '@/lib/settings'
import { apiErrorMessage } from '@/lib/apiClient'
import { cn } from '@/lib/utils'
import { useDebounced } from '@/components/rcsa/shared'
import { CYCLE_TABLE, RISK_TABLE } from '@/components/rcsa/risk-dialog'
import { FormField, describedBy } from '@/components/cycles/form'
import { RatingSelector } from '@/components/cycles/rating-selector'

const ASSESSMENT_TABLE = 'per_trn_inherent_risk_assessment'
const PICK_PAGE = 25

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
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }

  return (
    <div className="space-y-6">
      <LifecycleStepper current="inherent" />
      <PageHeader
        eyebrow="RCSA · Step 3"
        title="Inherent assessment"
        description={
          riskId ? 'Rate this risk’s likelihood and impact before any controls, and record the reasoning.' : 'Choose a risk, then rate its likelihood and impact as if no controls were in place.'
        }
        actions={
          riskId ? (
            <>
              <Button variant="secondary" onClick={() => choose(null)}>
                <ArrowLeft aria-hidden="true" />
                Choose another risk
              </Button>
              <Button asChild variant="secondary">
                <Link href={`/risks/${riskId}`}>
                  <ExternalLink aria-hidden="true" />
                  Open risk
                </Link>
              </Button>
            </>
          ) : undefined
        }
      />
      {!ready ? null : riskId ? <Assessment riskId={riskId} /> : <RiskPicker onPick={id => choose(String(id))} />}
    </div>
  )
}

// ── Picker ───────────────────────────────────────────────────────────────────

type PickView = 'unrated' | 'all'

function RiskPicker({ onPick }: { onPick: (id: number) => void }) {
  const { hasPermission } = useAuth()
  const [page, setPage] = useState(1)
  const [input, setInput] = useState('')
  const search = useDebounced(input)
  const [view, setView] = useState<PickView>('unrated')
  const q = useRowPage(RISK_TABLE, { page, pageSize: PICK_PAGE, search, sort: 'created_on', order: 'desc', filter: view === 'unrated' ? { inherent_likelihood: null } : undefined })
  const unratedCount = useRowPage(RISK_TABLE, { page: 1, pageSize: 1, filter: { inherent_likelihood: null } })
  const allCount = useRowPage(RISK_TABLE, { page: 1, pageSize: 1 })
  const cycles = useRows(CYCLE_TABLE)
  const cycleRef = useMemo(() => new Map((cycles.data ?? []).map(c => [Number(c.uuid), String(c.cycle_reference || c.cycle_name || `#${c.uuid}`)])), [cycles.data])
  const items = q.data?.items ?? []
  const canRate = hasPermission('update') && hasPermission('create')
  const nUnrated = unratedCount.data?.total ?? 0
  const nAll = allCount.data?.total ?? 0

  const switchView = (v: PickView) => {
    setView(v)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {view === 'all' && nUnrated > 0 && (
        <Callout
          hatch
          action={
            <Button variant="secondary" size="sm" onClick={() => switchView('unrated')}>
              Show the {nUnrated}
            </Button>
          }
        >
          <strong className="font-semibold">
            {nUnrated} of {nAll} risks
          </strong>{' '}
          have no inherent rating, so they are missing from heatmaps and band totals.
        </Callout>
      )}
      <ViewTabs
        label="Risks to assess"
        value={view}
        onChange={switchView}
        views={[
          { value: 'unrated', label: 'Needs rating', count: unratedCount.data ? nUnrated : null },
          { value: 'all', label: 'All risks', count: allCount.data ? nAll : null },
        ]}
      />
      <SearchField
        label="Search risks"
        placeholder="Statement, reference, owner…"
        value={input}
        onChange={v => {
          setInput(v)
          setPage(1)
        }}
      />
      <Panel bodyClassName="p-0">
        <DataState
          query={q}
          empty={items.length === 0}
          emptyTitle={search ? 'No risks match this search' : view === 'unrated' ? 'Every risk has an inherent rating' : 'The risk register is empty'}
          emptyDescription={
            search
              ? 'Try another word, or look in All risks.'
              : view === 'unrated'
                ? 'Nothing is waiting to be rated. You can still re-assess any risk from All risks.'
                : 'Add risks in the register first; then rate them here.'
          }
          emptyAction={
            !search && view === 'unrated' ? (
              <Button variant="secondary" onClick={() => switchView('all')}>
                Show all risks
              </Button>
            ) : !search ? (
              <Button asChild>
                <Link href="/rcsa/identification">Go to the risk register</Link>
              </Button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="enterprise-table min-w-[760px]">
              <thead>
                <tr>
                  <th className="pl-6">Risk</th>
                  <th>Owner</th>
                  <th>Cycle</th>
                  <th>Inherent</th>
                  <th>Approval</th>
                  <th className="pr-6 text-right">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map(row => {
                  const r = toRisk(row)
                  const ref = r.referenceNumber ?? `#${r.uuid}`
                  const sub = [ref, r.process].filter(Boolean).join(' · ')
                  return (
                    <tr
                      key={r.uuid}
                      className="cursor-pointer"
                      onClick={e => {
                        if ((e.target as HTMLElement).closest('a,button')) return
                        onPick(r.uuid)
                      }}
                    >
                      <td className="py-2 pl-6">
                        <div className="w-64 xl:w-96">
                          <span className="block truncate font-medium text-foreground" title={r.statement ?? undefined}>
                            {r.statement ?? <span className="font-normal text-muted-foreground italic">No statement recorded</span>}
                          </span>
                          <span className="block truncate font-mono text-caption text-muted-foreground" title={sub}>
                            {sub}
                          </span>
                        </div>
                      </td>
                      <td className="max-w-[180px]">
                        <Person name={r.owner} />
                      </td>
                      <td className="whitespace-nowrap">
                        {r.cycleUuid != null ? (
                          <Link href={`/rcsa/provisioning/${r.cycleUuid}`} className="rounded-xs font-mono text-caption text-primary hover:underline focus-ring">
                            {cycleRef.get(r.cycleUuid) ?? `#${r.cycleUuid}`}
                          </Link>
                        ) : (
                          <span className="text-caption text-muted-foreground">No cycle</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <BandBadge score={r.inherentScore} kind="Inherent" />
                      </td>
                      <td>
                        <ApprovalBadge status={r.approvalStatus ?? 'DRAFT'} />
                      </td>
                      <td className="pr-6 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-primary hover:text-primary"
                          onClick={() => onPick(r.uuid)}
                          aria-label={`${canRate ? (r.inherentScore == null ? 'Rate' : 'Re-assess') : 'View'} ${r.statement ?? ref}`}
                        >
                          {canRate ? (r.inherentScore == null ? 'Rate' : 'Re-assess') : 'View'}
                          <ArrowRight aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} pageSize={PICK_PAGE} total={q.data?.total ?? 0} onPage={setPage} busy={q.isFetching} />
        </DataState>
      </Panel>
    </div>
  )
}

// ── Assessment of one risk ───────────────────────────────────────────────────

interface FormState {
  likelihood: string
  impact: string
  sle: string
  owners: string
  description: string
  impactDescription: string
}

function Assessment({ riskId }: { riskId: string }) {
  const { hasPermission } = useAuth()
  const { settings, money, band } = useOrgSettings()
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
  const savedForm = (r: NonNullable<typeof risk>): FormState => ({
    likelihood: r.inherentLikelihood != null ? String(r.inherentLikelihood) : '',
    impact: r.inherentImpact != null ? String(r.inherentImpact) : '',
    sle: r.sle != null ? String(r.sle) : '',
    owners: r.owner ?? '',
    description: '',
    impactDescription: '',
  })
  useEffect(() => {
    if (!risk) return
    setForm(savedForm(risk))
    setErrors({})
    // Prefill once per risk, not on background refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [risk?.uuid])

  const records = useMemo(() => [...(history.data ?? [])].sort((a, b) => String(b.created_on ?? '').localeCompare(String(a.created_on ?? '')) || Number(b.uuid) - Number(a.uuid)), [history.data])

  const set = (k: keyof FormState) => (v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }))
  }
  const l = form.likelihood ? Number(form.likelihood) : null
  const i = form.impact ? Number(form.impact) : null
  const score = scoreOf(l, i)

  // The risk as it would be placed with the ratings being picked (for the live matrix).
  const preview = useMemo(() => (risk ? [toRisk({ ...risk.raw, inherent_likelihood: l, inherent_impact: i })] : []), [risk, l, i])

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

  const nextHref = risk ? (risk.cycleUuid != null ? `/rcsa/provisioning/${risk.cycleUuid}/controls/${risk.uuid}` : `/rcsa/mitigation/${risk.uuid}`) : '#'
  const sleNumber = form.sle.trim() ? Number(form.sle) : null
  const changed = risk != null && (form.likelihood !== savedForm(risk).likelihood || form.impact !== savedForm(risk).impact)

  return (
    <DataState query={riskQ}>
      {risk ? (
        <div className="space-y-6">
          {/* The risk being assessed */}
          <section aria-labelledby="risk-heading" className="surface-panel px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="font-mono text-caption text-muted-foreground">{risk.referenceNumber ?? `#${risk.uuid}`}</span>
              <ApprovalBadge status={risk.approvalStatus ?? 'DRAFT'} />
              {risk.cycleUuid != null && (
                <Link href={`/rcsa/provisioning/${risk.cycleUuid}`} className="rounded-xs font-mono text-caption text-primary hover:underline focus-ring">
                  {cycle.data ? cycle.data.cycle_reference || cycle.data.cycle_name : `Cycle #${risk.cycleUuid}`}
                </Link>
              )}
            </div>
            <h2 id="risk-heading" className="mt-2 max-w-4xl">
              <Link href={`/risks/${risk.uuid}`} className="rounded-xs underline-offset-4 hover:underline focus-ring">
                {risk.statement ?? <span className="text-muted-foreground italic">No statement recorded</span>}
              </Link>
            </h2>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4 md:grid-cols-5">
              <Fact label="Owner">
                <Person name={risk.owner} />
              </Fact>
              <Fact label="Process">
                <span className="text-body-sm text-foreground">{[risk.process, risk.subProcess].filter(Boolean).join(' › ') || '—'}</span>
              </Fact>
              <Fact label="Current inherent">
                <BandBadge score={risk.inherentScore} kind="Inherent" />
              </Fact>
              <Fact label="Residual">
                {risk.inherentScore == null && risk.residualScore == null ? (
                  <span className="text-body-sm text-muted-foreground">—</span>
                ) : (
                  <RiskMovement inherent={risk.inherentScore} residual={risk.residualScore} />
                )}
              </Fact>
              <Fact label="SLE">
                <span className="text-body-sm text-foreground tabular-nums">{money(risk.sle)}</span>
              </Fact>
            </dl>
          </section>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
            {/* Left: the form */}
            {canEdit ? (
              <Panel title="Rate before controls" meta="Fields marked * are required">
                <form onSubmit={save} noValidate className="space-y-6">
                  <RatingSelector id="ia-likelihood" kind="likelihood" required value={form.likelihood} onChange={set('likelihood')} error={errors.likelihood} />
                  <RatingSelector id="ia-impact" kind="impact" required value={form.impact} onChange={set('impact')} error={errors.impact} />

                  {/* Band preview */}
                  <div aria-live="polite" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg bg-surface-sunken px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--border)]">
                    {score != null ? (
                      <>
                        <div className="flex min-w-0 items-center gap-4">
                          <span className={cn('figure text-figure leading-none', BAND_STYLES[band(score) ?? 'Low'].text)}>{score}</span>
                          <span className="min-w-0">
                            <span className="label-caps block">Inherent score</span>
                            <span className="block text-body-sm text-foreground-secondary">
                              {l} {LIKELIHOOD_LABELS[(l ?? 1) - 1]} × {i} {IMPACT_LABELS[(i ?? 1) - 1]}
                            </span>
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <BandBadge score={score} kind="New inherent" />
                          <span className="text-caption text-muted-foreground">
                            {risk.inherentScore == null ? 'First rating' : changed ? `Was ${risk.inherentScore} · ${band(risk.inherentScore)}` : 'Same as saved'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true" className="hatch inline-block size-8 shrink-0 rounded-sm bg-risk-unrated-bg shadow-[inset_0_0_0_1px_var(--risk-unrated-border)]" />
                        <span>
                          <span className="label-caps block">Inherent score</span>
                          <span className="block text-body-sm text-muted-foreground">Choose a likelihood and an impact to see the band.</span>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                    <FormField
                      id="ia-sle"
                      label="Single loss expectancy"
                      error={errors.sle}
                      hint="Optional. Estimated loss from one occurrence."
                      aside={sleNumber != null && Number.isFinite(sleNumber) && sleNumber >= 0 ? money(sleNumber) : settings.currency}
                    >
                      <div className="relative">
                        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-caption text-muted-foreground" aria-hidden="true">
                          {settings.currency}
                        </span>
                        <Input
                          id="ia-sle"
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          value={form.sle}
                          onChange={e => set('sle')(e.target.value)}
                          className="pl-13 tabular-nums"
                          aria-invalid={!!errors.sle || undefined}
                          aria-describedby={describedBy('ia-sle', errors.sle, true)}
                        />
                      </div>
                    </FormField>
                    <FormField id="ia-owners" label="Risk owners" hint="Who owns this risk (names or teams).">
                      <Input id="ia-owners" value={form.owners} onChange={e => set('owners')(e.target.value)} aria-describedby="ia-owners-hint" />
                    </FormField>
                  </div>
                  <FormField id="ia-description" label="Basis for the rating" required error={errors.description} hint="Causes, evidence and assumptions behind the likelihood and impact.">
                    <Textarea
                      id="ia-description"
                      rows={4}
                      value={form.description}
                      onChange={e => set('description')(e.target.value)}
                      aria-invalid={!!errors.description || undefined}
                      aria-describedby={describedBy('ia-description', errors.description, true)}
                    />
                  </FormField>
                  <FormField id="ia-impact-desc" label="Impact description" hint="What happens if the risk occurs, and who is affected.">
                    <Textarea id="ia-impact-desc" rows={3} value={form.impactDescription} onChange={e => set('impactDescription')(e.target.value)} aria-describedby="ia-impact-desc-hint" />
                  </FormField>
                  {risk.approvalStatus === 'APPROVED' && !hasPermission('approve') && <Callout tone="warning">This risk is approved. Changing its rating sends it back for review.</Callout>}
                  <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-caption text-muted-foreground">Saving updates the risk&apos;s inherent rating and adds a record to its history.</p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={saving}
                        onClick={() => {
                          setForm(savedForm(risk))
                          setErrors({})
                        }}
                      >
                        <RotateCcw aria-hidden="true" />
                        Reset
                      </Button>
                      <Button type="submit" disabled={saving}>
                        {saving ? 'Saving…' : 'Save assessment'}
                      </Button>
                    </div>
                  </div>
                </form>
              </Panel>
            ) : (
              <Panel title="Current inherent rating">
                <div className="space-y-5">
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Fact label="Likelihood">
                      <span className="text-body-sm text-foreground">{risk.inherentLikelihood != null ? `${risk.inherentLikelihood} – ${LIKELIHOOD_LABELS[risk.inherentLikelihood - 1]}` : '—'}</span>
                    </Fact>
                    <Fact label="Impact">
                      <span className="text-body-sm text-foreground">{risk.inherentImpact != null ? `${risk.inherentImpact} – ${IMPACT_LABELS[risk.inherentImpact - 1]}` : '—'}</span>
                    </Fact>
                    <Fact label="Score">
                      <BandBadge score={risk.inherentScore} kind="Inherent" />
                    </Fact>
                  </dl>
                  <Callout tone="info">You have read-only access, so you can review this risk&apos;s rating and its history but not record a new assessment.</Callout>
                </div>
              </Panel>
            )}

            {/* Right: live matrix + history */}
            <div className="space-y-6">
              <Panel title="On the matrix" meta={canEdit && changed ? 'Preview · not saved' : 'Inherent'}>
                <RiskHeatmap risks={preview} mode="inherent" size="sm" showDetail={false} selected={l != null && i != null ? { l, i } : null} />
                <div className="mt-3 flex items-center justify-between gap-3 text-caption text-muted-foreground">
                  <span>Likelihood ↑ · Impact →</span>
                  {score == null && <span>Not placed until both are rated</span>}
                </div>
                <Button asChild variant="secondary" className="mt-5 w-full">
                  <Link href={nextHref}>
                    Next: controls &amp; residual
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </Panel>

              <Panel title="History" meta={history.data ? `${records.length} record${records.length === 1 ? '' : 's'}` : undefined}>
                <DataState query={history} empty={records.length === 0} emptyTitle="No assessments recorded yet" emptyDescription="Each saved assessment keeps its reasoning here." compact>
                  <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-border">
                    {records.map((rec, idx) => (
                      <li key={rec.uuid ?? rec.id} className="relative pl-6">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'absolute top-1.5 left-0 size-[11px] rounded-full shadow-[0_0_0_3px_var(--card)]',
                            idx === 0 ? 'bg-primary' : 'bg-card shadow-[inset_0_0_0_1.5px_var(--border-strong),0_0_0_3px_var(--card)]',
                          )}
                        />
                        <p className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
                          <span className="tabular-nums">{rec.created_on ? formatDateTime(rec.created_on) : formatDate(rec.updated_on)}</span>
                          {rec.created_by && <span>· {String(rec.created_by)}</span>}
                          {idx === 0 && <span className="font-medium text-foreground-secondary">· Latest</span>}
                          {rec.is_active === 'N' && <span className="rounded-xs bg-muted px-1.5 text-foreground-secondary">Inactive</span>}
                        </p>
                        <p className="mt-1 text-body-sm whitespace-pre-line text-foreground">{rec.description || <span className="text-muted-foreground italic">No basis recorded</span>}</p>
                        {rec.risk_impact_description && (
                          <p className="mt-1 text-body-sm whitespace-pre-line text-foreground-secondary">
                            <span className="font-medium text-foreground">Impact: </span>
                            {rec.risk_impact_description}
                          </p>
                        )}
                        {rec.risk_owners && <p className="mt-1 text-caption text-muted-foreground">Owners: {rec.risk_owners}</p>}
                      </li>
                    ))}
                  </ol>
                </DataState>
                <p className="mt-5 flex items-start gap-2 border-t pt-4 text-caption text-muted-foreground">
                  <History className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  The rating itself is stored on the risk; these records keep the reasoning given at each assessment.
                </p>
              </Panel>
            </div>
          </div>
        </div>
      ) : (
        !riskQ.isLoading && (
          <Panel>
            <EmptyState title="Risk not found" description="It may have been deleted, or the link is wrong." />
          </Panel>
        )
      )}
    </DataState>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <dt className="label-caps">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}
