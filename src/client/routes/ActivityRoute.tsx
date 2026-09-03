/**
 * Recent Entries feed across every Tracker (docs/design.md § Navigation:
 * "activity = recent Entries feed"; build ticket 21). A root tab — no back
 * affordance, no in-page title, matching HomeRoute/ListRoute's stance of
 * relying on the tab bar for current-section context rather than repeating
 * it here.
 *
 * Sourced from `GET /api/entries` (src/server/routes/entries.ts), a dumb
 * cross-Tracker cursor-paginated row list per ADR-0001 — Tracker/Variant
 * names are resolved client-side from the bootstrap cache
 * (src/client/activity/activityRows.ts), never sent by the server. Archived
 * Trackers are filtered out server-side (build ticket 21 decision), so
 * every row reaching buildActivityRows already belongs to a live Tracker.
 *
 * Tapping an Entry navigates to `/tracker/:trackerId` — that route already
 * renders the entry history with its edit/delete sheet (build ticket 15) —
 * rather than opening a second edit surface here.
 *
 * loading/failed/empty (.scratch/audit-fixes/spec.md decision 5): buildActivityRows drops
 * every Entry whose Tracker isn't in the bootstrap payload, so this screen
 * needs both queries settled with data before it can tell "nothing logged
 * yet" apart from "the entries page beat bootstrap to the finish line". Two
 * gates in sequence handle that: the entries query gates first (nothing to
 * build rows from without it), then bootstrap gates before rows are built.
 * Either gate reuses the same loading/failed copy, since the user can't
 * tell which request is the slow one and doesn't need to.
 */
import { useNavigate } from 'react-router-dom'
import type { ActivityRow } from '../activity/activityRows'
import { buildActivityRows } from '../activity/activityRows'
import '../activity/activity.css'
import { ActivityDaySection } from '../activity/ActivityDaySection'
import { groupActivityRowsByDay } from '../activity/dayBuckets'
import { useActivityEntries } from '../activity/useActivityEntries'
import { useBootstrapQuery } from '../query/useBootstrap'
import { useInfiniteScrollSentinel } from '../shell/useInfiniteScrollSentinel'

const EMPTY_MESSAGE = 'nothing logged yet'
const ERROR_MESSAGE = "couldn't load activity — try again"

export function ActivityRoute() {
  const navigate = useNavigate()
  const { data: bootstrap, status: bootstrapStatus } = useBootstrapQuery()
  const entriesQuery = useActivityEntries()

  const canLoadMore = entriesQuery.hasNextPage === true && !entriesQuery.isFetchingNextPage
  const sentinelRef = useInfiniteScrollSentinel(() => {
    void entriesQuery.fetchNextPage()
  }, canLoadMore)

  function handleOpenEntry(row: ActivityRow) {
    navigate(`/tracker/${row.trackerId}`)
  }

  const now = new Date()

  if (!entriesQuery.data) {
    return (
      <section aria-label="activity" className="activity-route">
        {entriesQuery.status === 'pending' && <p className="activity-route__loading">loading…</p>}
        {entriesQuery.status === 'error' && <p className="activity-route__error">{ERROR_MESSAGE}</p>}
      </section>
    )
  }

  if (!bootstrap) {
    return (
      <section aria-label="activity" className="activity-route">
        {bootstrapStatus === 'pending' && <p className="activity-route__loading">loading…</p>}
        {bootstrapStatus === 'error' && <p className="activity-route__error">{ERROR_MESSAGE}</p>}
      </section>
    )
  }

  const loadedEntries = entriesQuery.data.pages.flatMap((page) => page.entries)
  const rows = buildActivityRows(loadedEntries, bootstrap.trackers)
  const sections = groupActivityRowsByDay(rows, now)

  return (
    <section aria-label="activity" className="activity-route">
      {sections.length === 0 && <p className="activity-route__empty">{EMPTY_MESSAGE}</p>}

      {sections.length > 0 && (
        <>
          {sections.map((section) => (
            <ActivityDaySection key={section.dayKey} section={section} onOpenEntry={handleOpenEntry} />
          ))}
          {entriesQuery.isFetchingNextPage && <p className="activity-route__loading-more">loading more…</p>}
          <div ref={sentinelRef} className="activity-route__sentinel" aria-hidden="true" />
        </>
      )}
    </section>
  )
}
