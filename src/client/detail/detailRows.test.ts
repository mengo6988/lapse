import { describe, expect, it } from 'vitest'
import type { Tracker } from '../api'
import { buildDetailRows } from './detailRows'

const NOW = new Date('2026-08-15T12:00:00.000Z')

function tracker(overrides: Partial<Tracker> = {}): Tracker {
  return {
    id: 't1',
    name: 'tyre pressure',
    categoryId: null,
    thresholdDays: 30,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    latestEntry: null,
    variants: [],
    ...overrides,
  }
}

describe('buildDetailRows', () => {
  it('returns a single tracker-level row for a Tracker without Variants', () => {
    const rows = buildDetailRows(
      tracker({ latestEntry: { id: 'e1', trackerId: 't1', variantId: null, occurredAt: '2026-08-01T00:00:00.000Z', durationMinutes: null, note: null, createdAt: '' } }),
      NOW,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ trackerId: 't1', variantId: null, name: 'tyre pressure', thresholdDays: 30 })
  })

  it('returns one row per Variant, in declaration order, when Variants exist', () => {
    const rows = buildDetailRows(
      tracker({
        variants: [
          { id: 'v1', name: 'volvo', thresholdDays: null, latestEntry: null },
          { id: 'v2', name: 'crv', thresholdDays: 14, latestEntry: null },
        ],
      }),
      NOW,
    )
    expect(rows.map((r) => r.variantId)).toEqual(['v1', 'v2'])
    // v1 inherits the parent's 30d threshold; v2 overrides to 14d.
    expect(rows[0]?.thresholdDays).toBe(30)
    expect(rows[1]?.thresholdDays).toBe(14)
    expect(rows.map((r) => r.variantName)).toEqual(['volvo', 'crv'])
  })

  it('still returns rows for an archived Tracker (unlike buildListRows, which hides archived rows from home/list)', () => {
    const rows = buildDetailRows(tracker({ archivedAt: '2026-08-10T00:00:00.000Z' }), NOW)
    expect(rows).toHaveLength(1)
  })
})
