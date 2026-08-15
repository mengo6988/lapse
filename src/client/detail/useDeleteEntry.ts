/**
 * `DELETE /entries/:id` — the entry-edit sheet's (confirmed) delete action.
 * Response is empty (204), so the cache update needs the trackerId the
 * caller already had rather than anything read off the response — same
 * shape as src/client/tracker/useRemoveVariant.ts's soft-delete cache
 * surgery. Also invalidates bootstrap: a deleted Entry may have been a
 * Tracker/Variant's `latestEntry`, and that field is server-authoritative.
 */
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { mutationFetch } from '../tracker/mutationClient'
import type { HistoryPage } from './entriesApi'
import { removeEntryFromPages } from './entriesCache'
import { trackerEntriesQueryKey } from './useTrackerEntries'

export interface DeleteEntryInput {
  id: string
  trackerId: string
}

export function useDeleteEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: DeleteEntryInput) => mutationFetch(`/api/entries/${id}`, { method: 'DELETE' }),
    onSuccess: (_response, variables) => {
      queryClient.setQueryData<InfiniteData<HistoryPage>>(trackerEntriesQueryKey(variables.trackerId), (old) =>
        removeEntryFromPages(old, variables.id),
      )
      queryClient.invalidateQueries({ queryKey: bootstrapQueryKey })
    },
  })
}
