import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { KeyValStore } from '../query/storage'
import { outboxStore, setOutboxPersistence, type OutboxItem } from '../outbox/outboxStore'
import { Header } from './Header'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

function memoryStore(): KeyValStore {
  const data = new Map<string, string>()
  return {
    get: async (key) => data.get(key),
    set: async (key, value) => {
      data.set(key, value)
    },
    del: async (key) => {
      data.delete(key)
    },
  }
}

function outboxItem(id: string): OutboxItem {
  return {
    id,
    kind: 'create',
    input: { id, trackerId: 'tracker-1', variantId: null, occurredAt: '2026-08-15T10:00:00.000Z' },
    attempts: 0,
    status: 'pending',
    queuedAt: '2026-08-15T10:00:00.000Z',
  }
}

function renderHeader() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Header />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Header', () => {
  beforeEach(async () => {
    setOutboxPersistence(memoryStore())
    await outboxStore.setItems([])
  })

  afterEach(async () => {
    // unmount before resetting the store — otherwise a still-mounted
    // PendingChip from this test re-renders outside any act() wrapper
    // (matching src/client/log/LogToast.test.tsx's precedent).
    cleanup()
    await outboxStore.setItems([])
  })

  it('renders the wordmark and only the magnifier — no sliders icon — when nothing is queued', () => {
    renderHeader()
    expect(screen.getByText('lapse')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'search' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'filter' })).toBeNull()
    expect(screen.queryByLabelText('sliders')).toBeNull()
    expect(screen.queryByText(/queued/)).toBeNull()
  })

  it('the magnifier navigates to the list route with search open', async () => {
    renderHeader()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'search' }))
    expect(screen.getByTestId('location').textContent).toBe('/list?search=open')
  })

  it('slots the pending chip between the wordmark and the magnifier (build ticket 19)', async () => {
    await outboxStore.setItems([outboxItem('a')])
    renderHeader()

    const header = screen.getByText('lapse').closest('header')
    expect(header).toBeTruthy()
    const children = Array.from(header!.children)
    const wordmarkIndex = children.findIndex((child) => child.textContent === 'lapse')
    const chipIndex = children.findIndex((child) => child.textContent?.includes('queued'))
    const searchIndex = children.findIndex((child) => child.getAttribute('aria-label') === 'search')

    expect(wordmarkIndex).toBeLessThan(chipIndex)
    expect(chipIndex).toBeLessThan(searchIndex)
  })
})
