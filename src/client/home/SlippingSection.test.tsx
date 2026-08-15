import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SlippingSection } from './SlippingSection'
import type { HomeRow } from './homeRows'

const NOW = new Date('2026-08-15T12:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

const row = (id: string): HomeRow => ({
  id,
  trackerId: id,
  variantId: null,
  name: id,
  variantLabel: null,
  thresholdDays: 7,
  lastEntryAt: daysAgo(30),
})

describe('SlippingSection', () => {
  it('shows the "nothing slipping" empty state when there are no rows', () => {
    render(<SlippingSection rows={[]} now={NOW} />)

    expect(screen.getByText('nothing slipping')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders one card per row, in the given order, under the "slipping" label', () => {
    render(<SlippingSection rows={[row('a'), row('b'), row('c')]} now={NOW} />)

    expect(screen.getByText('slipping')).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(screen.queryByText('nothing slipping')).toBeNull()
  })

  it('forwards justLoggedId so only the matching card renders "now"', () => {
    render(<SlippingSection rows={[row('a'), row('b')]} now={NOW} justLoggedId="b" />)

    const buttons = screen.getAllByRole('button')
    expect(buttons[1]?.textContent).toContain('now')
    expect(buttons[0]?.textContent).not.toContain('now')
  })
})
