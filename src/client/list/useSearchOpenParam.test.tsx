import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCallback, useState } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useSearchOpenParam } from './useSearchOpenParam'

function Probe() {
  const [openCount, setOpenCount] = useState(0)
  const onOpen = useCallback(() => setOpenCount((count) => count + 1), [])
  useSearchOpenParam(onOpen)
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <div>
      <span data-testid="open-count">{openCount}</span>
      <span data-testid="search">{location.search}</span>
      <button type="button" onClick={() => navigate({ pathname: '/list', search: '?search=open' })}>
        reopen
      </button>
    </div>
  )
}

describe('useSearchOpenParam', () => {
  it('fires onOpen when the URL arrives carrying ?search=open', () => {
    render(
      <MemoryRouter initialEntries={['/list?search=open']}>
        <Probe />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('open-count').textContent).toBe('1')
  })

  it('does not fire when the param is absent', () => {
    render(
      <MemoryRouter initialEntries={['/list']}>
        <Probe />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('open-count').textContent).toBe('0')
  })

  it('strips the param from the URL after firing', () => {
    render(
      <MemoryRouter initialEntries={['/list?search=open']}>
        <Probe />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('search').textContent).toBe('')
  })

  it('fires again on a later navigation back to ?search=open, even after the same URL was already consumed once', async () => {
    render(
      <MemoryRouter initialEntries={['/list?search=open']}>
        <Probe />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('open-count').textContent).toBe('1')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'reopen' }))
    expect(screen.getByTestId('open-count').textContent).toBe('2')
  })
})
