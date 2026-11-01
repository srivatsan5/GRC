'use client'

/** Shared risk-register helpers for the analytics pages. */
import { useRows, type Row } from '@/lib/data'
import { bandOf, toRisk, type Risk, type RiskBands } from '@/lib/risk'
import type { CsvColumn } from './csv'

export const RISK_TABLE = 'per_trn_identify_risk'

const toRisks = (rows: Row[]) => rows.map(toRisk)

/** Every risk-register row as a Risk (active and inactive; filter with r.isActive). */
export function useRisks() {
  return useRows<Risk>(RISK_TABLE, { select: toRisks })
}

/** A readable name for a risk: its statement, else its reference, else its id. */
export function riskLabel(r: Risk): string {
  return r.statement ?? r.referenceNumber ?? `Risk #${r.uuid}`
}

/** The date a risk entered the register: created_on, else assessment_registered_date. */
export function riskDate(r: Risk): string | null {
  return r.createdOn ?? r.registeredDate
}

function time(v: string | null): number {
  if (!v) return Number.NEGATIVE_INFINITY
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t
}

export function byNewest(a: Risk, b: Risk) {
  return time(riskDate(b)) - time(riskDate(a))
}

/** Counts of a key across items, sorted descending. Missing keys go to `missing`. */
export function countBy<T>(items: T[], key: (t: T) => string | null | undefined, missing = 'Not specified') {
  const map = new Map<string, number>()
  for (const it of items) {
    const k = key(it)?.toString().trim() || missing
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export const APPROVAL_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  IN_REVIEW: 'In review',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export function approvalLabel(s: string | null): string {
  return s ? APPROVAL_LABELS[s] ?? s : 'Not recorded'
}

/** CSV columns for a risk register export. Money is exported as the raw number with the currency in the header. */
export function riskCsvColumns(bands: RiskBands, currency: string): CsvColumn<Risk>[] {
  return [
    { header: 'Risk ID', value: r => r.uuid },
    { header: 'Reference', value: r => r.referenceNumber },
    { header: 'Risk statement', value: r => r.statement },
    { header: 'Category', value: r => r.category },
    { header: 'Process', value: r => r.process },
    { header: 'Sub-process', value: r => r.subProcess },
    { header: 'Owner', value: r => r.owner },
    { header: 'Champion', value: r => r.champion },
    { header: 'Inherent likelihood', value: r => r.inherentLikelihood },
    { header: 'Inherent impact', value: r => r.inherentImpact },
    { header: 'Inherent score', value: r => r.inherentScore },
    { header: 'Inherent band', value: r => bandOf(r.inherentScore, bands) ?? 'Not rated' },
    { header: 'Residual likelihood', value: r => r.residualLikelihood },
    { header: 'Residual impact', value: r => r.residualImpact },
    { header: 'Residual score', value: r => r.residualScore },
    { header: 'Residual band', value: r => bandOf(r.residualScore, bands) ?? 'Not rated' },
    { header: `SLE (${currency})`, value: r => r.sle },
    { header: 'Approval status', value: r => approvalLabel(r.approvalStatus) },
    { header: 'Stage complete', value: r => (r.isComplete ? 'Yes' : 'No') },
    { header: 'Active', value: r => (r.isActive ? 'Yes' : 'No') },
    { header: 'Created on', value: r => r.createdOn },
    { header: 'Registered on', value: r => r.registeredDate },
  ]
}
