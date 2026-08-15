import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { CategoriesManager } from './CategoriesManager'

const payload: BootstrapPayload = {
  categories: [
    { id: 'house', name: 'house', color: '#a6e3a1', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'car', name: 'car', color: '#fab387', createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  trackers: [],
}

function renderManager() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  queryClient.setQueryData(bootstrapQueryKey, payload)
  render(
    <QueryClientProvider client={queryClient}>
      <CategoriesManager />
    </QueryClientProvider>,
  )
  return { queryClient }
}

describe('CategoriesManager', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders no rows, just the add form, before the bootstrap query has data', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <CategoriesManager />
      </QueryClientProvider>,
    )

    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByLabelText('new category name')).toBeTruthy()
  })

  it('renders one row per Category plus the add form', () => {
    renderManager()

    expect(screen.getByDisplayValue('house')).toBeTruthy()
    expect(screen.getByDisplayValue('car')).toBeTruthy()
    expect(screen.getByLabelText('new category name')).toBeTruthy()
  })

  it('opens the delete dialog for the clicked row, and cancelling it changes nothing', async () => {
    const user = userEvent.setup()
    renderManager()

    await user.click(screen.getByRole('button', { name: 'delete house' }))
    expect(screen.getByRole('dialog', { name: 'delete house' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'cancel' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByDisplayValue('house')).toBeTruthy()
  })

  it('confirming delete removes the row from the list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'house' }) }))
    const user = userEvent.setup()
    renderManager()

    await user.click(screen.getByRole('button', { name: 'delete house' }))
    await user.click(screen.getByRole('button', { name: 'delete' }))

    await waitFor(() => expect(screen.queryByDisplayValue('house')).toBeNull())
    expect(screen.getByDisplayValue('car')).toBeTruthy()
  })
})
