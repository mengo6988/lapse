/**
 * The QueryClient used by AppQueryProvider. `gcTime` must be at least as
 * long as the persister's `maxAge` (createAsyncStoragePersister defaults to
 * 24h) — otherwise a query could be garbage-collected from memory before
 * the throttled write to IndexedDB ever runs, silently losing the offline
 * cache. `staleTime` avoids an instant refetch on every mount; the bootstrap
 * fetch is still the source of truth on each launch.
 */
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api'

export const QUERY_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 // 24h, matches persister default maxAge

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: QUERY_CACHE_MAX_AGE_MS,
        staleTime: 1000 * 60, // 1 minute
        // A 401 means the session is gone, not that the request is flaky —
        // retrying it just delays routing to login. Anything else gets one retry.
        retry: (failureCount, error) => !(error instanceof ApiError && error.status === 401) && failureCount < 1,
      },
    },
  })
}
