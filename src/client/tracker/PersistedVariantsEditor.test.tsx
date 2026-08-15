import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PersistedVariantsEditor } from './PersistedVariantsEditor'

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient()
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('PersistedVariantsEditor', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders one row per existing variant plus an add-variant control', () => {
    renderWithClient(
      <PersistedVariantsEditor
        trackerId="t1"
        variants={[
          { id: 'v1', name: 'front', thresholdDays: null },
          { id: 'v2', name: 'rear', thresholdDays: 30 },
        ]}
      />,
    )

    expect(screen.getAllByLabelText('variant name')).toHaveLength(2)
    expect(screen.getByLabelText('new variant')).toBeTruthy()
  })

  it('PATCHes a rename on blur', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'v1', trackerId: 't1', name: 'renamed', thresholdDays: null, deletedAt: null, createdAt: '' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderWithClient(<PersistedVariantsEditor trackerId="t1" variants={[{ id: 'v1', name: 'front', thresholdDays: null }]} />)

    const input = screen.getByLabelText('variant name')
    await user.clear(input)
    await user.type(input, 'renamed')
    await user.tab()

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/variants/v1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'renamed' }) }),
      ),
    )
  })

  it('shows the server field error next to the row on a failed rename', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ success: false, error: { issues: [{ path: ['name'], message: 'too long' }] } }),
      }),
    )
    const user = userEvent.setup()
    renderWithClient(<PersistedVariantsEditor trackerId="t1" variants={[{ id: 'v1', name: 'front', thresholdDays: null }]} />)

    const input = screen.getByLabelText('variant name')
    await user.clear(input)
    await user.type(input, 'x'.repeat(101))
    await user.tab()

    expect(await screen.findByText('too long')).toBeTruthy()
  })

  it('DELETEs on remove', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: vi.fn() })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderWithClient(<PersistedVariantsEditor trackerId="t1" variants={[{ id: 'v1', name: 'front', thresholdDays: null }]} />)

    await user.click(screen.getByRole('button', { name: 'remove front' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/variants/v1', expect.objectContaining({ method: 'DELETE' })))
  })

  it('adds a new variant by typing a name and clicking add', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'v2', trackerId: 't1', name: 'rear', thresholdDays: null, deletedAt: null, createdAt: '' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderWithClient(<PersistedVariantsEditor trackerId="t1" variants={[]} />)

    await user.type(screen.getByLabelText('new variant'), 'rear')
    await user.click(screen.getByRole('button', { name: 'add variant' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/trackers/t1/variants',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'rear' }) }),
      ),
    )
  })

  it('does not add an empty variant', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderWithClient(<PersistedVariantsEditor trackerId="t1" variants={[]} />)

    await user.click(screen.getByRole('button', { name: 'add variant' }))

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
