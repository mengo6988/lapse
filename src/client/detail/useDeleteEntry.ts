/**
 * `DELETE /entries/:id` — the entry-edit sheet's (confirmed) delete action.
 * Sends through the shared write interface
 * (src/client/query/useBootstrapWrite.ts). The response is empty (204), so
 * the history-cache update reads the Entry and Tracker ids off the input
 * rather than off anything the server sent back.
 *
 * A deleted Entry may have been a Tracker/Variant's `latestEntry`, and that
 * field is server-authoritative — so the success kind is `invalidate` rather
 * than a graft, marking bootstrap stale instead of guessing the new latest
 * client-side.
 *
 * The already-loaded entry-history page(s) are a different query with a
 * different shape, untouched by an invalidated bootstrap, so `alsoUpdate`
 * removes the deleted Entry from them in place — a deep scroll through the
 * history survives the delete rather than refetching.
 */
import type { InfiniteData } from '@tanstack/react-query'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { useBootstrapWrite } from '../query/useBootstrapWrite'
import type { HistoryPage } from './entriesApi'
import { removeEntryFromPages } from './entriesCache'
import { trackerEntriesQueryKey } from './useTrackerEntries'

export interface DeleteEntryInput {
  id: string
  trackerId: string
}

export function useDeleteEntry() {
  return useBootstrapWrite<DeleteEntryInput, unknown, InfiniteData<HistoryPage>>({
    route: (input) => `/api/entries/${input.id}`,
    method: 'DELETE',
    onSuccess: { kind: 'invalidate', queryKey: bootstrapQueryKey },
    alsoUpdate: {
      queryKey: (input) => trackerEntriesQueryKey(input.trackerId),
      update: (pages, _response, input) => removeEntryFromPages(pages, input.id),
    },
  })
}
