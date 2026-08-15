import { describe, expect, it } from 'vitest'
import type { BootstrapPayload, Entry } from '../api'
import { isoDaysAgo, makeEntry, makeTracker, makeVariant } from '../home/fixtures'
import { findLatestEntry, setLatestEntryInCache } from './logCache'

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
