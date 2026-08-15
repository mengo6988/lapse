/**
 * The flat, newest-first, cursor-paginated Entry history (docs/spec.md §
 * Features 5: "tracker detail screen lists all Entries; each editable ...
 * and deletable"). Loads the next page when the bottom sentinel scrolls
 * into view — see shell/useInfiniteScrollSentinel.test.tsx for why that's
 * built against a fake IntersectionObserver rather than jsdom's
 * (nonexistent) real one.
 */
import type { Entry, Tracker } from '../api'
import { useInfiniteScrollSentinel } from '../shell/useInfiniteScrollSentinel'
import { EntryRow } from './EntryRow'
import { useTrackerEntries } from './useTrackerEntries'

export interface EntryHistoryListProps {
  trackerId: string
  tracker: Tracker
  now: Date
  onOpenEntry: (entry: Entry, openedFrom: HTMLElement) => void
}

// A tracker-level (variantId: null) Entry still appears in history — it
// just never resets any Variant's last-done state (docs/spec.md § Domain
// rules) — so it needs a label distinct from "no Variants at all exist".
function variantLabelFor(entry: Entry, tracker: Tracker): string | null {
  if (tracker.variants.length === 0) return null
  if (entry.variantId === null) return 'no variant'
  return tracker.variants.find((variant) => variant.id === entry.variantId)?.name ?? null
}

export function EntryHistoryList({ trackerId, tracker, now, onOpenEntry }: EntryHistoryListProps) {
  const query = useTrackerEntries(trackerId)
  const canLoadMore = query.hasNextPage === true && !query.isFetchingNextPage
  const sentinelRef = useInfiniteScrollSentinel(() => {
    void query.fetchNextPage()
  }, canLoadMore)

  if (query.status === 'pending') {
    return <p className="detail-loading">loading history…</p>
  }

  if (query.status === 'error') {
    return <p className="detail-not-found">couldn&apos;t load history — try again</p>
  }

  const entries = query.data.pages.flatMap((page) => page.entries)

  if (entries.length === 0) {
    return <p className="detail-empty">no entries yet</p>
  }

  return (
    <>
      <ul className="detail-history">
        {entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} now={now} variantLabel={variantLabelFor(entry, tracker)} onOpen={onOpenEntry} />
        ))}
      </ul>
      {query.isFetchingNextPage && <p className="detail-history__loading-more">loading more…</p>}
      <div ref={sentinelRef} className="detail-history__sentinel" aria-hidden="true" />
    </>
  )
}
