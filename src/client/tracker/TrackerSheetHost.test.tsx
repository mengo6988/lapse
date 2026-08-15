import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { trackerSheetStore } from './trackerSheetStore'
import { TrackerSheetHost } from './TrackerSheetHost'

const payload: BootstrapPayload = {
  categories: [],
  trackers: [
    {
      id: 't1',
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

function renderHost() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  queryClient.setQueryData(bootstrapQueryKey, payload)
  return render(
    <QueryClientProvider client={queryClient}>
      <TrackerSheetHost />
    </QueryClientProvider>,
  )
}

describe('TrackerSheetHost', () => {
  afterEach(() => {
    trackerSheetStore.close()
    vi.unstubAllGlobals()
  })

  it('renders nothing while closed', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload }))
    renderHost()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the "new tracker" sheet in create mode', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload }))
    trackerSheetStore.openCreate()
    renderHost()

    expect(screen.getByRole('dialog', { name: 'new tracker' })).toBeTruthy()
    expect(screen.getByLabelText('name')).toBeTruthy()
  })

  it('opens the "edit tracker" sheet pre-filled for the given Tracker', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload }))
    trackerSheetStore.openEdit('t1')
    renderHost()

    expect(screen.getByRole('dialog', { name: 'edit tracker' })).toBeTruthy()
    expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe('water the plants')
  })

  it('falls back to an honest message for an unknown tracker id', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload }))
    trackerSheetStore.openEdit('ghost')
    renderHost()

    expect(screen.getByText('tracker not found')).toBeTruthy()
  })

  it('clicking the scrim closes the sheet', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload }))
    trackerSheetStore.openCreate()
    const { container } = renderHost()
    const user = userEvent.setup()

    await user.click(container.querySelector('.tracker-sheet-scrim')!)

    expect(trackerSheetStore.read()).toEqual({ mode: 'closed' })
  })

  it('closing via the close button also restores focus to the opener', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload }))
    const opener = document.createElement('button')
    opener.textContent = 'open'
    document.body.appendChild(opener)
    opener.focus()

    trackerSheetStore.openCreate()
    renderHost()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'close' }))

    expect(trackerSheetStore.read()).toEqual({ mode: 'closed' })
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})
