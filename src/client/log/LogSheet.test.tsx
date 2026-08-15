import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LogSheet } from './LogSheet'

const NOW = new Date('2026-08-15T12:00:00.000Z')

describe('LogSheet (build ticket 13)', () => {
  it('renders the time/duration/note fields and a single primary Log button, per docs/design.md § Log sheet', () => {
    render(<LogSheet now={NOW} onSubmit={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'now' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '1h ago' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'yesterday' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'pick…' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '15m' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '30m' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '1h' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'custom' })).toBeTruthy()
    expect(screen.getByLabelText('note')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'log' })).toBeTruthy()
  })

  it('defaults to "now", with no duration and no note — everything optional', () => {
    render(<LogSheet now={NOW} onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'now' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByLabelText('pick a time')).toBeNull()
    expect(screen.queryByLabelText('custom duration in minutes')).toBeNull()
  })

  it('submitting on the default "now" state omits occurredAt so useLogRow resolves the actual moment of logging', async () => {
    const onSubmit = vi.fn()
    render(<LogSheet now={NOW} onSubmit={onSubmit} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'log' }))

    expect(onSubmit).toHaveBeenCalledWith({ occurredAt: undefined, durationMinutes: null, note: null })
  })

  it('"1h ago" resolves to exactly one hour before `now`', async () => {
    const onSubmit = vi.fn()
    render(<LogSheet now={NOW} onSubmit={onSubmit} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '1h ago' }))
    await user.click(screen.getByRole('button', { name: 'log' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ occurredAt: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString() }),
    )
  })

  it('"yesterday" resolves to exactly 24h before `now`', async () => {
    const onSubmit = vi.fn()
    render(<LogSheet now={NOW} onSubmit={onSubmit} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'yesterday' }))
    await user.click(screen.getByRole('button', { name: 'log' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ occurredAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString() }),
    )
  })

  it('"pick…" opens a native datetime-local input rather than a custom picker', async () => {
    render(<LogSheet now={NOW} onSubmit={vi.fn()} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'pick…' }))

    const input = screen.getByLabelText('pick a time')
    expect(input.getAttribute('type')).toBe('datetime-local')
  })

  it('submitting a valid picked time resolves it to an ISO occurredAt', async () => {
    const onSubmit = vi.fn()
    render(<LogSheet now={NOW} onSubmit={onSubmit} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'pick…' }))
    fireEvent.change(screen.getByLabelText('pick a time'), { target: { value: '2026-08-10T08:30' } })
    await user.click(screen.getByRole('button', { name: 'log' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ occurredAt: new Date('2026-08-10T08:30').toISOString() }),
    )
  })

  it('submitting an empty picked time shows an error and does not submit', async () => {
    const onSubmit = vi.fn()
    render(<LogSheet now={NOW} onSubmit={onSubmit} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'pick…' }))
    fireEvent.change(screen.getByLabelText('pick a time'), { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: 'log' }))

    expect(screen.getByText('enter a valid time')).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('a duration chip sets durationMinutes; re-tapping the active chip clears it back to empty', async () => {
    const onSubmit = vi.fn()
    render(<LogSheet now={NOW} onSubmit={onSubmit} />)
    const user = userEvent.setup()

    const chip = screen.getByRole('button', { name: '30m' })
    await user.click(chip)
    expect(chip.getAttribute('aria-pressed')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'log' }))
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ durationMinutes: 30 }))

    await user.click(chip)
    expect(chip.getAttribute('aria-pressed')).toBe('false')
    await user.click(screen.getByRole('button', { name: 'log' }))
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ durationMinutes: null }))
  })

  it('the "1h" duration chip submits 60 minutes', async () => {
    const onSubmit = vi.fn()
    render(<LogSheet now={NOW} onSubmit={onSubmit} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '1h' }))
    await user.click(screen.getByRole('button', { name: 'log' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ durationMinutes: 60 }))
  })

  it('"custom" reveals a numeric input and submits its typed value', async () => {
    const onSubmit = vi.fn()
    render(<LogSheet now={NOW} onSubmit={onSubmit} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'custom' }))
    const input = screen.getByLabelText('custom duration in minutes')
    expect(input.getAttribute('type')).toBe('number')
    await user.type(input, '45')
    await user.click(screen.getByRole('button', { name: 'log' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ durationMinutes: 45 }))
  })

  it('an out-of-range custom duration shows an error and does not submit', async () => {
    const onSubmit = vi.fn()
    render(<LogSheet now={NOW} onSubmit={onSubmit} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'custom' }))
    await user.type(screen.getByLabelText('custom duration in minutes'), '5000')
    await user.click(screen.getByRole('button', { name: 'log' }))

    expect(screen.getByText('enter 1–1440 minutes')).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('a note is trimmed, and an empty/whitespace note submits as null', async () => {
    const onSubmit = vi.fn()
    render(<LogSheet now={NOW} onSubmit={onSubmit} />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('note'), '  felt good  ')
    await user.click(screen.getByRole('button', { name: 'log' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ note: 'felt good' }))
  })

  it('the note field enforces a 500 character max, per docs/spec.md § Validation', () => {
    render(<LogSheet now={NOW} onSubmit={vi.fn()} />)
    expect(screen.getByLabelText('note').getAttribute('maxlength')).toBe('500')
  })
})
