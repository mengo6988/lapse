/**
 * Immutable cache surgery for the entry-history infinite query (mirrors
 * src/client/tracker/bootstrapCache.ts's approach, scoped to the paginated
 * `useTrackerEntries` cache instead of the bootstrap payload) — an edit or
 * delete updates the already-loaded pages in place rather than forcing a
 * refetch of the whole scrolled-through history.
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
