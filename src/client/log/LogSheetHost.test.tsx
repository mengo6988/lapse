import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { session } from '../auth/session'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { logSheetStore } from './logSheetStore'
import { LogSheetHost } from './LogSheetHost'
import { logWindowStore } from './logWindowStore'

const payload: BootstrapPayload = {
  categories: [],
  trackers: [
    {
      id: 't1',
      name: 'vacuum',
      categoryId: null,
      thresholdDays: 7,
      archivedAt: null,
      createdAt: '',
      latestEntry: null,
      variants: [],
    },
  ],
}

function renderHost() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  queryClient.setQueryData(bootstrapQueryKey, payload)
  return render(
    <QueryClientProvider client={queryClient}>
      <LogSheetHost />
    </QueryClientProvider>,
  )
}

describe('LogSheetHost (build ticket 13)', () => {
  afterEach(() => {
    logSheetStore.close()
    logWindowStore.closeSilently()
    vi.unstubAllGlobals()
    session.reset()
  })

  it('renders nothing while closed', () => {
    renderHost()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the log sheet as a labelled, focus-trapped dialog when the store is open', () => {
    logSheetStore.open({ trackerId: 't1', variantId: null })
    renderHost()

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(screen.getByRole('button', { name: 'now' })).toBeTruthy()
  })

  it('submitting the sheet logs an Entry through the same optimistic path a tap uses, then closes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'server-id',
          trackerId: 't1',
          variantId: null,
          occurredAt: '2026-08-15T00:00:00.000Z',
          durationMinutes: null,
          note: null,
          createdAt: '2026-08-15T00:00:00.000Z',
        }),
      }),
    )
    logSheetStore.open({ trackerId: 't1', variantId: null })
    renderHost()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'log' }))

    // the store closes instantly; the DOM lingers for the exit fade
    // (src/client/shell/useExitTransition.ts), so the dialog's removal is
    // awaited rather than asserted synchronously.
    expect(logSheetStore.read()).toEqual({ mode: 'closed' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(logWindowStore.read()).toMatchObject({ kind: 'open', toastMessage: 'logged ✓' })
  })

  it('clicking the scrim closes the sheet without logging', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    logSheetStore.open({ trackerId: 't1', variantId: null })
    const { container } = renderHost()
    const user = userEvent.setup()

    await user.click(container.querySelector('.tracker-sheet-scrim')!)

    expect(logSheetStore.read()).toEqual({ mode: 'closed' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Escape closes the sheet without logging', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    logSheetStore.open({ trackerId: 't1', variantId: null })
    renderHost()
    const user = userEvent.setup()

    await user.keyboard('{Escape}')

    expect(logSheetStore.read()).toEqual({ mode: 'closed' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('closing restores focus to the element the long-press fired from', async () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()

    logSheetStore.open({ trackerId: 't1', variantId: null }, opener)
    renderHost()
    const user = userEvent.setup()

    await user.keyboard('{Escape}')

    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})
