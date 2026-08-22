import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Category, Tracker } from '../api'
import { TrackerForm } from './TrackerForm'

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient()
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>,
    ),
  }
}

const categories: Category[] = [{ id: 'house', name: 'house', color: '#fff', createdAt: '' }]

const editTracker: Tracker = {
  id: 't1',
  name: 'water the plants',
  categoryId: 'house',
  thresholdDays: 7,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  latestEntry: null,
  variants: [{ id: 'v1', name: 'front', thresholdDays: null, latestEntry: null }],
}

describe('TrackerForm — create', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('focuses the name field on open and keeps Category/Threshold/Variants collapsed', () => {
    renderWithClient(<TrackerForm mode="create" categories={categories} onClose={() => {}} />)

    expect(document.activeElement).toBe(screen.getByLabelText('name'))
    expect(screen.queryByRole('group', { name: 'category' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'threshold' })).toBeNull()
  })

  it('a name alone is enough: submits POST /api/trackers with just the trimmed name', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 't2', name: 'run', categoryId: null, thresholdDays: null, archivedAt: null, createdAt: '', variants: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWithClient(<TrackerForm mode="create" categories={categories} onClose={onClose} />)

    await user.type(screen.getByLabelText('name'), '  run  ')
    await user.click(screen.getByRole('button', { name: 'add tracker' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/trackers',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'run', categoryId: null, thresholdDays: null, variants: [] }),
      }),
    )
  })

  it('includes a chosen Category and Threshold preset once those sections are opened', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 't2', name: 'x', categoryId: 'house', thresholdDays: 7, archivedAt: null, createdAt: '', variants: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderWithClient(<TrackerForm mode="create" categories={categories} onClose={() => {}} />)

    await user.type(screen.getByLabelText('name'), 'x')
    await user.click(screen.getByRole('button', { name: /category/ }))
    await user.click(screen.getByRole('button', { name: 'house' }))
    await user.click(screen.getByRole('button', { name: /threshold/ }))
    await user.click(screen.getByRole('button', { name: '1w' }))
    await user.click(screen.getByRole('button', { name: 'add tracker' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/trackers',
        expect.objectContaining({ body: JSON.stringify({ name: 'x', categoryId: 'house', thresholdDays: 7, variants: [] }) }),
      ),
    )
  })

  it('sends a drafted variant, dropping any left with a blank name', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 't2', name: 'x', categoryId: null, thresholdDays: null, archivedAt: null, createdAt: '', variants: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderWithClient(<TrackerForm mode="create" categories={categories} onClose={() => {}} />)

    await user.type(screen.getByLabelText('name'), 'tyre pressure')
    await user.click(screen.getByRole('button', { name: /variants/ }))
    await user.click(screen.getByRole('button', { name: 'add variant' }))
    await user.type(screen.getByLabelText('variant name'), 'front')
    await user.click(screen.getByRole('button', { name: 'add variant' })) // second, left blank
    await user.click(screen.getByRole('button', { name: 'add tracker' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/trackers',
        expect.objectContaining({
          body: JSON.stringify({ name: 'tyre pressure', categoryId: null, thresholdDays: null, variants: [{ name: 'front', thresholdDays: null }] }),
        }),
      ),
    )
  })

  it('points a nested variant field error at the right row even when an earlier draft was left blank', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        // targets payload index 0 — the only variant actually sent, since
        // the first (blank) draft row is dropped before the request goes out.
        json: async () => ({ success: false, error: { issues: [{ path: ['variants', 0, 'name'], message: 'too long' }] } }),
      }),
    )
    const user = userEvent.setup()
    renderWithClient(<TrackerForm mode="create" categories={categories} onClose={() => {}} />)

    await user.type(screen.getByLabelText('name'), 'tyre pressure')
    await user.click(screen.getByRole('button', { name: /variants/ }))
    await user.click(screen.getByRole('button', { name: 'add variant' })) // row 0, left blank
    await user.click(screen.getByRole('button', { name: 'add variant' })) // row 1
    const [, secondRow] = screen.getAllByLabelText('variant name')
    await user.type(secondRow!, 'front')
    await user.click(screen.getByRole('button', { name: 'add tracker' }))

    const error = await screen.findByText('too long')
    // the error paragraph's id is referenced by the SECOND row's input, not the first.
    const [firstInput, secondInput] = screen.getAllByLabelText('variant name')
    expect(secondInput!.getAttribute('aria-describedby')).toBe(error.id)
    expect(firstInput!.getAttribute('aria-describedby')).not.toBe(error.id)
  })

  it('shows a field error next to the name input on a 400, and does not close', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ success: false, error: { issues: [{ path: ['name'], message: 'required' }] } }),
      }),
    )
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWithClient(<TrackerForm mode="create" categories={categories} onClose={onClose} />)

    await user.type(screen.getByLabelText('name'), 'x')
    await user.click(screen.getByRole('button', { name: 'add tracker' }))

    expect(await screen.findByText('required')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows a generic alert (not a raw JSON dump) for a non-field failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }))
    const user = userEvent.setup()
    renderWithClient(<TrackerForm mode="create" categories={categories} onClose={() => {}} />)

    await user.type(screen.getByLabelText('name'), 'x')
    await user.click(screen.getByRole('button', { name: 'add tracker' }))

    expect((await screen.findByRole('alert')).textContent).toBe("couldn't save — try again")
  })
})

describe('TrackerForm — edit', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pre-fills name and shows an archive action, not present in create mode', () => {
    renderWithClient(<TrackerForm mode="edit" tracker={editTracker} categories={categories} onClose={() => {}} />)

    expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe('water the plants')
    expect(screen.getByRole('button', { name: 'archive' })).toBeTruthy()
  })

  it('save PATCHes only the tracker-level fields and closes on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...editTracker, name: 'water the ferns', variants: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWithClient(<TrackerForm mode="edit" tracker={editTracker} categories={categories} onClose={onClose} />)

    await user.clear(screen.getByLabelText('name'))
    await user.type(screen.getByLabelText('name'), 'water the ferns')
    await user.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/trackers/t1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'water the ferns', categoryId: 'house', thresholdDays: 7 }),
      }),
    )
  })

  it('confirming archive PATCHes { archived: true } and closes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...editTracker, archivedAt: '2026-08-15T00:00:00.000Z', variants: [] }) })
    vi.stubGlobal('fetch', fetchMock)
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWithClient(<TrackerForm mode="edit" tracker={editTracker} categories={categories} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'archive' }))
    await user.click(screen.getByRole('button', { name: 'archive' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith('/api/trackers/t1', expect.objectContaining({ body: JSON.stringify({ archived: true }) }))
  })
})
