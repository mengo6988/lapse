import { describe, expect, it } from 'vitest'
import { urgencyRatio, urgencyState } from './urgency'

const NOW = new Date('2026-08-15T12:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

describe('urgencyRatio', () => {
  it('is days since the last entry divided by the threshold', () => {
    expect(urgencyRatio(daysAgo(7), 7, NOW)).toBeCloseTo(1)
    expect(urgencyRatio(daysAgo(15), 30, NOW)).toBeCloseTo(0.5)
    expect(urgencyRatio(daysAgo(60), 30, NOW)).toBeCloseTo(2)
  })

  it('is null without a threshold or without an entry', () => {
    expect(urgencyRatio(daysAgo(7), null, NOW)).toBeNull()
    expect(urgencyRatio(null, 7, NOW)).toBeNull()
    expect(urgencyRatio(null, null, NOW)).toBeNull()
  })

  it('ranks a long overdue slow tracker above a barely late fast one', () => {
    const slow = urgencyRatio(daysAgo(60), 30, NOW)!
    const fast = urgencyRatio(daysAgo(8), 7, NOW)!
    expect(slow).toBeGreaterThan(fast)
  })

  it('never goes negative when the entry time is in the future', () => {
    expect(urgencyRatio(new Date(NOW.getTime() + 86_400_000).toISOString(), 7, NOW)).toBe(0)
  })
})

describe('urgencyState', () => {
  it('is neutral without a threshold, logged or not', () => {
    expect(urgencyState(daysAgo(400), null, NOW)).toBe('neutral')
    expect(urgencyState(null, null, NOW)).toBe('neutral')
  })

  it('is never when thresholded and unlogged', () => {
    expect(urgencyState(null, 7, NOW)).toBe('never')
  })

  it('is fresh below a ratio of 0.8', () => {
    expect(urgencyState(daysAgo(1), 7, NOW)).toBe('fresh')
    expect(urgencyState(daysAgo(5.5), 7, NOW)).toBe('fresh')
  })

  it('is due-soon from 0.8 up to but not including 1', () => {
    expect(urgencyState(daysAgo(8), 10, NOW)).toBe('due-soon')
    expect(urgencyState(daysAgo(6.99), 7, NOW)).toBe('due-soon')
  })

  it('is overdue at a ratio of 1 or above', () => {
    expect(urgencyState(daysAgo(7), 7, NOW)).toBe('overdue')
    expect(urgencyState(daysAgo(70), 7, NOW)).toBe('overdue')
  })
})
