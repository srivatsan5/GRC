'use client'

/** Link / unlink risk-register risks to a library control (ERM_LNK_CONTROL_RISK). */
import React, { useDeferredValue, useMemo, useState } from 'react'
import { Search, Link2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">Risks mitigated by {String(control.control_code ?? '')}</DialogTitle>
          <DialogDescription className="text-xs">{String(control.control_name ?? '')}</DialogDescription>
        </DialogHeader>

        <section aria-labelledby="linked-risks-heading" className="space-y-2">
          <h3 id="linked-risks-heading" className="text-xs font-semibold text-slate-900">
            Linked risks ({links.length})
          </h3>
          <div className="border border-slate-200 rounded">
            <DataState query={linkedIds.length ? [linksQ, linkedRisksQ] : linksQ} empty={links.length === 0} emptyTitle="No risks linked yet" compact>
              <ul className="divide-y divide-slate-100">
                {links.map(l => {
                  const r = riskById.get(Number(l.risk_uuid))
                  return (
                    <li key={l.uuid} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <div className="text-slate-900 line-clamp-2">{r ? riskLabel(r) : `Risk #${l.risk_uuid} (no longer in the register)`}</div>
                        {r && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {r.category ?? DASH} · {r.process ?? DASH}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {r && <BandBadge score={currentScore(r)} />}
                        {canEdit && (
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => doUnlink(l)} disabled={busy}>
                            <Unlink className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
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
            <h3 id="pick-risk-heading" className="text-xs font-semibold text-slate-900">
              Link a risk from the register
            </h3>
            <div className="relative">
              <label htmlFor="risk-picker-search" className="sr-only">
                Search risks
              </label>
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <Input
                id="risk-picker-search"
                placeholder="Search risk statement, process, owner…"
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="border border-slate-200 rounded">
              <DataState query={pickQ} empty={(pickQ.data?.items.length ?? 0) === 0} emptyTitle={deferred ? 'No risks match this search' : 'The risk register is empty'} compact>
                <ul className="divide-y divide-slate-100">
                  {(pickQ.data?.items ?? []).map(row => {
                    const r = toRisk(row)
                    const already = linkedIds.includes(r.uuid)
                    return (
                      <li key={r.uuid} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                        <div className="min-w-0">
                          <div className="text-slate-900 line-clamp-2">{riskLabel(r)}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {r.category ?? DASH} · {r.process ?? DASH}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <BandBadge score={currentScore(r)} />
                          <Button size="sm" variant={already ? 'outline' : 'default'} className="h-7 px-2 text-xs" onClick={() => doLink(r)} disabled={already || busy}>
                            <Link2 className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
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
