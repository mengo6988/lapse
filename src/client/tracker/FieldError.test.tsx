import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FieldError } from './FieldError'

describe('FieldError', () => {
  it('renders empty (but present, for aria-live) when there is no message', () => {
    render(<FieldError id="name-error" />)
    const el = document.getElementById('name-error')!
    expect(el).toBeTruthy()
    expect(el.textContent).toBe('')
    expect(el.getAttribute('aria-live')).toBe('polite')
  })

  it('renders the message text under the given id', () => {
    render(<FieldError id="name-error" message="required" />)
    expect(screen.getByText('required').id).toBe('name-error')
  })
})
