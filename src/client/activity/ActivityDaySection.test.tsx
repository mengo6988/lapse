import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ActivityDaySection } from './ActivityDaySection'
import type { ActivityRow } from './activityRows'
import type { DaySection } from './dayBuckets'

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

function section(overrides: Partial<DaySection> = {}): DaySection {
  return { dayKey: '2026-08-15', label: 'today', rows: [row()], ...overrides }
}

describe('ActivityDaySection', () => {
  it('renders the day label as a heading', () => {
    render(
      <div>
        <ActivityDaySection section={section({ label: 'yesterday' })} onOpenEntry={vi.fn()} />
      </div>,
    )
    expect(screen.getByText('yesterday')).toBeTruthy()
  })

  it('renders one row per Entry in the section', () => {
    const rows = [row({ id: 'e1' }), row({ id: 'e2', trackerName: 'vacuuming' })]
    render(
      <div>
        <ActivityDaySection section={section({ rows })} onOpenEntry={vi.fn()} />
      </div>,
    )
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByText('vacuuming')).toBeTruthy()
  })

  it('tapping a row calls onOpenEntry with that row', async () => {
    const onOpenEntry = vi.fn()
    const r = row()
    render(
      <div>
        <ActivityDaySection section={section({ rows: [r] })} onOpenEntry={onOpenEntry} />
      </div>,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button'))
    expect(onOpenEntry).toHaveBeenCalledWith(r)
  })
})
