'use client'

/** Link / unlink library controls to a policy (ERM_LNK_POLICY_CONTROL). */
import React, { useDeferredValue, useMemo, useState } from 'react'
import { Search, Link2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DataState } from '@/components/data-state'
import { Pager } from '@/components/pager'
import { useCreateRow, useDeleteRow, useRowPage, useRows, type Row } from '@/lib/data'
import { apiErrorMessage } from '@/lib/apiClient'
import { DASH } from '@/lib/format'

const LINKS = 'erm_lnk_policy_control'
const CONTROLS = 'erm_mst_control'
const PICK_SIZE = 8

const str = (v: unknown) => (v == null ? '' : String(v))

function ControlLine({ c }: { c: Row }) {
  return (
    <div className="min-w-0">
      <div className="text-slate-900">
        <span className="font-mono text-slate-500 mr-1.5">{str(c.control_code)}</span>
        {str(c.control_name)}
      </div>
      <div className="text-[11px] text-slate-500 mt-0.5">
        {str(c.control_type) || DASH} · {str(c.owner_name) || DASH} · {str(c.status) || DASH}
      </div>
    </div>
  )
}

export function PolicyControlsDialog({ policy, canEdit, onClose }: { policy: Row; canEdit: boolean; onClose: () => void }) {
  const policyId = Number(policy.uuid)
  const linksQ = useRows(LINKS, { filter: { policy_uuid: policyId } })
  const linkedIds = useMemo(() => (linksQ.data ?? []).map(l => Number(l.control_uuid)), [linksQ.data])
  const linkedControlsQ = useRows(CONTROLS, { filter: { uuid: linkedIds }, enabled: linkedIds.length > 0 })
  const controlById = useMemo(() => new Map((linkedControlsQ.data ?? []).map(c => [Number(c.uuid), c])), [linkedControlsQ.data])

  const [search, setSearch] = useState('')
  const deferred = useDeferredValue(search)
  const [page, setPage] = useState(1)
  const pickQ = useRowPage(CONTROLS, { page, pageSize: PICK_SIZE, search: deferred, sort: 'control_code', order: 'asc' }, { enabled: canEdit })

  const link = useCreateRow(LINKS)
  const unlink = useDeleteRow(LINKS)
  const busy = link.isPending || unlink.isPending

  const doLink = async (c: Row) => {
    try {
      await link.mutateAsync({ policy_uuid: policyId, control_uuid: Number(c.uuid) })
      toast.success(`Control ${str(c.control_code)} linked`)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }
  const doUnlink = async (l: Row) => {
    try {
      await unlink.mutateAsync(l.uuid)
      toast.success('Control unlinked')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const links = linksQ.data ?? []

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">Controls implementing {str(policy.policy_code)}</DialogTitle>
          <DialogDescription className="text-xs">{str(policy.title)}</DialogDescription>
        </DialogHeader>

        <section aria-labelledby="linked-controls-heading" className="space-y-2">
          <h3 id="linked-controls-heading" className="text-xs font-semibold text-slate-900">
            Linked controls ({links.length})
          </h3>
          <div className="border border-slate-200 rounded">
            <DataState query={linkedIds.length ? [linksQ, linkedControlsQ] : linksQ} empty={links.length === 0} emptyTitle="No controls linked yet" compact>
              <ul className="divide-y divide-slate-100">
                {links.map(l => {
                  const c = controlById.get(Number(l.control_uuid))
                  return (
                    <li key={l.uuid} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                      {c ? <ControlLine c={c} /> : <span className="text-slate-500">Control #{str(l.control_uuid)} (no longer in the library)</span>}
                      {canEdit && (
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={() => doUnlink(l)} disabled={busy}>
                          <Unlink className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                          Unlink
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </DataState>
          </div>
        </section>

        {canEdit && (
          <section aria-labelledby="pick-control-heading" className="space-y-2">
            <h3 id="pick-control-heading" className="text-xs font-semibold text-slate-900">
              Link a control from the library
            </h3>
            <div className="relative">
              <label htmlFor="control-picker-search" className="sr-only">
                Search controls
              </label>
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <Input
                id="control-picker-search"
                placeholder="Search code, name, owner, framework…"
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="border border-slate-200 rounded">
              <DataState query={pickQ} empty={(pickQ.data?.items.length ?? 0) === 0} emptyTitle={deferred ? 'No controls match this search' : 'The control library is empty'} compact>
                <ul className="divide-y divide-slate-100">
                  {(pickQ.data?.items ?? []).map(c => {
                    const already = linkedIds.includes(Number(c.uuid))
                    return (
                      <li key={c.uuid} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                        <ControlLine c={c} />
                        <Button size="sm" variant={already ? 'outline' : 'default'} className="h-7 px-2 text-xs shrink-0" onClick={() => doLink(c)} disabled={already || busy}>
                          <Link2 className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                          {already ? 'Linked' : 'Link'}
                        </Button>
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
