import { describe, expect, it } from 'vitest'
import { sortByUrgency, urgencyComparator, type UrgencySortable } from './sort'

const NOW = new Date('2026-08-15T12:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

interface Row extends UrgencySortable {
  readonly id: string
}

const row = (id: string, thresholdDays: number | null, lastEntryAt: string | null): Row => ({
  id,
  thresholdDays,
  lastEntryAt,
})

describe('sortByUrgency', () => {
  it('puts thresholded never-logged rows first', () => {
    const neverLogged = row('never', 7, null)
    const overdue = row('overdue', 7, daysAgo(30))
    const fresh = row('fresh', 7, daysAgo(1))

    const sorted = sortByUrgency([overdue, fresh, neverLogged], NOW)

    expect(sorted[0]!.id).toBe('never')
  })

  it('leaves tied thresholded never-logged rows in their stable input order', () => {
    const first = row('first', 7, null)
    const second = row('second', 30, null)

    const sorted = sortByUrgency([first, second], NOW)

    expect(sorted.map((r) => r.id)).toEqual(['first', 'second'])
  })

  it('orders thresholded logged rows by descending ratio', () => {
    // 8d on a 7d threshold (ratio ~1.14) ranks below 60d on a 30d one (ratio 2)
    const barelyLate = row('barely-late', 7, daysAgo(8))
    const wayOverdue = row('way-overdue', 30, daysAgo(60))

    const sorted = sortByUrgency([barelyLate, wayOverdue], NOW)

    expect(sorted.map((r) => r.id)).toEqual(['way-overdue', 'barely-late'])
  })

  it('ranks all thresholdless rows below all thresholded rows', () => {
    const thresholdless = row('thresholdless', null, daysAgo(1000))
    const freshThresholded = row('fresh', 7, daysAgo(1))

    const sorted = sortByUrgency([thresholdless, freshThresholded], NOW)

    expect(sorted.map((r) => r.id)).toEqual(['fresh', 'thresholdless'])
  })

  it('orders thresholdless rows never-logged first, then longest since logged', () => {
    const neverLogged = row('never', null, null)
    const loggedRecently = row('recent', null, daysAgo(1))
    const loggedLongAgo = row('long-ago', null, daysAgo(100))

    const sorted = sortByUrgency([loggedRecently, loggedLongAgo, neverLogged], NOW)

    expect(sorted.map((r) => r.id)).toEqual(['never', 'long-ago', 'recent'])
  })

  it('returns a new array and never mutates the input', () => {
    const a = row('a', 7, daysAgo(1))
    const b = row('b', 7, daysAgo(20))
    const input = [a, b]
    const inputCopy = [...input]

    const sorted = sortByUrgency(input, NOW)

    expect(input).toEqual(inputCopy)
    expect(sorted).not.toBe(input)
  })
})

describe('urgencyComparator', () => {
  it('is a pure function of (a, b) once bound to now', () => {
    const compare = urgencyComparator(NOW)
    const a = row('a', 7, daysAgo(1))
    const b = row('b', 30, daysAgo(60))

    expect(compare(a, b)).toBe(compare(a, b))
    expect(typeof compare).toBe('function')
  })
})
