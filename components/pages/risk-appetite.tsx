'use client'

/**
 * Risk appetite statements (erm_mst_risk_appetite) with the CURRENT exposure computed
 * from the risk register: the highest current score (residual, else inherent) among
 * rated risks whose risk_type matches the category.
 */
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, CircleCheck, MoreHorizontal, OctagonAlert, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DataState } from '@/components/data-state'
import { BandBadge } from '@/components/band-badge'
import { Callout, Chip, CountUp, PageHeader, Panel } from '@/components/charter/primitives'
import { Field, Select, invalid } from '@/components/governance/form'
import { useOrgSettings } from '@/lib/settings'
import { useAuth } from '@/components/providers/auth-provider'
import { useCreateRow, useDeleteRow, useRows, useUpdateRow, type Row } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { BAND_STYLES, currentScore, toRisk, type Band, type Risk, type RiskBands } from '@/lib/risk'
import { DASH, formatDate, toDateInput } from '@/lib/format'
import { cn } from '@/lib/utils'

const TABLE = 'erm_mst_risk_appetite'
const POSTURES = ['Averse', 'Cautious', 'Open', 'Hungry'] as const
const REVIEW_FREQUENCIES = ['Quarterly', 'Semi-annual', 'Annual'] as const
type Posture = (typeof POSTURES)[number]

/** Posture as a quiet word with a small appetite gauge (1–4 filled dots): never a traffic-light colour. */
const POSTURE_LEVEL: Record<Posture, number> = { Averse: 1, Cautious: 2, Open: 3, Hungry: 4 }

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
  const { bands } = useOrgSettings()
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
  const ratedRisks = useMemo(() => risks.filter(r => currentScore(r) != null).length, [risks])

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
      <PageHeader
        eyebrow="Controls & policy"
        title="Risk appetite"
        description="Tolerance per risk category, against the highest current score of rated risks of that type in the register."
        actions={
          canEdit ? (
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden="true" />
              New statement
            </Button>
          ) : undefined
        }
      />

      <DataState
        query={[appetiteQ, risksQ]}
        empty={statements.length === 0}
        emptyTitle="No appetite statements yet"
        emptyDescription={canEdit ? 'Add a statement per risk category to compare exposure with tolerance.' : 'A Risk Manager or Administrator can add appetite statements.'}
        emptyAction={
          canEdit ? (
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden="true" />
              Add the first statement
            </Button>
          ) : undefined
        }
      >
        <section aria-label="Appetite summary" className="surface-panel grid grid-cols-2 overflow-hidden lg:grid-cols-4">
          {[
            { label: 'Statements', value: stats.total, context: `${statements.filter(s => s.review).length} with a review cycle` },
            { label: 'Within appetite', value: stats.within, context: 'Exposure at or under tolerance', icon: CircleCheck, iconTone: 'text-status-success-fg' },
            {
              label: 'Above tolerance',
              value: stats.breached,
              context: stats.breached ? 'Categories needing action' : 'No category above tolerance',
              icon: OctagonAlert,
              iconTone: 'text-status-danger-fg',
              tone: stats.breached ? 'text-risk-critical-text' : undefined,
            },
            { label: 'Unmeasured', value: stats.noData, context: 'No rated risk of this type yet' },
          ].map(c => (
            <div key={c.label} className="flex min-w-0 flex-col gap-2 border-border px-6 py-5 [&:nth-child(n+3)]:border-t lg:[&:nth-child(n+3)]:border-t-0 [&:nth-child(even)]:border-l lg:[&:not(:first-child)]:border-l">
              <p className="label-caps flex items-center gap-1.5">
                {c.icon && <c.icon className={cn('size-3.5', c.iconTone)} aria-hidden="true" />}
                {c.label}
              </p>
              <p className={cn('figure text-figure text-foreground', c.tone)}>
                <CountUp value={c.value} />
              </p>
              <p className="text-body-sm text-muted-foreground">{c.context}</p>
            </div>
          ))}
        </section>

        {stats.noData === stats.total && stats.total > 0 && (
          <Callout
            tone="info"
            action={
              <Button variant="secondary" asChild>
                <Link href="/rcsa/identification">Open register</Link>
              </Button>
            }
          >
            {ratedRisks === 0
              ? 'No risk in the register is rated yet, so every category reads “—”, not zero.'
              : `None of the ${ratedRisks} rated risks has a risk type matching these categories yet, so exposure reads “—”, not zero.`}
          </Callout>
        )}

        <Panel bodyClassName="px-0 pb-2 pt-2" title="Exposure against appetite" meta={`${stats.within} within · ${stats.breached} above · ${stats.noData} unmeasured`}>
          <div className="hidden grid-cols-[minmax(150px,200px)_minmax(0,1fr)_136px_136px_40px] items-end gap-6 px-6 pb-2 md:grid" aria-hidden="true">
            <span />
            <ZoneScale bands={bands} />
            <span className="label-caps">Tolerance</span>
            <span className="label-caps">Current</span>
            <span />
          </div>
          <ul>
            {statements.map(s => (
              <StatementRow key={s.uuid} s={s} e={exposures.get(s.uuid)!} bands={bands} canEdit={canEdit} deleting={remove.isPending} onEdit={() => setEditing(s)} onDelete={() => onDelete(s)} />
            ))}
          </ul>
        </Panel>
        <p className="text-caption text-muted-foreground">
          Current exposure is the highest residual score (inherent when residual is not rated) among rated risks whose risk type matches the category. Track 0–25; the ink tick is the
          tolerance, the dot is current exposure.
        </p>
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

