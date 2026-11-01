'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataState } from '@/components/data-state'
import { BandBadge } from '@/components/band-badge'
import { useAuth } from '@/components/providers/auth-provider'
import { useRows } from '@/lib/data'
import { bandCounts, currentScore } from '@/lib/risk'
import { LIGHT_STYLES } from '@/lib/kri'
import { useOrgSettings } from '@/lib/settings'
import { auditApi, workflowApi } from '@/lib/apiClient'
import { formatDate, formatDateTime, formatNumber, formatPct, pctOf } from '@/lib/format'
import { cn } from '@/lib/utils'
import { exportCsv, fileDate } from '@/components/analytics/csv'
import { approvalLabel, byNewest, countBy, riskCsvColumns, riskDate, riskLabel, useRisks } from '@/components/analytics/risk-data'
import { BandCountTable, BarList, Panel, StatTile } from '@/components/analytics/widgets'
import { RiskHeatmap } from '@/components/analytics/risk-heatmap'
import { SEVERITIES, incidentOpen, kriStatuses, planComplete, planOverdue } from '@/components/analytics/ops-data'

const MONTHS_SHOWN = 12

function monthKey(value: string | null): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth(key: string): string {
  const [y, m] = key.split('-').map(Number) as [number, number]
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number) as [number, number]
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

