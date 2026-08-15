import { describe, expect, it } from 'vitest'
import type { ListRow } from './buildListRows'
import { filterListRows } from './filterListRows'

function row(overrides: Partial<ListRow>): ListRow {
  return {
    key: 'k',
    trackerId: 't',
    variantId: null,
    name: 'vacuum house',
    variantName: null,
    categoryId: null,
    thresholdDays: 7,
    lastEntryAt: null,
    urgency: 'never',
    ...overrides,
  }
}

describe('filterListRows', () => {
  it('with no category and no query, returns every row in the same order', () => {
    const rows = [row({ key: 'a' }), row({ key: 'b' })]
    expect(filterListRows(rows, { categoryId: null, query: '' })).toEqual(rows)
  })

  it('filters to rows matching the selected category, order preserved', () => {
    const rows = [
      row({ key: 'a', categoryId: 'house' }),
      row({ key: 'b', categoryId: 'car' }),
      row({ key: 'c', categoryId: 'house' }),
    ]
    const result = filterListRows(rows, { categoryId: 'house', query: '' })
    expect(result.map((r) => r.key)).toEqual(['a', 'c'])
  })

  it('filters by Tracker name, case-insensitively', () => {
    const rows = [row({ key: 'a', name: 'Change HVAC Filter' }), row({ key: 'b', name: 'vacuum house' })]
    const result = filterListRows(rows, { categoryId: null, query: 'hvac' })
    expect(result.map((r) => r.key)).toEqual(['a'])
  })

  it('filters by Variant name too', () => {
    const rows = [
      row({ key: 'a', name: 'tyre pressure', variantName: 'volvo' }),
      row({ key: 'b', name: 'tyre pressure', variantName: 'crv' }),
    ]
    const result = filterListRows(rows, { categoryId: null, query: 'crv' })
    expect(result.map((r) => r.key)).toEqual(['b'])
  })

  it('combines category and search filters', () => {
    const rows = [
      row({ key: 'a', name: 'vacuum house', categoryId: 'house' }),
      row({ key: 'b', name: 'vacuum car', categoryId: 'car' }),
      row({ key: 'c', name: 'sweep house', categoryId: 'house' }),
    ]
    const result = filterListRows(rows, { categoryId: 'house', query: 'vacuum' })
    expect(result.map((r) => r.key)).toEqual(['a'])
  })

  it('a blank/whitespace query does not filter', () => {
    const rows = [row({ key: 'a' }), row({ key: 'b' })]
    expect(filterListRows(rows, { categoryId: null, query: '   ' })).toHaveLength(2)
  })

  it('does not mutate the input array', () => {
    const rows = [row({ key: 'a', categoryId: 'house' }), row({ key: 'b', categoryId: 'car' })]
    const snapshot = [...rows]
    filterListRows(rows, { categoryId: 'house', query: '' })
    expect(rows).toEqual(snapshot)
  })
})
