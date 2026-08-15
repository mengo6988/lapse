import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { BootstrapPayload } from '../api'
import * as api from '../api'
import { bootstrapQueryKey, useBootstrapQuery } from './useBootstrap'

const payload: BootstrapPayload = { categories: [], trackers: [] }

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useBootstrapQuery', () => {
  it('fetches the bootstrap payload under a stable query key', async () => {
    vi.spyOn(api, 'fetchBootstrap').mockResolvedValue(payload)
    const queryClient = new QueryClient()

    const { result } = renderHook(() => useBootstrapQuery(), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.data).toEqual(payload))
    expect(queryClient.getQueryData(bootstrapQueryKey)).toEqual(payload)

    vi.restoreAllMocks()
  })
})
