import { describe, expect, it } from 'vitest'
import { observedIntervalDays } from './interval'

const isoDaysAgo = (days: number, from: Date) =>
  new Date(from.getTime() - days * 86_400_000).toISOString()

const NOW = new Date('2026-08-15T12:00:00.000Z')

describe('observedIntervalDays', () => {
  it('is null with zero, one, or two Entries', () => {
    expect(observedIntervalDays([])).toBeNull()
    expect(observedIntervalDays([isoDaysAgo(0, NOW)])).toBeNull()
    expect(observedIntervalDays([isoDaysAgo(0, NOW), isoDaysAgo(10, NOW)])).toBeNull()
  })

  it('is defined the moment a third Entry exists', () => {
    const entries = [isoDaysAgo(0, NOW), isoDaysAgo(10, NOW), isoDaysAgo(20, NOW)]
    expect(observedIntervalDays(entries)).toBe(10)
  })

  it('is the mean gap regardless of input order', () => {
    const inOrder = [isoDaysAgo(0, NOW), isoDaysAgo(10, NOW), isoDaysAgo(30, NOW)]
    const shuffled = [isoDaysAgo(30, NOW), isoDaysAgo(0, NOW), isoDaysAgo(10, NOW)]
    // gaps: 10 and 20 -> mean 15
    expect(observedIntervalDays(inOrder)).toBe(15)
    expect(observedIntervalDays(shuffled)).toBe(15)
  })

  it('considers only the most recent 10 Entries', () => {
    // 10 recent entries each 6 days apart (9 gaps of 6 -> mean 6), plus one
    // ancient outlier that would drag the mean up if it were included.
    const recent = Array.from({ length: 10 }, (_, i) => isoDaysAgo(i * 6, NOW))
    const withOutlier = [...recent, isoDaysAgo(3650, NOW)]
    expect(observedIntervalDays(recent)).toBe(6)
    expect(observedIntervalDays(withOutlier)).toBe(6)
  })

  it('does not mutate the input array', () => {
    const entries = [isoDaysAgo(30, NOW), isoDaysAgo(0, NOW), isoDaysAgo(10, NOW)]
    const copy = [...entries]
    observedIntervalDays(entries)
    expect(entries).toEqual(copy)
  })
})
