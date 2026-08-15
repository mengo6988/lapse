import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as entryCountModule from './entryCount'
import { useEntryCountQuery } from './useEntryCount'

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useEntryCountQuery', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not fetch while disabled', () => {
    const spy = vi.spyOn(entryCountModule, 'fetchEntryCount')
    const queryClient = new QueryClient()

    renderHook(() => useEntryCountQuery('tracker-1', false), { wrapper: wrapper(queryClient) })

    expect(spy).not.toHaveBeenCalled()
  })

  it('fetches the count once enabled', async () => {
    vi.spyOn(entryCountModule, 'fetchEntryCount').mockResolvedValue(12)
    const queryClient = new QueryClient()

    const { result } = renderHook(() => useEntryCountQuery('tracker-1', true), {
      wrapper: wrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(12)
  })

  it('surfaces a fetch failure so the dialog can show a retry', async () => {
    vi.spyOn(entryCountModule, 'fetchEntryCount').mockRejectedValue(new Error('network down'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    const { result } = renderHook(() => useEntryCountQuery('tracker-1', true), {
      wrapper: wrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
