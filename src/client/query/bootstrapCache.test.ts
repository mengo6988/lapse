import { describe, expect, it } from 'vitest'
import type { BootstrapPayload, Entry } from '../api'
import { isoDaysAgo, makeEntry, makeTracker, makeVariant } from '../home/fixtures'
import {
  addCategory,
  addTracker,
  addVariant,
  findLatestEntry,
  patchCategory,
  patchTracker,
  patchVariant,
  removeCategory,
  removeTracker,
  removeVariant,
  setLatestEntryInCache,
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

describe('addTracker', () => {
  it('appends the new tracker with latestEntry null and its inline variants', () => {
    const payload = basePayload()

    const next = addTracker(payload, {
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

    addTracker(payload, {
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

describe('patchTracker', () => {
  it('merges changed fields while preserving latestEntry', () => {
    const payload = basePayload()

    const next = patchTracker(payload, {
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

    const next = patchTracker(payload, {
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

    const next = patchTracker(payload, {
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

    const next = patchTracker(payload, {
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

describe('addVariant', () => {
  it('appends a variant with latestEntry null to its parent tracker', () => {
    const payload = basePayload()

    const next = addVariant(payload, 't1', {
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

describe('patchVariant', () => {
  it('merges the rename/threshold change while preserving latestEntry', () => {
    const payload = basePayload()
    payload.trackers[0]!.variants[0]!.latestEntry = existingEntry

    const next = patchVariant(payload, 't1', {
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

describe('removeVariant', () => {
  it('filters the soft-deleted variant out of its parent tracker', () => {
    const payload = basePayload()

    const next = removeVariant(payload, 't1', 'v1')

    expect(next.trackers[0]!.variants).toEqual([])
  })
})

describe('removeTracker', () => {
  const hardDeletePayload: BootstrapPayload = {
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

  it('drops only the matching Tracker', () => {
    const result = removeTracker(hardDeletePayload, 't2')

    expect(result.trackers.map((t) => t.id)).toEqual(['t1'])
  })

  it('does not mutate the input payload', () => {
    removeTracker(hardDeletePayload, 't2')

    expect(hardDeletePayload.trackers).toHaveLength(2)
  })

  it('is a no-op when the id is not present', () => {
    const result = removeTracker(hardDeletePayload, 'nope')

    expect(result.trackers).toHaveLength(2)
  })
})

function categoryPayload(): BootstrapPayload {
  return {
    categories: [
      { id: 'house', name: 'house', color: '#a6e3a1', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'car', name: 'car', color: '#fab387', createdAt: '2026-01-01T00:00:00.000Z' },
    ],
    trackers: [
      {
        id: 't1',
        name: 'water the plants',
        categoryId: 'house',
        thresholdDays: null,
        archivedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        latestEntry: null,
        variants: [],
      },
      {
        id: 't2',
        name: 'rotate tyres',
        categoryId: 'car',
        thresholdDays: null,
        archivedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        latestEntry: null,
        variants: [],
      },
      {
        id: 't3',
        name: 'no category',
        categoryId: null,
        thresholdDays: null,
        archivedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        latestEntry: null,
        variants: [],
      },
    ],
  }
}

describe('addCategory', () => {
  it('appends the new Category', () => {
    const payload = categoryPayload()

    const next = addCategory(payload, { id: 'health', name: 'health', color: '#f38ba8', createdAt: '2026-08-15T00:00:00.000Z' })

    expect(next.categories.map((c) => c.id)).toEqual(['house', 'car', 'health'])
  })

  it('does not mutate the original payload', () => {
    const payload = categoryPayload()
    const original = JSON.parse(JSON.stringify(payload))

    addCategory(payload, { id: 'health', name: 'health', color: '#f38ba8', createdAt: '' })

    expect(payload).toEqual(original)
  })
})

describe('patchCategory', () => {
  it('replaces the renamed/recolored Category in place', () => {
    const payload = categoryPayload()

    const next = patchCategory(payload, { id: 'house', name: 'home', color: '#ffffff', createdAt: '2026-01-01T00:00:00.000Z' })

    const category = next.categories.find((c) => c.id === 'house')!
    expect(category.name).toBe('home')
    expect(category.color).toBe('#ffffff')
    // untouched sibling
    expect(next.categories.find((c) => c.id === 'car')?.name).toBe('car')
  })

  it('does not mutate the original payload', () => {
    const payload = categoryPayload()
    const original = JSON.parse(JSON.stringify(payload))

    patchCategory(payload, { id: 'house', name: 'home', color: '#ffffff', createdAt: '' })

    expect(payload).toEqual(original)
  })
})

describe('removeCategory', () => {
  it('drops the Category from the categories list', () => {
    const payload = categoryPayload()

    const next = removeCategory(payload, 'house')

    expect(next.categories.map((c) => c.id)).toEqual(['car'])
  })

  it('nulls categoryId on every Tracker that referenced the deleted Category, mirroring on-delete-set-null', () => {
    const payload = categoryPayload()

    const next = removeCategory(payload, 'house')

    expect(next.trackers.find((t) => t.id === 't1')?.categoryId).toBeNull()
    // untouched: different category, and already uncategorised
    expect(next.trackers.find((t) => t.id === 't2')?.categoryId).toBe('car')
    expect(next.trackers.find((t) => t.id === 't3')?.categoryId).toBeNull()
  })

  it('does not mutate the original payload', () => {
    const payload = categoryPayload()
    const original = JSON.parse(JSON.stringify(payload))

    removeCategory(payload, 'house')

    expect(payload).toEqual(original)
  })

  it('is a no-op on categories/trackers when the id is not present', () => {
    const payload = categoryPayload()

    const next = removeCategory(payload, 'ghost')

    expect(next.categories).toHaveLength(2)
    expect(next.trackers.map((t) => t.categoryId)).toEqual(['house', 'car', null])
  })
})

function payloadWith(...trackers: BootstrapPayload['trackers']): BootstrapPayload {
  return { categories: [], trackers }
}

describe('findLatestEntry', () => {
  it('reads a tracker-level latestEntry when variantId is null', () => {
    const entry = makeEntry({ occurredAt: isoDaysAgo(3) })
    const tracker = makeTracker({ name: 'vacuum', latestEntry: entry })
    const payload = payloadWith(tracker)

    expect(findLatestEntry(payload, { trackerId: tracker.id, variantId: null })).toBe(entry)
  })

  it('reads a Variant\'s own latestEntry, independent of the Tracker\'s', () => {
    const variantEntry = makeEntry({ occurredAt: isoDaysAgo(1) })
    const variant = makeVariant({ name: 'volvo', latestEntry: variantEntry })
    const tracker = makeTracker({ name: 'tyres', variants: [variant] })
    const payload = payloadWith(tracker)

    expect(findLatestEntry(payload, { trackerId: tracker.id, variantId: variant.id })).toBe(variantEntry)
  })

  it('is null for a Tracker/Variant never logged', () => {
    const tracker = makeTracker({ name: 'vacuum' })
    expect(findLatestEntry(payloadWith(tracker), { trackerId: tracker.id, variantId: null })).toBeNull()
  })

  it('is null when the trackerId is not present in the payload', () => {
    expect(findLatestEntry(payloadWith(), { trackerId: 'missing', variantId: null })).toBeNull()
  })

  it('is null when the variantId is not present on the tracker', () => {
    const tracker = makeTracker({ name: 'vacuum' })
    expect(findLatestEntry(payloadWith(tracker), { trackerId: tracker.id, variantId: 'missing' })).toBeNull()
  })
})

describe('setLatestEntryInCache', () => {
  it('immutably sets a tracker-level latestEntry, leaving other trackers untouched', () => {
    const other = makeTracker({ name: 'unrelated' })
    const tracker = makeTracker({ name: 'vacuum' })
    const payload = payloadWith(other, tracker)
    const entry: Entry = makeEntry({ occurredAt: isoDaysAgo(0) })

    const next = setLatestEntryInCache(payload, { trackerId: tracker.id, variantId: null, entry })

    expect(next).not.toBe(payload)
    expect(next.trackers.find((t) => t.id === tracker.id)?.latestEntry).toBe(entry)
    expect(next.trackers.find((t) => t.id === other.id)).toBe(other)
    expect(payload.trackers.find((t) => t.id === tracker.id)?.latestEntry).toBeNull()
  })

  it('immutably sets a Variant\'s latestEntry, leaving the tracker and sibling variants untouched', () => {
    const volvo = makeVariant({ name: 'volvo' })
    const crv = makeVariant({ name: 'crv' })
    const tracker = makeTracker({ name: 'tyres', variants: [volvo, crv] })
    const payload = payloadWith(tracker)
    const entry: Entry = makeEntry({ occurredAt: isoDaysAgo(0) })

    const next = setLatestEntryInCache(payload, { trackerId: tracker.id, variantId: volvo.id, entry })
    const nextTracker = next.trackers.find((t) => t.id === tracker.id)

    expect(nextTracker?.variants.find((v) => v.id === volvo.id)?.latestEntry).toBe(entry)
    expect(nextTracker?.variants.find((v) => v.id === crv.id)).toBe(crv)
  })

  it('can revert a latestEntry back to null (undo of a never-logged row)', () => {
    const entry = makeEntry({ occurredAt: isoDaysAgo(0) })
    const tracker = makeTracker({ name: 'vacuum', latestEntry: entry })
    const payload = payloadWith(tracker)

    const next = setLatestEntryInCache(payload, { trackerId: tracker.id, variantId: null, entry: null })

    expect(next.trackers.find((t) => t.id === tracker.id)?.latestEntry).toBeNull()
  })

  it('is a no-op copy when the trackerId is not present', () => {
    const payload = payloadWith(makeTracker({ name: 'vacuum' }))
    const next = setLatestEntryInCache(payload, {
      trackerId: 'missing',
      variantId: null,
      entry: makeEntry({ occurredAt: isoDaysAgo(0) }),
    })

    expect(next.trackers).toEqual(payload.trackers)
  })
})
