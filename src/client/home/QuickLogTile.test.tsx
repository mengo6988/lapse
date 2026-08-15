import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QuickLogTile } from './QuickLogTile'
import type { HomeRow } from './homeRows'

const NOW = new Date('2026-08-15T12:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString()

const baseRow: HomeRow = {
  id: 'litter',
  trackerId: 'litter',
  variantId: null,
  name: 'clean litter box',
  variantLabel: null,
  thresholdDays: 1,
  lastEntryAt: null,
}

describe('QuickLogTile', () => {
  it('shows "never" when there is no Entry', () => {
    render(<QuickLogTile row={baseRow} now={NOW} />)
    expect(screen.getByText('never')).toBeTruthy()
  })

  it('shows "Xd ago" for a logged row', () => {
    render(<QuickLogTile row={{ ...baseRow, lastEntryAt: daysAgo(2) }} now={NOW} />)
    expect(screen.getByText('2d ago')).toBeTruthy()
  })

  it('labels a Variant row with the parent Tracker name and the Variant name', () => {
    const row: HomeRow = { ...baseRow, name: 'tyre pressure', variantLabel: 'crv', lastEntryAt: daysAgo(6) }
    render(<QuickLogTile row={row} now={NOW} />)

    const button = screen.getByRole('button')
    expect(button.textContent).toContain('tyre pressure')
    expect(button.textContent).toContain('crv')
  })
})