const ZONE_WASH: Record<Band, string> = { Low: 'bg-risk-low-bg', Moderate: 'bg-risk-moderate-bg', High: 'bg-risk-high-bg', Critical: 'bg-risk-critical-bg' }

/** Zone widths on the 0–25 track, from the organisation's band thresholds. */
function zones(bands: RiskBands): { band: Band; width: number }[] {
  return [
    { band: 'Low', width: (bands.moderate - 1) / 25 },
    { band: 'Moderate', width: (bands.high - bands.moderate) / 25 },
    { band: 'High', width: (bands.critical - bands.high) / 25 },
    { band: 'Critical', width: (25 - bands.critical + 1) / 25 },
  ]
}

function ZoneScale({ bands }: { bands: RiskBands }) {
  return (
    <div className="flex text-[11px] leading-4 text-muted-foreground">
      {zones(bands).map(z => (
        <span key={z.band} style={{ width: `${z.width * 100}%` }} className="truncate">
          {z.band === 'Moderate' ? 'Mod.' : z.band}
        </span>
      ))}
    </div>
  )
}

/** The dashboard bullet chart: band washes on a 0–25 track, ink tolerance tick, current exposure dot. */
function Bullet({ tolerance, exposure, bands, label }: { tolerance: number | null; exposure: number | null; bands: RiskBands; label: string }) {
  const { band } = useOrgSettings()
  const b = band(exposure)
  const zs = zones(bands)
  return (
    <div className="relative flex h-3" role="img" aria-label={label}>
      {zs.map((z, i) => (
        <span
          key={z.band}
          style={{ width: `${z.width * 100}%` }}
          className={cn(ZONE_WASH[z.band], 'shadow-[inset_0_0_0_1px_var(--border)]', i === 0 && 'rounded-l-full', i === zs.length - 1 && 'rounded-r-full')}
        />
      ))}
      {tolerance != null && (
        <span aria-hidden="true" className="absolute -top-1 h-5 w-[3px] -translate-x-1/2 rounded-full bg-foreground shadow-[0_0_0_2px_var(--card)]" style={{ left: `${(tolerance / 25) * 100}%` }} />
      )}
      {exposure != null && b && (
        <span
          aria-hidden="true"
          className={cn('absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_2px_var(--card)]', BAND_STYLES[b].dot)}
          style={{ left: `${(exposure / 25) * 100}%` }}
        />
      )}
    </div>
  )
}

