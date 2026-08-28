import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Category, Tracker } from '../api'
import { trackerSheetStore } from '../tracker'
import { TrackerDetailScreen } from './TrackerDetailScreen'

const NOW = new Date(2026, 7, 15, 12, 0, 0)

const categories: Category[] = [{ id: 'c1', name: 'car', color: '#000000', createdAt: '' }]

function renderScreen(tracker: Tracker) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={['/tracker/t1']}>
      <QueryClientProvider client={queryClient}>
        <TrackerDetailScreen tracker={tracker} categories={categories} now={NOW} />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

const noVariantEntriesPage = {
  entries: [{ id: 'e1', trackerId: 't1', variantId: null, occurredAt: new Date(2026, 7, 1).toISOString(), durationMinutes: null, note: null, createdAt: '' }],
  nextCursor: null,
}

describe('TrackerDetailScreen', () => {
  afterEach(() => {
    trackerSheetStore.close()
    vi.unstubAllGlobals()
  })

  it('shows the Tracker name and its Category in the header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => noVariantEntriesPage })
    vi.stubGlobal('fetch', fetchMock)
    renderScreen({ id: 't1', name: 'tyre pressure', categoryId: 'c1', thresholdDays: 30, archivedAt: null, createdAt: '', latestEntry: null, variants: [] })

    expect(screen.getByRole('heading', { name: 'tyre pressure' })).toBeTruthy()
    expect(screen.getByText('car')).toBeTruthy()
  })

  it('the back button is a real, always-present affordance (no OS back gesture in a standalone PWA)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => noVariantEntriesPage })
    vi.stubGlobal('fetch', fetchMock)
    renderScreen({ id: 't1', name: 'x', categoryId: null, thresholdDays: null, archivedAt: null, createdAt: '', latestEntry: null, variants: [] })

    expect(screen.getByRole('button', { name: 'back' }).tagName).toBe('BUTTON')
  })

  it('the edit button opens the shared edit-tracker sheet for this Tracker', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => noVariantEntriesPage })
    vi.stubGlobal('fetch', fetchMock)
    renderScreen({ id: 't1', name: 'x', categoryId: null, thresholdDays: null, archivedAt: null, createdAt: '', latestEntry: null, variants: [] })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'edit' }))

    expect(trackerSheetStore.read()).toMatchObject({ mode: 'edit', trackerId: 't1' })
  })

  it('a tracker-level Entry appears in history but does not affect a Variant\'s own last-done summary', async () => {
    const variantEntry = { id: 'v-entry', trackerId: 't1', variantId: 'v1', occurredAt: new Date(2026, 7, 12).toISOString(), durationMinutes: null, note: null, createdAt: '' }
    const trackerLevelEntry = { id: 't-entry', trackerId: 't1', variantId: null, occurredAt: new Date(2026, 7, 14).toISOString(), durationMinutes: null, note: null, createdAt: '' }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ entries: [trackerLevelEntry, variantEntry], nextCursor: null }) })
    vi.stubGlobal('fetch', fetchMock)

    const tracker: Tracker = {
      id: 't1',
      name: 'tyre pressure',
      categoryId: null,
      thresholdDays: null,
      archivedAt: null,
      createdAt: '',
      latestEntry: null,
      variants: [{ id: 'v1', name: 'volvo', thresholdDays: null, latestEntry: variantEntry }],
    }
    renderScreen(tracker)

    // history shows both, including the tracker-level one, labelled distinctly.
    await waitFor(() => expect(screen.getByText('no variant')).toBeTruthy())
    expect(screen.getAllByText('volvo').length).toBeGreaterThan(0)

    // the Variant's own summary subline is built from variant.latestEntry
    // (2026-08-12), not the more-recent tracker-level Entry (2026-08-14) —
    // "3d ago" would be wrong (that's the tracker-level entry's age).
    expect(screen.getByText(/last done 3d ago/)).toBeTruthy()
  })

  it('clicking an Entry row opens the edit sheet for that Entry', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => noVariantEntriesPage })
    vi.stubGlobal('fetch', fetchMock)
    renderScreen({ id: 't1', name: 'x', categoryId: null, thresholdDays: null, archivedAt: null, createdAt: '', latestEntry: null, variants: [] })

    const user = userEvent.setup()
    const entryButton = await screen.findByRole('button', { name: /14d ago/ })
    await user.click(entryButton)

    expect(screen.getByRole('dialog', { name: 'edit entry' })).toBeTruthy()
  })

  it('marks #app-root inert while the entry edit sheet is open, through the exit latch, and clears it once closed', async () => {
    const appRoot = document.createElement('div')
    appRoot.id = 'app-root'
    document.body.appendChild(appRoot)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => noVariantEntriesPage })
    vi.stubGlobal('fetch', fetchMock)
    renderScreen({ id: 't1', name: 'x', categoryId: null, thresholdDays: null, archivedAt: null, createdAt: '', latestEntry: null, variants: [] })

    const user = userEvent.setup()
    const entryButton = await screen.findByRole('button', { name: /14d ago/ })
    await user.click(entryButton)
    expect(screen.getByRole('dialog', { name: 'edit entry' })).toBeTruthy()
    expect(appRoot.hasAttribute('inert')).toBe(true)

    await user.click(screen.getByRole('button', { name: 'close' }))
    // store flips closed instantly, but the DOM (and the inert it drives)
    // latches through the exit animation — see useExitTransition.ts.
    expect(appRoot.hasAttribute('inert')).toBe(true)

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(appRoot.hasAttribute('inert')).toBe(false)

    appRoot.remove()
  })
})
