import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Entry } from '../api'
import { EntryEditSheet } from './EntryEditSheet'

const entry: Entry = {
  id: 'e1',
  trackerId: 't1',
  variantId: null,
  occurredAt: new Date(2026, 7, 15, 9, 5, 0).toISOString(),
  durationMinutes: 30,
  note: 'felt good',
  createdAt: '',
}

function renderSheet(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <EntryEditSheet entry={entry} trackerId="t1" onClose={onClose} />
    </QueryClientProvider>,
  )
  return { ...utils, onClose, queryClient }
}

describe('EntryEditSheet', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders as a labelled dialog, pre-filled from the given Entry', () => {
    renderSheet()
    expect(screen.getByRole('dialog', { name: 'edit entry' })).toBeTruthy()
    expect((screen.getByLabelText('duration (minutes)') as HTMLInputElement).value).toBe('30')
    expect((screen.getByLabelText('note') as HTMLTextAreaElement).value).toBe('felt good')
    expect((screen.getByLabelText('time') as HTMLInputElement).value).toBe('2026-08-15T09:05')
  })

  it('saving PATCHes the edited fields and closes on success', async () => {
    const updated = { ...entry, note: 'updated note' }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => updated })
    vi.stubGlobal('fetch', fetchMock)
    const { onClose } = renderSheet()
    const user = userEvent.setup()

    await user.clear(screen.getByLabelText('note'))
    await user.type(screen.getByLabelText('note'), 'updated note')
    await user.click(screen.getByRole('button', { name: 'save' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/entries/e1',
      expect.objectContaining({ method: 'PATCH' }),
    )
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toMatchObject({ note: 'updated note', durationMinutes: 30 })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows a field error and does not close when the server rejects the save', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: { issues: [{ path: ['note'], message: 'too long' }] } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { onClose } = renderSheet()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'save' }))

    expect(await screen.findByText('too long')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('delete requires a two-step confirm, then closes without waiting on the network (audit-fixes decision 2: delete goes through the outbox, same as undo)', async () => {
    // a fetch that never settles: the sheet has to close on the strength of
    // the cache update and the queued write alone, same as it would offline.
    // Asserting a DELETE was sent belongs to useDeleteEntry.test.tsx and
    // entryOutbox.test.ts now — this is the sheet-level regression for "the
    // success path no longer waits on the network."
    const fetchMock = vi.fn(() => new Promise(() => {}))
    vi.stubGlobal('fetch', fetchMock)
    const { onClose } = renderSheet()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'delete entry' }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText(/delete this entry/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'delete' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('cancelling the delete confirm leaves the Entry untouched', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderSheet()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'delete entry' }))
    await user.click(screen.getByRole('button', { name: 'cancel' }))

    expect(screen.queryByText(/delete this entry/)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Escape closes the sheet', async () => {
    const { onClose } = renderSheet()
    const user = userEvent.setup()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('clicking the scrim closes the sheet', async () => {
    const { onClose } = renderSheet()
    const user = userEvent.setup()
    // portaled to document.body (see EntryEditSheet.tsx), not a descendant
    // of RTL's own container.
    await user.click(document.querySelector('.tracker-sheet-scrim')!)
    expect(onClose).toHaveBeenCalled()
  })

  it('marks #app-root inert for as long as the sheet is mounted', () => {
    const appRoot = document.createElement('div')
    appRoot.id = 'app-root'
    document.body.appendChild(appRoot)
    const { unmount } = renderSheet()

    expect(appRoot.hasAttribute('inert')).toBe(true)

    unmount()
    expect(appRoot.hasAttribute('inert')).toBe(false)

    appRoot.remove()
  })
})
