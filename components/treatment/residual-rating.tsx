'use client'

/** Residual likelihood / impact for a risk (PATCH per_trn_identify_risk), with inherent vs residual and the real reduction. */
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BandBadge } from '@/components/band-badge'
import { useUpdateRow } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { IMPACT_LABELS, LIKELIHOOD_LABELS, type Risk } from '@/lib/risk'
import { DASH } from '@/lib/format'
import { labelCls, selectCls } from './shared'

const RISK = 'per_trn_identify_risk'

export function ResidualRating({ risk, canEdit }: { risk: Risk; canEdit: boolean }) {
  const update = useUpdateRow(RISK)
  const [l, setL] = useState('')
  const [i, setI] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setL(risk.residualLikelihood != null ? String(risk.residualLikelihood) : '')
    setI(risk.residualImpact != null ? String(risk.residualImpact) : '')
  }, [risk.residualLikelihood, risk.residualImpact])

  const dirty = l !== (risk.residualLikelihood != null ? String(risk.residualLikelihood) : '') || i !== (risk.residualImpact != null ? String(risk.residualImpact) : '')
  const draftScore = l && i ? Number(l) * Number(i) : null

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
  const residual = risk.residualScore
  const reduction = inherent != null && residual != null ? inherent - residual : null

  return (
    <section className="bg-white rounded border border-slate-200 p-5 space-y-4" aria-labelledby="residual-heading">
      <div>
        <h2 id="residual-heading" className="text-sm font-semibold text-slate-900">
          Residual rating
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">The rating that remains once the controls below are in place.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-slate-50 rounded border border-slate-200">
          <span className="text-[11px] text-slate-500 block mb-1">Inherent</span>
          <BandBadge score={inherent} />
          <span className="block text-[11px] text-slate-500 mt-1">
            {risk.inherentLikelihood != null && risk.inherentImpact != null
              ? `${LIKELIHOOD_LABELS[risk.inherentLikelihood - 1]} × ${IMPACT_LABELS[risk.inherentImpact - 1]}`
              : 'Rate the inherent risk in the assessment step first.'}
          </span>
        </div>
        <div className="p-3 bg-slate-50 rounded border border-slate-200">
          <span className="text-[11px] text-slate-500 block mb-1">Residual</span>
          <BandBadge score={residual} />
          <span className="block text-[11px] text-slate-500 mt-1">
            {risk.residualLikelihood != null && risk.residualImpact != null
              ? `${LIKELIHOOD_LABELS[risk.residualLikelihood - 1]} × ${IMPACT_LABELS[risk.residualImpact - 1]}`
              : 'Not rated yet'}
          </span>
        </div>
        <div className="p-3 bg-slate-50 rounded border border-slate-200">
          <span className="text-[11px] text-slate-500 block mb-1">Reduction (inherent − residual)</span>
          <span className="text-base font-semibold text-slate-900 tabular-nums">
            {reduction == null ? DASH : `${reduction > 0 ? '−' : reduction < 0 ? '+' : ''}${Math.abs(reduction)} points`}
          </span>
          {reduction == null ? (
            <span className="block text-[11px] text-slate-500 mt-1">Shown once both ratings exist.</span>
          ) : reduction < 0 ? (
            <span className="block text-[11px] text-amber-700 mt-1">Residual is higher than inherent — check the ratings.</span>
          ) : null}
        </div>
      </div>

      {canEdit ? (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label htmlFor="res-likelihood" className={labelCls}>
              Residual likelihood
            </label>
            <select id="res-likelihood" className={selectCls} value={l} onChange={e => setL(e.target.value)}>
              <option value="">Not rated</option>
              {LIKELIHOOD_LABELS.map((lab, idx) => (
                <option key={lab} value={idx + 1}>
                  {idx + 1} – {lab}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="res-impact" className={labelCls}>
              Residual impact
            </label>
            <select id="res-impact" className={selectCls} value={i} onChange={e => setI(e.target.value)}>
              <option value="">Not rated</option>
              {IMPACT_LABELS.map((lab, idx) => (
                <option key={lab} value={idx + 1}>
                  {idx + 1} – {lab}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            {dirty && draftScore != null && <BandBadge score={draftScore} />}
            <Button size="sm" onClick={save} disabled={!dirty || update.isPending}>
              {update.isPending && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" aria-hidden="true" />}
              Save residual rating
            </Button>
          </div>
          {error && (
            <p role="alert" className="sm:col-span-3 text-[11px] text-red-600">
              {error}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500">You have read-only access to this rating.</p>
      )}
    </section>
  )
}
