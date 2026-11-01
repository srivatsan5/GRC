'use client'

/**
 * Inherent → residual (Charter hero). Residual likelihood / impact for a risk (PATCH per_trn_identify_risk),
 * shown against the inherent rating on a single-risk movement matrix, with the real reduction as a serif figure.
 * Editors can pick a cell on the matrix or use the two fields; nothing is saved until "Save residual rating".
 */
import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Loader2, Lock, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BandBadge } from '@/components/band-badge'
import { RiskHeatmap, type CellRef } from '@/components/charter/heatmap'
import { Chip } from '@/components/charter/primitives'
import { useUpdateRow } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { IMPACT_LABELS, LIKELIHOOD_LABELS, type Risk } from '@/lib/risk'
import { cn } from '@/lib/utils'
import { FieldError, labelCls, selectCls } from './shared'

const RISK = 'per_trn_identify_risk'

/** RiskHeatmap size="sm": collapse the (invisible) axis-caption cell so it doesn't add ~70 px under the small grid. */
const HEATMAP_SM_FIX = 'w-full max-w-[240px]'

function lxi(l: number | null, i: number | null): string | null {
  return l != null && i != null ? `${LIKELIHOOD_LABELS[l - 1]} × ${IMPACT_LABELS[i - 1]}` : null
}

