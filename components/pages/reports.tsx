'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileDown, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DataState } from '@/components/data-state'
import { BandBadge } from '@/components/band-badge'
import { useAuth } from '@/components/providers/auth-provider'
import { useRows, type Row } from '@/lib/data'
import { auditApi } from '@/lib/apiClient'
import { bandCounts, currentScore, type Risk } from '@/lib/risk'
import { LIGHT_STYLES } from '@/lib/kri'
import { useOrgSettings } from '@/lib/settings'
import { DASH, daysUntil, formatDate, formatDateTime, formatNumber } from '@/lib/format'
import { exportCsv, fileDate, type CsvColumn } from '@/components/analytics/csv'
import { approvalLabel, countBy, riskCsvColumns, riskLabel, useRisks } from '@/components/analytics/risk-data'
import { BandCountTable, BarList, Panel } from '@/components/analytics/widgets'
import { incidentOpen, kriStatuses, numOrNull, SEVERITIES, type KriStatus } from '@/components/analytics/ops-data'

type ReportId = 'risks' | 'controls' | 'kri' | 'vendors' | 'incidents' | 'audit'

const REPORTS: { id: ReportId; name: string; description: string; audit?: boolean }[] = [
  { id: 'risks', name: 'Risk register', description: 'Active risks by band, category and owner, with ratings and SLE.' },
  { id: 'controls', name: 'Control library summary', description: 'Library controls, their effectiveness ratings, testing and risk coverage.' },
  { id: 'kri', name: 'KRI status', description: 'Each active KRI with its latest reading and traffic light.' },
  { id: 'vendors', name: 'Vendor summary', description: 'Third parties by tier and status, with overdue reviews and open findings.' },
  { id: 'incidents', name: 'Incident summary', description: 'Incidents by severity and status, with recorded losses.' },
  { id: 'audit', name: 'Audit trail summary', description: 'Recent audit events by action, entity and user.', audit: true },
]

const TABLE_LIMIT = 100

interface QueryLike {
  isLoading: boolean
  isError: boolean
  error: unknown
  refetch: () => unknown
  dataUpdatedAt: number
}

interface Column<T> extends CsvColumn<T> {
  render?: (row: T) => React.ReactNode
  align?: 'right'
  /** Exported to CSV but not shown in the on-screen table. */
  hidden?: boolean
}

const text = (v: unknown) => (v === null || v === undefined || String(v).trim() === '' ? DASH : String(v))

