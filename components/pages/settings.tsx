'use client'

/**
 * Organisation settings (stored by /api/settings). Only settings that change how the
 * app behaves live here: currency formats every money amount, the risk bands colour
 * every score, and the idle timeout signs users out.
 */
import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataState } from '@/components/data-state'
import { useAuth } from '@/components/providers/auth-provider'
import { settingsApi, apiErrorMessage, type ApiOrgSettings } from '@/lib/apiClient'
import { SETTINGS_KEY } from '@/lib/settings'
import { BAND_STYLES, IMPACT_LABELS, LIKELIHOOD_LABELS, bandOf, type RiskBands } from '@/lib/risk'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

const CURRENCIES: ApiOrgSettings['currency'][] = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'SGD', 'AED', 'CAD', 'CHF']

interface Draft {
  orgName: string
  industry: string
  currency: ApiOrgSettings['currency']
  idleTimeoutMinutes: string
  moderate: string
  high: string
  critical: string
}

const toDraft = (s: ApiOrgSettings): Draft => ({
  orgName: s.orgName,
  industry: s.industry,
  currency: s.currency,
  idleTimeoutMinutes: String(s.idleTimeoutMinutes),
  moderate: String(s.riskBands.moderate),
  high: String(s.riskBands.high),
  critical: String(s.riskBands.critical),
})

const int = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN)

function validate(d: Draft): Partial<Record<keyof Draft | 'bands', string>> {
  const e: Partial<Record<keyof Draft | 'bands', string>> = {}
  const name = d.orgName.trim()
  if (!name) e.orgName = 'Enter the organisation name.'
  else if (name.length > 120) e.orgName = 'Keep the name under 120 characters.'
  if (d.industry.trim().length > 80) e.industry = 'Keep the industry under 80 characters.'
  const t = int(d.idleTimeoutMinutes)
  if (!Number.isInteger(t) || t < 5 || t > 480) e.idleTimeoutMinutes = 'Enter a whole number of minutes from 5 to 480.'
  for (const k of ['moderate', 'high', 'critical'] as const) {
    const n = int(d[k])
    if (!Number.isInteger(n) || n < 2 || n > 25) e[k] = 'Whole number from 2 to 25.'
  }
  if (!e.moderate && !e.high && !e.critical) {
    if (!(int(d.moderate) < int(d.high) && int(d.high) < int(d.critical))) e.bands = 'Thresholds must increase: Moderate < High < Critical.'
  }
  return e
}

