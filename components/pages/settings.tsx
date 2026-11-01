'use client'

/**
 * Organisation settings (stored by /api/settings). Only settings that change how the
 * app behaves live here: currency formats every money amount, the risk bands colour
 * every score, and the idle timeout signs users out.
 */
import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Coins, Building2, Grid3x3, RotateCcw, Save, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataState } from '@/components/data-state'
import { Callout, PageHeader, Panel } from '@/components/charter/primitives'
import { Field, FieldError, Select, invalid } from '@/components/governance/form'
import { useAuth } from '@/components/providers/auth-provider'
import { settingsApi, apiErrorMessage, type ApiOrgSettings } from '@/lib/apiClient'
import { SETTINGS_KEY } from '@/lib/settings'
import { BAND_STYLES, BANDS, IMPACT_LABELS, LIKELIHOOD_LABELS, bandOf, type RiskBands } from '@/lib/risk'
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

  const err = (k: keyof typeof errors) => shown[k]
  const savedBands = loaded?.riskBands ?? null

  return (
    <div className="space-y-6 pb-4">
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        description="Organisation details, the currency for every amount, the idle sign-out and the score thresholds behind every risk band in the app."
      />

      <DataState query={query}>
        {draft && (
          <form onSubmit={onSubmit} noValidate className="space-y-6">
            {query.data && !query.data.stored && (
              <Callout tone="warning">
                <span className="font-medium">These settings are not stored in the database yet.</span> The app is using default values
                {query.data.reason ? ` (${query.data.reason.replace('_', ' ')})` : ''}. Saving will try to store them; until the settings table is set up, changes may not survive an API
                restart.
              </Callout>
            )}
            {!canEdit && <Callout tone="info">Only Administrators can change these settings.</Callout>}

            <fieldset disabled={!canEdit || save.isPending} className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
              <legend className="sr-only">Organisation settings</legend>
              <div className="min-w-0 space-y-6">
                <Panel title={<SectionTitle icon={Building2}>Organisation</SectionTitle>} meta="Shown in the top bar and on reports">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field id="set-orgName" label="Organisation name" required error={err('orgName')}>
                      <Input id="set-orgName" value={draft.orgName} onChange={e => setDraft({ ...draft, orgName: e.target.value })} {...invalid('set-orgName', err('orgName'))} />
                    </Field>
                    <Field id="set-industry" label="Industry" error={err('industry')}>
                      <Input id="set-industry" value={draft.industry} onChange={e => setDraft({ ...draft, industry: e.target.value })} {...invalid('set-industry', err('industry'))} />
                    </Field>
                  </div>
                </Panel>

                <Panel title={<SectionTitle icon={Coins}>Currency</SectionTitle>} meta="Formats every money amount">
                  <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                    <Field id="set-currency" label="Currency">
                      <Select id="set-currency" value={draft.currency} onChange={e => setDraft({ ...draft, currency: e.target.value as ApiOrgSettings['currency'] })}>
                        {CURRENCIES.map(c => (
                          <option key={c}>{c}</option>
                        ))}
                      </Select>
                    </Field>
                    <div className="rounded-md bg-surface-sunken px-4 py-2.5 shadow-[inset_0_0_0_1px_var(--border)]">
                      <p className="label-caps">Sample</p>
                      <p className="flex flex-wrap items-baseline gap-x-3 tabular-nums">
                        <span className="figure text-figure-sm text-foreground">{formatMoney(1250000, draft.currency)}</span>
                        <span className="text-caption text-muted-foreground">compact {formatMoney(1250000, draft.currency, { compact: true })}</span>
                      </p>
                    </div>
                  </div>
                  {loaded && draft.currency !== loaded.currency && (
                    <Callout tone="warning" className="mt-4">
                      Amounts are not converted: values recorded in {loaded.currency} will simply be labelled {draft.currency}. Only change this if the figures are actually in{' '}
                      {draft.currency}.
                    </Callout>
                  )}
                </Panel>

                <Panel title={<SectionTitle icon={Clock}>Session</SectionTitle>} meta="Applies to every user">
                  <Field id="set-idle" label="Idle sign-out" required error={err('idleTimeoutMinutes')} hint="Users are signed out after this long without activity in any tab (5–480 minutes).">
                    <div className="flex items-center gap-2">
                      <Input
                        id="set-idle"
                        type="number"
                        min={5}
                        max={480}
                        step={1}
                        inputMode="numeric"
                        className="w-28 tabular-nums"
                        value={draft.idleTimeoutMinutes}
                        onChange={e => setDraft({ ...draft, idleTimeoutMinutes: e.target.value })}
                        {...invalid('set-idle', err('idleTimeoutMinutes'))}
                      />
                      <span className="text-body-sm text-muted-foreground">minutes</span>
                    </div>
                  </Field>
                </Panel>
              </div>

              <Panel title={<SectionTitle icon={Grid3x3}>Risk bands</SectionTitle>} meta="Colours every score in the app">
                <p className="text-body-sm text-muted-foreground">A likelihood × impact score (1–25) at or above a threshold falls in that band. Scores below Moderate are Low.</p>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  {(['moderate', 'high', 'critical'] as const).map(k => {
                    const b = (k[0]!.toUpperCase() + k.slice(1)) as 'Moderate' | 'High' | 'Critical'
                    return (
                      <Field
                        key={k}
                        id={`set-${k}`}
                        label={
                          <span className="inline-flex items-center gap-1.5">
                            <span aria-hidden="true" className={cn('size-2.5 rounded-xs', BAND_STYLES[b].dot)} />
                            {b}
                            <span className="sr-only"> from</span>
                            <span aria-hidden="true" className="font-normal text-muted-foreground">≥</span>
                          </span>
                        }
                        required
                        error={err(k)}
                      >
                        <Input
                          id={`set-${k}`}
                          type="number"
                          min={2}
                          max={25}
                          step={1}
                          inputMode="numeric"
                          className="tabular-nums"
                          value={draft[k]}
                          onChange={e => setDraft({ ...draft, [k]: e.target.value })}
                          aria-invalid={!!err(k) || !!err('bands')}
                          aria-describedby={err(k) ? `set-${k}-error` : err('bands') ? 'set-bands-error' : undefined}
                        />
                      </Field>
                    )
                  })}
                </div>
                {err('bands') && <FieldError id="set-bands-error">{err('bands')}</FieldError>}
                <BandPreview bands={previewBands} saved={savedBands} />
              </Panel>
            </fieldset>

            {canEdit && (
              <div
                className={cn(
                  'flex flex-wrap items-center justify-between gap-3 rounded-lg px-5 py-3 transition-shadow duration-(--duration-base) ease-out',
                  dirty ? 'sticky bottom-4 z-20 bg-card shadow-raised' : 'surface-panel',
                )}
              >
                <p className="flex items-center gap-2 text-body-sm text-muted-foreground" aria-live="polite">
                  {dirty ? (
                    <>
                      <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
                      <span className="text-foreground">Unsaved changes</span>
                      <span className="hidden sm:inline">· they apply to every user once saved</span>
                    </>
                  ) : (
                    'All changes saved'
                  )}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!dirty || save.isPending}
                    onClick={() => {
                      if (loaded) setDraft(toDraft(loaded))
                      setTouched(false)
                    }}
                  >
                    <RotateCcw aria-hidden="true" />
                    Discard
                  </Button>
                  <Button type="submit" disabled={!dirty || save.isPending}>
                    <Save aria-hidden="true" />
                    {save.isPending ? 'Saving…' : 'Save settings'}
                  </Button>
                </div>
              </div>
            )}
          </form>
        )}
      </DataState>
    </div>
  )
}

