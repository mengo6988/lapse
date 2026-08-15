/**
 * Cursor-paginated Entry history for one Tracker (docs/spec.md § API:
 * "history, cursor-paginated"). A TanStack Query `useInfiniteQuery` over
 * `fetchTrackerEntries` — `nextCursor` from each page becomes the next
 * page's `pageParam` directly, matching the server's own cursor contract.
 */
import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchTrackerEntries } from './entriesApi'

export function trackerEntriesQueryKey(trackerId: string) {
  return ['trackerEntries', trackerId] as const
}

export function useTrackerEntries(trackerId: string) {
  return useInfiniteQuery({
    queryKey: trackerEntriesQueryKey(trackerId),
    queryFn: ({ pageParam }) => fetchTrackerEntries(trackerId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}
