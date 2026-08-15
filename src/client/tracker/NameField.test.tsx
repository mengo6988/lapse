import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NameField } from './NameField'

describe('NameField', () => {
  it('has a visible label, not a placeholder-only input', () => {
    render(<NameField value="" onChange={() => {}} />)
    expect(screen.getByLabelText('name')).toBeTruthy()
  })

  it('calls onChange as the user types', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<NameField value="" onChange={onChange} />)

    await user.type(screen.getByLabelText('name'), 'a')

    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('links a field error via aria-describedby and shows it', () => {
    render(<NameField value="" onChange={() => {}} error="required" />)

    const input = screen.getByLabelText('name')
    expect(input.getAttribute('aria-describedby')).toBe('tracker-name-error')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('required').id).toBe('tracker-name-error')
  })

  it('autofocuses when asked (create flow opens with the name field focused)', () => {
    render(<NameField value="" onChange={() => {}} autoFocus />)
    expect(document.activeElement).toBe(screen.getByLabelText('name'))
  })
})
