import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import type { KeyValStore } from '../query/storage'
import { outboxStore, setOutboxPersistence, type OutboxItem } from './outboxStore'
import { QueuedSheet } from './QueuedSheet'

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

function item(id: string, overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id,
    kind: 'create',
    input: { id, trackerId: 'tracker-1', variantId: null, occurredAt: '2026-08-15T10:00:00.000Z' },
    attempts: 0,
    status: 'pending',
    queuedAt: '2026-08-15T10:00:00.000Z',
    ...overrides,
  }
}

const bootstrap: BootstrapPayload = {
  categories: [],
  trackers: [
    {
      id: 'tracker-1',
      name: 'water the plants',
      categoryId: null,
      thresholdDays: null,
      archivedAt: null,
      createdAt: '',
      latestEntry: null,
      variants: [
        { id: 'variant-1', name: 'basil', thresholdDays: null, latestEntry: null },
      ],
    },
  ],
}

function renderSheet(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  queryClient.setQueryData(bootstrapQueryKey, bootstrap)
  const result = render(
    <QueryClientProvider client={queryClient}>
      <QueuedSheet onClose={onClose} restoreFocusTo={null} />
    </QueryClientProvider>,
  )
  return { ...result, onClose }
}

describe('QueuedSheet', () => {
  beforeEach(async () => {
    setOutboxPersistence(memoryStore())
    await outboxStore.setItems([])
  })

  afterEach(() => {
    cleanup()
  })

  it('lists each item with its resolved Tracker/Variant label and intended time', async () => {
    await outboxStore.setItems([
      item('a', { input: { id: 'a', trackerId: 'tracker-1', variantId: null, occurredAt: '2026-08-15T10:00:00.000Z' } }),
      item('b', { input: { id: 'b', trackerId: 'tracker-1', variantId: 'variant-1', occurredAt: '2026-08-15T11:00:00.000Z' } }),
    ])
    renderSheet()

    expect(screen.getByText('water the plants')).toBeTruthy()
    expect(screen.getByText('water the plants · basil')).toBeTruthy()
  })

  it('visually distinguishes dead-lettered items from merely-waiting ones', async () => {
    await outboxStore.setItems([item('a', { status: 'dead' }), item('b')])
    const { container } = renderSheet()

    expect(container.querySelectorAll('.queued-sheet__row--dead').length).toBe(1)
  })

  it('offers retry-all, which revives every dead-lettered item', async () => {
    await outboxStore.setItems([item('a', { status: 'dead', attempts: 3 })])
    renderSheet()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /retry all/i }))

    expect(outboxStore.read()).toEqual([item('a', { status: 'pending', attempts: 0 })])
  })

  it('offers retry-all while items are merely waiting, so an offline queue can be kicked', async () => {
    await outboxStore.setItems([item('a', { status: 'pending', attempts: 2 })])
    renderSheet()
    const listener = vi.fn()
    const unsubscribe = outboxStore.subscribe(listener)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /retry all/i }))
    unsubscribe()

    // nothing to revive, but the store still emits — that emit is what wakes
    // the drain loop, which is the whole point of tapping retry all offline.
    expect(listener).toHaveBeenCalled()
    expect(outboxStore.read()).toEqual([item('a', { status: 'pending', attempts: 2 })])
  })

  it('offers per-entry discard, which removes just that item', async () => {
    await outboxStore.setItems([item('a'), item('b')])
    renderSheet()
    const user = userEvent.setup()

    const discardButtons = screen.getAllByRole('button', { name: /discard/i })
    await user.click(discardButtons[0]!)

    expect(outboxStore.read().map((entry) => entry.id)).toEqual(['b'])
  })

  it('reuses the tracker-sheet chrome — a dialog with a close button and a scrim', async () => {
    await outboxStore.setItems([item('a')])
    const { container } = renderSheet()

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'close' })).toBeTruthy()
    expect(container.querySelector('.tracker-sheet-scrim')).toBeTruthy()
  })

  it('calls onClose when the close button is clicked', async () => {
    await outboxStore.setItems([item('a')])
    const { onClose } = renderSheet()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'close' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('closes when the queue empties underneath it', async () => {
    await outboxStore.setItems([item('a')])
    const { onClose } = renderSheet()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /discard/i }))

    expect(onClose).toHaveBeenCalled()
  })
})
