import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HardDeleteDialog } from './HardDeleteDialog'

function renderDialog(props: Partial<ComponentProps<typeof HardDeleteDialog>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onCancel = vi.fn()
  const onDeleted = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <HardDeleteDialog
        trackerId="tracker-1"
        trackerName="ancient chore"
        restoreFocusTo={null}
        onCancel={onCancel}
        onDeleted={onDeleted}
        {...props}
      />
    </QueryClientProvider>,
  )
  return { onCancel, onDeleted }
}

describe('HardDeleteDialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is a labelled modal dialog', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ entries: [], nextCursor: null }) }))
    renderDialog()

    const dialog = screen.getByRole('dialog', { name: 'delete ancient chore' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('shows a loading state, then the exact entry count once fetched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ entries: [{}, {}], nextCursor: null }) }),
    )
    renderDialog()

    expect(screen.getByText('checking entry count…')).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/destroys 2 entries/)).toBeTruthy())
  })

  it('says "no entries" for a Tracker that was never logged', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ entries: [], nextCursor: null }) }))
    renderDialog()

    await waitFor(() => expect(screen.getByText(/destroys no entries/)).toBeTruthy())
  })

  it('cancel is the button that receives focus on open, not the destructive action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ entries: [], nextCursor: null }) }))
    renderDialog()

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'cancel' })))
  })

  it('the delete button is disabled until the count has loaded', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    renderDialog()

    expect(screen.getByRole('button', { name: 'delete forever' }).hasAttribute('disabled')).toBe(true)
  })

  it('cancel calls onCancel without ever calling the delete endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ entries: [], nextCursor: null }) }))
    const user = userEvent.setup()
    const { onCancel } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'cancel' }))

    expect(onCancel).toHaveBeenCalled()
  })

  it('Escape cancels the dialog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ entries: [], nextCursor: null }) }))
    const user = userEvent.setup()
    const { onCancel } = renderDialog()

    await user.keyboard('{Escape}')

    expect(onCancel).toHaveBeenCalled()
  })

  it('confirming after the count loads calls DELETE and then onDeleted', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ entries: [{}], nextCursor: null }) })
      .mockResolvedValueOnce({ ok: true, status: 204, json: vi.fn() })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    const { onDeleted } = renderDialog()

    await waitFor(() => expect(screen.getByRole('button', { name: 'delete forever' }).hasAttribute('disabled')).toBe(false))
    await user.click(screen.getByRole('button', { name: 'delete forever' }))

    await waitFor(() => expect(onDeleted).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenLastCalledWith('/api/trackers/tracker-1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('shows a retry button and an error message when the count fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')))
    renderDialog()

    await waitFor(() => expect(screen.getByText("couldn't check entry count — try again")).toBeTruthy())
    expect(screen.getByRole('button', { name: 'retry' })).toBeTruthy()
  })

  it('shows the server error message when the delete request itself fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ entries: [], nextCursor: null }) })
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'tracker must be archived before it can be deleted' }) })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderDialog()

    await waitFor(() => expect(screen.getByRole('button', { name: 'delete forever' }).hasAttribute('disabled')).toBe(false))
    await user.click(screen.getByRole('button', { name: 'delete forever' }))

    await waitFor(() => expect(screen.getByText('tracker must be archived before it can be deleted')).toBeTruthy())
  })
})
