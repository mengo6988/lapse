import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QuickLogSection } from './QuickLogSection'
import type { HomeRow } from './homeRows'

const NOW = new Date('2026-08-15T12:00:00.000Z')

const row = (id: string): HomeRow => ({
  id,
  trackerId: id,
  variantId: null,
  name: id,
  variantLabel: null,
  thresholdDays: null,
  lastEntryAt: null,
})

describe('QuickLogSection', () => {
  it('renders nothing when there are no candidates', () => {
    const { container } = render(<QuickLogSection rows={[]} now={NOW} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the "quick log" label and one tile per row', () => {
    render(<QuickLogSection rows={[row('a'), row('b')]} now={NOW} />)

    expect(screen.getByText('quick log')).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('forwards justLoggedId so only the matching tile renders "now"', () => {
    render(<QuickLogSection rows={[row('a'), row('b')]} now={NOW} justLoggedId="a" />)

    const buttons = screen.getAllByRole('button')
    expect(buttons[0]?.textContent).toContain('now')
    expect(buttons[1]?.textContent).not.toContain('now')
  })
})
