import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Entry, Tracker } from '../api'
import { VariantSummaryList } from './VariantSummaryList'

const NOW = new Date(2026, 7, 15, 12, 0, 0)

function entriesEveryNDays(variantId: string | null, days: number): Entry[] {
  return [0, days, days * 2].map((offset, i) => ({
    id: `${variantId ?? 'tracker'}-${i}`,
    trackerId: 't1',
    variantId,
    occurredAt: new Date(NOW.getTime() - offset * 86_400_000).toISOString(),
    durationMinutes: null,
    note: null,
    createdAt: '',
  }))
}

describe('VariantSummaryList', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders one summary row per Variant', () => {
    const tracker: Tracker = {
      id: 't1',
      name: 'tyre pressure',
      categoryId: null,
      thresholdDays: 30,
      archivedAt: null,
      createdAt: '',
      latestEntry: null,
      variants: [
        { id: 'v1', name: 'volvo', thresholdDays: null, latestEntry: null },
        { id: 'v2', name: 'crv', thresholdDays: null, latestEntry: null },
      ],
    }
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <VariantSummaryList tracker={tracker} now={NOW} loadedEntries={[]} />
      </QueryClientProvider>,
    )
    expect(screen.getByText('volvo')).toBeTruthy()
    expect(screen.getByText('crv')).toBeTruthy()
  })

  it('accepting a suggestion on a Variant row PATCHes that Variant, not the Tracker', async () => {
    const tracker: Tracker = {
      id: 't1',
      name: 'tyre pressure',
      categoryId: null,
      thresholdDays: null,
      archivedAt: null,
      createdAt: '',
      latestEntry: null,
      variants: [{ id: 'v1', name: 'volvo', thresholdDays: 10, latestEntry: null }],
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'v1', trackerId: 't1', name: 'volvo', thresholdDays: 40, deletedAt: null, createdAt: '' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const queryClient = new QueryClient()
    queryClient.setQueryData(['bootstrap'], { categories: [], trackers: [tracker] })

    render(
      <QueryClientProvider client={queryClient}>
        <VariantSummaryList tracker={tracker} now={NOW} loadedEntries={entriesEveryNDays('v1', 40)} />
      </QueryClientProvider>,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'accept' }))

    expect(fetchMock).toHaveBeenCalledWith('/api/variants/v1', expect.objectContaining({ method: 'PATCH' }))
  })

  it('accepting a suggestion on a no-Variant Tracker PATCHes the Tracker itself', async () => {
    const tracker: Tracker = {
      id: 't1',
      name: 'water plants',
      categoryId: null,
      thresholdDays: null,
      archivedAt: null,
      createdAt: '',
      latestEntry: null,
      variants: [],
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 't1', name: 'water plants', categoryId: null, thresholdDays: 7, archivedAt: null, createdAt: '', variants: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const queryClient = new QueryClient()
    queryClient.setQueryData(['bootstrap'], { categories: [], trackers: [tracker] })

    render(
      <QueryClientProvider client={queryClient}>
        <VariantSummaryList tracker={tracker} now={NOW} loadedEntries={entriesEveryNDays(null, 7)} />
      </QueryClientProvider>,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'accept' }))

    expect(fetchMock).toHaveBeenCalledWith('/api/trackers/t1', expect.objectContaining({ method: 'PATCH' }))
  })
})
