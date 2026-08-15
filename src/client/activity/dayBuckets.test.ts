import { describe, expect, it } from 'vitest'
import type { ActivityRow } from './activityRows'
import { groupActivityRowsByDay } from './dayBuckets'

// Local-time fixtures (not UTC ISO strings) so this exercises device-local
// day bucketing regardless of which timezone the test runner is in —
// matching src/client/domain/daysAgo.test.ts's convention.
const NOW = new Date(2026, 7, 15, 1, 0, 0) // Aug 15, 2026, 01:00 local

function row(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: 'entry-1',
    trackerId: 'tracker-1',
    variantId: null,
    trackerName: 'tyre pressure',
    variantName: null,
    occurredAt: NOW.toISOString(),
    durationMinutes: null,
    note: null,
    ...overrides,
  }
}

describe('groupActivityRowsByDay', () => {
  it('returns no sections for an empty row list', () => {
    expect(groupActivityRowsByDay([], NOW)).toEqual([])
  })

  it('buckets an Entry logged earlier the same local day as "today"', () => {
    const sameDay = row({ occurredAt: new Date(2026, 7, 15, 0, 30, 0).toISOString() })

    const sections = groupActivityRowsByDay([sameDay], NOW)

    expect(sections).toHaveLength(1)
    expect(sections[0]?.label).toBe('today')
    expect(sections[0]?.rows).toEqual([sameDay])
  })

  it('buckets by local midnight, not a rolling 24 hours — 23:30 the local day before reads "yesterday"', () => {
    // Well under 24h before NOW, but it already crossed a local midnight.
    const lateYesterday = row({ occurredAt: new Date(2026, 7, 14, 23, 30, 0).toISOString() })

    const sections = groupActivityRowsByDay([lateYesterday], NOW)

    expect(sections[0]?.label).toBe('yesterday')
  })

  it('labels an older Entry with an absolute lowercase date', () => {
    const older = row({ occurredAt: new Date(2026, 7, 1, 9, 0, 0).toISOString() })

    const sections = groupActivityRowsByDay([older], NOW)

    expect(sections[0]?.label).toBe('aug 1')
  })

  it('includes the year for an Entry from a previous calendar year', () => {
    const lastYear = row({ occurredAt: new Date(2025, 11, 25, 9, 0, 0).toISOString() })

    const sections = groupActivityRowsByDay([lastYear], NOW)

    expect(sections[0]?.label).toBe('dec 25, 2025')
  })

  it('groups consecutive same-local-day rows into a single section, preserving row order', () => {
    const first = row({ id: 'e1', occurredAt: new Date(2026, 7, 15, 9, 0, 0).toISOString() })
    const second = row({ id: 'e2', occurredAt: new Date(2026, 7, 15, 8, 0, 0).toISOString() })

    const sections = groupActivityRowsByDay([first, second], NOW)

    expect(sections).toHaveLength(1)
    expect(sections[0]?.rows.map((r) => r.id)).toEqual(['e1', 'e2'])
  })

  it('opens a new section once the local day changes, in newest-first row order', () => {
    const today = row({ id: 'e-today', occurredAt: new Date(2026, 7, 15, 9, 0, 0).toISOString() })
    const yesterday = row({ id: 'e-yesterday', occurredAt: new Date(2026, 7, 14, 9, 0, 0).toISOString() })

    const sections = groupActivityRowsByDay([today, yesterday], NOW)

    expect(sections.map((s) => s.label)).toEqual(['today', 'yesterday'])
    expect(sections[0]?.rows.map((r) => r.id)).toEqual(['e-today'])
    expect(sections[1]?.rows.map((r) => r.id)).toEqual(['e-yesterday'])
  })

  it('gives each section a dayKey that is stable and distinct per local day', () => {
    const today = row({ occurredAt: new Date(2026, 7, 15, 9, 0, 0).toISOString() })
    const yesterday = row({ occurredAt: new Date(2026, 7, 14, 9, 0, 0).toISOString() })

    const sections = groupActivityRowsByDay([today, yesterday], NOW)

    expect(sections[0]?.dayKey).not.toBe(sections[1]?.dayKey)
  })
})
