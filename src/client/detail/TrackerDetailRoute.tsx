/**
 * `/tracker/:trackerId` (already registered in src/client/shell/AppShell.tsx
 * — this file replaces the ticket 15 placeholder). Resolves the route param
 * against the already-hydrated bootstrap cache (the same source home/list
 * read from) rather than a separate per-tracker fetch — a Tracker's own
 * fields never need a dedicated request, only its Entry history does
 * (useTrackerEntries).
 */
import { useNavigate, useParams } from 'react-router-dom'
import { useBootstrapQuery } from '../query/useBootstrap'
import './detail.css'
import { TrackerDetailScreen } from './TrackerDetailScreen'

// Mirrors TrackerDetailScreen's local BackIcon (not exported from there, and
// this ticket's fence doesn't cover changing that file) — matches this
// codebase's convention of a small per-directory icon (src/client/archived/icons.tsx,
// src/client/shell/icons.tsx) over a shared import.
function BackIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true">
      <polyline points="14 5 7 12 14 19" />
    </svg>
  )
}

export function TrackerDetailRoute() {
  const { trackerId } = useParams<{ trackerId: string }>()
  const navigate = useNavigate()
  const { data, isPending } = useBootstrapQuery()

  if (isPending) {
    return <p className="detail-loading">loading…</p>
  }

  const tracker = data?.trackers.find((t) => t.id === trackerId)

  if (!tracker) {
    return (
      <section className="detail-route">
        <p className="detail-not-found">tracker not found</p>
        <button type="button" className="detail-header__back" aria-label="back" onClick={() => navigate('/list')}>
          <BackIcon />
        </button>
      </section>
    )
  }

  return <TrackerDetailScreen tracker={tracker} categories={data?.categories ?? []} now={new Date()} />
}
