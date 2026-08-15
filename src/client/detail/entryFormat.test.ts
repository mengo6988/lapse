import { describe, expect, it } from 'vitest'
import { formatEntryAbsolute, formatEntryRelative } from './entryFormat'

// Local-time fixtures (not UTC ISO strings) so this exercises device-local
// day bucketing regardless of which timezone the test runner is in —
// matching src/client/domain/daysAgo.test.ts's convention.
const NOW = new Date(2026, 7, 15, 12, 0, 0)

describe('formatEntryRelative', () => {
  it('reads "today" for an Entry logged earlier the same local day', () => {
    expect(formatEntryRelative(new Date(2026, 7, 15, 9, 0, 0).toISOString(), NOW)).toBe('today')
  })

  it('reads "yesterday" for an Entry one local day back', () => {
    expect(formatEntryRelative(new Date(2026, 7, 14, 9, 0, 0).toISOString(), NOW)).toBe('yesterday')
  })

  it('reads "Nd ago" for anything older', () => {
    expect(formatEntryRelative(new Date(2026, 7, 1, 9, 0, 0).toISOString(), NOW)).toBe('14d ago')
  })
})

describe('formatEntryAbsolute', () => {
  it('formats a readable absolute date and time', () => {
    const formatted = formatEntryAbsolute('2026-08-15T09:00:00.000Z')
    expect(formatted).toContain('2026')
  })
})
