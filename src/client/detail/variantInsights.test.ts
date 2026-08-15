import { describe, expect, it } from 'vitest'
import type { Entry } from '../api'
import type { ListRow } from '../list/buildListRows'
import { buildVariantInsights } from './variantInsights'

const NOW = new Date('2026-08-15T12:00:00.000Z')

function entry(overrides: Partial<Entry>): Entry {
  return {
    id: 'e',
    trackerId: 't1',
    variantId: null,
    occurredAt: '2026-08-01T00:00:00.000Z',
    durationMinutes: null,
    note: null,
    createdAt: '',
    ...overrides,
  }
}

function row(overrides: Partial<ListRow>): ListRow {
  return {
    key: 't1',
    trackerId: 't1',
    variantId: null,
    name: 'tyre pressure',
    variantName: null,
    categoryId: null,
    thresholdDays: 20,
    lastEntryAt: null,
    urgency: 'fresh',
    ...overrides,
  }
}

describe('buildVariantInsights', () => {
  it('is null/null with fewer than 3 matching Entries', () => {
    const [insight] = buildVariantInsights([row({})], [entry({ variantId: null })])
    expect(insight?.observedIntervalDays).toBeNull()
    expect(insight?.suggestion).toBeNull()
  })

  it('excludes a tracker-level Entry from a Variant row\'s observed interval — tracker-level Entries never reset or feed a Variant', () => {
    const variantRow = row({ key: 'v1', variantId: 'v1', thresholdDays: 10 })
    const entries: Entry[] = [
      entry({ id: 'e1', variantId: 'v1', occurredAt: '2026-08-15T00:00:00.000Z' }),
      entry({ id: 'e2', variantId: 'v1', occurredAt: '2026-08-05T00:00:00.000Z' }),
      entry({ id: 'e3', variantId: 'v1', occurredAt: '2026-07-26T00:00:00.000Z' }),
      // a tracker-level entry interleaved in the same combined history feed
      entry({ id: 'e4', variantId: null, occurredAt: '2026-08-14T00:00:00.000Z' }),
    ]

    const [insight] = buildVariantInsights([variantRow], entries)
    // gaps for v1 only: 15/07 -> 08/05 (10d), 08/05 -> 08/15 (10d) => mean 10
    expect(insight?.observedIntervalDays).toBe(10)
  })

  it('computes observed interval and the "update" suggestion for a thresholded, deviating row', () => {
    const r = row({ thresholdDays: 10 })
    const entries: Entry[] = [
      entry({ id: 'e1', occurredAt: '2026-08-15T00:00:00.000Z' }),
      entry({ id: 'e2', occurredAt: '2026-07-16T00:00:00.000Z' }),
      entry({ id: 'e3', occurredAt: '2026-06-16T00:00:00.000Z' }),
    ]
    const [insight] = buildVariantInsights([r], entries)
    expect(insight?.observedIntervalDays).toBeGreaterThan(10)
    expect(insight?.suggestion?.kind).toBe('update')
  })

  it('gives the gentler "set" suggestion for a thresholdless row with 3+ Entries', () => {
    const r = row({ thresholdDays: null })
    const entries: Entry[] = [
      entry({ id: 'e1', occurredAt: '2026-08-15T00:00:00.000Z' }),
      entry({ id: 'e2', occurredAt: '2026-08-05T00:00:00.000Z' }),
      entry({ id: 'e3', occurredAt: '2026-07-26T00:00:00.000Z' }),
    ]
    const [insight] = buildVariantInsights([r], entries)
    expect(insight?.suggestion?.kind).toBe('set')
  })
})
