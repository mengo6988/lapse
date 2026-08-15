import { describe, expect, it } from 'vitest'
import { buildHomeRows } from './homeRows'
import { isoDaysAgo, makeEntry, makeTracker, makeVariant } from './fixtures'

describe('buildHomeRows', () => {
  it('is one row for a Tracker with no Variants', () => {
    const entry = makeEntry({ occurredAt: isoDaysAgo(5) })
    const tracker = makeTracker({ name: 'vacuum house', thresholdDays: 7, latestEntry: entry })

    const rows = buildHomeRows([tracker])

    expect(rows).toEqual([
      {
        id: tracker.id,
        trackerId: tracker.id,
        variantId: null,
        name: 'vacuum house',
        variantLabel: null,
        thresholdDays: 7,
        lastEntryAt: entry.occurredAt,
      },
    ])
  })

  it('is one row per Variant, and no separate row for the parent Tracker', () => {
    const volvo = makeVariant({ name: 'volvo', latestEntry: makeEntry({ occurredAt: isoDaysAgo(34) }) })
    const crv = makeVariant({ name: 'crv', latestEntry: makeEntry({ occurredAt: isoDaysAgo(6) }) })
    const tracker = makeTracker({ name: 'tyre pressure', thresholdDays: 30, variants: [volvo, crv] })

    const rows = buildHomeRows([tracker])

    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.name)).toEqual(['tyre pressure', 'tyre pressure'])
    expect(rows.map((r) => r.variantLabel)).toEqual(['volvo', 'crv'])
    expect(rows.map((r) => r.variantId)).toEqual([volvo.id, crv.id])
  })

  it("uses the Variant's own Threshold when set, else the parent's", () => {
    const overridden = makeVariant({ name: 'crv', thresholdDays: 7 })
    const inherited = makeVariant({ name: 'volvo', thresholdDays: null })
    const tracker = makeTracker({ name: 'tyre pressure', thresholdDays: 30, variants: [overridden, inherited] })

    const rows = buildHomeRows([tracker])

    expect(rows.find((r) => r.variantLabel === 'crv')?.thresholdDays).toBe(7)
    expect(rows.find((r) => r.variantLabel === 'volvo')?.thresholdDays).toBe(30)
  })

  it('excludes archived Trackers', () => {
    const active = makeTracker({ name: 'active one' })
    const archived = makeTracker({ name: 'archived one', archivedAt: isoDaysAgo(1) })

    const rows = buildHomeRows([active, archived])

    expect(rows.map((r) => r.name)).toEqual(['active one'])
  })

  it('never mutates the input array', () => {
    const trackers = [makeTracker({ name: 'a' }), makeTracker({ name: 'b' })]
    const before = [...trackers]

    buildHomeRows(trackers)

    expect(trackers).toEqual(before)
  })
})
