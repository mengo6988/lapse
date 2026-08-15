import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Disclosure } from './Disclosure'

describe('Disclosure', () => {
  it('starts collapsed by default: trigger visible, content absent', () => {
    render(
      <Disclosure label="category">
        <p>category chips</p>
      </Disclosure>,
    )

    expect(screen.getByRole('button', { name: /category/ }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('category chips')).toBeNull()
  })

  it('honors defaultOpen', () => {
    render(
      <Disclosure label="category" defaultOpen>
        <p>category chips</p>
      </Disclosure>,
    )

    expect(screen.getByText('category chips')).toBeTruthy()
  })

  it('reveals and hides content on click, toggling aria-expanded', async () => {
    const user = userEvent.setup()
    render(
      <Disclosure label="category">
        <p>category chips</p>
      </Disclosure>,
    )
    const trigger = screen.getByRole('button', { name: /category/ })

    await user.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('category chips')).toBeTruthy()

    await user.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('category chips')).toBeNull()
  })
})
