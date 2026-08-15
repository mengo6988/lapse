import { describe, expect, it } from 'vitest'
import type { ListRow } from '../domain/trackerRows'
import { selectQuickLogRows } from './selectQuickLogRows'

const NOW = new Date('2026-08-15T12:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

const row = (id: string, lastEntryAt: string | null): ListRow => ({
  key: id,
  trackerId: id,
  variantId: null,
  name: id,
  variantName: null,
  categoryId: null,
  thresholdDays: null,
  lastEntryAt,
  urgency: 'neutral',
})

describe('selectQuickLogRows', () => {
  it('excludes rows already surfaced elsewhere (the slipping section)', () => {
    const shown = row('shown', daysAgo(1))
    const candidate = row('candidate', daysAgo(2))

    const quick = selectQuickLogRows([shown, candidate], new Set(['shown']), NOW)

    expect(quick.map((r) => r.key)).toEqual(['candidate'])
  })

  it('orders most-recently-logged first', () => {
    const old = row('old', daysAgo(10))
    const recent = row('recent', daysAgo(1))

    const quick = selectQuickLogRows([old, recent], new Set(), NOW)

    expect(quick.map((r) => r.key)).toEqual(['recent', 'old'])
  })

  it('sorts never-logged rows last rather than dropping them', () => {
    const logged = row('logged', daysAgo(5))
    const neverLogged = row('never', null)

    const quick = selectQuickLogRows([neverLogged, logged], new Set(), NOW)

    expect(quick.map((r) => r.key)).toEqual(['logged', 'never'])
  })

  it('caps at six candidates', () => {
    const rows = Array.from({ length: 8 }, (_, i) => row(`r${i}`, daysAgo(i + 1)))

    expect(selectQuickLogRows(rows, new Set(), NOW)).toHaveLength(6)
  })

  it('never mutates the input array', () => {
    const rows = [row('a', daysAgo(1)), row('b', daysAgo(2))]
    const before = [...rows]

    selectQuickLogRows(rows, new Set(), NOW)

    expect(rows).toEqual(before)
  })
})
