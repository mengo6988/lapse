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
        <button type="button" className="detail-header__back" onClick={() => navigate('/list')}>
          back to list
        </button>
      </section>
    )
  }

  return <TrackerDetailScreen tracker={tracker} categories={data?.categories ?? []} now={new Date()} />
}
