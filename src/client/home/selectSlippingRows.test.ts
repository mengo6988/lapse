import { describe, expect, it } from 'vitest'
import { selectSlippingRows } from './selectSlippingRows'
import type { HomeRow } from './homeRows'

const NOW = new Date('2026-08-15T12:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

const row = (id: string, thresholdDays: number | null, lastEntryAt: string | null): HomeRow => ({
  id,
  trackerId: id,
  variantId: null,
  name: id,
  variantLabel: null,
  thresholdDays,
  lastEntryAt,
})

describe('selectSlippingRows', () => {
  it('keeps only overdue and due-soon rows', () => {
    const overdue = row('overdue', 7, daysAgo(30))
    const dueSoon = row('due-soon', 7, daysAgo(6))
    const fresh = row('fresh', 7, daysAgo(1))
    const neverLogged = row('never', 7, null)
    const neutral = row('neutral', null, daysAgo(1000))

    const slipping = selectSlippingRows([overdue, dueSoon, fresh, neverLogged, neutral], NOW)

    expect(slipping.map((r) => r.id).sort()).toEqual(['due-soon', 'overdue'])
  })

  it('caps at three, most urgent first', () => {
    const rows = [
      row('a', 7, daysAgo(70)), // ratio 10
      row('b', 7, daysAgo(63)), // ratio 9
      row('c', 7, daysAgo(56)), // ratio 8
      row('d', 7, daysAgo(49)), // ratio 7
    ]

    const slipping = selectSlippingRows(rows, NOW)

    expect(slipping.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('is empty when nothing is due-soon or overdue', () => {
    const fresh = row('fresh', 7, daysAgo(1))
    const neverLogged = row('never', 7, null)

    expect(selectSlippingRows([fresh, neverLogged], NOW)).toEqual([])
  })

  it('never mutates the input array', () => {
    const rows = [row('a', 7, daysAgo(30)), row('b', 7, daysAgo(60))]
    const before = [...rows]

    selectSlippingRows(rows, NOW)

    expect(rows).toEqual(before)
  })
})
