import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EXIT_DURATION_MS, useExitTransition } from '../shell/useExitTransition'
import { CategoryDeleteDialog } from './CategoryDeleteDialog'

function renderDialog(props: Partial<ComponentProps<typeof CategoryDeleteDialog>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onCancel = vi.fn()
  const onDeleted = vi.fn()
  const result = render(
    <QueryClientProvider client={queryClient}>
      <CategoryDeleteDialog
        categoryId="house"
        categoryName="house"
        restoreFocusTo={null}
        onCancel={onCancel}
        onDeleted={onDeleted}
        {...props}
      />
    </QueryClientProvider>,
  )
  return { ...result, onCancel, onDeleted }
}

describe('CategoryDeleteDialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is a labelled modal dialog whose copy says Trackers survive uncategorised, not destroyed', () => {
    renderDialog()

    const dialog = screen.getByRole('dialog', { name: 'delete house' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByText(/uncategorised/)).toBeTruthy()
  })

  it('portals to document.body rather than rendering as a descendant of its caller', () => {
    const { container } = renderDialog()

    // portaled to document.body (see CategoryDeleteDialog.tsx), not a
    // descendant of RTL's own container.
    expect(container.querySelector('.confirm-dialog')).toBeNull()
    expect(document.querySelector('.confirm-dialog')).toBeTruthy()
  })

  it('marks #app-root inert for as long as the dialog is mounted', () => {
    const appRoot = document.createElement('div')
    appRoot.id = 'app-root'
    document.body.appendChild(appRoot)
    const { unmount } = renderDialog()

    expect(appRoot.hasAttribute('inert')).toBe(true)

    unmount()
    expect(appRoot.hasAttribute('inert')).toBe(false)

    appRoot.remove()
  })

  it('cancel is the button that receives focus on open, not the destructive action', async () => {
    renderDialog()

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'cancel' })))
  })

  it('cancel calls onCancel without ever calling the delete endpoint', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    const { onCancel } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'cancel' }))

    expect(onCancel).toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Escape cancels the dialog', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderDialog()

    await user.keyboard('{Escape}')

    expect(onCancel).toHaveBeenCalled()
  })

  it('stays mounted through the cancel exit fade, then unmounts once it completes', async () => {
    // mirrors how CategoriesManager.tsx wires this dialog in production:
    // the request clears instantly on cancel, and useExitTransition latches
    // the dialog mounted (with `closing`) through its fade — see
    // src/client/shell/useExitTransition.ts.
    function Harness() {
      const [open, setOpen] = useState(true)
      const { value, closing } = useExitTransition(open ? true : null)
      if (!value) return null
      return (
        <CategoryDeleteDialog
          categoryId="house"
          categoryName="house"
          restoreFocusTo={null}
          onCancel={() => setOpen(false)}
          onDeleted={() => setOpen(false)}
          closing={closing}
        />
      )
    }
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

  it('confirming calls DELETE and then onDeleted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'house' }) }))
    const user = userEvent.setup()
    const { onDeleted } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'delete' }))

    await waitFor(() => expect(onDeleted).toHaveBeenCalled())
  })

  it('shows the server error message when the delete request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'category not found' }) }))
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'delete' }))

    await waitFor(() => expect(screen.getByText('category not found')).toBeTruthy())
  })
})
