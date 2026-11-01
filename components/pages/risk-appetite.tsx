'use client'

/**
 * Risk appetite statements (erm_mst_risk_appetite) with the CURRENT exposure computed
 * from the risk register: the highest current score (residual, else inherent) among
 * rated risks whose risk_type matches the category.
 */
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DataState } from '@/components/data-state'
import { BandBadge } from '@/components/band-badge'
import { useAuth } from '@/components/providers/auth-provider'
import { useCreateRow, useDeleteRow, useRows, useUpdateRow, type Row } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { currentScore, toRisk, type Risk } from '@/lib/risk'
import { DASH, formatDate, toDateInput } from '@/lib/format'
import { cn } from '@/lib/utils'

const TABLE = 'erm_mst_risk_appetite'
const POSTURES = ['Averse', 'Cautious', 'Open', 'Hungry'] as const
const REVIEW_FREQUENCIES = ['Quarterly', 'Semi-annual', 'Annual'] as const
type Posture = (typeof POSTURES)[number]

const POSTURE_TONE: Record<Posture, string> = {
  Averse: 'bg-red-50 text-red-800 border-red-200',
  Cautious: 'bg-amber-50 text-amber-800 border-amber-200',
  Open: 'bg-blue-50 text-blue-800 border-blue-200',
  Hungry: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}

interface Statement {
  uuid: number
  category: string
  statement: string
  posture: string | null
  tolerance: number | null
  approvedBy: string | null
  approvedOn: string | null
  review: string | null
}

function toStatement(r: Row): Statement {
  const tol = r.tolerance_score == null || r.tolerance_score === '' ? null : Number(r.tolerance_score)
  return {
    uuid: Number(r.uuid ?? r.id),
    category: String(r.category ?? '').trim(),
    statement: String(r.statement ?? '').trim(),
    posture: r.posture ? String(r.posture) : null,
    tolerance: tol != null && Number.isFinite(tol) ? tol : null,
    approvedBy: r.approved_by ? String(r.approved_by) : null,
    approvedOn: r.approved_on ? String(r.approved_on) : null,
    review: r.review_frequency ? String(r.review_frequency) : null,
  }
}

interface Exposure {
  max: number | null
  rated: number
  unrated: number
  above: Risk[]
}

function exposureFor(category: string, tolerance: number | null, risks: Risk[]): Exposure {
  const key = category.trim().toLowerCase()
  const inCat = risks.filter(r => r.category?.trim().toLowerCase() === key)
  const rated = inCat.filter(r => currentScore(r) != null)
  const max = rated.length ? Math.max(...rated.map(r => currentScore(r)!)) : null
  const above = tolerance == null ? [] : rated.filter(r => currentScore(r)! > tolerance).sort((a, b) => currentScore(b)! - currentScore(a)!)
  return { max, rated: rated.length, unrated: inCat.length - rated.length, above }
}

