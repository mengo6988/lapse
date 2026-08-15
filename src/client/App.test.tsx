import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { App } from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const stubFetch = (login: Response) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/api/health') ? new Response('{}', { status: 200 }) : login,
    ),
  )

describe('App shell', () => {
  it('reports the api as reachable', async () => {
    stubFetch(new Response(null, { status: 401 }))

    render(<App />)

    expect(await screen.findByText('api: ok')).toBeTruthy()
  })

  it('logs in with the right password', async () => {
    stubFetch(new Response('{}', { status: 200 }))

    render(<App />)
    await userEvent.type(screen.getByLabelText('password'), 'hunter2')
    await userEvent.click(screen.getByRole('button', { name: 'log in' }))

    await waitFor(() => expect(screen.getByText('logged in')).toBeTruthy())
  })

  it('surfaces a rejected password', async () => {
    stubFetch(new Response(null, { status: 401 }))

    render(<App />)
    await userEvent.type(screen.getByLabelText('password'), 'nope')
    await userEvent.click(screen.getByRole('button', { name: 'log in' }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('wrong password'))
  })
})
