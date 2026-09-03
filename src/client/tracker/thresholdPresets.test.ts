import { describe, expect, it } from 'vitest'
import { daysFromCustomInput, THRESHOLD_MAX_DAYS, THRESHOLD_PRESETS, THRESHOLD_UNITS, presetMatching } from './thresholdPresets'

describe('THRESHOLD_PRESETS', () => {
  it('is the six tiers from docs/design.md, in days', () => {
    expect(THRESHOLD_PRESETS.map((p) => [p.label, p.days])).toEqual([
      ['1w', 7],
      ['2w', 14],
      ['1m', 30],
      ['3m', 90],
      ['6m', 180],
      ['1y', 365],
    ])
  })
})

describe('presetMatching', () => {
  it('finds the preset whose days match exactly', () => {
    expect(presetMatching(7)?.label).toBe('1w')
    expect(presetMatching(365)?.label).toBe('1y')
  })

  it('is undefined for null (no threshold)', () => {
    expect(presetMatching(null)).toBeUndefined()
  })

  it('is undefined for a value with no matching preset (custom)', () => {
    expect(presetMatching(45)).toBeUndefined()
  })
})

describe('daysFromCustomInput', () => {
  it('converts an amount + unit into whole days', () => {
    expect(daysFromCustomInput(3, 'day')).toBe(3)
    expect(daysFromCustomInput(2, 'week')).toBe(14)
    expect(daysFromCustomInput(1, 'month')).toBe(30)
    expect(daysFromCustomInput(2, 'year')).toBe(730)
  })

  it('rounds fractional results to the nearest whole day', () => {
    expect(daysFromCustomInput(1.5, 'week')).toBe(11)
  })

  it('is null for a non-positive or non-finite amount', () => {
    expect(daysFromCustomInput(0, 'day')).toBeNull()
    expect(daysFromCustomInput(-1, 'day')).toBeNull()
    expect(daysFromCustomInput(Number.NaN, 'day')).toBeNull()
  })

  it('is null when the resulting days exceed the ten-year cap, matching the server', () => {
    expect(THRESHOLD_MAX_DAYS).toBe(3650)
    expect(daysFromCustomInput(10, 'year')).toBe(3650) // exactly the cap, still allowed
    expect(daysFromCustomInput(11, 'year')).toBeNull()
    expect(daysFromCustomInput(3651, 'day')).toBeNull()
  })
})

describe('THRESHOLD_UNITS', () => {
  it('offers day/week/month/year', () => {
    expect(THRESHOLD_UNITS.map((u) => u.value)).toEqual(['day', 'week', 'month', 'year'])
  })
})
