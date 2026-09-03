import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ThresholdPicker } from './ThresholdPicker'

describe('ThresholdPicker', () => {
  it('defaults to the none chip pressed when value is null', () => {
    render(<ThresholdPicker id="t" value={null} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'no threshold' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('uses a custom noneLabel (e.g. "inherit parent" for a Variant row)', () => {
    render(<ThresholdPicker id="t" value={null} onChange={() => {}} noneLabel="inherit parent" />)
    expect(screen.getByRole('button', { name: 'inherit parent' })).toBeTruthy()
  })

  it('marks the matching preset pressed for an existing value', () => {
    render(<ThresholdPicker id="t" value={14} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '2w' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('calls onChange with the preset days on click', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ThresholdPicker id="t" value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '1m' }))

    expect(onChange).toHaveBeenCalledWith(30)
  })

  it('calls onChange(null) when the none chip is clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ThresholdPicker id="t" value={90} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'no threshold' }))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('opens a number + unit custom control and reports days as they change', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ThresholdPicker id="t" value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'custom' }))
    await user.type(screen.getByLabelText('amount'), '3')

    expect(onChange).toHaveBeenLastCalledWith(3) // default unit is day

    await user.selectOptions(screen.getByLabelText('unit'), 'weeks')

    expect(onChange).toHaveBeenLastCalledWith(21)
  })

  it('opens the custom control up front for a pre-existing custom value', () => {
    render(<ThresholdPicker id="t" value={45} onChange={() => {}} />)
    expect(screen.getByLabelText('amount')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'custom' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('shows a field error', () => {
    render(<ThresholdPicker id="t" value={null} onChange={() => {}} error="too big" />)
    expect(screen.getByText('too big')).toBeTruthy()
  })

  it('shows an inline error and does not call onChange for a custom amount over the ten-year cap', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ThresholdPicker id="t" value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'custom' }))
    await user.selectOptions(screen.getByLabelText('unit'), 'years')
    // paste, not type — a real keystroke-by-keystroke "11" would commit a
    // valid "1" (365 days) first; pasting asserts the over-cap amount itself
    // never reaches onChange.
    await user.click(screen.getByLabelText('amount'))
    await user.paste('11')

    expect(screen.getByText('up to 10 years')).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows the same inline error for a non-positive custom amount (previously silent)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ThresholdPicker id="t" value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'custom' }))
    await user.type(screen.getByLabelText('amount'), '0')

    expect(screen.getByText('up to 10 years')).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('clears the over-cap error once the amount is fixed', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ThresholdPicker id="t" value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'custom' }))
    await user.selectOptions(screen.getByLabelText('unit'), 'years')
    await user.type(screen.getByLabelText('amount'), '11')
    expect(screen.getByText('up to 10 years')).toBeTruthy()

    await user.clear(screen.getByLabelText('amount'))
    await user.type(screen.getByLabelText('amount'), '9')

    expect(screen.queryByText('up to 10 years')).toBeNull()
    expect(onChange).toHaveBeenLastCalledWith(9 * 365)
  })
})
