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

  it('says how far over an overdue row is — the accent bar carrying that is aria-hidden', () => {
    expect(
      formatRowSubline(
        row({ lastEntryAt: '2026-08-03T00:00:00.000Z', thresholdDays: 7, urgency: 'overdue' }),
        NOW,
      ),
    ).toBe('last done 12d ago · every 7d · 5d over')
  })

  it('says when a due-soon row is due', () => {
    expect(
      formatRowSubline(
        row({ lastEntryAt: '2026-08-09T00:00:00.000Z', thresholdDays: 7, urgency: 'due-soon' }),
        NOW,
      ),
    ).toBe('last done 6d ago · every 7d · due tomorrow')
  })

  it('counts down the remaining days when a due-soon row has more than one left', () => {
    expect(
      formatRowSubline(
        row({ lastEntryAt: '2026-07-29T00:00:00.000Z', thresholdDays: 20, urgency: 'due-soon' }),
        NOW,
      ),
    ).toBe('last done 17d ago · every 20d · due in 3d')
  })

  it('adds nothing for a fresh row — the absence of a warning is the signal', () => {
    expect(
      formatRowSubline(
        row({ lastEntryAt: '2026-08-14T00:00:00.000Z', thresholdDays: 7, urgency: 'fresh' }),
        NOW,
      ),
    ).toBe('last done 1d ago · every 7d')
  })
})
