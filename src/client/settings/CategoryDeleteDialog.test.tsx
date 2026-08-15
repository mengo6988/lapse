import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CategoryDeleteDialog } from './CategoryDeleteDialog'

function renderDialog(props: Partial<ComponentProps<typeof CategoryDeleteDialog>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onCancel = vi.fn()
  const onDeleted = vi.fn()
  render(
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
  return { onCancel, onDeleted }
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
