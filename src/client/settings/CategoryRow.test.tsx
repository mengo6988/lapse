import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Category } from '../api'
import { CategoryRow } from './CategoryRow'

const category: Category = { id: 'house', name: 'house', color: '#a6e3a1', createdAt: '2026-01-01T00:00:00.000Z' }

function renderRow(onRequestDelete = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ul>
        <CategoryRow category={category} onRequestDelete={onRequestDelete} />
      </ul>
    </QueryClientProvider>,
  )
  return { onRequestDelete }
}

describe('CategoryRow', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the category name and a color swatch', () => {
    renderRow()

    expect(screen.getByDisplayValue('house')).toBeTruthy()
    const swatch = screen.getByLabelText('house color') as HTMLInputElement
    expect(swatch.type).toBe('color')
    expect(swatch.value).toBe('#a6e3a1')
  })

  it('renames on blur when the name changed, PATCHing the category', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...category, name: 'home' }) })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderRow()

    const nameInput = screen.getByDisplayValue('house')
    await user.clear(nameInput)
    await user.type(nameInput, 'home')
    await user.tab()

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/categories/house',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'home' }) }),
      ),
    )
  })

  it('does not send a PATCH when the name is unchanged on blur', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderRow()

    await user.click(screen.getByDisplayValue('house'))
    await user.tab()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reverts to the persisted name when blurred empty rather than sending a blank rename', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderRow()

    const nameInput = screen.getByDisplayValue('house')
    await user.clear(nameInput)
    await user.tab()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('house')).toBeTruthy()
  })

  it('recolors immediately when the color input changes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...category, color: '#ffffff' }) })
    vi.stubGlobal('fetch', fetchMock)
    renderRow()

    const swatch = screen.getByLabelText('house color') as HTMLInputElement
    // jsdom color inputs accept fireEvent.change with a hex value.
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(swatch, { target: { value: '#ffffff' } })

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/categories/house',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ color: '#ffffff' }) }),
      ),
    )
  })

  // A native colour picker fires `input` continuously while the user drags
  // through the gradient and `change` only once the pick is confirmed. React
  // routes both to onChange, so committing on every one of them would PATCH
  // once per pointer move.
  it('does not PATCH while the colour is still being dragged through', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderRow()

    const swatch = screen.getByLabelText('house color') as HTMLInputElement
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.input(swatch, { target: { value: '#111111' } })
    fireEvent.input(swatch, { target: { value: '#222222' } })
    fireEvent.input(swatch, { target: { value: '#333333' } })

    expect(fetchMock).not.toHaveBeenCalled()
    // the swatch still tracks the drag, so the user sees what they're picking.
    expect(swatch.value).toBe('#333333')
  })

  it('sends exactly one PATCH for a drag that ends in a confirmed pick', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...category, color: '#333333' }) })
    vi.stubGlobal('fetch', fetchMock)
    renderRow()

    const swatch = screen.getByLabelText('house color') as HTMLInputElement
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.input(swatch, { target: { value: '#111111' } })
    fireEvent.input(swatch, { target: { value: '#222222' } })
    fireEvent.change(swatch, { target: { value: '#333333' } })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/categories/house',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ color: '#333333' }) }),
    )
  })

  it('does not PATCH when the confirmed colour is the one it already had', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderRow()

    const swatch = screen.getByLabelText('house color') as HTMLInputElement
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(swatch, { target: { value: '#a6e3a1' } })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('calls onRequestDelete with the clicked button when delete is pressed', async () => {
    const user = userEvent.setup()
    const { onRequestDelete } = renderRow()

    await user.click(screen.getByRole('button', { name: 'delete house' }))

    expect(onRequestDelete).toHaveBeenCalledWith(expect.any(HTMLButtonElement))
  })

  it('shows the field error message from a failed rename', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ success: false, error: { issues: [{ path: ['name'], message: 'too long' }] } }),
      }),
    )
    const user = userEvent.setup()
    renderRow()

    const nameInput = screen.getByDisplayValue('house')
    await user.clear(nameInput)
    await user.type(nameInput, 'a much longer name')
    await user.tab()

    await waitFor(() => expect(screen.getByText('too long')).toBeTruthy())
  })

  it('shows the generic server error when a rename failure is not attributable to a field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'category not found' }) }))
    const user = userEvent.setup()
    renderRow()

    const nameInput = screen.getByDisplayValue('house')
    await user.clear(nameInput)
    await user.type(nameInput, 'home')
    await user.tab()

    await waitFor(() => expect(screen.getByText('category not found')).toBeTruthy())
  })
})
