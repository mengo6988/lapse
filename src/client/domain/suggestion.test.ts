import { describe, expect, it } from 'vitest'
import { suggestThreshold } from './suggestion'

const isoDaysAgo = (days: number, from: Date) =>
  new Date(from.getTime() - days * 86_400_000).toISOString()

const NOW = new Date('2026-08-15T12:00:00.000Z')

// 3 Entries spaced evenly so the mean gap equals the spacing exactly,
// keeping the fixtures free of floating-point drift at the 30% boundary.
const entriesWithGap = (gapDays: number) => [
  isoDaysAgo(0, NOW),
  isoDaysAgo(gapDays, NOW),
  isoDaysAgo(gapDays * 2, NOW),
]

describe('suggestThreshold', () => {
  it('is null with fewer than 3 Entries, thresholded or not', () => {
    expect(suggestThreshold(10, [])).toBeNull()
    expect(suggestThreshold(null, [isoDaysAgo(0, NOW), isoDaysAgo(10, NOW)])).toBeNull()
  })

  it('gently suggests setting a Threshold for a thresholdless Tracker with 3+ Entries', () => {
    expect(suggestThreshold(null, entriesWithGap(20))).toEqual({
      kind: 'set',
      observedIntervalDays: 20,
    })
  })

  it('does not suggest when the observed interval is within 30% of the Threshold', () => {
    // threshold 20, observed 26 -> deviation exactly 0.3, the inclusive edge
    expect(suggestThreshold(20, entriesWithGap(26))).toBeNull()
    // threshold 20, observed 14 -> deviation exactly 0.3 on the low side
    expect(suggestThreshold(20, entriesWithGap(14))).toBeNull()
  })

  it('suggests updating once the observed interval deviates past 30%, on both sides', () => {
    // threshold 20, observed 27 -> deviation 0.35, above the Threshold
    expect(suggestThreshold(20, entriesWithGap(27))).toEqual({
      kind: 'update',
      observedIntervalDays: 27,
    })
    // threshold 20, observed 13 -> deviation 0.35, below the Threshold
    expect(suggestThreshold(20, entriesWithGap(13))).toEqual({
      kind: 'update',
      observedIntervalDays: 13,
    })
  })
})
