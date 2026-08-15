import { describe, expect, it } from 'vitest'
import { formatEntryMeta, formatEntryTime } from './activityFormat'

// Local-time fixtures (not UTC ISO strings), matching
// src/client/domain/daysAgo.test.ts's convention.

describe('formatEntryTime', () => {
  it('reads the local clock time of the Entry', () => {
    expect(formatEntryTime(new Date(2026, 7, 15, 14, 32, 0).toISOString())).toBe('2:32 pm')
  })

  it('pads the minutes but not the hour', () => {
    expect(formatEntryTime(new Date(2026, 7, 15, 9, 5, 0).toISOString())).toBe('9:05 am')
  })

  it('reads midnight as 12 am, the day the bucket it sits in already names', () => {
    expect(formatEntryTime(new Date(2026, 7, 15, 0, 0, 0).toISOString())).toBe('12:00 am')
  })
})

describe('formatEntryMeta', () => {
  it('joins duration and note with a middot when both are present', () => {
    expect(formatEntryMeta(40, 'felt good')).toBe('40m · felt good')
  })

  it('shows only the duration when there is no note', () => {
    expect(formatEntryMeta(15, null)).toBe('15m')
  })

  it('shows only the note when there is no duration', () => {
    expect(formatEntryMeta(null, 'felt good')).toBe('felt good')
  })

  it('is null when neither duration nor note is present', () => {
    expect(formatEntryMeta(null, null)).toBeNull()
  })
})
