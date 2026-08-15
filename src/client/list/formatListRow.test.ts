import { describe, expect, it } from 'vitest'
import type { ListRow } from '../domain/trackerRows'
import { formatRowCount, formatRowSubline } from './formatListRow'

const NOW = new Date('2026-08-15T00:00:00.000Z')

function row(overrides: Partial<ListRow>): ListRow {
  return {
    key: 'k',
    trackerId: 't',
    variantId: null,
    name: 'vacuum house',
    variantName: null,
    categoryId: null,
    thresholdDays: 7,
    lastEntryAt: null,
    urgency: 'never',
    ...overrides,
  }
}

describe('formatRowCount', () => {
  it('is an em-dash when there is no last Entry, thresholded or not', () => {
    expect(formatRowCount(row({ lastEntryAt: null, thresholdDays: 7, urgency: 'never' }), NOW)).toBe('—')
    expect(formatRowCount(row({ lastEntryAt: null, thresholdDays: null, urgency: 'neutral' }), NOW)).toBe(
      '—',
    )
  })

  it('is "Nd" using the domain daysAgo bucketing when there is a last Entry', () => {
    const result = formatRowCount(
      row({ lastEntryAt: '2026-08-01T00:00:00.000Z', thresholdDays: 7, urgency: 'overdue' }),
      NOW,
    )
    expect(result).toBe('14d')
  })
})

describe('formatRowSubline', () => {
  it('reads "last done never · every Yd" for a thresholded, never-logged row', () => {
    expect(formatRowSubline(row({ lastEntryAt: null, thresholdDays: 90 }), NOW)).toBe(
      'last done never · every 90d',
    )
  })

  it('reads "last done Xd ago · every Yd" for a thresholded row with an Entry', () => {
    expect(
      formatRowSubline(row({ lastEntryAt: '2026-08-01T00:00:00.000Z', thresholdDays: 60 }), NOW),
    ).toBe('last done 14d ago · every 60d')
  })

  it('omits the "every" clause for a thresholdless row', () => {
    expect(
      formatRowSubline(row({ lastEntryAt: '2026-07-28T00:00:00.000Z', thresholdDays: null }), NOW),
    ).toBe('last done 18d ago')
  })

  it('reads "last done never" for a thresholdless, never-logged row', () => {
    expect(formatRowSubline(row({ lastEntryAt: null, thresholdDays: null }), NOW)).toBe('last done never')
  })
})
