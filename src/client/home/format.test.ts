import { describe, expect, it } from 'vitest'
import { formatAgeLabel, formatDayCount, formatSlippingSubline } from './format'

describe('formatDayCount', () => {
  it('renders a whole day count', () => {
    expect(formatDayCount(74)).toBe('74d')
    expect(formatDayCount(0)).toBe('0d')
  })
})

describe('formatAgeLabel', () => {
  it('is "never" without an Entry', () => {
    expect(formatAgeLabel(null)).toBe('never')
  })

  it('is "today" for an Entry logged earlier the same local day', () => {
    expect(formatAgeLabel(0)).toBe('today')
  })

  it('is "Xd ago" otherwise', () => {
    expect(formatAgeLabel(5)).toBe('5d ago')
  })
})

describe('formatSlippingSubline', () => {
  it('reads "every Yd · Nd over" when overdue', () => {
    // docs/design.md example: 60d threshold, 74 days elapsed.
    expect(formatSlippingSubline('overdue', 60, 74 / 60)).toBe('every 60d · 14d over')
  })

  it('reads "every Yd · due tomorrow" when due within a day', () => {
    // docs/design.md example: 7d threshold, 6 days elapsed.
    expect(formatSlippingSubline('due-soon', 7, 6 / 7)).toBe('every 7d · due tomorrow')
  })

  it('reads "every Yd · due in Nd" when due-soon with more than a day left', () => {
    expect(formatSlippingSubline('due-soon', 30, 25 / 30)).toBe('every 30d · due in 5d')
  })
})
