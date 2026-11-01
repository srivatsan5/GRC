'use client'

/** Link / unlink risk-register risks to a library control (ERM_LNK_CONTROL_RISK). */
import React, { useDeferredValue, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Link2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SearchField } from '@/components/charter/primitives'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DataState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { BandBadge } from '@/components/band-badge'
import { useCreateRow, useDeleteRow, useRowPage, useRows, type Row } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { currentScore, toRisk, type Risk } from '@/lib/risk'
import { DASH } from '@/lib/format'

const LINKS = 'erm_lnk_control_risk'
const RISKS = 'per_trn_identify_risk'
const PICK_SIZE = 8

function riskLabel(r: Risk) {
  return r.statement ?? r.referenceNumber ?? `Risk #${r.uuid}`
}

export function ControlRisksDialog({ control, canEdit, onClose }: { control: Row; canEdit: boolean; onClose: () => void }) {
  const controlId = Number(control.uuid)
  const linksQ = useRows(LINKS, { filter: { control_uuid: controlId } })
  const linkedIds = useMemo(() => (linksQ.data ?? []).map(l => Number(l.risk_uuid)), [linksQ.data])
  // Linked risk details (only when there are links).
  const linkedRisksQ = useRows(RISKS, { filter: { uuid: linkedIds }, enabled: linkedIds.length > 0 })
  const riskById = useMemo(() => new Map((linkedRisksQ.data ?? []).map(r => [Number(r.uuid), toRisk(r)])), [linkedRisksQ.data])

  const [search, setSearch] = useState('')
  const deferred = useDeferredValue(search)
  const [page, setPage] = useState(1)
  const pickQ = useRowPage(RISKS, { page, pageSize: PICK_SIZE, search: deferred, sort: 'risk_statement', order: 'asc' }, { enabled: canEdit })

  const link = useCreateRow(LINKS)
  const unlink = useDeleteRow(LINKS)

  const doLink = async (r: Risk) => {
    try {
      await link.mutateAsync({ control_uuid: controlId, risk_uuid: r.uuid })
      toast.success('Risk linked to control')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }
  const doUnlink = async (linkRow: Row) => {
    try {
      await unlink.mutateAsync(linkRow.uuid)
      toast.success('Risk unlinked')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const links = linksQ.data ?? []
  const busy = link.isPending || unlink.isPending

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <p className="font-mono text-caption text-muted-foreground">{String(control.control_code ?? '')}</p>
          <DialogTitle>Risks this control mitigates</DialogTitle>
          <DialogDescription>{String(control.control_name ?? '')}</DialogDescription>
        </DialogHeader>

        <section aria-labelledby="linked-risks-heading" className="space-y-2">
          <h3 id="linked-risks-heading" className="label-caps">
            Linked risks <span className="tabular-nums">{links.length}</span>
          </h3>
          <div className="overflow-hidden rounded-md shadow-[inset_0_0_0_1px_var(--border)]">
            <DataState query={linkedIds.length ? [linksQ, linkedRisksQ] : linksQ} empty={links.length === 0} emptyTitle="No risks linked yet" compact>
              <ul className="divide-y">
                {links.map(l => {
                  const r = riskById.get(Number(l.risk_uuid))
                  return (
                    <li key={l.uuid} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      {r ? <RiskLine r={r} /> : <span className="text-body-sm text-muted-foreground">Risk #{String(l.risk_uuid)} (no longer in the register)</span>}
                      <div className="flex shrink-0 items-center gap-2">
                        {r && <BandBadge score={currentScore(r)} />}
                        {canEdit && (
                          <Button variant="ghost" size="sm" onClick={() => doUnlink(l)} disabled={busy} aria-label={`Unlink ${r ? riskLabel(r) : 'risk'}`}>
                            <Unlink aria-hidden="true" />
                            Unlink
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </DataState>
          </div>
        </section>

        {canEdit && (
          <section aria-labelledby="pick-risk-heading" className="space-y-2">
            <h3 id="pick-risk-heading" className="label-caps">
              Link a risk from the register
            </h3>
            <SearchField
              label="Search risks"
              className="sm:w-full"
              placeholder="Risk statement, process, owner…"
              value={search}
              onChange={v => {
                setSearch(v)
                setPage(1)
              }}
            />
            <div className="overflow-hidden rounded-md shadow-[inset_0_0_0_1px_var(--border)]">
              <DataState query={pickQ} empty={(pickQ.data?.items.length ?? 0) === 0} emptyTitle={deferred ? 'No risks match this search' : 'The risk register is empty'} compact>
                <ul className="divide-y">
                  {(pickQ.data?.items ?? []).map(row => {
                    const r = toRisk(row)
                    const already = linkedIds.includes(r.uuid)
                    return (
                      <li key={r.uuid} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <RiskLine r={r} />
                        <div className="flex shrink-0 items-center gap-2">
                          <BandBadge score={currentScore(r)} />
                          <Button size="sm" variant={already ? 'ghost' : 'secondary'} onClick={() => doLink(r)} disabled={already || busy} aria-label={`${already ? 'Already linked' : 'Link'} ${riskLabel(r)}`}>
                            {already ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
                            {already ? 'Linked' : 'Link'}
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <Pager page={page} pageSize={PICK_SIZE} total={pickQ.data?.total ?? 0} onPage={setPage} busy={pickQ.isFetching} />
              </DataState>
            </div>
          </section>
        )}
      </DialogContent>
    </Dialog>
  )
}

function RiskLine({ r }: { r: Risk }) {
  const meta = [r.referenceNumber, r.category, r.process].filter(Boolean).join(' · ')
  return (
    <div className="min-w-0">
      <Link href={`/risks/${r.uuid}`} className="block truncate text-body-sm font-medium text-foreground hover:text-primary hover:underline focus-ring" title={r.statement ?? undefined}>
        {r.statement ?? 'No statement recorded'}
      </Link>
      <div className="truncate font-mono text-caption text-muted-foreground">{meta || DASH}</div>
    </div>
  )
}
