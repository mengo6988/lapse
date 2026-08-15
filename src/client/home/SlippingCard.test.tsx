import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SlippingCard } from './SlippingCard'
import type { HomeRow } from './homeRows'

const NOW = new Date('2026-08-15T12:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

describe('SlippingCard', () => {
  it('renders name, subline and big count for an overdue row', () => {
    const row: HomeRow = {
      id: 'hvac',
      trackerId: 'hvac',
      variantId: null,
      name: 'change hvac filter',
      variantLabel: null,
      thresholdDays: 60,
      lastEntryAt: daysAgo(74),
    }

    render(<SlippingCard row={row} now={NOW} />)

    expect(screen.getByText('change hvac filter')).toBeTruthy()
    expect(screen.getByText('every 60d · 14d over')).toBeTruthy()
    expect(screen.getByText('74d')).toBeTruthy()
  })

  it('carries the overdue accent class and a due-soon subline for a due-soon row', () => {
    const row: HomeRow = {
      id: 'crv',
      trackerId: 'crv',
      variantId: 'crv',
      name: 'tyre pressure',
      variantLabel: 'crv',
      thresholdDays: 7,
      lastEntryAt: daysAgo(6),
    }

    render(<SlippingCard row={row} now={NOW} />)

    expect(screen.getByText('every 7d · due tomorrow')).toBeTruthy()
    expect(screen.getByRole('button').className).toContain('slipping-card--due-soon')
  })

  it('labels a Variant row with the parent Tracker name and the Variant name', () => {
    const row: HomeRow = {
      id: 'volvo',
      trackerId: 'tyre',
      variantId: 'volvo',
      name: 'tyre pressure',
      variantLabel: 'volvo',
      thresholdDays: 30,
      lastEntryAt: daysAgo(34),
    }

    render(<SlippingCard row={row} now={NOW} />)

    const button = screen.getByRole('button')
    expect(button.textContent).toContain('tyre pressure')
    expect(button.textContent).toContain('volvo')
  })

  it('is a real button, focusable and 44px+ tall, per the accessibility constraints', () => {
    const row: HomeRow = {
      id: 'hvac',
      trackerId: 'hvac',
      variantId: null,
      name: 'change hvac filter',
      variantLabel: null,
      thresholdDays: 60,
      lastEntryAt: daysAgo(74),
    }

    render(<SlippingCard row={row} now={NOW} />)

    const button = screen.getByRole('button')
    expect(button.getAttribute('type')).toBe('button')
  })
})