export function ReportsPage() {
  const { hasPermission } = useAuth()
  const available = REPORTS.filter(r => !r.audit || hasPermission('audit'))
  const [selected, setSelected] = useState<ReportId>('risks')
  const current = available.find(r => r.id === selected) ?? available[0]!

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Reports</h1>
          <p className="text-xs text-slate-500">Generated on demand from the live database. Export any report as CSV or print it.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <nav className="bg-white rounded border border-slate-200 h-fit print:hidden" aria-label="Reports">
          <ul className="divide-y divide-slate-100">
            {available.map(r => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelected(r.id)}
                  aria-current={current.id === r.id ? 'page' : undefined}
                  className={cn('w-full text-left px-4 py-3 text-xs transition-colors', current.id === r.id ? 'bg-slate-50' : 'hover:bg-slate-50')}
                >
                  <span className={cn('block font-medium', current.id === r.id ? 'text-blue-800' : 'text-slate-900')}>{r.name}</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">{r.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lg:col-span-3 space-y-4">
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

/* ------------------------------------------------------------------ shell */

function ReportShell<T>({
  title,
  entity,
  queries,
  rows,
  columns,
  emptyTitle,
  summary,
  tableNote,
}: {
  title: string
  entity: string
  queries: QueryLike[]
  rows: T[]
  columns: Column<T>[]
  emptyTitle: string
  summary?: React.ReactNode
  tableNote?: string
}) {
  const loaded = queries.every(q => !q.isLoading && !q.isError)
  const updatedAt = Math.max(...queries.map(q => q.dataUpdatedAt || 0))
  const onExport = () =>
    exportCsv({
      filename: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${fileDate()}`,
      entity,
      description: `Exported report: ${title}`,
      rows,
      columns,
    })
  const shown = rows.slice(0, TABLE_LIMIT)
  const screen = columns.filter(c => !c.hidden)

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 bg-white rounded border border-slate-200 p-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {loaded && updatedAt ? `Data as of ${formatDateTime(new Date(updatedAt).toISOString())}` : 'Loading data…'}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => window.print()} disabled={!loaded}>
            <Printer className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            Print
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={onExport} disabled={!loaded || rows.length === 0}>
            <FileDown className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </div>

      <DataState query={queries} empty={rows.length === 0} emptyTitle={emptyTitle}>
        {summary && <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{summary}</div>}
        <Panel title="Detail" bodyClassName="p-0" action={<span className="text-[11px] text-slate-500">{rows.length} rows</span>}>
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  {screen.map(c => (
                    <th key={c.header} className={c.align === 'right' ? 'text-right' : undefined}>{c.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((row, i) => (
                  <tr key={i}>
                    {screen.map(c => (
                      <td key={c.header} className={c.align === 'right' ? 'text-right tabular-nums' : undefined}>
                        {c.render ? c.render(row) : text(c.value(row))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(rows.length > TABLE_LIMIT || tableNote) && (
            <p className="px-4 py-2 text-[11px] text-slate-500 border-t border-slate-200">
              {rows.length > TABLE_LIMIT ? `Showing the first ${TABLE_LIMIT} of ${rows.length} rows; the CSV export contains all of them. ` : ''}
              {tableNote}
            </p>
          )}
        </Panel>
      </DataState>
    </>
  )
}

function Figures({ title, items }: { title: string; items: { label: string; value: React.ReactNode; tone?: string }[] }) {
  return (
    <Panel title={title}>
      <dl className="space-y-2">
        {items.map(i => (
          <div key={i.label} className="flex justify-between gap-3 text-xs">
            <dt className="text-slate-600">{i.label}</dt>
            <dd className={cn('font-semibold tabular-nums text-slate-900', i.tone)}>{i.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

/* ------------------------------------------------------------- risk register */

function RiskRegisterReport() {
  const { bands, money, settings } = useOrgSettings()
  const q = useRisks()
  const all = q.data
  const risks = useMemo(() => (all ?? []).filter(r => r.isActive), [all])
  const csv = useMemo(() => riskCsvColumns(bands, settings.currency), [bands, settings.currency])
  const columns: Column<Risk>[] = useMemo(() => {
    const render: Record<string, (r: Risk) => React.ReactNode> = {
      'Risk statement': r => <span className="font-medium text-slate-900">{riskLabel(r)}</span>,
      'Inherent score': r => <BandBadge score={r.inherentScore} />,
      'Residual score': r => <BandBadge score={r.residualScore} />,
      [`SLE (${settings.currency})`]: r => money(r.sle),
      'Created on': r => formatDate(r.createdOn),
    }
    const shownOnScreen = new Set(['Risk ID', 'Risk statement', 'Category', 'Process', 'Owner', 'Inherent score', 'Residual score', `SLE (${settings.currency})`, 'Approval status', 'Created on'])
    // The on-screen table shows a subset; CSV export uses every column.
    return csv.map(c => ({ ...c, render: render[c.header], align: c.header.startsWith('SLE') ? ('right' as const) : undefined, hidden: !shownOnScreen.has(c.header) }))
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

  return (
    <ReportShell
      title="Risk register"
      entity="per_trn_identify_risk"
      queries={[q]}
      rows={risks}
      columns={columns}
      emptyTitle="No active risks in the register"
      summary={
        <>
          <Panel title="By band" bodyClassName="p-0">
            <BandCountTable columns={[{ label: 'Inherent', counts: stats.inherent }, { label: 'Residual', counts: stats.residual }, { label: 'Current', counts: stats.current }]} />
            <p className="px-4 py-2 text-[11px] text-slate-500 border-t border-slate-200">Current = residual if assessed, else inherent.</p>
          </Panel>
          <Panel title="By category">
            <BarList items={stats.byCategory} total={risks.length} limit={8} />
          </Panel>
          <Panel title="By owner">
            <BarList items={stats.byOwner} total={risks.length} limit={8} />
          </Panel>
          <Figures
            title="Totals"
            items={[
              { label: 'Active risks', value: formatNumber(risks.length) },
              { label: 'Recorded SLE', value: money(stats.sle) },
              { label: 'Risks with an SLE', value: formatNumber(stats.sleCount) },
              ...stats.byApproval.map(a => ({ label: a.name, value: formatNumber(a.count) })),
            ]}
          />
        </>
      }
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

  const controls = controlsQ.data ?? []
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

  const columns: Column<Row>[] = [
    { header: 'Code', value: c => c.control_code },
    { header: 'Name', value: c => c.control_name, render: c => <span className="font-medium text-slate-900">{text(c.control_name)}</span> },
    { header: 'Type', value: c => c.control_type },
    { header: 'Nature', value: c => c.control_nature },
    { header: 'Frequency', value: c => c.frequency },
    { header: 'Owner', value: c => c.owner_name },
    { header: 'Design (1–5)', value: c => numOrNull(c.design_effectiveness), align: 'right' },
    { header: 'Operating (1–5)', value: c => numOrNull(c.operating_effectiveness), align: 'right' },
    { header: 'Last tested', value: c => c.last_tested_on, render: c => formatDate(c.last_tested_on) },
    { header: 'Linked risks', value: c => linked.get(Number(c.uuid))?.size ?? 0, align: 'right' },
    { header: 'Status', value: c => c.status },
  ]

  return (
    <ReportShell
      title="Control library summary"
      entity="erm_mst_control"
      queries={[controlsQ, linksQ, implQ]}
      rows={controls}
      columns={columns}
      emptyTitle="No controls in the library yet"
      summary={
        <>
          <Figures
            title="Effectiveness"
            items={[
              { label: 'Controls', value: formatNumber(controls.length) },
              { label: `Average design (${stats.designN} rated)`, value: stats.design == null ? DASH : `${formatNumber(stats.design, 1)} / 5` },
              { label: `Average operating (${stats.operatingN} rated)`, value: stats.operating == null ? DASH : `${formatNumber(stats.operating, 1)} / 5` },
              { label: 'Never tested', value: formatNumber(stats.untested), tone: stats.untested ? 'text-amber-700' : undefined },
              { label: 'Linked to at least one risk', value: formatNumber(stats.linked) },
            ]}
          />
          <Panel title="By status">
            <BarList items={stats.byStatus} total={controls.length} />
          </Panel>
          <Panel title="By type">
            <BarList items={stats.byType} total={controls.length} />
          </Panel>
        </>
      }
      tableNote="Linked risks counts distinct risks from control–risk links and applied controls."
    />
  )
}

/* ----------------------------------------------------------------------- KRI */

function LightChip({ light }: { light: KriStatus['light'] }) {
  if (!light) return <span className="text-[11px] text-slate-500">No reading</span>
  const s = LIGHT_STYLES[light]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium', s.bg, s.text, s.border)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} aria-hidden="true" />
      {light}
    </span>
  )
}

function KriReport() {
  const defsQ = useRows('erm_mst_kri_definition')
  const readsQ = useRows('erm_trn_kri_readings')
  const statuses = useMemo(() => kriStatuses(defsQ.data ?? [], readsQ.data ?? []), [defsQ.data, readsQ.data])
  const count = (l: KriStatus['light']) => statuses.filter(s => s.light === l).length

  const columns: Column<KriStatus>[] = [
    { header: 'Code', value: s => s.kri.code },
    { header: 'Name', value: s => s.kri.name, render: s => <span className="font-medium text-slate-900">{text(s.kri.name)}</span> },
    { header: 'Category', value: s => s.kri.category },
    { header: 'Owner', value: s => s.kri.owner },
    { header: 'Direction', value: s => (s.kri.direction === 'HIGHER_WORSE' ? 'Higher is worse' : 'Lower is worse') },
    { header: 'Amber threshold', value: s => s.kri.amber, align: 'right' },
    { header: 'Red threshold', value: s => s.kri.red, align: 'right' },
    { header: 'Latest value', value: s => s.latest?.value ?? null, render: s => (s.latest ? `${formatNumber(s.latest.value, 2)}${s.kri.unit ? ` ${s.kri.unit}` : ''}` : DASH), align: 'right' },
    { header: 'Reading date', value: s => s.latest?.date ?? null, render: s => formatDate(s.latest?.date) },
    { header: 'Status', value: s => s.light ?? 'No reading', render: s => <LightChip light={s.light} /> },
  ]

  return (
    <ReportShell
      title="KRI status"
      entity="erm_mst_kri_definition"
      queries={[defsQ, readsQ]}
      rows={statuses}
      columns={columns}
      emptyTitle="No active KRIs defined"
      summary={
        <Figures
          title="Latest readings"
          items={[
            { label: 'Active KRIs', value: formatNumber(statuses.length) },
            { label: 'Red', value: formatNumber(count('RED')), tone: 'text-red-700' },
            { label: 'Amber', value: formatNumber(count('AMBER')), tone: 'text-amber-700' },
            { label: 'Green', value: formatNumber(count('GREEN')), tone: 'text-emerald-700' },
            { label: 'No reading / thresholds', value: formatNumber(count(null)) },
          ]}
        />
      }
      tableNote="Status is computed from each KRI's latest reading against its amber and red thresholds."
    />
  )
}

/* ------------------------------------------------------------------- vendors */

function VendorReport() {
  const { money, settings } = useOrgSettings()
  const q = useRows('erm_mst_vendor')
  const vendors = q.data ?? []
  const overdue = (v: Row) => {
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

  const columns: Column<Row>[] = [
    { header: 'Vendor', value: v => v.vendor_name, render: v => <span className="font-medium text-slate-900">{text(v.vendor_name)}</span> },
    { header: 'Category', value: v => v.category },
    { header: 'Tier', value: v => v.tier },
    { header: 'Country', value: v => v.country_code },
    { header: `Contract value (${settings.currency})`, value: v => numOrNull(v.contract_value), render: v => money(numOrNull(v.contract_value)), align: 'right' },
    { header: 'Risk score (1–100)', value: v => numOrNull(v.risk_score), align: 'right' },
    { header: 'Open findings', value: v => numOrNull(v.open_findings), align: 'right' },
    { header: 'Last assessed', value: v => v.last_assessment_on, render: v => formatDate(v.last_assessment_on) },
    {
      header: 'Next review',
      value: v => v.next_review_on,
      render: v => (
        <span className={overdue(v) ? 'text-red-700 font-medium' : undefined}>
          {formatDate(v.next_review_on)}
          {overdue(v) ? ' · overdue' : ''}
        </span>
      ),
    },
    { header: 'Review overdue', value: v => (overdue(v) ? 'Yes' : 'No'), hidden: true },
    { header: 'Status', value: v => v.status },
  ]

  return (
    <ReportShell
      title="Vendor summary"
      entity="erm_mst_vendor"
      queries={[q]}
      rows={vendors}
      columns={columns}
      emptyTitle="No vendors recorded yet"
      summary={
        <>
          <Figures
            title="Totals"
            items={[
              { label: 'Vendors', value: formatNumber(vendors.length) },
              { label: `Contract value (${stats.contractN} recorded)`, value: money(stats.contract) },
              { label: 'Open findings', value: formatNumber(stats.findings) },
              { label: 'Reviews overdue', value: formatNumber(stats.overdue), tone: stats.overdue ? 'text-red-700' : undefined },
            ]}
          />
          <Panel title="By tier">
            <BarList items={stats.byTier} total={vendors.length} />
          </Panel>
          <Panel title="By status">
            <BarList items={stats.byStatus} total={vendors.length} />
          </Panel>
        </>
      }
    />
  )
}

/* ----------------------------------------------------------------- incidents */

function IncidentReport() {
  const { money, settings } = useOrgSettings()
  const q = useRows('erm_trn_incident')
  const incidents = q.data ?? []
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

  const columns: Column<Row>[] = [
    { header: 'Reference', value: i => i.incident_ref },
    { header: 'Title', value: i => i.title, render: i => <span className="font-medium text-slate-900">{text(i.title)}</span> },
    { header: 'Severity', value: i => i.severity },
    { header: 'Status', value: i => i.status },
    { header: 'Category', value: i => i.category },
    { header: 'Assigned to', value: i => i.assigned_to },
    { header: 'Occurred', value: i => i.occurred_on, render: i => formatDate(i.occurred_on) },
    { header: 'Reported', value: i => i.reported_on, render: i => formatDate(i.reported_on) },
    { header: 'Closed', value: i => i.closed_on, render: i => formatDate(i.closed_on) },
    { header: `Loss (${settings.currency})`, value: i => numOrNull(i.loss_amount), render: i => money(numOrNull(i.loss_amount)), align: 'right' },
  ]

  return (
    <ReportShell
      title="Incident summary"
      entity="erm_trn_incident"
      queries={[q]}
      rows={incidents}
      columns={columns}
      emptyTitle="No incidents recorded"
      summary={
        <>
          <Figures
            title="Totals"
            items={[
              { label: 'Incidents', value: formatNumber(incidents.length) },
              { label: 'Open (not mitigated or closed)', value: formatNumber(stats.open), tone: stats.open ? 'text-amber-700' : undefined },
              { label: `Recorded losses (${stats.lossN} with an amount)`, value: money(stats.loss) },
            ]}
          />
          <Panel title="Open by severity">
            <BarList items={stats.openBySeverity} total={stats.open} />
          </Panel>
          <Panel title="By status">
            <BarList items={stats.byStatus} total={incidents.length} />
          </Panel>
        </>
      }
    />
  )
}

/* --------------------------------------------------------------------- audit */

type AuditEntry = Awaited<ReturnType<typeof auditApi.list>>['items'][number]

function AuditReport() {
  const q = useQuery({ queryKey: ['audit', 'reports-summary'], queryFn: () => auditApi.list({ limit: 1000 }) })
  const entries = q.data?.items ?? []
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

  const columns: Column<AuditEntry>[] = [
    { header: 'Seq', value: e => e.seq, align: 'right' },
    { header: 'Timestamp', value: e => e.timestamp, render: e => <span className="whitespace-nowrap text-[11px] text-slate-500">{formatDateTime(e.timestamp)}</span> },
    { header: 'User', value: e => e.actor_name },
    { header: 'Role', value: e => e.actor_role },
    { header: 'Action', value: e => e.action },
    { header: 'Entity', value: e => e.entity },
    { header: 'Entity ID', value: e => e.entity_id },
    { header: 'Description', value: e => e.description },
    { header: 'Result', value: e => e.result },
  ]

  return (
    <ReportShell
      title="Audit trail summary"
      entity="audit_trail"
      queries={[q]}
      rows={entries}
      columns={columns}
      emptyTitle="No audit events recorded"
      summary={
        <>
          <Figures
            title="Totals"
            items={[
              { label: 'Events in the trail', value: formatNumber(total) },
              { label: 'Summarised below (most recent)', value: formatNumber(entries.length) },
              { label: 'Failed actions', value: formatNumber(stats.failures), tone: stats.failures ? 'text-red-700' : undefined },
            ]}
          />
          <Panel title="By action">
            <BarList items={stats.byAction} total={entries.length} limit={8} />
          </Panel>
          <Panel title="By entity">
            <BarList items={stats.byEntity} total={entries.length} limit={8} />
          </Panel>
          <Panel title="By user">
            <BarList items={stats.byActor} total={entries.length} limit={8} />
          </Panel>
        </>
      }
      tableNote={total > entries.length ? `Summary covers the ${entries.length} most recent of ${total} events. The full trail is on the Audit trail page.` : undefined}
    />
  )
}
