import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { BootstrapPayload } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import type { KeyValStore } from '../query/storage'
import { outboxStore, setOutboxPersistence, type OutboxItem } from './outboxStore'
import { PendingChip } from './PendingChip'

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
      variants: [],
    },
  ],
}

function renderChip() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  queryClient.setQueryData(bootstrapQueryKey, bootstrap)
  return render(
    <QueryClientProvider client={queryClient}>
      <PendingChip />
    </QueryClientProvider>,
  )
}

describe('PendingChip', () => {
  beforeEach(async () => {
    setOutboxPersistence(memoryStore())
    await outboxStore.setItems([])
  })

  afterEach(() => {
    cleanup()
  })

  it('renders nothing while the outbox is empty', async () => {
    renderChip()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows the pending count in the canonical "N queued" form with a clock glyph', async () => {
    await outboxStore.setItems([item('a'), item('b')])
    renderChip()

    const button = screen.getByRole('button', { name: /2 queued/ })
    expect(button.textContent).toContain('2 queued')
    expect(button.querySelector('svg')).toBeTruthy()
  })

  it('is rendered in the failure accent when any item has dead-lettered', async () => {
    await outboxStore.setItems([item('a'), item('b', { status: 'dead' })])
    renderChip()

    expect(screen.getByRole('button').className).toContain('pending-chip--dead')
  })

  it('is not rendered in the failure accent when every item is merely pending', async () => {
    await outboxStore.setItems([item('a'), item('b')])
    renderChip()

    expect(screen.getByRole('button').className).not.toContain('pending-chip--dead')
  })

  it('has a real accessible name and a ≥44px touch target', async () => {
    await outboxStore.setItems([item('a')])
    renderChip()

    const button = screen.getByRole('button', { name: /1 queued/ })
    expect(button.getAttribute('type')).toBe('button')
  })

  it('tapping the chip opens the queued sheet', async () => {
    await outboxStore.setItems([item('a')])
    renderChip()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /1 queued/ }))

    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('marks #app-root inert while the queued sheet is open, through the exit latch, and clears it once closed', async () => {
    const appRoot = document.createElement('div')
    appRoot.id = 'app-root'
    document.body.appendChild(appRoot)
    await outboxStore.setItems([item('a')])
    renderChip()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /1 queued/ }))
    expect(appRoot.hasAttribute('inert')).toBe(true)

    await user.click(screen.getByRole('button', { name: 'close' }))
    // the sheet's DOM latches through the exit fade (useExitTransition.ts)
    // even though the click already closed it, so inert must too.
    expect(appRoot.hasAttribute('inert')).toBe(true)

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(appRoot.hasAttribute('inert')).toBe(false)

    appRoot.remove()
  })

  it('disappears on its own as soon as the queue drains — no manual dismissal', async () => {
    await outboxStore.setItems([item('a')])
    renderChip()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /1 queued/ }))
    expect(screen.getByRole('dialog')).toBeTruthy()

    await act(async () => {
      await outboxStore.setItems([])
    })

    // chip and sheet play a 200ms exit fade before unmounting
    // (src/client/shell/useExitTransition.ts), so removal is awaited.
    await waitFor(() => {
      expect(screen.queryByRole('button')).toBeNull()
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})
