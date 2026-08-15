import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Entry } from '../api'
import { EntryRow } from './EntryRow'

const NOW = new Date(2026, 7, 15, 12, 0, 0)

const entry: Entry = {
  id: 'e1',
  trackerId: 't1',
  variantId: null,
  occurredAt: new Date(2026, 7, 15, 9, 0, 0).toISOString(),
  durationMinutes: 40,
  note: 'felt good',
  createdAt: '',
}

describe('EntryRow', () => {
  it('renders as a real, focusable button carrying relative and absolute time', () => {
    render(
      <ul>
        <EntryRow entry={entry} now={NOW} variantLabel={null} onOpen={vi.fn()} />
      </ul>,
    )
    const button = screen.getByRole('button')
    expect(button.tagName).toBe('BUTTON')
    expect(button.textContent).toContain('today')
  })

  it('shows duration, note, and variant label combined in the meta line', () => {
    render(
      <ul>
        <EntryRow entry={entry} now={NOW} variantLabel="volvo" onOpen={vi.fn()} />
      </ul>,
    )
    const meta = screen.getByText(/volvo/)
    expect(meta.textContent).toContain('40m')
    expect(meta.textContent).toContain('felt good')
  })

  it('omits the meta line entirely when there is nothing to show', () => {
    const bare: Entry = { ...entry, durationMinutes: null, note: null }
    render(
      <ul>
        <EntryRow entry={bare} now={NOW} variantLabel={null} onOpen={vi.fn()} />
      </ul>,
    )
    expect(screen.queryByText('40m')).toBeNull()
  })

  it('clicking calls onOpen with the Entry and the clicked element', async () => {
    const onOpen = vi.fn()
    render(
      <ul>
        <EntryRow entry={entry} now={NOW} variantLabel={null} onOpen={onOpen} />
      </ul>,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledWith(entry, expect.any(HTMLElement))
  })
})
