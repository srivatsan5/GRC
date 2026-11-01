'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, CircleCheck, Clock, Gauge, OctagonAlert, ScrollText, ShieldAlert, ShieldCheck, Siren, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BandBadge, BandPips, RiskMovement } from '@/components/band-badge'
import { useAuth } from '@/components/providers/auth-provider'
import { ApprovalBadge, Chip, CountUp, Meter, PageHeader } from '@/components/charter/primitives'
import { useRows, type Row } from '@/lib/data'
import { auditApi } from '@/lib/apiClient'
import { BAND_STYLES, bandCounts, currentScore, type Band, type Risk } from '@/lib/risk'
import { LIGHT_STYLES, type KriLight } from '@/lib/kri'
import { useOrgSettings } from '@/lib/settings'
import { DASH, daysUntil, formatDate, formatDateTime, formatNumber, formatPct, pctOf } from '@/lib/format'
import { APPROVAL_LABELS, approvalLabel, countBy, riskCsvColumns, useRisks } from '@/components/analytics/risk-data'
import { incidentOpen, kriStatuses, numOrNull, SEVERITIES, type KriStatus } from '@/components/analytics/ops-data'
import { BoardPack, text, type ReportColumn } from '@/components/reports/board-pack'
import { BandStack, HeadlineCell, RankedBars, SplitBar } from '@/components/reports/kit'

type ReportId = 'risks' | 'controls' | 'kri' | 'vendors' | 'incidents' | 'audit'

const REPORTS: { id: ReportId; name: string; description: string; icon: React.ComponentType<{ className?: string }>; audit?: boolean }[] = [
  { id: 'risks', name: 'Risk register', description: 'Active risks by band, category and owner, with ratings and SLE.', icon: ShieldAlert },
  { id: 'controls', name: 'Control library summary', description: 'Library controls, their effectiveness ratings, testing and risk coverage.', icon: ShieldCheck },
  { id: 'kri', name: 'KRI status', description: 'Each active KRI with its latest reading and traffic light.', icon: Gauge },
  { id: 'vendors', name: 'Vendor summary', description: 'Third parties by tier and status, with overdue reviews and open findings.', icon: Building2 },
  { id: 'incidents', name: 'Incident summary', description: 'Incidents by severity and status, with recorded losses.', icon: Siren },
  { id: 'audit', name: 'Audit trail summary', description: 'Recent audit events by action, entity and user.', icon: ScrollText, audit: true },
]

const isReportId = (v: string | null): v is ReportId => REPORTS.some(r => r.id === v)

