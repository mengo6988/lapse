import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AllItemsFooter } from './AllItemsFooter'

describe('AllItemsFooter', () => {
  it('shows the label and count, and links to the plain list route', () => {
    render(
      <MemoryRouter>
        <AllItemsFooter count={9} />
      </MemoryRouter>,
    )

    expect(screen.getByText('all items')).toBeTruthy()
    const link = screen.getByRole('link')
    expect(link.textContent).toContain('9')
    // never the search-open route — search must never overlay the digest.
    expect(link.getAttribute('href')).toBe('/list')
  })
})
