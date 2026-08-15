import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { session } from '../auth/session'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { SettingsRoute } from './SettingsRoute'

const payload: BootstrapPayload = {
  categories: [{ id: 'house', name: 'house', color: '#a6e3a1', createdAt: '2026-01-01T00:00:00.000Z' }],
  trackers: [],
}

function renderRoute() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  queryClient.setQueryData(bootstrapQueryKey, payload)
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<SettingsRoute />} />
          <Route path="/archived" element={<div>archived screen</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SettingsRoute', () => {
  beforeEach(() => {
    session.reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exposes itself as the settings region', () => {
    renderRoute()

    expect(screen.getByRole('region', { name: 'settings' })).toBeTruthy()
  })

  it('renders the categories manager', () => {
    renderRoute()

    expect(screen.getByDisplayValue('house')).toBeTruthy()
    expect(screen.getByLabelText('new category name')).toBeTruthy()
  })

  it('links to the archived screen', async () => {
    const user = userEvent.setup()
    renderRoute()

    await user.click(screen.getByRole('link', { name: 'archived' }))

    expect(screen.getByText('archived screen')).toBeTruthy()
  })

  it('has a logout button that marks the session unauthorized', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }))
    const user = userEvent.setup()
    renderRoute()

    await user.click(screen.getByRole('button', { name: 'log out' }))

    await waitFor(() => expect(session.read()).toBe('unauthorized'))
  })
})
