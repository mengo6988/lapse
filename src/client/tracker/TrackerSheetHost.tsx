/**
 * Mounts the create/edit Tracker sheet when trackerSheetStore says to.
 * Rendered once, high in the tree (AppShell), regardless of whether the
 * sheet is open — so the FAB (or a future edit entry point, tickets 15/16)
 * only has to flip the store, not know anything about mounting.
 */
import type { ReactNode } from 'react'
import { useBootstrapQuery } from '../query/useBootstrap'
import './trackerSheet.css'
import { TrackerForm } from './TrackerForm'
import { TrackerSheet } from './TrackerSheet'
import { trackerSheetStore, useTrackerSheetState } from './trackerSheetStore'
import { useFocusTrap } from './useFocusTrap'

export function TrackerSheetHost() {
  const state = useTrackerSheetState()
  const active = state.mode !== 'closed'
  const openedFrom = state.mode === 'closed' ? null : state.openedFrom
  const containerRef = useFocusTrap<HTMLDivElement>(active, trackerSheetStore.close, openedFrom)
  const { data } = useBootstrapQuery()

  if (state.mode === 'closed') return null

  const categories = data?.categories ?? []
  let title: string
  let content: ReactNode

  if (state.mode === 'edit') {
    const tracker = data?.trackers.find((t) => t.id === state.trackerId)
    title = 'edit tracker'
    content = tracker ? (
      <TrackerForm mode="edit" tracker={tracker} categories={categories} onClose={trackerSheetStore.close} />
    ) : (
      <p className="tracker-form__error" role="alert">
        tracker not found
      </p>
    )
  } else {
    title = 'new tracker'
    content = <TrackerForm mode="create" categories={categories} onClose={trackerSheetStore.close} />
  }

  return (
    <>
      <div className="tracker-sheet-scrim" onClick={trackerSheetStore.close} />
      <TrackerSheet title={title} onClose={trackerSheetStore.close} containerRef={containerRef}>
        {content}
      </TrackerSheet>
    </>
  )
}
