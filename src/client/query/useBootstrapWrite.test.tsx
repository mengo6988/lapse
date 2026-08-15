import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import { session } from '../auth/session'
import { bootstrapQueryKey } from './useBootstrap'
import { useBootstrapWrite, type WriteSpec } from './useBootstrapWrite'

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const emptyPayload: BootstrapPayload = { categories: [], trackers: [] }

interface WidgetInput {
  id: string
  name: string
}

interface WidgetResponse {
  id: string
  name: string
}

/** a spec with no observable effect, for the failure-path tests where onSuccess never runs. */
const noopSpec: WriteSpec<WidgetInput, WidgetResponse> = {
  route: '/api/widgets',
  method: 'POST',
  onSuccess: { kind: 'graft', graft: (payload) => payload },
}

describe('useBootstrapWrite', () => {
  beforeEach(() => {
    session.reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the request to a route resolved from the input, then grafts the response into the bootstrap cache', async () => {
    const created: WidgetResponse = { id: 'c1', name: 'house' }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => created })
    vi.stubGlobal('fetch', fetchMock)

    const spec: WriteSpec<WidgetInput, WidgetResponse> = {
      route: (input) => `/api/widgets/${input.id}`,
      method: 'POST',
      body: ({ id, ...rest }) => rest,
      onSuccess: {
        kind: 'graft',
        graft: (payload, response) => ({
          ...payload,
          categories: [...payload.categories, { id: response.id, name: response.name, color: '#000', createdAt: '' }],
        }),
      },
    }

    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, emptyPayload)
    const { result } = renderHook(() => useBootstrapWrite(spec), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ id: 'c1', name: 'house' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/widgets/c1',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'house' }) }),
    )
    expect(queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)?.categories).toEqual([
      { id: 'c1', name: 'house', color: '#000', createdAt: '' },
    ])
  })

  it('invalidates the given query instead of grafting when the spec asks to invalidate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'e1', name: 'x' } as WidgetResponse) }))

    const spec: WriteSpec<WidgetInput, WidgetResponse> = {
      route: (input) => `/api/widgets/${input.id}`,
      method: 'PATCH',
      onSuccess: { kind: 'invalidate', queryKey: bootstrapQueryKey },
    }

    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, emptyPayload)
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useBootstrapWrite(spec), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ id: 'e1', name: 'x' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bootstrapQueryKey })
    // no graft ran: the cached payload itself is untouched, only marked stale.
    expect(queryClient.getQueryData<BootstrapPayload>(bootstrapQueryKey)).toEqual(emptyPayload)
  })

  it('rejects with per-field messages on a 400 and leaves the cache untouched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ success: false, error: { issues: [{ path: ['name'], message: 'required' }] } }),
      }),
    )

    const queryClient = new QueryClient()
    queryClient.setQueryData(bootstrapQueryKey, emptyPayload)
    const { result } = renderHook(() => useBootstrapWrite(noopSpec), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ id: 'c1', name: '' }))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ status: 400, fieldErrors: { name: 'required' } })
    expect(queryClient.getQueryData(bootstrapQueryKey)).toEqual(emptyPayload)
  })

  it('collapses a 401 to the single "couldn\'t save" failure message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: vi.fn() }))

    const queryClient = new QueryClient()
    const { result } = renderHook(() => useBootstrapWrite(noopSpec), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ id: 'c1', name: 'house' }))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ status: 401, message: "couldn't save — try again" })
    expect(session.read()).toBe('unauthorized')
  })

  it('collapses an unreachable server to the same single failure message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const queryClient = new QueryClient()
    const { result } = renderHook(() => useBootstrapWrite(noopSpec), { wrapper: wrapper(queryClient) })

    act(() => result.current.mutate({ id: 'c1', name: 'house' }))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ status: null, message: "couldn't save — try again" })
  })
})
