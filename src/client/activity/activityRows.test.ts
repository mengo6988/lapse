import { describe, expect, it } from 'vitest'
import type { Entry, Tracker } from '../api'
import { buildActivityRows } from './activityRows'

function tracker(overrides: Partial<Tracker> = {}): Tracker {
  return {
    id: 'tracker-1',
    name: 'tyre pressure',
    categoryId: null,
    thresholdDays: null,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    latestEntry: null,
    variants: [],
    ...overrides,
  }
}

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'entry-1',
    trackerId: 'tracker-1',
    variantId: null,
    occurredAt: '2026-08-15T00:00:00.000Z',
    durationMinutes: null,
    note: null,
    createdAt: '2026-08-15T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildActivityRows', () => {
  it('resolves the Tracker name for a tracker-level Entry', () => {
    const rows = buildActivityRows([entry()], [tracker({ name: 'vacuuming' })])

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'entry-1',
      trackerId: 'tracker-1',
      variantId: null,
      trackerName: 'vacuuming',
      variantName: null,
    })
  })

  it('resolves the Variant name when the Entry has one', () => {
    const t = tracker({ variants: [{ id: 'v1', name: 'volvo', thresholdDays: null, latestEntry: null }] })
    const rows = buildActivityRows([entry({ variantId: 'v1' })], [t])

    expect(rows[0]?.variantName).toBe('volvo')
  })

  it('resolves to a null variantName when the Variant no longer exists in the bootstrap cache (soft-deleted)', () => {
    const rows = buildActivityRows([entry({ variantId: 'gone' })], [tracker()])

    expect(rows[0]?.variantName).toBeNull()
  })

  it('skips an Entry whose Tracker is not in the bootstrap cache', () => {
    const rows = buildActivityRows([entry({ trackerId: 'does-not-exist' })], [tracker()])

    expect(rows).toHaveLength(0)
  })

  it('carries occurredAt, durationMinutes, and note through unchanged', () => {
    const rows = buildActivityRows(
      [entry({ occurredAt: '2026-08-10T12:00:00.000Z', durationMinutes: 30, note: 'felt good' })],
      [tracker()],
    )

    expect(rows[0]).toMatchObject({
      occurredAt: '2026-08-10T12:00:00.000Z',
      durationMinutes: 30,
      note: 'felt good',
    })
  })

  it('preserves the input order (the caller owns sorting)', () => {
    const rows = buildActivityRows(
      [entry({ id: 'e-new', occurredAt: '2026-08-15T00:00:00.000Z' }), entry({ id: 'e-old', occurredAt: '2026-08-01T00:00:00.000Z' })],
      [tracker()],
    )

    expect(rows.map((r) => r.id)).toEqual(['e-new', 'e-old'])
  })

  it('returns an empty array for an empty Entry list', () => {
    expect(buildActivityRows([], [tracker()])).toEqual([])
  })
})
