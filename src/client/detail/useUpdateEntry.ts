/**
 * `PATCH /entries/:id` — the entry-edit sheet's save action (docs/spec.md §
 * API; this is the *edit* path for an existing Entry, distinct from the log
 * sheet which creates one). Sends through the shared write interface
 * (src/client/query/useBootstrapWrite.ts), so error handling — per-field
 * messages parsed from a 400 body, 401/offline collapsing to one message —
 * comes from there.
 *
 * The edited Entry may now be — or no longer be — a Tracker/Variant's
 * `latestEntry`; that field is server-authoritative (docs/spec.md § API
 * bootstrap payload), so the success kind is `invalidate` rather than a
 * graft: bootstrap is marked stale and refetched instead of the client
 * guessing the new latest.
 *
 * The already-loaded entry-history page(s) are a different query with a
 * different shape, untouched by an invalidated bootstrap, so `alsoUpdate`
 * swaps the edited Entry into them in place — a deep scroll through the
 * history survives the edit rather than refetching.
 */
import type { InfiniteData } from '@tanstack/react-query'
import type { Entry } from '../api'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { useBootstrapWrite } from '../query/useBootstrapWrite'
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
  return useBootstrapWrite<UpdateEntryInput, Entry, InfiniteData<HistoryPage>>({
    route: (input) => `/api/entries/${input.id}`,
    method: 'PATCH',
    body: ({ id, trackerId, ...patch }) => patch,
    onSuccess: { kind: 'invalidate', queryKey: bootstrapQueryKey },
    alsoUpdate: {
      queryKey: (input) => trackerEntriesQueryKey(input.trackerId),
      update: (pages, entry) => replaceEntryInPages(pages, entry),
    },
  })
}
