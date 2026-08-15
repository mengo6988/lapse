/**
 * `PATCH /entries/:id` — the entry-edit sheet's save action (docs/spec.md §
 * API; this is the *edit* path for an existing Entry, distinct from ticket
 * 13's log sheet which creates one). Goes through `mutationFetch`
 * (src/client/tracker/mutationClient.ts, imported not edited) for the same
 * friendly field-error parsing the tracker/variant forms already get.
 *
 * The edited Entry may now be — or no longer be — a Tracker/Variant's
 * `latestEntry`; that field is server-authoritative (docs/spec.md § API
 * bootstrap payload), so this invalidates bootstrap rather than trying to
 * recompute "the new latest" client-side.
 */
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import type { Entry } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { jsonRequest, mutationFetch } from '../tracker/mutationClient'
import type { HistoryPage } from './entriesApi'
import { replaceEntryInPages } from './entriesCache'
import { trackerEntriesQueryKey } from './useTrackerEntries'

export interface UpdateEntryInput {
  id: string
  trackerId: string
  occurredAt?: string
  durationMinutes?: number | null
  note?: string | null
}

export function useUpdateEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, trackerId, ...patch }: UpdateEntryInput) =>
      mutationFetch(`/api/entries/${id}`, jsonRequest('PATCH', patch)) as Promise<Entry>,
    onSuccess: (response, variables) => {
      queryClient.setQueryData<InfiniteData<HistoryPage>>(trackerEntriesQueryKey(variables.trackerId), (old) =>
        replaceEntryInPages(old, response),
      )
      queryClient.invalidateQueries({ queryKey: bootstrapQueryKey })
    },
  })
}
