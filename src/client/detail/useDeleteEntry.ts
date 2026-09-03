/**
 * `DELETE /entries/:id` — the entry-edit sheet's (confirmed) delete action.
 *
 * Goes through the offline outbox (src/client/outbox/entryOutbox.ts's
 * `deleteEntry`, the same function src/client/log/useLogRow.ts's undo calls)
 * instead of the fail-fast generic write interface
 * (src/client/query/useBootstrapWrite.ts) it used before (audit-fixes
 * decision 2, .scratch/audit-fixes/spec.md): a delete confirmed from the
 * edit sheet is exactly as offline-durable as undoing a log, so it queues
 * and survives a dropped connection instead of failing with a toast. The
 * outbox owns everything from here — create-ahead-of-delete ordering, a
 * still-pending create for the same id dropping instead of queueing both, a
 * 4xx dead-lettering — none of that changes for this caller.
 *
 * The two cache updates below happen *before* the send is even kicked off,
 * since a queued send may not complete for hours:
 *  - the already-loaded entry-history page(s) drop the Entry in place, the
 *    same immediate local edit src/client/detail/entriesCache.ts's other
 *    caller (useUpdateEntry) makes, so a deep scroll through history isn't
 *    force-refetched;
 *  - bootstrap is marked stale rather than grafted, because a deleted
 *    Entry may have been a Tracker/Variant's `latestEntry`, and that field
 *    is server-authoritative — invalidating it lets the next bootstrap
 *    fetch supply the real one instead of this hook guessing.
 *
 * Sending itself is fire-and-forget, mirroring useLogRow's undo path: the
 * outbox durably records the write (synchronously, via outboxStore's
 * `commit`) before this mutation's own promise resolves, so by the time the
 * caller sees success the delete is queued even if the network attempt is
 * still in flight or backing off. That's what lets the edit sheet close
 * immediately instead of waiting on the response.
 */
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { deleteEntry } from '../outbox/entryOutbox'
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
    mutationFn: async ({ id, trackerId }: DeleteEntryInput) => {
      queryClient.setQueryData<InfiniteData<HistoryPage>>(trackerEntriesQueryKey(trackerId), (pages) =>
        removeEntryFromPages(pages, id),
      )
      void queryClient.invalidateQueries({ queryKey: bootstrapQueryKey })

      // `deleteEntry` queues every ordinary failure and rethrows only two
      // things (src/client/outbox/entryOutbox.ts): a 401, and a storage
      // failure that already discarded the record. Either way no delete is
      // queued anywhere, while the history pages above are already rendering
      // as though one were — so drop that edit and let the server say what
      // history actually holds. No toast: on the 401 the login screen is
      // swapping in over the top of it anyway, the same reason
      // src/client/log/useLogRow.ts's own failure messages are unreachable.
      void deleteEntry(id).catch(() => {
        void queryClient.invalidateQueries({ queryKey: trackerEntriesQueryKey(trackerId) })
      })
    },
  })
}
