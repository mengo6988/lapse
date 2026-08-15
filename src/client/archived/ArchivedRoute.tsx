/**
 * Archived Trackers (build ticket 16; docs/spec.md § Archive; docs/design.md
 * § Archived/Settings): findable, restorable, and — only from here, behind a
 * confirmation naming the cost — permanently deletable. Depth-2, no tab of
 * its own, so it carries its own back affordance (docs/design.md §
 * Navigation) rather than relying on an OS back gesture a standalone PWA
 * doesn't have. Ticket 22 (settings screen) is this route's intended entry
 * point — it should navigate here (e.g. `navigate('/archived')`), since
 * SettingsRoute.tsx is outside this ticket's file fence.
 *
 * Sorted by `archivedAt` descending (most recently archived first): the
 * bootstrap payload carries no other ordering signal for archived Trackers,
 * and "what did I archive recently" is the likelier reason to be here over
 * an old one.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBootstrapQuery } from '../query/useBootstrap'
import './archived.css'
import { ArchivedTrackerRow } from './ArchivedTrackerRow'
import { HardDeleteDialog } from './HardDeleteDialog'
import { BackIcon } from './icons'

const EMPTY_MESSAGE = 'nothing archived'

interface DeleteRequest {
  trackerId: string
  trackerName: string
  openedFrom: HTMLElement | null
}

export function ArchivedRoute() {
  const navigate = useNavigate()
  const { data } = useBootstrapQuery()
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null)

  const now = new Date()
  const archivedTrackers = (data?.trackers ?? [])
    .filter((tracker) => tracker.archivedAt !== null)
    .slice()
    .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''))

  function goBack() {
    navigate('/settings')
  }

  return (
    <section aria-label="archived" className="archived-route">
      <div className="archived-route__header">
        <button type="button" className="icon-button" aria-label="back" onClick={goBack}>
          <BackIcon />
        </button>
        <h1 className="archived-route__title">archived</h1>
      </div>

      {archivedTrackers.length === 0 ? (
        <p className="archived-route__empty">{EMPTY_MESSAGE}</p>
      ) : (
        <ul className="archived-route__rows">
          {archivedTrackers.map((tracker) => (
            <ArchivedTrackerRow
              key={tracker.id}
              tracker={tracker}
              now={now}
              onRequestDelete={(openedFrom) =>
                setDeleteRequest({ trackerId: tracker.id, trackerName: tracker.name, openedFrom })
              }
            />
          ))}
        </ul>
      )}

      {deleteRequest && (
        <HardDeleteDialog
          trackerId={deleteRequest.trackerId}
          trackerName={deleteRequest.trackerName}
          restoreFocusTo={deleteRequest.openedFrom}
          onCancel={() => setDeleteRequest(null)}
          onDeleted={() => setDeleteRequest(null)}
        />
      )}
    </section>
  )
}
