import { describe, expect, it } from 'vitest'
import { effectiveThresholdDays } from './threshold'

describe('effectiveThresholdDays', () => {
  it('is the Tracker Threshold when there is no Variant', () => {
    expect(effectiveThresholdDays({ thresholdDays: 14 })).toBe(14)
  })

  it('is null when the Tracker has no Threshold and there is no Variant', () => {
    expect(effectiveThresholdDays({ thresholdDays: null })).toBeNull()
  })

  it("inherits the parent Tracker's Threshold when the Variant has none", () => {
    expect(effectiveThresholdDays({ thresholdDays: 14 }, { thresholdDays: null })).toBe(14)
  })

  it("prefers the Variant's own Threshold over the parent's", () => {
    expect(effectiveThresholdDays({ thresholdDays: 14 }, { thresholdDays: 7 })).toBe(7)
  })

  it('lets a thresholdless Tracker have a thresholded Variant', () => {
    expect(effectiveThresholdDays({ thresholdDays: null }, { thresholdDays: 7 })).toBe(7)
  })

  it('is null when neither the Tracker nor the Variant has a Threshold', () => {
    expect(effectiveThresholdDays({ thresholdDays: null }, { thresholdDays: null })).toBeNull()
  })
})