export function RiskAppetitePage() {
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('approve')
  const confirm = useConfirm()
  const appetiteQ = useRows(TABLE)
  const risksQ = useRows('per_trn_identify_risk')
  const remove = useDeleteRow(TABLE)
  const [editing, setEditing] = useState<Statement | 'new' | null>(null)

  const statements = useMemo(() => (appetiteQ.data ?? []).map(toStatement).sort((a, b) => a.category.localeCompare(b.category)), [appetiteQ.data])
  const risks = useMemo(() => (risksQ.data ?? []).map(toRisk).filter(r => r.isActive), [risksQ.data])
  const exposures = useMemo(() => new Map(statements.map(s => [s.uuid, exposureFor(s.category, s.tolerance, risks)])), [statements, risks])

  const stats = useMemo(() => {
    let breached = 0
    let within = 0
    let noData = 0
    for (const s of statements) {
      const e = exposures.get(s.uuid)!
      if (e.max == null || s.tolerance == null) noData++
      else if (e.max > s.tolerance) breached++
      else within++
    }
    return { total: statements.length, breached, within, noData }
  }, [statements, exposures])

  const onDelete = async (s: Statement) => {
    const ok = await confirm({
      title: `Delete the ${s.category} appetite statement?`,
      description: 'The statement and its tolerance will be removed. This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await remove.mutateAsync(s.uuid)
      toast.success(`Deleted ${s.category} appetite statement`)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Risk appetite</h1>
          <p className="text-xs text-slate-500">
            Tolerance per risk category, compared with the highest current score of rated risks in that category in the risk register.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            New statement
          </Button>
        )}
      </div>

      <DataState
        query={[appetiteQ, risksQ]}
        empty={statements.length === 0}
        emptyTitle="No risk appetite statements yet"
        emptyDescription={canEdit ? 'Add a statement per risk category to compare exposure with tolerance.' : 'A Risk Manager or Administrator can add appetite statements.'}
        emptyAction={
          canEdit ? (
            <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
              Add a statement
            </Button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Statements" value={stats.total} />
          <Stat label="Within appetite" value={stats.within} tone="text-emerald-700" />
          <Stat label="Above tolerance" value={stats.breached} tone="text-red-700" />
          <Stat label="No rated risks" value={stats.noData} tone="text-slate-500" />
        </div>

        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {statements.map(s => {
            const e = exposures.get(s.uuid)!
            const breached = e.max != null && s.tolerance != null && e.max > s.tolerance
            const pct = e.max != null && s.tolerance ? Math.min(100, (e.max / s.tolerance) * 100) : 0
            const posture = POSTURES.includes(s.posture as Posture) ? (s.posture as Posture) : null
            return (
              <li key={s.uuid} className={cn('bg-white rounded border p-4 space-y-3', breached ? 'border-red-200' : 'border-slate-200')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-500">{s.category || DASH}</p>
                    <p className="text-sm text-slate-900 mt-0.5">{s.statement || DASH}</p>
                  </div>
                  {s.posture && (
                    <span className={cn('shrink-0 px-2 py-0.5 rounded border text-[11px] font-medium', posture ? POSTURE_TONE[posture] : 'bg-slate-50 border-slate-200 text-slate-600')}>
                      {s.posture}
                    </span>
                  )}
                </div>

                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-[11px] text-slate-500">Tolerance</dt>
                    <dd className="mt-0.5">{s.tolerance != null ? <BandBadge score={s.tolerance} /> : DASH}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500">Current exposure</dt>
                    <dd className="mt-0.5">
                      {e.max != null ? <BandBadge score={e.max} /> : <span className="text-slate-500">No rated risks in this category</span>}
                    </dd>
                  </div>
                </dl>

                {e.max != null && s.tolerance != null && (
                  <div
                    className="h-1.5 rounded-full bg-slate-100 overflow-hidden"
                    role="meter"
                    aria-label={`Exposure ${e.max} against tolerance ${s.tolerance}`}
                    aria-valuemin={0}
                    aria-valuemax={s.tolerance}
                    aria-valuenow={Math.min(e.max, s.tolerance)}
                  >
                    <div className={cn('h-full rounded-full', breached ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
                  </div>
                )}

                <p className="text-[11px] text-slate-600">
                  {e.rated} rated risk{e.rated === 1 ? '' : 's'}
                  {e.unrated > 0 && ` · ${e.unrated} not rated yet`}
                  {s.tolerance != null && e.rated > 0 && (
                    <>
                      {' · '}
                      <span className={cn(e.above.length > 0 && 'font-semibold text-red-700')}>{e.above.length} above tolerance</span>
                    </>
                  )}
                </p>

                {e.above.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-800 hover:underline">Show risks above tolerance</summary>
                    <ul className="mt-2 space-y-1">
                      {e.above.map(r => (
                        <li key={r.uuid} className="flex items-center justify-between gap-2">
                          <Link href={`/rcsa/mitigation/${r.uuid}`} className="truncate text-slate-800 hover:underline">
                            {r.referenceNumber ? `${r.referenceNumber} — ` : ''}
                            {r.statement ?? `Risk #${r.uuid}`}
                          </Link>
                          <BandBadge score={currentScore(r)} className="shrink-0" />
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <span>
                    Approved by {s.approvedBy ?? DASH} on {formatDate(s.approvedOn)} · Review {s.review ?? DASH}
                  </span>
                  {canEdit && (
                    <span className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s)} aria-label={`Edit ${s.category} appetite statement`}>
                        <Pencil className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-700 hover:bg-red-50"
                        onClick={() => onDelete(s)}
                        disabled={remove.isPending}
                        aria-label={`Delete ${s.category} appetite statement`}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Delete
                      </Button>
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </DataState>

      {editing !== null && (
        <StatementDialog
          key={editing === 'new' ? 'new' : editing.uuid}
          statement={editing === 'new' ? null : editing}
          others={statements.filter(s => editing === 'new' || s.uuid !== editing.uuid)}
          categories={Array.from(new Set(risks.map(r => r.category).filter((c): c is string => !!c))).sort()}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function Stat({ label, value, tone = 'text-slate-900' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="p-3 bg-white rounded border border-slate-200">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cn('text-xl font-semibold mt-0.5 tabular-nums', tone)}>{value}</div>
    </div>
  )
}

interface Draft {
  category: string
  statement: string
  posture: string
  tolerance: string
  approvedBy: string
  approvedOn: string
  review: string
}

function StatementDialog({
  statement,
  others,
  categories,
  onClose,
}: {
  statement: Statement | null
  others: Statement[]
  categories: string[]
  onClose: () => void
}) {
  const create = useCreateRow(TABLE)
  const update = useUpdateRow(TABLE)
  const [touched, setTouched] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => ({
    category: statement?.category ?? '',
    statement: statement?.statement ?? '',
    posture: statement?.posture ?? 'Cautious',
    tolerance: statement?.tolerance != null ? String(statement.tolerance) : '',
    approvedBy: statement?.approvedBy ?? '',
    approvedOn: toDateInput(statement?.approvedOn),
    review: statement?.review ?? '',
  }))

  const errors: Partial<Record<keyof Draft, string>> = {}
  const cat = draft.category.trim()
  if (!cat) errors.category = 'Enter a category.'
  else if (others.some(o => o.category.toLowerCase() === cat.toLowerCase())) errors.category = 'There is already a statement for this category.'
  if (!draft.statement.trim()) errors.statement = 'Enter the appetite statement.'
  if (!POSTURES.includes(draft.posture as Posture)) errors.posture = 'Choose a posture.'
  const tol = /^\d+$/.test(draft.tolerance.trim()) ? Number(draft.tolerance) : NaN
  if (!Number.isInteger(tol) || tol < 1 || tol > 25) errors.tolerance = 'Enter a whole score from 1 to 25.'
  const shown = touched ? errors : {}
  const pending = create.isPending || update.isPending
  const matched = cat ? categories.some(c => c.toLowerCase() === cat.toLowerCase()) : true

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(errors).length) return
    const values = {
      category: cat,
      statement: draft.statement.trim(),
      posture: draft.posture,
      tolerance_score: tol,
      approved_by: draft.approvedBy.trim() || null,
      approved_on: draft.approvedOn || null,
      review_frequency: draft.review || null,
    }
    try {
      if (statement) await update.mutateAsync({ id: statement.uuid, values })
      else await create.mutateAsync(values)
      toast.success(statement ? `Updated ${cat} appetite` : `Added ${cat} appetite`)
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const label = 'block text-xs font-medium text-slate-700 mb-1'
  const err = (k: keyof Draft) =>
    shown[k] ? (
      <p id={`ap-${k}-error`} className="mt-1 text-[11px] text-red-600">
        {shown[k]}
      </p>
    ) : null
  const aria = (k: keyof Draft) => ({ 'aria-invalid': !!shown[k], 'aria-describedby': shown[k] ? `ap-${k}-error` : undefined })

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{statement ? `Edit ${statement.category} appetite` : 'New appetite statement'}</DialogTitle>
          <DialogDescription>The category is matched (ignoring case) against the risk type of each risk in the register.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-3 text-xs">
          <div>
            <label htmlFor="ap-category" className={label}>
              Category *
            </label>
            <Input id="ap-category" list="ap-categories" className="h-8 text-xs" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} {...aria('category')} />
            <datalist id="ap-categories">
              {categories.map(c => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {err('category')}
            {!shown.category && !matched && <p className="mt-1 text-[11px] text-amber-700">No risk in the register has this risk type yet, so exposure will show as unrated.</p>}
          </div>
          <div>
            <label htmlFor="ap-statement" className={label}>
              Statement *
            </label>
            <Textarea id="ap-statement" rows={3} className="text-xs" value={draft.statement} onChange={e => setDraft({ ...draft, statement: e.target.value })} {...aria('statement')} />
            {err('statement')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ap-posture" className={label}>
                Posture *
              </label>
              <select id="ap-posture" value={draft.posture} onChange={e => setDraft({ ...draft, posture: e.target.value })} className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white" {...aria('posture')}>
                {POSTURES.map(p => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              {err('posture')}
            </div>
            <div>
              <label htmlFor="ap-tolerance" className={label}>
                Tolerance score (1–25) *
              </label>
              <Input id="ap-tolerance" type="number" min={1} max={25} step={1} className="h-8 text-xs" value={draft.tolerance} onChange={e => setDraft({ ...draft, tolerance: e.target.value })} {...aria('tolerance')} />
              {err('tolerance')}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="ap-approved-by" className={label}>
                Approved by
              </label>
              <Input id="ap-approved-by" className="h-8 text-xs" value={draft.approvedBy} onChange={e => setDraft({ ...draft, approvedBy: e.target.value })} />
            </div>
            <div>
              <label htmlFor="ap-approved-on" className={label}>
                Approved on
              </label>
              <Input id="ap-approved-on" type="date" className="h-8 text-xs" value={draft.approvedOn} onChange={e => setDraft({ ...draft, approvedOn: e.target.value })} />
            </div>
            <div>
              <label htmlFor="ap-review" className={label}>
                Review frequency
              </label>
              <select id="ap-review" value={draft.review} onChange={e => setDraft({ ...draft, review: e.target.value })} className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white">
                <option value="">Not set</option>
                {REVIEW_FREQUENCIES.map(f => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Saving…' : statement ? 'Save changes' : 'Add statement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
