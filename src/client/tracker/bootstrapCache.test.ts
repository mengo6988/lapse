import { describe, expect, it } from 'vitest'
import type { BootstrapPayload } from '../api'
import {
  addTrackerToCache,
  addVariantToCache,
  patchTrackerInCache,
  patchVariantInCache,
  removeVariantFromCache,
} from './bootstrapCache'

const existingEntry = {
  id: 'entry-1',
  trackerId: 't1',
  variantId: null,
  occurredAt: '2026-08-01T00:00:00.000Z',
  durationMinutes: null,
  note: null,
  createdAt: '2026-08-01T00:00:00.000Z',
}

function basePayload(): BootstrapPayload {
  return {
    categories: [],
    trackers: [
      {
        id: 't1',
        name: 'water the plants',
        categoryId: null,
        thresholdDays: 7,
        archivedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        latestEntry: existingEntry,
        variants: [
          {
            id: 'v1',
            name: 'front',
            thresholdDays: null,
            latestEntry: null,
          },
        ],
      },
    ],
  }
}

describe('addTrackerToCache', () => {
  it('appends the new tracker with latestEntry null and its inline variants', () => {
    const payload = basePayload()

    const next = addTrackerToCache(payload, {
      id: 't2',
      name: 'rotate tyres',
      categoryId: null,
      thresholdDays: 90,
      archivedAt: null,
      createdAt: '2026-08-15T00:00:00.000Z',
      variants: [{ id: 'v2', trackerId: 't2', name: 'rear', thresholdDays: 60, deletedAt: null, createdAt: '2026-08-15T00:00:00.000Z' }],
    })

    expect(next.trackers).toHaveLength(2)
    const added = next.trackers[1]!
    expect(added).toMatchObject({ id: 't2', name: 'rotate tyres', latestEntry: null })
    expect(added.variants).toEqual([{ id: 'v2', name: 'rear', thresholdDays: 60, latestEntry: null }])
  })

  it('does not mutate the original payload', () => {
    const payload = basePayload()
    const original = JSON.parse(JSON.stringify(payload))

    addTrackerToCache(payload, {
      id: 't2',
      name: 'x',
      categoryId: null,
      thresholdDays: null,
      archivedAt: null,
      createdAt: '2026-08-15T00:00:00.000Z',
      variants: [],
    })

    expect(payload).toEqual(original)
  })
})

describe('patchTrackerInCache', () => {
  it('merges changed fields while preserving latestEntry', () => {
    const payload = basePayload()

    const next = patchTrackerInCache(payload, {
      id: 't1',
      name: 'water the ferns',
      categoryId: 'cat-1',
      thresholdDays: 10,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      variants: payload.trackers[0]!.variants.map((v) => ({
        id: v.id,
        trackerId: 't1',
        name: v.name,
        thresholdDays: v.thresholdDays,
        deletedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      })),
    })

    const tracker = next.trackers.find((t) => t.id === 't1')!
    expect(tracker.name).toBe('water the ferns')
    expect(tracker.categoryId).toBe('cat-1')
    expect(tracker.thresholdDays).toBe(10)
    expect(tracker.latestEntry).toEqual(existingEntry)
  })

  it('preserves each variant latestEntry and drops variants absent from the response (soft-deleted)', () => {
    const payload = basePayload()
    payload.trackers[0]!.variants[0]!.latestEntry = existingEntry

    const next = patchTrackerInCache(payload, {
      id: 't1',
      name: 'water the plants',
      categoryId: null,
      thresholdDays: 7,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      variants: [], // the one active variant was soft-deleted elsewhere
    })

    expect(next.trackers[0]!.variants).toEqual([])
  })

  it('gives a newly-returned variant (added mid-session) latestEntry null', () => {
    const payload = basePayload()

    const next = patchTrackerInCache(payload, {
      id: 't1',
      name: 'water the plants',
      categoryId: null,
      thresholdDays: 7,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      variants: [
        { id: 'v1', trackerId: 't1', name: 'front', thresholdDays: null, deletedAt: null, createdAt: '' },
        { id: 'v3', trackerId: 't1', name: 'rear', thresholdDays: null, deletedAt: null, createdAt: '' },
      ],
    })

    const added = next.trackers[0]!.variants.find((v) => v.id === 'v3')
    expect(added).toEqual({ id: 'v3', name: 'rear', thresholdDays: null, latestEntry: null })
  })

  it('is a no-op (new array, same content) when the tracker id is not in the cache', () => {
    const payload = basePayload()

    const next = patchTrackerInCache(payload, {
      id: 'ghost',
      name: 'x',
      categoryId: null,
      thresholdDays: null,
      archivedAt: null,
      createdAt: '',
      variants: [],
    })

    expect(next).toEqual(payload)
    expect(next).not.toBe(payload)
  })
})

describe('addVariantToCache', () => {
  it('appends a variant with latestEntry null to its parent tracker', () => {
    const payload = basePayload()

    const next = addVariantToCache(payload, 't1', {
      id: 'v2',
      trackerId: 't1',
      name: 'rear',
      thresholdDays: 30,
      deletedAt: null,
      createdAt: '2026-08-15T00:00:00.000Z',
    })

    expect(next.trackers[0]!.variants).toHaveLength(2)
    expect(next.trackers[0]!.variants[1]).toEqual({ id: 'v2', name: 'rear', thresholdDays: 30, latestEntry: null })
  })
})

describe('patchVariantInCache', () => {
  it('merges the rename/threshold change while preserving latestEntry', () => {
    const payload = basePayload()
    payload.trackers[0]!.variants[0]!.latestEntry = existingEntry

    const next = patchVariantInCache(payload, 't1', {
      id: 'v1',
      trackerId: 't1',
      name: 'front (renamed)',
      thresholdDays: 20,
      deletedAt: null,
      createdAt: '',
    })

    expect(next.trackers[0]!.variants[0]).toEqual({
      id: 'v1',
      name: 'front (renamed)',
      thresholdDays: 20,
      latestEntry: existingEntry,
    })
  })
})

describe('removeVariantFromCache', () => {
  it('filters the soft-deleted variant out of its parent tracker', () => {
    const payload = basePayload()

    const next = removeVariantFromCache(payload, 't1', 'v1')

    expect(next.trackers[0]!.variants).toEqual([])
  })
})
