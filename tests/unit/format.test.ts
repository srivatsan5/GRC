import { describe, expect, it } from 'vitest'
import { DASH, daysUntil, formatDate, formatMoney, formatPct, pctOf, toDateInput } from '@/lib/format'

describe('formatting', () => {
  it('shows a dash for missing values, never 0', () => {
    expect(formatMoney(null)).toBe(DASH)
    expect(formatMoney(Number.NaN)).toBe(DASH)
    expect(formatPct(undefined)).toBe(DASH)
    expect(formatDate('')).toBe(DASH)
    expect(formatDate('not a date')).toBe(DASH)
  })

  it('formats money in the organisation’s currency', () => {
    expect(formatMoney(150000, 'USD')).toMatch(/150,000/)
    expect(formatMoney(1_700_000, 'EUR', { compact: true })).toMatch(/1\.7M/)
  })

  it('does not divide by zero', () => {
    expect(pctOf(3, 0)).toBeNull()
    expect(pctOf(7, 20)).toBe(35)
  })

  it('keeps calendar dates on the stored day whatever the time zone', () => {
    expect(toDateInput('2026-06-30T00:00:00Z')).toBe('2026-06-30')
    expect(formatDate('2026-06-30T00:00:00Z', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: undefined })).toMatch(/30/)
  })

  it('counts whole days to a due date (negative when overdue)', () => {
    const now = new Date(2026, 10, 1, 15, 30) // 1 Nov 2026, afternoon local time
    expect(daysUntil('2026-11-01T00:00:00Z', now)).toBe(0)
    expect(daysUntil('2026-11-11T00:00:00Z', now)).toBe(10)
    expect(daysUntil('2026-10-30T00:00:00Z', now)).toBe(-2)
    expect(daysUntil(null, now)).toBeNull()
  })
})
