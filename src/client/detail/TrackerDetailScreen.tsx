/**
 * Tracker detail / history (docs/design.md § Tracker detail / history):
 * header (name, category, edit), per-Variant summaries (VariantSummaryList),
 * and the full Entry history (EntryHistoryList), with an edit sheet for
 * whichever Entry was tapped. Detail is depth 2 with no tab of its own, and
 * a standalone iOS PWA has no OS back gesture (docs/design.md § Navigation)
 * — the header's back button always returns to `/list` explicitly rather
 * than `navigate(-1)`, since a deep link straight into detail (no prior
 * app history) would otherwise have nowhere sane to go back to.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Category, Entry, Tracker } from '../api'
import { openEditTrackerSheet } from '../tracker'
import './detail.css'
import { EntryEditSheet } from './EntryEditSheet'
import { EntryHistoryList } from './EntryHistoryList'
import { useTrackerEntries } from './useTrackerEntries'
import { VariantSummaryList } from './VariantSummaryList'

export interface TrackerDetailScreenProps {
  tracker: Tracker
  categories: readonly Category[]
  now: Date
}

interface EditingEntry {
  entry: Entry
  openedFrom: HTMLElement | null
}

function BackIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true">
      <polyline points="14 5 7 12 14 19" />
    </svg>
  )
}

export function TrackerDetailScreen({ tracker, categories, now }: TrackerDetailScreenProps) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState<EditingEntry | null>(null)
  const entriesQuery = useTrackerEntries(tracker.id)
  const loadedEntries = entriesQuery.data ? entriesQuery.data.pages.flatMap((page) => page.entries) : []
  const category = categories.find((c) => c.id === tracker.categoryId) ?? null

  function handleOpenEntry(entry: Entry, openedFrom: HTMLElement) {
    setEditing({ entry, openedFrom })
  }

  return (
    <section className="detail-route" aria-label={`${tracker.name} detail`}>
      <header className="detail-header">
        <button type="button" className="detail-header__back" aria-label="back" onClick={() => navigate('/list')}>
          <BackIcon />
        </button>
        <div className="detail-header__body">
          <h1 className="detail-header__name">{tracker.name}</h1>
          {category && <p className="detail-header__meta">{category.name}</p>}
        </div>
        <button type="button" className="detail-header__edit" onClick={() => openEditTrackerSheet(tracker.id)}>
          edit
        </button>
      </header>

      <VariantSummaryList tracker={tracker} now={now} loadedEntries={loadedEntries} />

      <EntryHistoryList trackerId={tracker.id} tracker={tracker} now={now} onOpenEntry={handleOpenEntry} />

      {editing && (
        <EntryEditSheet entry={editing.entry} trackerId={tracker.id} onClose={() => setEditing(null)} openedFrom={editing.openedFrom} />
      )}
    </section>
  )
}
