import { describe, expect, it } from 'vitest'
import { selectQuickLogRows } from './selectQuickLogRows'
import type { HomeRow } from './homeRows'

const NOW = new Date('2026-08-15T12:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

const row = (id: string, lastEntryAt: string | null): HomeRow => ({
  id,
  trackerId: id,
  variantId: null,
  name: id,
  variantLabel: null,
  thresholdDays: null,
  lastEntryAt,
})

describe('selectQuickLogRows', () => {
  it('excludes rows already surfaced elsewhere (the slipping section)', () => {
    const shown = row('shown', daysAgo(1))
    const candidate = row('candidate', daysAgo(2))

    const quick = selectQuickLogRows([shown, candidate], new Set(['shown']), NOW)

    expect(quick.map((r) => r.id)).toEqual(['candidate'])
  })

  it('orders most-recently-logged first', () => {
    const old = row('old', daysAgo(10))
    const recent = row('recent', daysAgo(1))

    const quick = selectQuickLogRows([old, recent], new Set(), NOW)

    expect(quick.map((r) => r.id)).toEqual(['recent', 'old'])
  })

  it('sorts never-logged rows last rather than dropping them', () => {
    const logged = row('logged', daysAgo(5))
    const neverLogged = row('never', null)

    const quick = selectQuickLogRows([neverLogged, logged], new Set(), NOW)

    expect(quick.map((r) => r.id)).toEqual(['logged', 'never'])
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
