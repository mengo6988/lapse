import { describe, expect, it } from 'vitest'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from './datetimeLocal'

describe('toDatetimeLocalValue', () => {
  it('formats an ISO timestamp as a datetime-local value in device-local time', () => {
    const iso = new Date(2026, 7, 15, 9, 5, 0).toISOString()
    expect(toDatetimeLocalValue(iso)).toBe('2026-08-15T09:05')
  })

  it('zero-pads single-digit month/day/hour/minute', () => {
    const iso = new Date(2026, 0, 5, 3, 4, 0).toISOString()
    expect(toDatetimeLocalValue(iso)).toBe('2026-01-05T03:04')
  })
})

describe('fromDatetimeLocalValue', () => {
  it('round-trips a datetime-local value back to an ISO timestamp', () => {
    const local = new Date(2026, 7, 15, 9, 5, 0)
    expect(fromDatetimeLocalValue('2026-08-15T09:05')).toBe(local.toISOString())
  })

  it('returns null for an unparseable value', () => {
    expect(fromDatetimeLocalValue('not-a-date')).toBeNull()
  })

  it('returns null for an empty value', () => {
    expect(fromDatetimeLocalValue('')).toBeNull()
  })
})