function PostureGauge({ posture }: { posture: string | null }) {
  if (!posture) return <span className="text-caption text-muted-foreground">No posture</span>
  const level = POSTURES.includes(posture as Posture) ? POSTURE_LEVEL[posture as Posture] : 0
  return (
    <span className="inline-flex items-center gap-1.5 text-caption text-muted-foreground" title={`Appetite posture: ${posture}`}>
      {level > 0 && (
        <span aria-hidden="true" className="inline-flex gap-0.5">
          {[1, 2, 3, 4].map(i => (
            <span key={i} className={cn('size-1.5 rounded-full', i <= level ? 'bg-foreground-secondary' : 'bg-border-strong')} />
          ))}
        </span>
      )}
      {posture}
    </span>
  )
}

function StatementRow({
  s,
  e,
  bands,
  canEdit,
  deleting,
  onEdit,
  onDelete,
}: {
  s: Statement
  e: Exposure
  bands: RiskBands
  canEdit: boolean
  deleting: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const breached = e.max != null && s.tolerance != null && e.max > s.tolerance
  const aria = `${s.category}: tolerance ${s.tolerance ?? 'not set'}, ${e.max != null ? `current exposure ${e.max}${breached ? ', above tolerance' : ', within tolerance'}` : 'no rated risks'}`
  return (
    <li className={cn('border-t px-6 py-4', breached && 'shadow-[inset_3px_0_0_var(--risk-critical-text)]')}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 md:grid-cols-[minmax(150px,200px)_minmax(0,1fr)_136px_136px_40px]">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground" title={s.category}>
            {s.category || DASH}
          </p>
          <PostureGauge posture={s.posture} />
        </div>
        <div className="order-last col-span-2 md:order-none md:col-span-1">
          <Bullet tolerance={s.tolerance} exposure={e.max} bands={bands} label={aria} />
        </div>
        <div className="hidden md:block">{s.tolerance != null ? <BandBadge score={s.tolerance} variant="soft" kind="Tolerance" /> : <span className="text-muted-foreground">{DASH}</span>}</div>
        <div className="hidden min-w-0 md:block">
          {e.max != null ? (
            <span className="inline-flex flex-col items-start gap-1">
              <BandBadge score={e.max} kind="Current exposure" />
              {breached && <span className="text-caption font-medium text-status-danger-fg">+{e.max - s.tolerance!} over</span>}
            </span>
          ) : (
            <span className="text-body-sm text-muted-foreground" title="No rated risks in this category">
              {DASH}
            </span>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 md:contents">
          <span className="grid grid-cols-[auto_auto] items-center justify-items-end gap-x-2 gap-y-1 text-caption text-muted-foreground md:hidden">
            <span>Tolerance</span>
            {s.tolerance != null ? <BandBadge score={s.tolerance} variant="soft" kind="Tolerance" compact /> : <span>{DASH}</span>}
            <span>Current</span>
            {e.max != null ? <BandBadge score={e.max} compact kind="Current exposure" /> : <span>{DASH}</span>}
          </span>
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8 justify-self-end" aria-label={`More actions for the ${s.category} statement`}>
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil aria-hidden="true" /> Edit statement
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" disabled={deleting} onSelect={onDelete}>
                  <Trash2 aria-hidden="true" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="hidden md:block" />
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-x-6 md:grid-cols-[minmax(150px,200px)_minmax(0,1fr)_360px]">
        <span className="hidden md:block" />
        <div className="min-w-0 space-y-1.5">
          <p className="text-body-sm text-foreground-secondary">{s.statement || 'No statement recorded'}</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground tabular-nums">
            <span>
              {e.rated} rated risk{e.rated === 1 ? '' : 's'}
              {e.unrated > 0 && ` · ${e.unrated} not rated`}
            </span>
            {s.tolerance != null && e.rated > 0 && (
              <>
                <span aria-hidden="true">·</span>
                {e.above.length > 0 ? (
                  <Chip tone="danger">{e.above.length} above tolerance</Chip>
                ) : (
                  <span className="inline-flex items-center gap-1 text-status-success-fg">
                    <CircleCheck className="size-3.5" aria-hidden="true" />
                    All within tolerance
                  </span>
                )}
              </>
            )}
          </p>
          {e.above.length > 0 && (
            <details className="group text-body-sm">
              <summary className="inline-flex cursor-pointer items-center gap-1 rounded-xs text-caption font-medium text-primary hover:underline focus-ring">Show the {e.above.length} risk{e.above.length === 1 ? '' : 's'} above tolerance</summary>
              <ul className="mt-2 divide-y rounded-md shadow-[inset_0_0_0_1px_var(--border)]">
                {e.above.map(r => (
                  <li key={r.uuid} className="flex items-center justify-between gap-3 px-3 py-2">
                    <Link href={`/risks/${r.uuid}`} className="group/link min-w-0 rounded-xs focus-ring">
                      <span className="block truncate text-foreground group-hover/link:underline">{r.statement ?? `Risk #${r.uuid}`}</span>
                      {r.referenceNumber && <span className="block truncate font-mono text-caption text-muted-foreground">{r.referenceNumber}</span>}
                    </Link>
                    <span className="flex shrink-0 items-center gap-2">
                      <BandBadge score={currentScore(r)} />
                      <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" />
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <p className="mt-1.5 text-caption text-muted-foreground md:mt-0">
          {s.approvedBy ? `Approved by ${s.approvedBy}` : 'Approver not recorded'}
          {s.approvedOn ? ` · ${formatDate(s.approvedOn)}` : ''}
          <br className="hidden md:block" />
          <span className="md:hidden"> · </span>
          Review {s.review ? s.review.toLowerCase() : DASH}
        </p>
      </div>
    </li>
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
  const { bands } = useOrgSettings()
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

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{statement ? `Edit ${statement.category} appetite` : 'New appetite statement'}</DialogTitle>
          <DialogDescription>The category is matched, ignoring case, against the risk type of each risk in the register.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field
            id="ap-category"
            label="Category"
            required
            error={shown.category}
            hint={!matched ? 'No risk in the register has this risk type yet, so exposure will read “—”.' : 'Pick a risk type from the register, or type a new one.'}
          >
            <Input id="ap-category" list="ap-categories" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} {...invalid('ap-category', shown.category)} />
            <datalist id="ap-categories">
              {categories.map(c => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field id="ap-statement" label="Statement" required error={shown.statement}>
            <Textarea id="ap-statement" rows={3} value={draft.statement} onChange={e => setDraft({ ...draft, statement: e.target.value })} {...invalid('ap-statement', shown.statement)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field id="ap-posture" label="Posture" required error={shown.posture}>
              <Select id="ap-posture" value={draft.posture} onChange={e => setDraft({ ...draft, posture: e.target.value })} {...invalid('ap-posture', shown.posture)}>
                {POSTURES.map(p => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </Field>
            <Field id="ap-tolerance" label="Tolerance score" required error={shown.tolerance} hint="Likelihood × impact, 1–25">
              <Input id="ap-tolerance" type="number" min={1} max={25} step={1} inputMode="numeric" className="tabular-nums" value={draft.tolerance} onChange={e => setDraft({ ...draft, tolerance: e.target.value })} {...invalid('ap-tolerance', shown.tolerance)} />
            </Field>
          </div>
          {Number.isInteger(tol) && tol >= 1 && tol <= 25 && (
            <div className="flex items-center gap-3 rounded-lg bg-surface-sunken px-4 py-3 shadow-[inset_0_0_0_1px_var(--border)]">
              <span className="label-caps shrink-0">Preview</span>
              <div className="min-w-0 flex-1">
                <Bullet tolerance={tol} exposure={null} bands={bands} label={`Tolerance ${tol}`} />
              </div>
              <BandBadge score={tol} variant="soft" />
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field id="ap-approved-by" label="Approved by">
              <Input id="ap-approved-by" value={draft.approvedBy} onChange={e => setDraft({ ...draft, approvedBy: e.target.value })} />
            </Field>
            <Field id="ap-approved-on" label="Approved on">
              <Input id="ap-approved-on" type="date" value={draft.approvedOn} onChange={e => setDraft({ ...draft, approvedOn: e.target.value })} />
            </Field>
            <Field id="ap-review" label="Review frequency">
              <Select id="ap-review" value={draft.review} onChange={e => setDraft({ ...draft, review: e.target.value })}>
                <option value="">Not set</option>
                {REVIEW_FREQUENCIES.map(f => (
                  <option key={f}>{f}</option>
                ))}
              </Select>
            </Field>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : statement ? 'Save changes' : 'Add statement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
