import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { session } from '../auth/session'
import { LoginScreen } from './LoginScreen'

describe('LoginScreen', () => {
  beforeEach(() => {
    session.reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts { password } as JSON and marks the session authed on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<LoginScreen />)

    await user.type(screen.getByLabelText('password'), 'correct-horse')
    await user.click(screen.getByRole('button', { name: 'log in' }))

    await waitFor(() => expect(session.read()).toBe('authed'))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 'correct-horse' }),
      }),
    )
  })

  it('shows "wrong password" on a 401 and does not authorize', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    const user = userEvent.setup()
    render(<LoginScreen />)

    await user.type(screen.getByLabelText('password'), 'nope')
    await user.click(screen.getByRole('button', { name: 'log in' }))

    expect((await screen.findByRole('alert')).textContent).toBe('wrong password')
    expect(session.read()).not.toBe('authed')
  })

  it("shows \"couldn't log in\" on a non-401 failure response", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    const user = userEvent.setup()
    render(<LoginScreen />)

    await user.type(screen.getByLabelText('password'), 'anything')
    await user.click(screen.getByRole('button', { name: 'log in' }))

    expect((await screen.findByRole('alert')).textContent).toBe("couldn't log in")
  })

  it("shows \"couldn't log in\" when the request itself throws", async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const user = userEvent.setup()
    render(<LoginScreen />)

    await user.type(screen.getByLabelText('password'), 'anything')
    await user.click(screen.getByRole('button', { name: 'log in' }))

    expect((await screen.findByRole('alert')).textContent).toBe("couldn't log in")
  })
})
