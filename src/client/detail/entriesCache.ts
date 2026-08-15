/**
 * Immutable cache surgery for the entry-history infinite query (mirrors
 * src/client/query/bootstrapCache.ts's approach, scoped to the paginated
 * `useTrackerEntries` cache instead of the bootstrap payload). It stays a
 * separate module on purpose: this is a different query with a different
 * shape, and merging it into the bootstrap cache owner would produce one
 * module with two subjects.
 *
 * An edit or delete updates the already-loaded pages in place here — that's
 * what keeps a deep scroll through history from being force-refetched — while
 * useUpdateEntry/useDeleteEntry separately invalidate the bootstrap query,
 * because a changed Entry's effect on a Tracker/Variant's `latestEntry` is
 * server-authoritative and doesn't belong in this module's guesswork.
 */
import type { InfiniteData } from '@tanstack/react-query'
import type { Entry } from '../api'
import type { HistoryPage } from './entriesApi'

export function replaceEntryInPages(
  data: InfiniteData<HistoryPage> | undefined,
  updated: Entry,
): InfiniteData<HistoryPage> | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      entries: page.entries.map((entry) => (entry.id === updated.id ? updated : entry)),
    })),
  }
}

export function removeEntryFromPages(
  data: InfiniteData<HistoryPage> | undefined,
  entryId: string,
): InfiniteData<HistoryPage> | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      entries: page.entries.filter((entry) => entry.id !== entryId),
    })),
  }
}
