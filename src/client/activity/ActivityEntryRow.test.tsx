import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ActivityEntryRow } from './ActivityEntryRow'
import type { ActivityRow } from './activityRows'

function row(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: 'entry-1',
    trackerId: 'tracker-1',
    variantId: null,
    trackerName: 'tyre pressure',
    variantName: null,
    occurredAt: new Date(2026, 7, 15, 9, 0, 0).toISOString(),
    durationMinutes: null,
    note: null,
    ...overrides,
  }
}

describe('ActivityEntryRow', () => {
  it('renders as a real, focusable button carrying the Tracker name and clock time', () => {
    render(
      <ul>
        <ActivityEntryRow row={row()} onOpen={vi.fn()} />
      </ul>,
    )
    const button = screen.getByRole('button')
    expect(button.tagName).toBe('BUTTON')
    expect(button.textContent).toContain('tyre pressure')
    expect(button.textContent).toContain('9:00 am')
  })

  it('shows the Variant name suffixed onto the Tracker name when present', () => {
    render(
      <ul>
        <ActivityEntryRow row={row({ variantName: 'volvo' })} onOpen={vi.fn()} />
      </ul>,
    )
    expect(screen.getByRole('button').textContent).toContain('tyre pressure · volvo')
  })

  it('omits the variant suffix entirely when there is no Variant', () => {
    render(
      <ul>
        <ActivityEntryRow row={row()} onOpen={vi.fn()} />
      </ul>,
    )
    expect(screen.getByRole('button').textContent).not.toContain('·')
  })

  it('shows duration and note combined in the meta line', () => {
    render(
      <ul>
        <ActivityEntryRow row={row({ durationMinutes: 40, note: 'felt good' })} onOpen={vi.fn()} />
      </ul>,
    )
    const button = screen.getByRole('button')
    expect(button.textContent).toContain('40m')
    expect(button.textContent).toContain('felt good')
  })

  it('omits the meta line entirely when there is nothing to show', () => {
    render(
      <ul>
        <ActivityEntryRow row={row()} onOpen={vi.fn()} />
      </ul>,
    )
    expect(screen.queryByText('40m')).toBeNull()
  })

  it('clicking calls onOpen with the row', async () => {
    const onOpen = vi.fn()
    const r = row()
    render(
      <ul>
        <ActivityEntryRow row={r} onOpen={onOpen} />
      </ul>,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledWith(r)
  })
})