export function ResidualRating({ risk, canEdit, className, title = 'Inherent → residual' }: { risk: Risk; canEdit: boolean; className?: string; title?: React.ReactNode }) {
  const update = useUpdateRow(RISK)
  const [l, setL] = useState('')
  const [i, setI] = useState('')
  const [error, setError] = useState<string | null>(null)

  const savedL = risk.residualLikelihood != null ? String(risk.residualLikelihood) : ''
  const savedI = risk.residualImpact != null ? String(risk.residualImpact) : ''
  useEffect(() => {
    setL(savedL)
    setI(savedI)
  }, [savedL, savedI])

  const dirty = l !== savedL || i !== savedI
  const dl = l ? Number(l) : null
  const di = i ? Number(i) : null
  const draftScore = dl != null && di != null ? dl * di : null

  // The matrix shows the draft so the movement updates as the editor chooses.
  const draft = useMemo<Risk>(() => ({ ...risk, residualLikelihood: dl, residualImpact: di, residualScore: draftScore }), [risk, dl, di, draftScore])
  const hasInherent = risk.inherentScore != null
  const mode = hasInherent && draftScore != null ? 'movement' : draftScore != null ? 'residual' : 'inherent'
  const selected: CellRef | null = dl != null && di != null ? { l: dl, i: di } : null

  const save = async () => {
    if ((l === '') !== (i === '')) {
      setError('Set both residual likelihood and residual impact, or clear both.')
      return
    }
    setError(null)
    try {
      await update.mutateAsync({
        id: risk.uuid,
        values: { residual_likelihood: l === '' ? null : Number(l), residual_impact: i === '' ? null : Number(i) },
      })
      toast.success(l === '' ? 'Residual rating cleared' : 'Residual rating saved')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const inherent = risk.inherentScore
  const reduction = inherent != null && draftScore != null ? inherent - draftScore : null
  const headingId = `residual-heading-${risk.uuid}`

  return (
    <section className={cn('surface-panel @container min-w-0', className)} aria-labelledby={headingId}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-6 pt-5">
        <h2 id={headingId} className="font-display text-section text-foreground">
          {title}
        </h2>
        <span className="text-caption text-muted-foreground">The rating that remains once the controls are in place</span>
      </div>

      <div className="grid gap-x-8 gap-y-6 px-6 pt-5 pb-6 @xl:grid-cols-[240px_minmax(0,1fr)] @4xl:grid-cols-[240px_minmax(0,1fr)_minmax(220px,0.8fr)]">
        <div className="min-w-0">
          <RiskHeatmap
            risks={[draft]}
            mode={mode}
            size="sm"
            showDetail={false}
            selected={selected}
            onSelect={
              canEdit
                ? cell => {
                    setError(null)
                    setL(cell ? String(cell.l) : '')
                    setI(cell ? String(cell.i) : '')
                  }
                : undefined
            }
            className={HEATMAP_SM_FIX}
          />
          {canEdit && <p className="mt-2 text-caption text-muted-foreground">Pick a cell to set the residual rating.</p>}
        </div>

        <dl className="flex min-w-0 flex-col justify-center divide-y divide-border self-center">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 pb-3.5">
            <dt className="min-w-0">
              <span className="label-caps block">Inherent</span>
              <span className="text-body-sm text-foreground-secondary">{lxi(risk.inherentLikelihood, risk.inherentImpact) ?? 'Not rated yet'}</span>
            </dt>
            <dd>
              <BandBadge score={inherent} kind="Inherent" rateHref={hasInherent ? undefined : '/assessments/inherent'} />
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 pt-3.5">
            <dt className="min-w-0">
              <span className="label-caps block">Residual</span>
              <span className="text-body-sm text-foreground-secondary">{lxi(dl, di) ?? 'Not rated yet'}</span>
            </dt>
            <dd className="flex items-center gap-2">
              {dirty && (
                <Chip tone="info" icon={null}>
                  Unsaved
                </Chip>
              )}
              <BandBadge score={draftScore} kind="Residual" />
            </dd>
          </div>
        </dl>

        <div className="flex min-w-0 flex-col justify-center gap-1 border-border border-t pt-5 @xl:col-span-2 @4xl:col-span-1 @4xl:border-t-0 @4xl:border-l @4xl:pt-0 @4xl:pl-8" aria-live="polite">
          <span className="label-caps">Reduction</span>
          {reduction == null ? (
            <>
              <span className="figure text-figure-lg text-muted-foreground" aria-hidden="true">
                —
              </span>
              <span className="text-body-sm text-muted-foreground">
                {hasInherent ? 'Shown once a residual rating is set.' : 'Rate the inherent risk first to measure the effect of controls.'}
              </span>
            </>
          ) : (
            <>
              <span className={'figure text-figure-lg ' + (reduction > 0 ? 'text-status-success-fg' : reduction < 0 ? 'text-status-danger-fg' : 'text-foreground')}>
                {reduction < 0 ? '+' : ''}
                {Math.abs(reduction)}
              </span>
              <span className="flex items-center gap-1.5 text-body-sm text-foreground-secondary">
                {reduction > 0 ? (
                  <ArrowDown className="size-3.5 text-status-success-fg" aria-hidden="true" />
                ) : reduction < 0 ? (
                  <ArrowUp className="size-3.5 text-status-danger-fg" aria-hidden="true" />
                ) : null}
                {reduction > 0
                  ? `point${reduction === 1 ? '' : 's'} lower after controls`
                  : reduction < 0
                    ? `point${reduction === -1 ? '' : 's'} higher than inherent: check the ratings`
                    : 'No change from the inherent rating'}
              </span>
            </>
          )}
        </div>
      </div>

      {canEdit ? (
        <div className="rounded-b-lg border-t bg-surface-sunken/60 px-6 py-4">
          <div className="grid grid-cols-1 items-end gap-3 @xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <label htmlFor={`res-likelihood-${risk.uuid}`} className={labelCls}>
                Residual likelihood
              </label>
              <select
                id={`res-likelihood-${risk.uuid}`}
                className={selectCls}
                value={l}
                onChange={e => setL(e.target.value)}
                aria-invalid={!!error && l === ''}
                aria-describedby={error ? `res-error-${risk.uuid}` : undefined}
              >
                <option value="">Not rated</option>
                {LIKELIHOOD_LABELS.map((lab, idx) => (
                  <option key={lab} value={idx + 1}>
                    {idx + 1} · {lab}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor={`res-impact-${risk.uuid}`} className={labelCls}>
                Residual impact
              </label>
              <select
                id={`res-impact-${risk.uuid}`}
                className={selectCls}
                value={i}
                onChange={e => setI(e.target.value)}
                aria-invalid={!!error && i === ''}
                aria-describedby={error ? `res-error-${risk.uuid}` : undefined}
              >
                <option value="">Not rated</option>
                {IMPACT_LABELS.map((lab, idx) => (
                  <option key={lab} value={idx + 1}>
                    {idx + 1} · {lab}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setL(savedL)
                  setI(savedI)
                  setError(null)
                }}
                disabled={!dirty || update.isPending}
              >
                <RotateCcw aria-hidden="true" />
                Reset
              </Button>
              <Button onClick={save} disabled={!dirty || update.isPending}>
                {update.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                Save residual rating
              </Button>
            </div>
          </div>
          <FieldError id={`res-error-${risk.uuid}`} message={error ?? undefined} />
        </div>
      ) : (
        <p className="flex items-center gap-2 border-t px-6 py-3 text-caption text-muted-foreground">
          <Lock className="size-3.5" aria-hidden="true" />
          You have read-only access to this rating.
        </p>
      )}
    </section>
  )
}
