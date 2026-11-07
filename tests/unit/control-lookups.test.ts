import { describe, expect, it } from 'vitest'
import { lookupName } from '@/lib/controlLookups'

describe('lookupName', () => {
  const freq = new Map([['1', 'Continuous'], ['2', 'Daily']])
  it('turns a lookup id into its name', () => {
    expect(lookupName(2, freq)).toBe('Daily')
    expect(lookupName('1', freq)).toBe('Continuous')
  })
  it('keeps text values as stored', () => expect(lookupName('Weekly', freq)).toBe('Weekly'))
  it('returns null for empty or unknown ids, never the raw number', () => {
    expect(lookupName(null, freq)).toBeNull()
    expect(lookupName('  ', freq)).toBeNull()
    expect(lookupName(9, freq)).toBeNull()
  })
})
