import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload, Tracker } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { ArchivedTrackerRow } from './ArchivedTrackerRow'

const NOW = new Date('2026-08-15T00:00:00.000Z')

function tracker(overrides: Partial<Tracker> = {}): Tracker {
  return {
    id: 't1',
    name: 'ancient chore',
    categoryId: null,
    thresholdDays: 7,
    archivedAt: '2026-08-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    latestEntry: null,
    variants: [],
    ...overrides,
  }
}

function renderRow(t: Tracker, onRequestDelete = vi.fn()) {
  const queryClient = new QueryClient()
  const payload: BootstrapPayload = { categories: [], trackers: [t] }
  queryClient.setQueryData(bootstrapQueryKey, payload)
  render(
    <QueryClientProvider client={queryClient}>
      <ul>
        <ArchivedTrackerRow tracker={t} now={NOW} onRequestDelete={onRequestDelete} />
      </ul>
    </QueryClientProvider>,
  )
  return { queryClient, onRequestDelete }
}

describe('ArchivedTrackerRow', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the Tracker name and its last-done state', () => {
    renderRow(tracker({ name: 'vacuum house', latestEntry: null }))

    expect(screen.getByText('vacuum house')).toBeTruthy()
    expect(screen.getByText('last done never · every 7d')).toBeTruthy()
  })

  it('shows one last-done line per Variant, prefixed with the variant name, when Variants exist', () => {
    renderRow(
      tracker({
        variants: [
          { id: 'v1', name: 'volvo', thresholdDays: null, latestEntry: null },
          { id: 'v2', name: 'crv', thresholdDays: 7, latestEntry: null },
        ],
      }),
    )

    expect(screen.getByText(/^volvo/)).toBeTruthy()
    expect(screen.getByText(/^crv/)).toBeTruthy()
  })

  it('unarchive PATCHes { archived: false }', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...tracker(), archivedAt: null, variants: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderRow(tracker())

    await user.click(screen.getByRole('button', { name: 'unarchive' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/trackers/t1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ archived: false }) }),
      ),
    )
  })

  it('shows an error and leaves the row in place when unarchive fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'server exploded' }) }),
    )
    const user = userEvent.setup()
    renderRow(tracker())

    await user.click(screen.getByRole('button', { name: 'unarchive' }))

    await waitFor(() => expect(screen.getByText('server exploded')).toBeTruthy())
  })

  it('delete calls onRequestDelete with the button that was clicked, and never fetches on its own', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    const { onRequestDelete } = renderRow(tracker())

    const deleteButton = screen.getByRole('button', { name: 'delete' })
    await user.click(deleteButton)

    expect(onRequestDelete).toHaveBeenCalledWith(deleteButton)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
