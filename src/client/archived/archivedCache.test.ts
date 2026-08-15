import { describe, expect, it } from 'vitest'
import type { BootstrapPayload } from '../api'
import { removeTrackerFromCache } from './archivedCache'

const payload: BootstrapPayload = {
  categories: [],
  trackers: [
    {
      id: 't1',
      name: 'keep me',
      categoryId: null,
      thresholdDays: null,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      latestEntry: null,
      variants: [],
    },
    {
      id: 't2',
      name: 'delete me',
      categoryId: null,
      thresholdDays: null,
      archivedAt: '2026-08-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      latestEntry: null,
      variants: [],
    },
  ],
}

describe('removeTrackerFromCache', () => {
  it('drops only the matching Tracker', () => {
    const result = removeTrackerFromCache(payload, 't2')

    expect(result.trackers.map((t) => t.id)).toEqual(['t1'])
  })

  it('does not mutate the input payload', () => {
    removeTrackerFromCache(payload, 't2')

    expect(payload.trackers).toHaveLength(2)
  })

  it('is a no-op when the id is not present', () => {
    const result = removeTrackerFromCache(payload, 'nope')

    expect(result.trackers).toHaveLength(2)
  })
})
