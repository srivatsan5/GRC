import { describe, expect, it } from 'vitest'
import { kriLight, thresholdProblem } from '@/lib/kri'

describe('KRI traffic lights', () => {
  const outage = { amber: 8, red: 12, direction: 'HIGHER_WORSE' as const }
  const uptime = { amber: 99.5, red: 99, direction: 'LOWER_WORSE' as const }

  it('higher is worse: thresholds are the boundaries where the colour starts', () => {
    expect([0, 7.9, 8, 11.9, 12, 40].map(v => kriLight(v, outage))).toEqual(['GREEN', 'GREEN', 'AMBER', 'AMBER', 'RED', 'RED'])
  })

  it('lower is worse', () => {
    expect([100, 99.6, 99.5, 99.1, 99, 90].map(v => kriLight(v, uptime))).toEqual(['GREEN', 'GREEN', 'AMBER', 'AMBER', 'RED', 'RED'])
  })

  it('no reading or no thresholds means no light, never a guessed green', () => {
    expect(kriLight(null, outage)).toBeNull()
    expect(kriLight(5, { amber: null, red: 12, direction: 'HIGHER_WORSE' } as never)).toBeNull()
  })

  it('rejects thresholds in the wrong order for the direction', () => {
    expect(thresholdProblem(4, 8, 12, 'HIGHER_WORSE')).toBeNull()
    expect(thresholdProblem(12, 8, 4, 'HIGHER_WORSE')).toMatch(/must increase/)
    expect(thresholdProblem(100, 99.5, 99, 'LOWER_WORSE')).toBeNull()
    expect(thresholdProblem(99, 99.5, 100, 'LOWER_WORSE')).toMatch(/must decrease/)
  })
})
