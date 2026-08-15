import { describe, expect, it } from 'vitest'
import { daysAgo } from './daysAgo'

// Local-time fixtures (not UTC ISO strings) so the cross-midnight cases
// genuinely exercise device-local day bucketing regardless of which
// timezone the test runner's machine is in.
const localNow = new Date(2026, 7, 15, 1, 0, 0) // Aug 15, 2026, 01:00 local

describe('daysAgo', () => {
  it('is null when there is no Entry yet', () => {
    expect(daysAgo(null, localNow)).toBeNull()
  })

  it('is 0 for an Entry logged earlier the same local calendar day', () => {
    const sameDayEarlier = new Date(2026, 7, 15, 0, 30, 0).toISOString()
    expect(daysAgo(sameDayEarlier, localNow)).toBe(0)
  })

  it('buckets by local midnight, not a rolling 24 hours', () => {
    // Logged 23:30 the local day before "now" — well under 24h elapsed,
    // but it already crossed a local midnight, so it reads as 1 day ago.
    const lateYesterday = new Date(2026, 7, 14, 23, 30, 0).toISOString()
    expect(daysAgo(lateYesterday, localNow)).toBe(1)
  })

  it('counts whole days for an Entry several days back', () => {
    const sevenDaysBack = new Date(2026, 7, 8, 1, 0, 0).toISOString()
    expect(daysAgo(sevenDaysBack, localNow)).toBe(7)
  })

  it('never goes negative for a clock-skewed future Entry', () => {
    const future = new Date(2026, 7, 16, 1, 0, 0).toISOString()
    expect(daysAgo(future, localNow)).toBe(0)
  })
})
