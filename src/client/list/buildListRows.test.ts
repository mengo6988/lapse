import { describe, expect, it } from 'vitest'
import type { Tracker } from '../api/types'
import { buildListRows } from './buildListRows'

const NOW = new Date('2026-08-15T12:00:00.000Z')

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

describe('buildListRows', () => {
  it('produces one row for a tracker with no variants', () => {
    const rows = buildListRows([tracker()], NOW)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      trackerId: 'tracker-1',
      variantId: null,
      name: 'vacuum house',
      variantName: null,
    })
  })

  it('produces one row per variant, never a tracker-level row, when variants exist', () => {
    const rows = buildListRows(
      [
        tracker({
          id: 'tyre',
          name: 'tyre pressure',
          variants: [
            {
              id: 'volvo',
              name: 'volvo',
              thresholdDays: null,
              latestEntry: null,
            },
            {
              id: 'crv',
              name: 'crv',
              thresholdDays: 7,
              latestEntry: null,
            },
          ],
        }),
      ],
      NOW,
    )
    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.trackerId === 'tyre')).toBe(true)
    expect(rows.map((row) => row.variantName).sort()).toEqual(['crv', 'volvo'])
    expect(rows.find((row) => row.variantId === 'volvo')?.name).toBe('tyre pressure')
  })

  it('a variant with a null thresholdDays inherits the parent tracker threshold', () => {
    const rows = buildListRows(
      [
        tracker({
          id: 'tyre',
          name: 'tyre pressure',
          thresholdDays: 30,
          variants: [{ id: 'volvo', name: 'volvo', thresholdDays: null, latestEntry: null }],
        }),
      ],
      NOW,
    )
    expect(rows[0]?.thresholdDays).toBe(30)
  })

  it('excludes archived trackers', () => {
    const rows = buildListRows(
      [tracker({ id: 'active' }), tracker({ id: 'archived', archivedAt: '2026-02-01T00:00:00.000Z' })],
      NOW,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.trackerId).toBe('active')
  })

  it('assigns each row the urgency state from the domain module, not a re-derived value', () => {
    const rows = buildListRows(
      [
        tracker({ id: 'overdue', thresholdDays: 7, latestEntry: entryAt('2026-08-01T00:00:00.000Z') }),
        tracker({ id: 'never', thresholdDays: 90, latestEntry: null }),
        tracker({ id: 'neutral', thresholdDays: null, latestEntry: entryAt('2026-08-10T00:00:00.000Z') }),
      ],
      NOW,
    )
    const byId = Object.fromEntries(rows.map((row) => [row.trackerId, row]))
    expect(byId.overdue?.urgency).toBe('overdue')
    expect(byId.never?.urgency).toBe('never')
    expect(byId.neutral?.urgency).toBe('neutral')
  })

  it('returns rows already sorted per the shared urgency comparator', () => {
    const rows = buildListRows(
      [
        tracker({ id: 'fresh', thresholdDays: 7, latestEntry: entryAt('2026-08-14T00:00:00.000Z') }),
        tracker({ id: 'never', thresholdDays: 90, latestEntry: null }),
        tracker({ id: 'overdue', thresholdDays: 7, latestEntry: entryAt('2026-08-01T00:00:00.000Z') }),
      ],
      NOW,
    )
    expect(rows.map((row) => row.trackerId)).toEqual(['never', 'overdue', 'fresh'])
  })

  it('does not mutate the trackers array it receives', () => {
    const trackers = [tracker({ id: 'a' }), tracker({ id: 'b', thresholdDays: null })]
    const snapshot = JSON.stringify(trackers)
    buildListRows(trackers, NOW)
    expect(JSON.stringify(trackers)).toBe(snapshot)
  })
})

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
