import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ListRow } from '../domain/trackerRows'
import { QuickLogSection } from './QuickLogSection'

const NOW = new Date('2026-08-15T12:00:00.000Z')

const row = (id: string): ListRow => ({
  key: id,
  trackerId: id,
  variantId: null,
  name: id,
  variantName: null,
  categoryId: null,
  thresholdDays: null,
  lastEntryAt: null,
  urgency: 'neutral',
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
