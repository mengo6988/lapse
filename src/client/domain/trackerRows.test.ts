import { describe, expect, it } from 'vitest'
import type { Tracker } from '../api'
import { trackerRows } from './trackerRows'

const NOW = new Date('2026-08-15T12:00:00.000Z')

const SORTED = { includeArchived: false, sortByUrgency: true }
const UNSORTED_ACTIVE_ONLY = { includeArchived: false, sortByUrgency: false }
const UNSORTED_WITH_ARCHIVED = { includeArchived: true, sortByUrgency: false }

function tracker(overrides: Partial<Tracker> = {}): Tracker {
  return {
    id: 'tracker-1',
    name: 'vacuum house',
    categoryId: null,
    thresholdDays: 7,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    latestEntry: null,
    variants: [],
    ...overrides,
  }
}

function entryAt(occurredAt: string) {
  return {
    id: 'entry-1',
    trackerId: 'tracker-1',
    variantId: null,
    occurredAt,
    durationMinutes: null,
    note: null,
    createdAt: occurredAt,
  }
}

describe('trackerRows', () => {
  it('produces one row for a Tracker with no Variants', () => {
    const rows = trackerRows([tracker()], NOW, UNSORTED_ACTIVE_ONLY)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      trackerId: 'tracker-1',
      variantId: null,
      name: 'vacuum house',
      variantName: null,
    })
  })

  it('produces one row per Variant, never a tracker-level row, when Variants exist', () => {
    const rows = trackerRows(
      [
        tracker({
          id: 'tyre',
          name: 'tyre pressure',
          variants: [
            { id: 'volvo', name: 'volvo', thresholdDays: null, latestEntry: null },
            { id: 'crv', name: 'crv', thresholdDays: 7, latestEntry: null },
          ],
        }),
      ],
      NOW,
      UNSORTED_ACTIVE_ONLY,
    )
    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.trackerId === 'tyre')).toBe(true)
    expect(rows.map((row) => row.variantName).sort()).toEqual(['crv', 'volvo'])
    expect(rows.find((row) => row.variantId === 'volvo')?.name).toBe('tyre pressure')
  })

  it('a Variant with a null thresholdDays inherits the parent Tracker threshold', () => {
    const rows = trackerRows(
      [
        tracker({
          id: 'tyre',
          name: 'tyre pressure',
          thresholdDays: 30,
          variants: [{ id: 'volvo', name: 'volvo', thresholdDays: null, latestEntry: null }],
        }),
      ],
      NOW,
      UNSORTED_ACTIVE_ONLY,
    )
    expect(rows[0]?.thresholdDays).toBe(30)
  })

  it('a Variant with its own thresholdDays overrides the parent', () => {
    const rows = trackerRows(
      [
        tracker({
          id: 'tyre',
          name: 'tyre pressure',
          thresholdDays: 30,
          variants: [{ id: 'crv', name: 'crv', thresholdDays: 7, latestEntry: null }],
        }),
      ],
      NOW,
      UNSORTED_ACTIVE_ONLY,
    )
    expect(rows[0]?.thresholdDays).toBe(7)
  })

  it('excludes archived Trackers when includeArchived is false', () => {
    const rows = trackerRows(
      [tracker({ id: 'active' }), tracker({ id: 'archived', archivedAt: '2026-02-01T00:00:00.000Z' })],
      NOW,
      UNSORTED_ACTIVE_ONLY,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.trackerId).toBe('active')
  })

  it('includes archived Trackers when includeArchived is true', () => {
    const rows = trackerRows(
      [tracker({ id: 'active' }), tracker({ id: 'archived', archivedAt: '2026-02-01T00:00:00.000Z' })],
      NOW,
      UNSORTED_WITH_ARCHIVED,
    )
    expect(rows.map((row) => row.trackerId).sort()).toEqual(['active', 'archived'])
  })

  it('still returns rows for a single archived Tracker (Detail/Archived single-Tracker case)', () => {
    const rows = trackerRows([tracker({ archivedAt: '2026-08-10T00:00:00.000Z' })], NOW, UNSORTED_WITH_ARCHIVED)
    expect(rows).toHaveLength(1)
  })

  it('assigns each row the urgency state from the domain module, not a re-derived value', () => {
    const rows = trackerRows(
      [
        tracker({ id: 'overdue', thresholdDays: 7, latestEntry: entryAt('2026-08-01T00:00:00.000Z') }),
        tracker({ id: 'never', thresholdDays: 90, latestEntry: null }),
        tracker({ id: 'neutral', thresholdDays: null, latestEntry: entryAt('2026-08-10T00:00:00.000Z') }),
      ],
      NOW,
      UNSORTED_ACTIVE_ONLY,
    )
    const byId = Object.fromEntries(rows.map((row) => [row.trackerId, row]))
    expect(byId.overdue?.urgency).toBe('overdue')
    expect(byId.never?.urgency).toBe('never')
    expect(byId.neutral?.urgency).toBe('neutral')
  })

  it('sorts by the shared urgency comparator when sortByUrgency is true', () => {
    const rows = trackerRows(
      [
        tracker({ id: 'fresh', thresholdDays: 7, latestEntry: entryAt('2026-08-14T00:00:00.000Z') }),
        tracker({ id: 'never', thresholdDays: 90, latestEntry: null }),
        tracker({ id: 'overdue', thresholdDays: 7, latestEntry: entryAt('2026-08-01T00:00:00.000Z') }),
      ],
      NOW,
      SORTED,
    )
    expect(rows.map((row) => row.trackerId)).toEqual(['never', 'overdue', 'fresh'])
  })

  it('keeps Tracker/Variant declaration order when sortByUrgency is false', () => {
    const rows = trackerRows(
      [
        tracker({ id: 'fresh', thresholdDays: 7, latestEntry: entryAt('2026-08-14T00:00:00.000Z') }),
        tracker({ id: 'never', thresholdDays: 90, latestEntry: null }),
        tracker({ id: 'overdue', thresholdDays: 7, latestEntry: entryAt('2026-08-01T00:00:00.000Z') }),
      ],
      NOW,
      UNSORTED_ACTIVE_ONLY,
    )
    expect(rows.map((row) => row.trackerId)).toEqual(['fresh', 'never', 'overdue'])
  })

  it('keeps declaration order across Variants of one Tracker, matching Detail (no urgency re-sort within a Tracker)', () => {
    const rows = trackerRows(
      [
        tracker({
          thresholdDays: 30,
          variants: [
            { id: 'v1', name: 'volvo', thresholdDays: null, latestEntry: null },
            { id: 'v2', name: 'crv', thresholdDays: 14, latestEntry: null },
          ],
        }),
      ],
      NOW,
      UNSORTED_WITH_ARCHIVED,
    )
    expect(rows.map((row) => row.variantId)).toEqual(['v1', 'v2'])
    expect(rows[0]?.thresholdDays).toBe(30)
    expect(rows[1]?.thresholdDays).toBe(14)
  })

  it('a thresholdless, never-logged Tracker yields a neutral urgency row', () => {
    const rows = trackerRows([tracker({ thresholdDays: null })], NOW, UNSORTED_WITH_ARCHIVED)
    expect(rows[0]?.urgency).toBe('neutral')
    expect(rows[0]?.lastEntryAt).toBeNull()
  })

  it('does not mutate the Trackers array it receives', () => {
    const trackers = [tracker({ id: 'a' }), tracker({ id: 'b', thresholdDays: null })]
    const snapshot = JSON.stringify(trackers)
    trackerRows(trackers, NOW, SORTED)
    expect(JSON.stringify(trackers)).toBe(snapshot)
  })
})
