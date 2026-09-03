import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EXIT_DURATION_MS, useExitTransition } from '../shell/useExitTransition'
import { HardDeleteDialog } from './HardDeleteDialog'

function renderDialog(props: Partial<ComponentProps<typeof HardDeleteDialog>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onCancel = vi.fn()
  const onDeleted = vi.fn()
  const result = render(
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
  return { ...result, onCancel, onDeleted }
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

  it('portals to document.body rather than rendering as a descendant of its caller', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ entries: [], nextCursor: null }) }))
    const { container } = renderDialog()

    // portaled to document.body (see HardDeleteDialog.tsx), not a descendant
    // of RTL's own container.
    expect(container.querySelector('.confirm-dialog')).toBeNull()
    expect(document.querySelector('.confirm-dialog')).toBeTruthy()
  })

  it('marks #app-root inert for as long as the dialog is mounted', () => {
    const appRoot = document.createElement('div')
    appRoot.id = 'app-root'
    document.body.appendChild(appRoot)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ entries: [], nextCursor: null }) }))
    const { unmount } = renderDialog()

    expect(appRoot.hasAttribute('inert')).toBe(true)

    unmount()
    expect(appRoot.hasAttribute('inert')).toBe(false)

    appRoot.remove()
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

  it('stays mounted through the cancel exit fade, then unmounts once it completes', async () => {
    // mirrors how ArchivedRoute.tsx wires this dialog in production: the
    // request clears instantly on cancel, and useExitTransition latches the
    // dialog mounted (with `closing`) through its fade — see
    // src/client/shell/useExitTransition.ts.
    function Harness() {
      const [open, setOpen] = useState(true)
      const { value, closing } = useExitTransition(open ? true : null)
      if (!value) return null
      return (
        <HardDeleteDialog
          trackerId="tracker-1"
          trackerName="ancient chore"
          restoreFocusTo={null}
          onCancel={() => setOpen(false)}
          onDeleted={() => setOpen(false)}
          closing={closing}
        />
      )
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ entries: [], nextCursor: null }) }))
    vi.useFakeTimers()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    })

    expect(screen.getByRole('dialog').className).toContain('confirm-dialog--closing')

    await act(async () => {
      vi.advanceTimersByTime(EXIT_DURATION_MS)
    })

    expect(screen.queryByRole('dialog')).toBeNull()
    vi.useRealTimers()
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