function SectionTitle({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      {children}
    </span>
  )
}

/** Live 5×5 preview of the band thresholds (solid band fills), flagging cells whose band would change. */
function BandPreview({ bands, saved }: { bands: RiskBands | null; saved: RiskBands | null }) {
  if (!bands)
    return (
      <div className="mt-5 flex h-48 items-center justify-center rounded-md bg-surface-sunken text-body-sm text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]">
        <TriangleAlert className="mr-2 size-4" aria-hidden="true" />
        Fix the thresholds to see the preview
      </div>
    )
  let changed = 0
  for (let l = 1; l <= 5; l++) for (let i = 1; i <= 5; i++) if (saved && bandOf(l * i, saved) !== bandOf(l * i, bands)) changed++
  const ranges: Record<string, string> = {
    Low: `1–${bands.moderate - 1}`,
    Moderate: `${bands.moderate}–${bands.high - 1}`,
    High: `${bands.high}–${bands.critical - 1}`,
    Critical: `${bands.critical}–25`,
  }
  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label-caps">
          Live preview <span className="font-normal tracking-normal normal-case sm:hidden">· likelihood ↑ impact →</span>
        </p>
        <p className="text-caption text-muted-foreground" aria-live="polite">
          {changed === 0 ? 'Matches the saved bands' : `${changed} cell${changed === 1 ? '' : 's'} change band (outlined)`}
        </p>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[296px] table-fixed border-separate border-spacing-1" aria-label="Risk band preview: likelihood rows by impact columns">
          <thead>
            <tr>
              <th scope="col" className="w-8 sm:w-[92px]">
                <span className="sr-only">Likelihood</span>
              </th>
              {IMPACT_LABELS.map((l, i) => (
                <th key={l} scope="col" className="pt-1 text-center align-top font-normal">
                  <span className="block font-display text-body-lg leading-5 text-foreground">{i + 1}</span>
                  <span className="hidden truncate text-[11px] leading-4 text-muted-foreground sm:block">{l}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[5, 4, 3, 2, 1].map(l => (
              <tr key={l}>
                <th scope="row" className="pr-2 text-right font-normal">
                  <span className="block font-display text-body-lg leading-5 text-foreground">{l}</span>
                  <span className="hidden text-[11px] leading-4 whitespace-nowrap text-muted-foreground sm:block">{LIKELIHOOD_LABELS[l - 1]}</span>
                </th>
                {[1, 2, 3, 4, 5].map(i => {
                  const score = l * i
                  const b = bandOf(score, bands)!
                  const moved = !!saved && bandOf(score, saved) !== b
                  return (
                    <td
                      key={i}
                      className={cn(
                        'h-12 rounded-sm px-2 text-right align-bottom transition-colors duration-(--duration-base) ease-out',
                        BAND_STYLES[b].solid,
                        moved && 'shadow-[inset_0_0_0_2px_var(--foreground)]',
                      )}
                    >
                      <span className="figure text-body-lg">{score}</span>
                      <span className="sr-only">
                        {' '}
                        {b}
                        {moved ? `, was ${bandOf(score, saved!)}` : ''}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-caption text-foreground-secondary tabular-nums">
        {BANDS.map(b => (
          <li key={b} className="inline-flex items-center gap-1.5">
            <span className={cn('size-3.5 rounded-xs', BAND_STYLES[b].dot)} aria-hidden="true" />
            {b} {ranges[b]}
          </li>
        ))}
      </ul>
    </div>
  )
}