export function SettingsPage() {
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('admin')
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: settingsApi.get, staleTime: 5 * 60_000 })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [touched, setTouched] = useState(false)

  const loaded = query.data?.settings
  useEffect(() => {
    if (loaded && draft === null) setDraft(toDraft(loaded))
  }, [loaded, draft])

  const save = useMutation({
    mutationFn: (s: ApiOrgSettings) => settingsApi.save(s),
    onSuccess: async res => {
      setDraft(toDraft(res.settings))
      setTouched(false)
      await queryClient.invalidateQueries({ queryKey: SETTINGS_KEY })
      if (res.stored) toast.success('Settings saved')
      else toast.warning('Settings applied, but they could not be stored in the database')
    },
    onError: err => toast.error(apiErrorMessage(err)),
  })

  const errors = draft ? validate(draft) : {}
  const shown = touched ? errors : {}
  const dirty = !!draft && !!loaded && JSON.stringify(draft) !== JSON.stringify(toDraft(loaded))

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft || !canEdit) return
    setTouched(true)
    if (Object.keys(errors).length) return
    save.mutate({
      orgName: draft.orgName.trim(),
      industry: draft.industry.trim(),
      currency: draft.currency,
      idleTimeoutMinutes: int(draft.idleTimeoutMinutes),
      riskBands: { moderate: int(draft.moderate), high: int(draft.high), critical: int(draft.critical) },
    })
  }

  const previewBands: RiskBands | null =
    draft && !errors.moderate && !errors.high && !errors.critical && !errors.bands
      ? { moderate: int(draft.moderate), high: int(draft.high), critical: int(draft.critical) }
      : null

  const label = 'block text-xs font-medium text-slate-700 mb-1'
  const err = (k: keyof typeof errors) =>
    shown[k] ? (
      <p id={`set-${k}-error`} className="mt-1 text-[11px] text-red-600">
        {shown[k]}
      </p>
    ) : null
  const aria = (k: keyof typeof errors) => ({ 'aria-invalid': !!shown[k], 'aria-describedby': shown[k] ? `set-${k}-error` : undefined })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Organisation settings</h1>
          <p className="text-xs text-slate-500">Currency, session timeout and the score thresholds used for every risk band in the app.</p>
        </div>
      </div>

      <DataState query={query}>
        {draft && (
          <form onSubmit={onSubmit} noValidate className="space-y-6">
            {query.data && !query.data.stored && (
              <div role="status" className="flex gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-semibold">These settings are not stored in the database yet.</p>
                  <p className="mt-0.5">
                    The app is using default values{query.data.reason ? ` (${query.data.reason})` : ''}. Saving will try to store them; until the settings table is set up,
                    changes may not survive an API restart.
                  </p>
                </div>
              </div>
            )}
            {!canEdit && <p className="text-xs text-slate-500">Only Administrators can change these settings.</p>}

            <fieldset disabled={!canEdit || save.isPending} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-white rounded border border-slate-200 p-4 space-y-4">
                <h2 className="text-sm font-semibold text-slate-900">Organisation</h2>
                <div>
                  <label htmlFor="set-orgName" className={label}>
                    Organisation name *
                  </label>
                  <Input id="set-orgName" className="h-8 text-xs" value={draft.orgName} onChange={e => setDraft({ ...draft, orgName: e.target.value })} {...aria('orgName')} />
                  {err('orgName')}
                </div>
                <div>
                  <label htmlFor="set-industry" className={label}>
                    Industry
                  </label>
                  <Input id="set-industry" className="h-8 text-xs" value={draft.industry} onChange={e => setDraft({ ...draft, industry: e.target.value })} {...aria('industry')} />
                  {err('industry')}
                </div>
                <div>
                  <label htmlFor="set-currency" className={label}>
                    Currency
                  </label>
                  <select
                    id="set-currency"
                    value={draft.currency}
                    onChange={e => setDraft({ ...draft, currency: e.target.value as ApiOrgSettings['currency'] })}
                    className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">Every money amount is shown in this currency, e.g. {formatMoney(1250000, draft.currency)}.</p>
                  {loaded && draft.currency !== loaded.currency && (
                    <p role="note" className="mt-1 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      Amounts are not converted: values already recorded in {loaded.currency} will simply be labelled {draft.currency}.
                      Only change this if the figures are actually in {draft.currency}.
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="set-idle" className={label}>
                    Idle sign-out (minutes) *
                  </label>
                  <Input
                    id="set-idle"
                    type="number"
                    min={5}
                    max={480}
                    step={1}
                    className="h-8 text-xs w-32"
                    value={draft.idleTimeoutMinutes}
                    onChange={e => setDraft({ ...draft, idleTimeoutMinutes: e.target.value })}
                    {...aria('idleTimeoutMinutes')}
                  />
                  {err('idleTimeoutMinutes')}
                  <p className="mt-1 text-[11px] text-slate-500">Users are signed out after this long without activity (5–480).</p>
                </div>
              </section>

              <section className="bg-white rounded border border-slate-200 p-4 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Risk bands</h2>
                  <p className="text-[11px] text-slate-500">A likelihood × impact score (1–25) at or above a threshold falls in that band. Scores below Moderate are Low.</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(['moderate', 'high', 'critical'] as const).map(k => (
                    <div key={k}>
                      <label htmlFor={`set-${k}`} className={label}>
                        {k[0]!.toUpperCase() + k.slice(1)} from *
                      </label>
                      <Input
                        id={`set-${k}`}
                        type="number"
                        min={2}
                        max={25}
                        step={1}
                        className="h-8 text-xs"
                        value={draft[k]}
                        onChange={e => setDraft({ ...draft, [k]: e.target.value })}
                        {...aria(k)}
                      />
                      {err(k)}
                    </div>
                  ))}
                </div>
                {err('bands')}
                <BandPreview bands={previewBands} />
              </section>
            </fieldset>

            {canEdit && (
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!dirty || save.isPending}
                  onClick={() => {
                    if (loaded) setDraft(toDraft(loaded))
                    setTouched(false)
                  }}
                >
                  Discard changes
                </Button>
                <Button type="submit" size="sm" disabled={!dirty || save.isPending}>
                  {save.isPending ? 'Saving…' : 'Save settings'}
                </Button>
              </div>
            )}
          </form>
        )}
      </DataState>
    </div>
  )
}

function BandPreview({ bands }: { bands: RiskBands | null }) {
  if (!bands) return <p className="text-[11px] text-slate-500">Fix the thresholds to see the preview.</p>
  return (
    <div>
      <p className="text-xs font-medium text-slate-700 mb-2">Preview</p>
      <table className="border-separate border-spacing-1 text-[11px]" aria-label="Risk band preview: likelihood rows by impact columns">
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              Likelihood
            </th>
            {IMPACT_LABELS.map((l, i) => (
              <th key={l} scope="col" className="w-14 font-normal text-slate-500 text-center leading-tight">
                {i + 1}
                <span className="block text-[9px]">{l}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[5, 4, 3, 2, 1].map(l => (
            <tr key={l}>
              <th scope="row" className="pr-1 font-normal text-slate-500 text-right whitespace-nowrap">
                {l} <span className="text-[9px]">{LIKELIHOOD_LABELS[l - 1]}</span>
              </th>
              {[1, 2, 3, 4, 5].map(i => {
                const score = l * i
                const b = bandOf(score, bands)!
                return (
                  <td key={i} title={`${score} · ${b}`} className={cn('h-9 w-14 rounded text-center font-semibold tabular-nums', BAND_STYLES[b].cell, BAND_STYLES[b].text)}>
                    {score}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-600">
        {(
          [
            ['Low', `1–${bands.moderate - 1}`],
            ['Moderate', `${bands.moderate}–${bands.high - 1}`],
            ['High', `${bands.high}–${bands.critical - 1}`],
            ['Critical', `${bands.critical}–25`],
          ] as const
        ).map(([b, range]) => (
          <li key={b} className="flex items-center gap-1">
            <span className={cn('h-2 w-2 rounded-full', BAND_STYLES[b].dot)} aria-hidden="true" />
            {b} {range}
          </li>
        ))}
      </ul>
    </div>
  )
}
