import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AddCategoryForm } from './AddCategoryForm'

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AddCategoryForm />
    </QueryClientProvider>,
  )
}

describe('AddCategoryForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('has a labelled name field, a color field, and a submit button', () => {
    renderForm()

    expect(screen.getByLabelText('new category name')).toBeTruthy()
    expect(screen.getByLabelText('new category color')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'add' })).toBeTruthy()
  })

  it('POSTs the trimmed name and lowercased color on submit, then clears the name', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'x', name: 'health', color: '#b4befe', createdAt: '' }) })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('new category name'), '  health  ')
    await user.click(screen.getByRole('button', { name: 'add' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/categories',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'health', color: '#b4befe' }) }),
      ),
    )
    await waitFor(() => expect((screen.getByLabelText('new category name') as HTMLInputElement).value).toBe(''))
  })

  it('does not submit a blank name', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'add' }))

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the field error from a failed create', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ success: false, error: { issues: [{ path: ['name'], message: 'required' }] } }),
      }),
    )
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('new category name'), 'x')
    await user.click(screen.getByRole('button', { name: 'add' }))

    await waitFor(() => expect(screen.getByText('required')).toBeTruthy())
  })

  it('shows the generic server error when the failure is not attributable to a field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'category already exists' }) }))
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('new category name'), 'health')
    await user.click(screen.getByRole('button', { name: 'add' }))

    await waitFor(() => expect(screen.getByText('category already exists')).toBeTruthy())
  })
})
