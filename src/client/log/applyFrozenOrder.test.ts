import { describe, expect, it } from 'vitest'
import { applyFrozenOrder } from './applyFrozenOrder'

interface Row {
  readonly id: string
  readonly label: string
}

function row(id: string, label = id): Row {
  return { id, label }
}

describe('applyFrozenOrder', () => {
  it('reorders live rows to match the frozen id order', () => {
    const live = [row('a'), row('b'), row('c')]
    expect(applyFrozenOrder(live, ['c', 'a', 'b'], (r) => r.id)).toEqual([row('c'), row('a'), row('b')])
  })

  it('uses each row\'s live (current) data, not a stale copy', () => {
    const live = [row('a', 'A is fresh now'), row('b')]
    const result = applyFrozenOrder(live, ['a', 'b'], (r) => r.id)
    expect(result[0]?.label).toBe('A is fresh now')
  })

  it('drops a frozen id that no longer exists among the live rows', () => {
    const live = [row('a'), row('b')]
    expect(applyFrozenOrder(live, ['a', 'gone', 'b'], (r) => r.id)).toEqual([row('a'), row('b')])
  })

  it('never appends a live row that is missing from the frozen order — membership stays frozen too', () => {
    const live = [row('a'), row('b'), row('new')]
    expect(applyFrozenOrder(live, ['a', 'b'], (r) => r.id)).toEqual([row('a'), row('b')])
  })

  it('returns an empty array for an empty frozen order', () => {
    expect(applyFrozenOrder([row('a')], [], (r) => r.id)).toEqual([])
  })
})
