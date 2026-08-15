import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { session } from '../auth/session'
import { LogoutButton } from './LogoutButton'

function renderButton() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <LogoutButton />
    </QueryClientProvider>,
  )
}

describe('LogoutButton', () => {
  beforeEach(() => {
    session.reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is a real button labelled "log out"', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }))
    renderButton()

    const button = screen.getByRole('button', { name: 'log out' })
    expect(button.tagName).toBe('BUTTON')
  })

  it('clicking it posts to /api/auth/logout and marks the session unauthorized', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderButton()

    await user.click(screen.getByRole('button', { name: 'log out' }))

    await waitFor(() => expect(session.read()).toBe('unauthorized'))
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }))
  })

  it('still logs out locally when the network call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')))
    const user = userEvent.setup()
    renderButton()

    await user.click(screen.getByRole('button', { name: 'log out' }))

    await waitFor(() => expect(session.read()).toBe('unauthorized'))
  })
})