export function ReportsPage() {
  const { hasPermission } = useAuth()
  const available = REPORTS.filter(r => !r.audit || hasPermission('audit'))
  const [selected, setSelected] = useState<ReportId>('risks')
  const current = available.find(r => r.id === selected) ?? available[0]!

  // Deep link: /reports?report=kri opens that report; the choice is kept in the URL.
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('report')
    if (isReportId(r)) setSelected(r)
  }, [])
  const choose = (id: ReportId) => {
    setSelected(id)
    const url = new URL(window.location.href)
    url.searchParams.set('report', id)
    window.history.replaceState(null, '', url.toString())
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Reports"
        description="Board-ready reports generated on demand from the live database. Export any report as CSV, or print it as a board pack."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[264px_minmax(0,1fr)] print:block">
        <nav aria-label="Reports" className="min-w-0 print:hidden">
          <p className="label-caps mb-2 hidden px-3 lg:block">Report catalogue</p>
          <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
            {available.map(r => {
              const active = current.id === r.id
              const Icon = r.icon
              return (
                <li key={r.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => choose(r.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-[background-color,box-shadow] duration-(--duration-fast) ease-out focus-ring',
                      active ? 'bg-card shadow-panel' : 'hover:bg-hover',
                    )}
                  >
                    {active && <span aria-hidden="true" className="absolute top-2.5 bottom-2.5 left-0 hidden w-[3px] rounded-full bg-primary lg:block" />}
                    <Icon className={cn('mt-0.5 size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className={cn('block text-body-sm font-medium whitespace-nowrap', active ? 'text-foreground' : 'text-foreground-secondary')}>{r.name}</span>
                      <span className="mt-0.5 hidden text-caption text-muted-foreground lg:block">{r.description}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="min-w-0" key={current.id}>
          {current.id === 'risks' && <RiskRegisterReport />}
          {current.id === 'controls' && <ControlReport />}
          {current.id === 'kri' && <KriReport />}
          {current.id === 'vendors' && <VendorReport />}
          {current.id === 'incidents' && <IncidentReport />}
          {current.id === 'audit' && <AuditReport />}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- shared bits */

const APPROVAL_STATUS_OF: Record<string, string> = Object.fromEntries(Object.entries(APPROVAL_LABELS).map(([k, v]) => [v, k]))

/** Severity (Low | Medium | High | Critical) on the risk scale: soft band badge with the signal-bar glyph. */
const SEVERITY_BAND: Record<string, Band> = { low: 'Low', medium: 'Moderate', high: 'High', critical: 'Critical' }
function SeverityBadge({ severity }: { severity: unknown }) {
  const s = String(severity ?? '').trim()
  const b = SEVERITY_BAND[s.toLowerCase()]
  if (!b) return <>{text(severity)}</>
  const st = BAND_STYLES[b]
  return (
    <span className={cn('inline-flex h-badge items-center gap-1.5 rounded-sm border px-2 text-caption font-medium whitespace-nowrap', st.bg, st.text, st.border)}>
      <BandPips level={st.level} />
      {s}
    </span>
  )
}

const KRI_ICON = { 'circle-check': CircleCheck, 'triangle-alert': TriangleAlert, 'octagon-alert': OctagonAlert } as const

function LightChip({ light }: { light: KriStatus['light'] }) {
  if (!light) return <span className="text-caption text-muted-foreground">No reading</span>
  const s = LIGHT_STYLES[light]
  const Icon = KRI_ICON[s.icon]
  return (
    <span className={cn('inline-flex h-badge items-center gap-1.5 rounded-sm px-2 text-caption font-medium whitespace-nowrap', s.bg, s.text)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {s.label}
    </span>
  )
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-caption whitespace-nowrap text-foreground-secondary">{children}</span>
}

function Strong({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span className="block max-w-[280px] truncate font-medium text-foreground" title={title}>
      {children}
    </span>
  )
}

/* ------------------------------------------------------------- risk register */

function RiskRegisterReport() {
  const { bands, money, settings } = useOrgSettings()
  const q = useRisks()
  const all = q.data
  const risks = useMemo(() => (all ?? []).filter(r => r.isActive), [all])
  const csv = useMemo(() => riskCsvColumns(bands, settings.currency), [bands, settings.currency])
  const columns: ReportColumn<Risk>[] = useMemo(() => {
    const render: Record<string, (r: Risk) => React.ReactNode> = {
      'Risk ID': r => <Mono>{r.uuid}</Mono>,
      'Risk statement': r => (
        <Strong title={r.statement ?? undefined}>
          {r.statement ?? <span className="font-normal text-muted-foreground">No statement recorded</span>}
        </Strong>
      ),
      'Inherent score': r => <BandBadge score={r.inherentScore} kind="Inherent" />,
      'Residual score': r => <RiskMovement inherent={r.inherentScore} residual={r.residualScore} />,
      [`SLE (${settings.currency})`]: r => money(r.sle),
      'Approval status': r => <ApprovalBadge status={r.approvalStatus} />,
      'Created on': r => <span className="whitespace-nowrap">{formatDate(r.createdOn)}</span>,
    }
    const shownOnScreen = new Set(['Risk ID', 'Risk statement', 'Category', 'Process', 'Owner', 'Inherent score', 'Residual score', `SLE (${settings.currency})`, 'Approval status', 'Created on'])
    // The on-screen table shows a subset; CSV export uses every column.
    const notPrinted = new Set(['Risk ID', 'Process', 'Created on'])
    return csv.map(c => ({ ...c, render: render[c.header], align: c.header.startsWith('SLE') ? ('right' as const) : undefined, hidden: !shownOnScreen.has(c.header), printHidden: notPrinted.has(c.header) }))
  }, [csv, money, settings.currency])

  const stats = useMemo(() => {
    const withSle = risks.filter(r => r.sle != null)
    return {
      current: bandCounts(risks.map(currentScore), bands),
      inherent: bandCounts(risks.map(r => r.inherentScore), bands),
      residual: bandCounts(risks.map(r => r.residualScore), bands),
      byCategory: countBy(risks, r => r.category),
      byOwner: countBy(risks, r => r.owner),
      byApproval: countBy(risks, r => approvalLabel(r.approvalStatus)),
      sle: withSle.length ? withSle.reduce((s, r) => s + (r.sle ?? 0), 0) : null,
      sleCount: withSle.length,
    }
  }, [risks, bands])
  const rated = risks.length - stats.current['Not rated']
  const highCrit = stats.current.High + stats.current.Critical
  const approved = stats.byApproval.find(a => a.name === 'Approved')?.count ?? 0

  return (
    <BoardPack
      title="Risk register"
      description="Active risks by band, category and owner, with ratings, single loss expectancy and approval status."
      entity="per_trn_identify_risk"
      queries={[q]}
      rows={risks}
      columns={columns}
      emptyTitle="No active risks in the register"
      emptyDescription="The report fills in as risks are identified."
      figures={
        <>
          <HeadlineCell label="Active risks" value={<CountUp value={risks.length} />} context={`${rated} rated · ${stats.current['Not rated']} not rated`}>
            <SplitBar
              label="Rated"
              parts={[
                { value: rated, className: 'bg-foreground/75', label: 'rated' },
                { value: stats.current['Not rated'], className: 'hatch bg-risk-unrated-bg shadow-[inset_0_0_0_1px_var(--risk-unrated-border)]', label: 'not rated' },
              ]}
            />
          </HeadlineCell>
          <HeadlineCell
            label="High & critical"
            value={<CountUp value={highCrit} />}
            tone={stats.current.Critical ? 'text-risk-critical-text' : highCrit ? 'text-risk-high-text' : undefined}
            context={`${stats.current.Critical} critical · ${stats.current.High} high, on current score`}
          />
          <HeadlineCell label="Recorded SLE" value={money(stats.sle, { compact: true })} context={`${stats.sleCount} of ${risks.length} risks have an SLE`} />
          <HeadlineCell label="Approved" value={<CountUp value={approved} />} suffix={`of ${risks.length}`} context={`${formatPct(pctOf(approved, risks.length))} of active risks`}>
            <Meter value={pctOf(approved, risks.length)} label="Approved" />
          </HeadlineCell>
        </>
      }
      sections={[
        {
          title: 'Ratings by band',
          meta: 'Current = residual if assessed, else inherent',
          wide: true,
          body: (
            <BandStack
              rows={[
                { label: 'Inherent', counts: stats.inherent },
                { label: 'Residual', counts: stats.residual },
                { label: 'Current', counts: stats.current },
              ]}
            />
          ),
        },
        { title: 'By category', meta: `${stats.byCategory.length} categories`, body: <RankedBars items={stats.byCategory} total={risks.length} limit={8} /> },
        { title: 'By owner', meta: `${stats.byOwner.length} owners`, body: <RankedBars items={stats.byOwner} total={risks.length} limit={8} /> },
        {
          title: 'Approval status',
          wide: true,
          body: (
            <ul className="flex flex-wrap gap-x-8 gap-y-3">
              {stats.byApproval.map(a => (
                <li key={a.name} className="flex items-center gap-3">
                  <span className="figure text-figure-sm text-foreground">{formatNumber(a.count)}</span>
                  <ApprovalBadge status={APPROVAL_STATUS_OF[a.name] ?? (a.name === 'Not recorded' ? null : a.name)} />
                  <span className="text-caption text-muted-foreground">{formatPct(pctOf(a.count, risks.length))}</span>
                </li>
              ))}
            </ul>
          ),
        },
      ]}
    />
  )
}

/* ------------------------------------------------------------------ controls */

function ControlReport() {
  const controlsQ = useRows('erm_mst_control')
  const linksQ = useRows('erm_lnk_control_risk')
  const implQ = useRows('per_trn_control_implementation')

  const linked = useMemo(() => {
    const m = new Map<number, Set<number>>()
    const add = (c: unknown, r: unknown) => {
      if (c == null || r == null) return
      const set = m.get(Number(c)) ?? new Set<number>()
      set.add(Number(r))
      m.set(Number(c), set)
    }
    for (const l of linksQ.data ?? []) add(l.control_uuid, l.risk_uuid)
    for (const i of implQ.data ?? []) add(i.control_id, i.identify_risk_uuid)
    return m
  }, [linksQ.data, implQ.data])

  const controls = useMemo(() => controlsQ.data ?? [], [controlsQ.data])
  const stats = useMemo(() => {
    const design = controls.map(c => numOrNull(c.design_effectiveness)).filter((n): n is number => n != null)
    const operating = controls.map(c => numOrNull(c.operating_effectiveness)).filter((n): n is number => n != null)
    const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
    return {
      byStatus: countBy(controls, c => c.status),
      byType: countBy(controls, c => c.control_type),
      design: avg(design),
      designN: design.length,
      operating: avg(operating),
      operatingN: operating.length,
      untested: controls.filter(c => !c.last_tested_on).length,
      linked: controls.filter(c => (linked.get(Number(c.uuid))?.size ?? 0) > 0).length,
    }
  }, [controls, linked])

  const rating = (v: unknown) => {
    const n = numOrNull(v)
    return n == null ? <span className="text-muted-foreground">Not rated</span> : <span className="tabular-nums">{n} / 5</span>
  }
  const columns: ReportColumn<Row>[] = [
    { header: 'Code', value: c => c.control_code, render: c => <Mono>{text(c.control_code)}</Mono> },
    { header: 'Name', value: c => c.control_name, render: c => <Strong title={String(c.control_name ?? '')}>{text(c.control_name)}</Strong> },
    { header: 'Type', value: c => c.control_type },
    { header: 'Nature', value: c => c.control_nature, printHidden: true },
    { header: 'Frequency', value: c => c.frequency, printHidden: true },
    { header: 'Owner', value: c => c.owner_name },
    { header: 'Design (1–5)', value: c => numOrNull(c.design_effectiveness), render: c => rating(c.design_effectiveness), align: 'right' },
    { header: 'Operating (1–5)', value: c => numOrNull(c.operating_effectiveness), render: c => rating(c.operating_effectiveness), align: 'right' },
    { header: 'Last tested', value: c => c.last_tested_on, render: c => (c.last_tested_on ? <span className="whitespace-nowrap">{formatDate(c.last_tested_on as string)}</span> : <Chip tone="warning">Never tested</Chip>) },
    { header: 'Linked risks', value: c => linked.get(Number(c.uuid))?.size ?? 0, align: 'right' },
    {
      header: 'Status',
      value: c => c.status,
      render: c =>
        c.status === 'Active' ? (
          <Chip tone="success">Active</Chip>
        ) : c.status ? (
          <Chip tone="neutral" icon={null}>
            {String(c.status)}
          </Chip>
        ) : (
          DASH
        ),
    },
  ]

  const fmtAvg = (v: number | null) => (v == null ? DASH : formatNumber(v, 1))

  return (
    <BoardPack
      title="Control library summary"
      description="Library controls, their design and operating effectiveness, testing and coverage of the risk register."
      entity="erm_mst_control"
      queries={[controlsQ, linksQ, implQ]}
      rows={controls}
      columns={columns}
      emptyTitle="No controls in the library yet"
      figures={
        <>
          <HeadlineCell label="Controls" value={<CountUp value={controls.length} />} context={`${stats.linked} linked to at least one risk`} />
          <HeadlineCell label="Average design" value={fmtAvg(stats.design)} suffix={stats.design == null ? undefined : '/ 5'} context={`${stats.designN} of ${controls.length} rated`} />
          <HeadlineCell label="Average operating" value={fmtAvg(stats.operating)} suffix={stats.operating == null ? undefined : '/ 5'} context={`${stats.operatingN} of ${controls.length} rated`} />
          <HeadlineCell
            label="Never tested"
            value={<CountUp value={stats.untested} />}
            tone={stats.untested ? 'text-status-warning-fg' : undefined}
            context={stats.untested ? 'No test date recorded' : 'Every control has a test date'}
          />
        </>
      }
      sections={[
        {
          title: 'Coverage and testing',
          wide: true,
          body: (
            <div className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between text-body-sm">
                  <span className="text-foreground">Linked to a risk</span>
                  <span className="font-medium tabular-nums">
                    {stats.linked} of {controls.length} <span className="font-normal text-muted-foreground">· {formatPct(pctOf(stats.linked, controls.length))}</span>
                  </span>
                </div>
                <Meter value={pctOf(stats.linked, controls.length)} tone="bg-chart-1" label="Linked to a risk" />
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between text-body-sm">
                  <span className="text-foreground">Tested at least once</span>
                  <span className="font-medium tabular-nums">
                    {controls.length - stats.untested} of {controls.length} <span className="font-normal text-muted-foreground">· {formatPct(pctOf(controls.length - stats.untested, controls.length))}</span>
                  </span>
                </div>
                <Meter value={pctOf(controls.length - stats.untested, controls.length)} tone="bg-chart-2" label="Tested at least once" />
              </div>
            </div>
          ),
        },
        { title: 'By status', body: <RankedBars items={stats.byStatus} total={controls.length} /> },
        { title: 'By type', body: <RankedBars items={stats.byType} total={controls.length} /> },
      ]}
      tableNote="Linked risks counts distinct risks from control–risk links and applied controls."
    />
  )
}

/* ----------------------------------------------------------------------- KRI */

function KriReport() {
  const defsQ = useRows('erm_mst_kri_definition')
  const readsQ = useRows('erm_trn_kri_readings')
  const statuses = useMemo(() => kriStatuses(defsQ.data ?? [], readsQ.data ?? []), [defsQ.data, readsQ.data])
  const count = (l: KriStatus['light']) => statuses.filter(s => s.light === l).length

  const columns: ReportColumn<KriStatus>[] = [
    { header: 'Code', value: s => s.kri.code, render: s => <Mono>{text(s.kri.code)}</Mono> },
    { header: 'Name', value: s => s.kri.name, render: s => <Strong title={s.kri.name ?? undefined}>{text(s.kri.name)}</Strong> },
    { header: 'Category', value: s => s.kri.category, printHidden: true },
    { header: 'Owner', value: s => s.kri.owner },
    { header: 'Direction', value: s => (s.kri.direction === 'HIGHER_WORSE' ? 'Higher is worse' : 'Lower is worse'), printHidden: true },
    { header: 'Amber threshold', value: s => s.kri.amber, align: 'right' },
    { header: 'Red threshold', value: s => s.kri.red, align: 'right' },
    { header: 'Latest value', value: s => s.latest?.value ?? null, render: s => (s.latest ? <span className="whitespace-nowrap">{`${formatNumber(s.latest.value, 2)}${s.kri.unit ? ` ${s.kri.unit}` : ''}`}</span> : DASH), align: 'right' },
    { header: 'Reading date', value: s => s.latest?.date ?? null, render: s => <span className="whitespace-nowrap">{formatDate(s.latest?.date)}</span> },
    { header: 'Status', value: s => s.light ?? 'No reading', render: s => <LightChip light={s.light} /> },
  ]

  const lights: { light: KriLight; tone: string }[] = [
    { light: 'RED', tone: 'text-kri-red-fg' },
    { light: 'AMBER', tone: 'text-kri-amber-fg' },
    { light: 'GREEN', tone: 'text-kri-green-fg' },
  ]

  return (
    <BoardPack
      title="KRI status"
      description="Each active key risk indicator with its latest reading, measured against its amber and red thresholds."
      entity="erm_mst_kri_definition"
      queries={[defsQ, readsQ]}
      rows={statuses}
      columns={columns}
      emptyTitle="No active KRIs defined"
      figures={
        <>
          <HeadlineCell label="Active KRIs" value={<CountUp value={statuses.length} />} context={`${count(null)} without a reading or thresholds`} />
          {lights.map(l => {
            const s = LIGHT_STYLES[l.light]
            const Icon = KRI_ICON[s.icon]
            const n = count(l.light)
            return (
              <HeadlineCell
                key={l.light}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <Icon className={cn('size-3.5', l.tone)} aria-hidden="true" />
                    {s.label}
                  </span>
                }
                value={<CountUp value={n} />}
                tone={n && l.light !== 'GREEN' ? l.tone : undefined}
                context={`${l.light === 'RED' ? 'Red' : l.light === 'AMBER' ? 'Amber' : 'Green'} on the latest reading`}
              />
            )
          })}
        </>
      }
      sections={[
        {
          title: 'Latest readings',
          meta: `${statuses.length} active KRIs`,
          wide: true,
          body: (
            <div className="space-y-3">
              <SplitBar
                className="h-3"
                label="KRI traffic lights"
                parts={[
                  { value: count('RED'), className: 'bg-kri-red', label: 'breach' },
                  { value: count('AMBER'), className: 'bg-kri-amber', label: 'warning' },
                  { value: count('GREEN'), className: 'bg-kri-green', label: 'within appetite' },
                  { value: count(null), className: 'hatch bg-risk-unrated-bg shadow-[inset_0_0_0_1px_var(--risk-unrated-border)]', label: 'no reading' },
                ]}
              />
              <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-caption text-foreground-secondary">
                {lights.map(l => (
                  <li key={l.light} className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className={cn('size-2.5 rounded-[3px]', LIGHT_STYLES[l.light].dot)} />
                    {LIGHT_STYLES[l.light].label} {count(l.light)}
                  </li>
                ))}
                <li className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="hatch size-2.5 rounded-[3px] bg-risk-unrated-bg shadow-[inset_0_0_0_1px_var(--risk-unrated-border)]" />
                  No reading {count(null)}
                </li>
              </ul>
            </div>
          ),
        },
      ]}
      tableNote="Status is computed from each KRI's latest reading against its amber and red thresholds."
    />
  )
}

/* ------------------------------------------------------------------- vendors */

function VendorReport() {
  const { money, settings } = useOrgSettings()
  const q = useRows('erm_mst_vendor')
  const vendors = useMemo(() => q.data ?? [], [q.data])
  const overdue = (v: Row) => {
    if (v.status === 'Exited') return false // same rule as the vendor register
    const d = daysUntil(v.next_review_on)
    return d != null && d < 0
  }
  const stats = useMemo(() => {
    const values = vendors.map(v => numOrNull(v.contract_value)).filter((n): n is number => n != null)
    const findings = vendors.map(v => numOrNull(v.open_findings)).filter((n): n is number => n != null)
    return {
      byTier: countBy(vendors, v => v.tier),
      byStatus: countBy(vendors, v => v.status),
      overdue: vendors.filter(overdue).length,
      contract: values.length ? values.reduce((s, x) => s + x, 0) : null,
      contractN: values.length,
      findings: findings.length ? findings.reduce((s, x) => s + x, 0) : null,
    }
  }, [vendors])

  const TIER_BAND: Record<string, Band> = { Critical: 'Critical', High: 'High', Medium: 'Moderate', Low: 'Low' }
  const columns: ReportColumn<Row>[] = [
    { header: 'Vendor', value: v => v.vendor_name, render: v => <Strong title={String(v.vendor_name ?? '')}>{text(v.vendor_name)}</Strong> },
    { header: 'Category', value: v => v.category, printHidden: true },
    { header: 'Tier', value: v => v.tier, render: v => <SeverityBadge severity={v.tier} /> },
    { header: 'Country', value: v => v.country_code, render: v => <Mono>{text(v.country_code)}</Mono>, printHidden: true },
    { header: `Contract value (${settings.currency})`, value: v => numOrNull(v.contract_value), render: v => money(numOrNull(v.contract_value)), align: 'right' },
    { header: 'Risk score (1–100)', value: v => numOrNull(v.risk_score), align: 'right' },
    { header: 'Open findings', value: v => numOrNull(v.open_findings), align: 'right' },
    { header: 'Last assessed', value: v => v.last_assessment_on, render: v => <span className="whitespace-nowrap">{formatDate(v.last_assessment_on as string)}</span>, printHidden: true },
    {
      header: 'Next review',
      value: v => v.next_review_on,
      render: v =>
        overdue(v) ? (
          <Chip tone="danger" icon={Clock}>
            {formatDate(v.next_review_on as string)} · overdue
          </Chip>
        ) : (
          <span className="whitespace-nowrap">{formatDate(v.next_review_on as string)}</span>
        ),
    },
    { header: 'Review overdue', value: v => (overdue(v) ? 'Yes' : 'No'), hidden: true },
    { header: 'Status', value: v => v.status },
  ]

  return (
    <BoardPack
      title="Vendor summary"
      description="Third parties by tier and status, with contract value, open findings and overdue reviews."
      entity="erm_mst_vendor"
      queries={[q]}
      rows={vendors}
      columns={columns}
      emptyTitle="No vendors recorded yet"
      figures={
        <>
          <HeadlineCell label="Vendors" value={<CountUp value={vendors.length} />} context={`${stats.byStatus.find(s => s.name === 'Active')?.count ?? 0} active`} />
          <HeadlineCell label="Contract value" value={money(stats.contract, { compact: true })} context={`${stats.contractN} of ${vendors.length} recorded`} />
          <HeadlineCell label="Open findings" value={stats.findings == null ? DASH : <CountUp value={stats.findings} />} context="Across all vendors" />
          <HeadlineCell label="Reviews overdue" value={<CountUp value={stats.overdue} />} tone={stats.overdue ? 'text-status-danger-fg' : undefined} context="Next review date has passed" />
        </>
      }
      sections={[
        { title: 'By tier', body: <RankedBars items={stats.byTier.map(t => ({ ...t, barClassName: TIER_BAND[t.name] ? BAND_STYLES[TIER_BAND[t.name]!].dot : 'bg-chart-5' }))} total={vendors.length} /> },
        { title: 'By status', body: <RankedBars items={stats.byStatus} total={vendors.length} /> },
      ]}
    />
  )
}

/* ----------------------------------------------------------------- incidents */

function IncidentReport() {
  const { money, settings } = useOrgSettings()
  const q = useRows('erm_trn_incident')
  const incidents = useMemo(() => q.data ?? [], [q.data])
  const stats = useMemo(() => {
    const losses = incidents.map(i => numOrNull(i.loss_amount)).filter((n): n is number => n != null)
    const open = incidents.filter(incidentOpen)
    return {
      open: open.length,
      openBySeverity: SEVERITIES.map(s => ({ name: s, count: open.filter(i => String(i.severity ?? '').toLowerCase() === s.toLowerCase()).length })),
      byStatus: countBy(incidents, i => i.status),
      loss: losses.length ? losses.reduce((s, x) => s + x, 0) : null,
      lossN: losses.length,
    }
  }, [incidents])
  const openCritical = stats.openBySeverity.find(s => s.name === 'Critical')?.count ?? 0

  const columns: ReportColumn<Row>[] = [
    { header: 'Reference', value: i => i.incident_ref, render: i => <Mono>{text(i.incident_ref)}</Mono> },
    { header: 'Title', value: i => i.title, render: i => <Strong title={String(i.title ?? '')}>{text(i.title)}</Strong> },
    { header: 'Severity', value: i => i.severity, render: i => <SeverityBadge severity={i.severity} /> },
    { header: 'Status', value: i => i.status },
    { header: 'Category', value: i => i.category, printHidden: true },
    { header: 'Assigned to', value: i => i.assigned_to },
    { header: 'Occurred', value: i => i.occurred_on, render: i => <span className="whitespace-nowrap">{formatDate(i.occurred_on as string)}</span> },
    { header: 'Reported', value: i => i.reported_on, render: i => <span className="whitespace-nowrap">{formatDate(i.reported_on as string)}</span>, printHidden: true },
    { header: 'Closed', value: i => i.closed_on, render: i => <span className="whitespace-nowrap">{formatDate(i.closed_on as string)}</span> },
    { header: `Loss (${settings.currency})`, value: i => numOrNull(i.loss_amount), render: i => money(numOrNull(i.loss_amount)), align: 'right' },
  ]

  return (
    <BoardPack
      title="Incident summary"
      description="Incidents by severity and status, with recorded losses."
      entity="erm_trn_incident"
      queries={[q]}
      rows={incidents}
      columns={columns}
      emptyTitle="No incidents recorded"
      figureCols={4}
      figures={
        <>
          <HeadlineCell label="Incidents" value={<CountUp value={incidents.length} />} context="All recorded incidents" />
          <HeadlineCell label="Open" value={<CountUp value={stats.open} />} tone={stats.open ? 'text-status-warning-fg' : undefined} context="Not mitigated or closed" />
          <HeadlineCell label="Open critical" value={<CountUp value={openCritical} />} tone={openCritical ? 'text-risk-critical-text' : undefined} context={`${stats.openBySeverity.find(s => s.name === 'High')?.count ?? 0} open high`} />
          <HeadlineCell label="Recorded losses" value={money(stats.loss, { compact: true })} context={`${stats.lossN} of ${incidents.length} with an amount`} />
        </>
      }
      sections={[
        {
          title: 'Open by severity',
          meta: `${stats.open} open`,
          body: (
            <RankedBars
              items={stats.openBySeverity.map(s => ({ ...s, barClassName: BAND_STYLES[SEVERITY_BAND[s.name.toLowerCase()] ?? 'Low'].dot }))}
              total={stats.open}
              empty="No open incidents."
            />
          ),
        },
        { title: 'By status', body: <RankedBars items={stats.byStatus} total={incidents.length} /> },
      ]}
    />
  )
}

/* --------------------------------------------------------------------- audit */

type AuditEntry = Awaited<ReturnType<typeof auditApi.list>>['items'][number]

function AuditReport() {
  const q = useQuery({ queryKey: ['audit', 'reports-summary'], queryFn: () => auditApi.list({ limit: 1000 }) })
  const entries = useMemo(() => q.data?.items ?? [], [q.data])
  const total = q.data?.total ?? 0
  const stats = useMemo(
    () => ({
      byAction: countBy(entries, e => e.action),
      byEntity: countBy(entries, e => e.entity),
      byActor: countBy(entries, e => e.actor_name || e.actor_email),
      failures: entries.filter(e => e.result === 'FAILURE').length,
    }),
    [entries],
  )

  const columns: ReportColumn<AuditEntry>[] = [
    { header: 'Seq', value: e => e.seq, render: e => <Mono>{e.seq}</Mono>, align: 'right' },
    { header: 'Timestamp', value: e => e.timestamp, render: e => <span className="whitespace-nowrap text-foreground-secondary">{formatDateTime(e.timestamp)}</span> },
    { header: 'User', value: e => e.actor_name },
    { header: 'Role', value: e => e.actor_role, printHidden: true },
    { header: 'Action', value: e => e.action, render: e => <Mono>{text(e.action)}</Mono> },
    { header: 'Entity', value: e => e.entity, render: e => <Mono>{text(e.entity)}</Mono> },
    { header: 'Entity ID', value: e => e.entity_id, render: e => <Mono>{text(e.entity_id)}</Mono>, printHidden: true },
    { header: 'Description', value: e => e.description, render: e => <Strong title={e.description ?? undefined}>{text(e.description)}</Strong> },
    { header: 'Result', value: e => e.result, render: e => (e.result === 'FAILURE' ? <Chip tone="danger">Failure</Chip> : e.result === 'SUCCESS' ? <Chip tone="success">Success</Chip> : text(e.result)) },
  ]

  return (
    <BoardPack
      title="Audit trail summary"
      description="Recent audit events by action, entity and user, from the tamper-evident audit trail."
      entity="audit_trail"
      queries={[q]}
      rows={entries}
      columns={columns}
      emptyTitle="No audit events recorded"
      figureCols={3}
      figures={
        <>
          <HeadlineCell label="Events in the trail" value={<CountUp value={total} />} context="Every recorded event" />
          <HeadlineCell label="Summarised here" value={<CountUp value={entries.length} />} context="The most recent events" />
          <HeadlineCell label="Failed actions" value={<CountUp value={stats.failures} />} tone={stats.failures ? 'text-status-danger-fg' : undefined} context="Result recorded as failure" />
        </>
      }
      sections={[
        { title: 'By action', body: <RankedBars items={stats.byAction} total={entries.length} limit={8} /> },
        { title: 'By entity', body: <RankedBars items={stats.byEntity} total={entries.length} limit={8} /> },
        { title: 'By user', body: <RankedBars items={stats.byActor} total={entries.length} limit={8} /> },
      ]}
      tableNote={total > entries.length ? `Summary covers the ${entries.length} most recent of ${total} events. The full trail is on the Audit trail page.` : undefined}
    />
  )
}
