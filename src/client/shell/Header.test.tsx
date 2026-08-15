import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Header } from './Header'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Header />
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('Header', () => {
  it('renders the wordmark and only the magnifier — no sliders icon', () => {
    renderHeader()
    expect(screen.getByText('lapse')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'search' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'filter' })).toBeNull()
    expect(screen.queryByLabelText('sliders')).toBeNull()
  })

  it('the magnifier navigates to the list route with search open', async () => {
    renderHeader()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'search' }))
    expect(screen.getByTestId('location').textContent).toBe('/list?search=open')
  })
})
