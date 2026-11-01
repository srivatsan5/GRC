import { describe, expect, it } from 'vitest'
import { bandCounts, bandOf, currentScore, DEFAULT_BANDS, heatmapCells, scoreOf, toRisk } from '@/lib/risk'

describe('risk scoring', () => {
  it('scores likelihood × impact, and only when both are rated', () => {
    expect(scoreOf(4, 5)).toBe(20)
    expect(scoreOf(1, 1)).toBe(1)
    expect(scoreOf(null, 5)).toBeNull()
    expect(scoreOf(3, null)).toBeNull()
  })

  it('bands scores at the default thresholds (7 / 12 / 16)', () => {
    expect([1, 6, 7, 11, 12, 15, 16, 25].map(s => bandOf(s))).toEqual(['Low', 'Low', 'Moderate', 'Moderate', 'High', 'High', 'Critical', 'Critical'])
    expect(bandOf(null)).toBeNull()
    expect(bandOf(Number.NaN)).toBeNull()
  })

  it('uses the organisation’s own thresholds when given', () => {
    const strict = { moderate: 4, high: 8, critical: 12 }
    expect(bandOf(10, strict)).toBe('High')
    expect(bandOf(10, DEFAULT_BANDS)).toBe('Moderate')
  })

  it('counts unrated risks separately instead of hiding them', () => {
    expect(bandCounts([20, 12, 8, 2, null, null])).toEqual({ Low: 1, Moderate: 1, High: 1, Critical: 1, 'Not rated': 2 })
  })
})

describe('toRisk', () => {
  const row = {
    uuid: 1510,
    risk_statement: '  POS System Downtime ',
    inherent_likelihood: '4',
    inherent_impact: 4,
    residual_likelihood: 2,
    residual_impact: 3,
    inherent_sle: '200000',
    approval_status: 'submitted',
    status: 'Y',
    is_stage_complted: 'Y',
    risk_owner: 'null',
  }

  it('maps database columns and computes both scores', () => {
    const r = toRisk(row)
    expect(r).toMatchObject({ uuid: 1510, statement: 'POS System Downtime', inherentScore: 16, residualScore: 6, sle: 200000, approvalStatus: 'SUBMITTED', isActive: true, isComplete: true, owner: null })
    expect(currentScore(r)).toBe(6)
  })

  it('never invents a rating: out-of-range or missing values stay unrated', () => {
    const r = toRisk({ uuid: 1, inherent_likelihood: 0, inherent_impact: 6, residual_likelihood: 2.5, residual_impact: '' })
    expect(r.inherentScore).toBeNull()
    expect(r.residualScore).toBeNull()
    expect(currentScore(r)).toBeNull()
    expect(r.sle).toBeNull()
  })

  it('falls back to the inherent score when residual is not assessed', () => {
    expect(currentScore(toRisk({ uuid: 2, inherent_likelihood: 3, inherent_impact: 3 }))).toBe(9)
  })

  it('treats only status N as inactive', () => {
    expect(toRisk({ uuid: 3, status: 'N' }).isActive).toBe(false)
    expect(toRisk({ uuid: 4 }).isActive).toBe(true)
  })
})

describe('heatmapCells', () => {
  it('places each rated risk in its likelihood × impact cell and counts the rest', () => {
    const risks = [toRisk({ uuid: 1, inherent_likelihood: 5, inherent_impact: 4 }), toRisk({ uuid: 2, inherent_likelihood: 5, inherent_impact: 4 }), toRisk({ uuid: 3 })]
    const { cells, unrated } = heatmapCells(risks, 'inherent')
    expect(cells[4]![3]!.map(r => r.uuid)).toEqual([1, 2])
    expect(unrated).toBe(1)
    expect(cells.flat().reduce((n, c) => n + c.length, 0)).toBe(2)
  })
})