export function Dashboard() {
  const { hasPermission } = useAuth()
  const { money, bands, settings } = useOrgSettings()
  const canAudit = hasPermission('audit')

  const risksQ = useRisks()
  const implQ = useRows('per_trn_control_implementation')
  const linkQ = useRows('erm_lnk_control_risk')
  const monQ = useRows('per_trn_risk_monitoring')
  const kriQ = useRows('erm_mst_kri_definition')
  const readQ = useRows('erm_trn_kri_readings')
  const incQ = useRows('erm_trn_incident')
  const wfQ = useQuery({ queryKey: ['workflow', 'dashboard', 'to-decide'], queryFn: () => workflowApi.list({ mine: 'to-decide' }) })
  const auditQ = useQuery({ queryKey: ['audit', 'dashboard-recent'], queryFn: () => auditApi.list({ limit: 5 }), enabled: canAudit })

  const allRisks = risksQ.data
  const risks = useMemo(() => (allRisks ?? []).filter(r => r.isActive), [allRisks])

  const riskStats = useMemo(() => {
    const rated = risks.filter(r => currentScore(r) != null).length
    const withSle = risks.filter(r => r.sle != null)
    const sle = withSle.reduce((s, r) => s + (r.sle ?? 0), 0)
    const current = bandCounts(risks.map(currentScore), bands)
    return {
      total: risks.length,
      rated,
      unrated: risks.length - rated,
      sle: withSle.length ? sle : null,
      sleCount: withSle.length,
      highOrCritical: current.High + current.Critical,
      critical: current.Critical,
      inherent: bandCounts(risks.map(r => r.inherentScore), bands),
      residual: bandCounts(risks.map(r => r.residualScore), bands),
    }
  }, [risks, bands])

  const coverage = useMemo(() => {
    const covered = new Set<number>()
    for (const row of implQ.data ?? []) if (row.identify_risk_uuid != null) covered.add(Number(row.identify_risk_uuid))
    for (const row of linkQ.data ?? []) if (row.risk_uuid != null) covered.add(Number(row.risk_uuid))
    const n = risks.filter(r => covered.has(r.uuid)).length
    return { covered: n, pct: pctOf(n, risks.length) }
  }, [implQ.data, linkQ.data, risks])

  const plans = useMemo(() => {
    const rows = monQ.data ?? []
    return { open: rows.filter(r => !planComplete(r)).length, overdue: rows.filter(planOverdue).length }
  }, [monQ.data])

  const kris = useMemo(() => kriStatuses(kriQ.data ?? [], readQ.data ?? []), [kriQ.data, readQ.data])
  const kriAlerts = useMemo(() => {
    const red = kris.filter(k => k.light === 'RED')
    const amber = kris.filter(k => k.light === 'AMBER')
    return { red, amber, withReading: kris.filter(k => k.latest).length, list: [...red, ...amber] }
  }, [kris])

  const incidents = useMemo(() => {
    const open = (incQ.data ?? []).filter(incidentOpen)
    const bySeverity = SEVERITIES.map(s => ({ s, n: open.filter(i => String(i.severity ?? '').toLowerCase() === s.toLowerCase()).length }))
    return { open: open.length, bySeverity }
  }, [incQ.data])

  const approvals = useMemo(() => {
    const items = (wfQ.data?.items ?? []).filter(i => i.status === 'Pending' || i.status === 'In Review')
    return { waiting: items.length, decidable: items.filter(i => i.can_decide).length }
  }, [wfQ.data])

  const trend = useMemo(() => {
    const counts = new Map<string, number>()
    let undated = 0
    for (const r of risks) {
      const k = monthKey(riskDate(r))
      if (!k) undated++
      else counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    const keys = [...counts.keys()].sort()
    if (keys.length < 2) return { data: null, undated, months: keys.length, truncated: false }
    const series: { month: string; label: string; count: number }[] = []
    for (let k = keys[0]!; k <= keys[keys.length - 1]!; k = nextMonth(k)) series.push({ month: k, label: monthLabel(k), count: counts.get(k) ?? 0 })
    return { data: series.slice(-MONTHS_SHOWN), undated, months: keys.length, truncated: series.length > MONTHS_SHOWN }
  }, [risks])

  const byProcess = useMemo(() => countBy(risks, r => r.process), [risks])
  const recent = useMemo(() => [...risks].sort(byNewest).slice(0, 6), [risks])

  const exportRegister = () =>
    exportCsv({
      filename: `risk-register-${fileDate()}`,
      entity: 'per_trn_identify_risk',
      description: 'Exported risk register from dashboard',
      rows: risks,
      columns: riskCsvColumns(bands, settings.currency),
    })

  const severityText = incidents.bySeverity.filter(x => x.n > 0).map(x => `${x.n} ${x.s.toLowerCase()}`).join(' · ')

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
          <p className="text-xs text-slate-500">Enterprise risk and control status from the live register</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportRegister} disabled={!risksQ.isSuccess || risks.length === 0} className="h-8 text-xs font-normal">
          <FileDown className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
          Export risk register (CSV)
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          title="Active risks"
          href="/rcsa/identification"
          queries={[risksQ]}
          value={formatNumber(riskStats.total)}
          sub={`${riskStats.rated} rated · ${riskStats.unrated} not rated`}
        />
        <StatTile
          title="Recorded single loss expectancy"
          href="/assessments/inherent"
          queries={[risksQ]}
          value={money(riskStats.sle, { compact: true })}
          sub={riskStats.sleCount ? `Sum over ${riskStats.sleCount} of ${riskStats.total} risks with an SLE` : 'No SLE recorded yet'}
        />
        <StatTile
          title="Control coverage"
          href="/control-library"
          queries={[risksQ, implQ, linkQ]}
          value={formatPct(coverage.pct)}
          sub={riskStats.total ? `${coverage.covered} of ${riskStats.total} active risks have at least one control` : 'No active risks'}
        />
        <StatTile
          title="Approvals waiting for you"
          href="/workflow"
          queries={[wfQ]}
          value={formatNumber(approvals.waiting)}
          sub={approvals.waiting ? `${approvals.decidable} ready for your decision` : 'Nothing to decide'}
          tone={approvals.decidable > 0 ? 'warning' : undefined}
        />
        <StatTile
          title="High and critical risks"
          href="/heatmaps"
          queries={[risksQ]}
          value={formatNumber(riskStats.highOrCritical)}
          sub={riskStats.rated ? `${riskStats.critical} critical · current score of ${riskStats.rated} rated risks` : 'No risks rated yet'}
          tone={riskStats.critical > 0 ? 'danger' : undefined}
        />
        <StatTile
          title="Open action plans"
          href="/rcsa/monitoring"
          queries={[monQ]}
          value={formatNumber(plans.open)}
          sub={plans.overdue ? `${plans.overdue} overdue` : 'None overdue'}
          tone={plans.overdue > 0 ? 'warning' : undefined}
        />
        <StatTile
          title="KRIs in red or amber"
          href="/kri"
          queries={[kriQ, readQ]}
          value={formatNumber(kriAlerts.red.length + kriAlerts.amber.length)}
          sub={kris.length ? `${kriAlerts.red.length} red · ${kriAlerts.amber.length} amber · latest readings of ${kriAlerts.withReading} of ${kris.length} KRIs` : 'No active KRIs'}
          tone={kriAlerts.red.length > 0 ? 'danger' : kriAlerts.amber.length > 0 ? 'warning' : undefined}
        />
        <StatTile
          title="Open incidents"
          href="/incidents"
          queries={[incQ]}
          value={formatNumber(incidents.open)}
          sub={severityText || 'No open incidents'}
          tone={incidents.bySeverity[0]!.n > 0 ? 'danger' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Risks by band" bodyClassName="p-0">
          <DataState query={risksQ} compact empty={risks.length === 0} emptyTitle="No risks in the register yet">
            <BandCountTable columns={[{ label: 'Inherent', counts: riskStats.inherent }, { label: 'Residual', counts: riskStats.residual }]} />
            {riskStats.unrated > 0 && (
              <p className="px-4 py-2 text-[11px] text-slate-500 border-t border-slate-200">
                {riskStats.unrated} risk{riskStats.unrated === 1 ? ' has' : 's have'} no rating yet.{' '}
                <Link href="/assessments/inherent" className="text-blue-700 hover:underline">Rate them</Link>
              </p>
            )}
          </DataState>
        </Panel>

        <Panel title="Inherent heatmap" action={<Link href="/heatmaps" className="text-xs text-blue-700 hover:underline">Open heatmaps &rarr;</Link>}>
          <DataState query={risksQ} compact empty={riskStats.inherent['Not rated'] === risks.length} emptyTitle="No inherent ratings yet" emptyAction={<Link href="/assessments/inherent" className="text-xs text-blue-700 hover:underline">Rate risks</Link>}>
            <RiskHeatmap risks={risks} which="inherent" compact />
            <p className="mt-2 text-[11px] text-slate-500">{risks.length - riskStats.inherent['Not rated']} rated · {riskStats.inherent['Not rated']} not rated</p>
          </DataState>
        </Panel>

        <Panel title="Risks by process">
          <DataState query={risksQ} compact empty={risks.length === 0} emptyTitle="No risks in the register yet">
            <BarList items={byProcess} total={risks.length} limit={6} />
          </DataState>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="New risks per month" className="lg:col-span-2" action={trend.data && trend.truncated ? <span className="text-[11px] text-slate-400">Last {MONTHS_SHOWN} months</span> : undefined}>
          <DataState query={risksQ} compact empty={!trend.data} emptyTitle="Not enough history yet" emptyDescription={`A trend needs risks registered in at least two different months (currently ${trend.months}).`}>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend.data ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} style={{ fontSize: '11px' }} stroke="#64748b" />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} style={{ fontSize: '11px' }} stroke="#64748b" />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '12px' }} />
                  <Bar dataKey="count" name="New risks" fill="#1e40af" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {trend.undated > 0 && <p className="mt-2 text-[11px] text-slate-500">{trend.undated} risk{trend.undated === 1 ? ' has' : 's have'} no created or registered date and {trend.undated === 1 ? 'is' : 'are'} not shown.</p>}
          </DataState>
        </Panel>

        <Panel title="KRI alerts" action={<Link href="/kri" className="text-xs text-blue-700 hover:underline">All KRIs &rarr;</Link>} bodyClassName="p-0">
          <DataState query={[kriQ, readQ]} compact empty={kriAlerts.list.length === 0} emptyTitle={kris.length ? 'No KRIs in red or amber' : 'No active KRIs'} emptyDescription={kris.length ? `Based on the latest reading of ${kriAlerts.withReading} of ${kris.length} KRIs.` : undefined}>
            <ul className="divide-y divide-slate-100">
              {kriAlerts.list.map(({ kri, latest, light }) => (
                <li key={kri.uuid} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{kri.name || kri.code}</div>
                    <div className="text-[11px] text-slate-500">
                      {formatNumber(latest?.value, 2)}
                      {kri.unit ? ` ${kri.unit}` : ''} · {formatDate(latest?.date)}
                    </div>
                  </div>
                  {light && (
                    <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium', LIGHT_STYLES[light].bg, LIGHT_STYLES[light].text, LIGHT_STYLES[light].border)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', LIGHT_STYLES[light].dot)} aria-hidden="true" />
                      {LIGHT_STYLES[light].label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </DataState>
        </Panel>
      </div>

      <Panel title="Recent risks" action={<Link href="/rcsa/identification" className="text-xs text-blue-700 hover:underline">View register &rarr;</Link>} bodyClassName="p-0">
        <DataState query={risksQ} compact empty={recent.length === 0} emptyTitle="No risks in the register yet" emptyAction={<Link href="/rcsa/identification" className="text-xs text-blue-700 hover:underline">Identify a risk</Link>}>
          <div className="overflow-x-auto">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th className="w-[38%]">Risk statement</th>
                  <th>Process</th>
                  <th>Inherent</th>
                  <th>Residual</th>
                  <th className="text-right">SLE</th>
                  <th>Approval</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(r => (
                  <tr key={r.uuid}>
                    <td>
                      <span className="font-medium text-slate-900">{riskLabel(r)}</span>
                      <span className="block text-[11px] text-slate-400 font-mono">{r.referenceNumber ?? `#${r.uuid}`}</span>
                    </td>
                    <td className="text-slate-600">{r.process ?? '—'}</td>
                    <td><BandBadge score={r.inherentScore} /></td>
                    <td><BandBadge score={r.residualScore} /></td>
                    <td className="text-right tabular-nums">{money(r.sle)}</td>
                    <td>
                      <Badge variant="outline" className="text-[10px] font-normal px-2 py-0.5 rounded">{approvalLabel(r.approvalStatus)}</Badge>
                    </td>
                    <td className="text-slate-600 whitespace-nowrap">{formatDate(riskDate(r))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </Panel>

      {canAudit && (
        <Panel title="Recent audit events" action={<Link href="/audit-trail" className="text-xs text-blue-700 hover:underline">Full audit trail &rarr;</Link>} bodyClassName="p-0">
          <DataState query={auditQ} compact empty={(auditQ.data?.items.length ?? 0) === 0} emptyTitle="No audit events yet">
            <div className="overflow-x-auto">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>User</th>
                    <th>Action</th>
                    <th className="w-[50%]">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {(auditQ.data?.items ?? []).map(e => (
                    <tr key={e.id}>
                      <td className="text-[11px] text-slate-500 whitespace-nowrap">{formatDateTime(e.timestamp)}</td>
                      <td className="font-medium text-slate-900">{e.actor_name}</td>
                      <td className="font-mono text-xs text-slate-700">{e.action}</td>
                      <td className="text-slate-600">{e.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataState>
        </Panel>
      )}
    </div>
  )
}
