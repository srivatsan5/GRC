'use client'

/**
 * "Needs your attention" items for the navbar bell, all from live data:
 * approvals waiting for the signed-in user, KRIs whose latest reading is red/amber,
 * and overdue action plans. Sources that fail to load are simply skipped.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { workflowApi } from '@/lib/apiClient'
import { useRows } from '@/lib/data'
import { kriLight, toKri, toReading } from '@/lib/kri'
import { daysUntil } from '@/lib/format'

export interface AttentionItem {
  id: string
  title: string
  body: string
  href: string
  tone: 'red' | 'amber' | 'blue'
}

export function useAttentionItems(): { items: AttentionItem[]; loading: boolean } {
  const approvals = useQuery({ queryKey: ['workflow', 'attention'], queryFn: () => workflowApi.list({ mine: 'to-decide' }), retry: false, staleTime: 60_000 })
  const kris = useRows('erm_mst_kri_definition')
  const readings = useRows('erm_trn_kri_readings')
  const plans = useRows('per_trn_risk_monitoring')

  const items = useMemo(() => {
    const out: AttentionItem[] = []
    for (const w of approvals.data?.items ?? []) {
      out.push({ id: `wf-${w.uuid}`, title: 'Approval waiting for you', body: String(w.title ?? `Request #${w.uuid}`), href: '/workflow', tone: 'blue' })
    }
    const latest = new Map<number, ReturnType<typeof toReading>>()
    for (const r of (readings.data ?? []).map(toReading)) {
      const cur = latest.get(r.kriUuid)
      if (!cur || r.date > cur.date) latest.set(r.kriUuid, r)
    }
    for (const k of (kris.data ?? []).map(toKri)) {
      if (!k.active) continue
      const r = latest.get(k.uuid)
      const light = r ? kriLight(r.value, k) : null
      if (light === 'RED' || light === 'AMBER') {
        out.push({ id: `kri-${k.uuid}`, title: `KRI ${light === 'RED' ? 'breach' : 'warning'}: ${k.code}`, body: `${k.name} — latest ${r!.value}${k.unit ? ` ${k.unit}` : ''}`, href: '/kri', tone: light === 'RED' ? 'red' : 'amber' })
      }
    }
    const overdue = (plans.data ?? []).filter(p => {
      const done = p.is_stage_complted === 'Y' || Number(p.completion_pct) >= 100 || !!p.actual_end_date
      const d = daysUntil(p.estimated_end_date)
      return !done && d != null && d < 0
    })
    if (overdue.length) {
      out.push({ id: 'plans-overdue', title: `${overdue.length} overdue action plan${overdue.length === 1 ? '' : 's'}`, body: 'Past their target end date and not complete', href: '/monitoring/action-plan', tone: 'red' })
    }
    return out
  }, [approvals.data, kris.data, readings.data, plans.data])

  return { items, loading: approvals.isLoading || kris.isLoading || readings.isLoading || plans.isLoading }
}
