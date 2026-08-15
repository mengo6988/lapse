import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { TrackerDetailRoute } from './TrackerDetailRoute'

const payload: BootstrapPayload = {
  categories: [],
  trackers: [
    { id: 't1', name: 'tyre pressure', categoryId: null, thresholdDays: null, archivedAt: null, createdAt: '', latestEntry: null, variants: [] },
  ],
}

function renderRoute(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(bootstrapQueryKey, payload)
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/tracker/:trackerId" element={<TrackerDetailRoute />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TrackerDetailRoute', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves the trackerId route param against the bootstrap cache and renders that Tracker', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ entries: [], nextCursor: null }) })
    vi.stubGlobal('fetch', fetchMock)
    renderRoute('/tracker/t1')

    expect(screen.getByRole('heading', { name: 'tyre pressure' })).toBeTruthy()
  })

  it('shows an honest not-found state for an unknown trackerId, with a way back', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ entries: [], nextCursor: null }) }))
    renderRoute('/tracker/ghost')

    expect(screen.getByText('tracker not found')).toBeTruthy()
    expect(screen.getByRole('button', { name: /back/i })).toBeTruthy()
  })
})
