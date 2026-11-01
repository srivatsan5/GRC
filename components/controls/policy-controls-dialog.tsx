'use client'

/** Link / unlink library controls to a policy (ERM_LNK_POLICY_CONTROL). */
import React, { useDeferredValue, useMemo, useState } from 'react'
import { Check, Link2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SearchField } from '@/components/charter/primitives'
import { LifecycleChip } from '@/components/controls/charter-bits'
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
      <div className="truncate text-body-sm font-medium text-foreground" title={str(c.control_name)}>
        {str(c.control_name) || DASH}
      </div>
      <div className="truncate text-caption text-muted-foreground">
        <span className="font-mono">{str(c.control_code)}</span> · {str(c.control_type) || 'Type not set'} · {str(c.owner_name) || 'No owner'}
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <p className="font-mono text-caption text-muted-foreground">{str(policy.policy_code)}</p>
          <DialogTitle>Controls implementing this policy</DialogTitle>
          <DialogDescription>{str(policy.title)}</DialogDescription>
        </DialogHeader>

        <section aria-labelledby="linked-controls-heading" className="space-y-2">
          <h3 id="linked-controls-heading" className="label-caps">
            Linked controls <span className="tabular-nums">{links.length}</span>
          </h3>
          <div className="overflow-hidden rounded-md shadow-[inset_0_0_0_1px_var(--border)]">
            <DataState query={linkedIds.length ? [linksQ, linkedControlsQ] : linksQ} empty={links.length === 0} emptyTitle="No controls linked yet" compact>
              <ul className="divide-y">
                {links.map(l => {
                  const c = controlById.get(Number(l.control_uuid))
                  return (
                    <li key={l.uuid} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      {c ? <ControlLine c={c} /> : <span className="text-body-sm text-muted-foreground">Control #{str(l.control_uuid)} (no longer in the library)</span>}
                      <div className="flex shrink-0 items-center gap-2">
                        {c && <LifecycleChip status={str(c.status) || null} />}
                        {canEdit && (
                          <Button variant="ghost" size="sm" onClick={() => doUnlink(l)} disabled={busy} aria-label={`Unlink ${c ? str(c.control_code) : 'control'}`}>
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
          <section aria-labelledby="pick-control-heading" className="space-y-2">
            <h3 id="pick-control-heading" className="label-caps">
              Link a control from the library
            </h3>
            <SearchField
              label="Search controls"
              className="sm:w-full"
              placeholder="Code, name, owner, framework…"
              value={search}
              onChange={v => {
                setSearch(v)
                setPage(1)
              }}
            />
            <div className="overflow-hidden rounded-md shadow-[inset_0_0_0_1px_var(--border)]">
              <DataState query={pickQ} empty={(pickQ.data?.items.length ?? 0) === 0} emptyTitle={deferred ? 'No controls match this search' : 'The control library is empty'} compact>
                <ul className="divide-y">
                  {(pickQ.data?.items ?? []).map(c => {
                    const already = linkedIds.includes(Number(c.uuid))
                    return (
                      <li key={c.uuid} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <ControlLine c={c} />
                        <Button size="sm" variant={already ? 'ghost' : 'secondary'} className="shrink-0" onClick={() => doLink(c)} disabled={already || busy} aria-label={`${already ? 'Already linked' : 'Link'} ${str(c.control_code)}`}>
                          {already ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
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
