import { describe, expect, it } from 'vitest'
import type { Tracker } from '../api/types'
import { archivedRowsForTracker } from './archivedRows'

const NOW = new Date('2026-08-15T00:00:00.000Z')

function tracker(overrides: Partial<Tracker> = {}): Tracker {
  return {
    id: 'tracker-1',
    name: 'tyre pressure',
    categoryId: null,
    thresholdDays: null,
    archivedAt: '2026-08-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    latestEntry: null,
    variants: [],
    ...overrides,
  }
}

describe('archivedRowsForTracker', () => {
  it('returns a single row for a Tracker with no Variants, using the Tracker\'s own threshold and latest Entry', () => {
    const t = tracker({
      thresholdDays: 30,
      latestEntry: {
        id: 'e1',
        trackerId: 'tracker-1',
        variantId: null,
        occurredAt: '2026-08-01T00:00:00.000Z',
        durationMinutes: null,
        note: null,
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    })

    const rows = archivedRowsForTracker(t, NOW)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      key: 'tracker-1',
      trackerId: 'tracker-1',
      variantId: null,
      name: 'tyre pressure',
      variantName: null,
      thresholdDays: 30,
      lastEntryAt: '2026-08-01T00:00:00.000Z',
      urgency: 'fresh',
    })
  })

  it('returns one row per Variant, never a separate tracker-level row, when Variants exist', () => {
    const t = tracker({
      thresholdDays: 30,
      variants: [
        { id: 'v1', name: 'volvo', thresholdDays: null, latestEntry: null },
        { id: 'v2', name: 'crv', thresholdDays: 7, latestEntry: null },
      ],
    })

    const rows = archivedRowsForTracker(t, NOW)

    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.key)).toEqual(['v1', 'v2'])
    expect(rows.map((r) => r.variantName)).toEqual(['volvo', 'crv'])
  })

  it('a Variant with no own threshold inherits the parent Tracker\'s', () => {
    const t = tracker({
      thresholdDays: 30,
      variants: [{ id: 'v1', name: 'volvo', thresholdDays: null, latestEntry: null }],
    })

    const rows = archivedRowsForTracker(t, NOW)

    expect(rows[0]?.thresholdDays).toBe(30)
  })

  it('a Variant with its own threshold overrides the parent', () => {
    const t = tracker({
      thresholdDays: 30,
      variants: [{ id: 'v1', name: 'crv', thresholdDays: 7, latestEntry: null }],
    })

    const rows = archivedRowsForTracker(t, NOW)

    expect(rows[0]?.thresholdDays).toBe(7)
  })

  it('a thresholdless, never-logged Tracker yields a neutral urgency row', () => {
    const rows = archivedRowsForTracker(tracker(), NOW)

    expect(rows[0]?.urgency).toBe('neutral')
    expect(rows[0]?.lastEntryAt).toBeNull()
  })
})
