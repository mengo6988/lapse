/**
 * Cursor-paginated cross-Tracker Entry feed (docs/spec.md § API; build
 * ticket 21). A TanStack Query `useInfiniteQuery` over
 * `fetchActivityEntries` — `nextCursor` from each page becomes the next
 * page's `pageParam` directly, matching the server's own cursor contract
 * (src/client/detail/useTrackerEntries.ts does the same thing for one
 * Tracker's history). The query key is a single fixed tuple, not scoped by
 * trackerId — this feed spans every Tracker, not one.
 */
import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchActivityEntries } from './entriesApi'

export const activityEntriesQueryKey = ['activityEntries'] as const

export function useActivityEntries() {
  return useInfiniteQuery({
    queryKey: activityEntriesQueryKey,
    queryFn: ({ pageParam }) => fetchActivityEntries(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}
