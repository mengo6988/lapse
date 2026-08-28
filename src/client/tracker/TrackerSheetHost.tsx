/**
 * Mounts the create/edit Tracker sheet when trackerSheetStore says to.
 * Rendered once, high in the tree (AppShell), regardless of whether the
 * sheet is open — so the FAB (or a future edit entry point, tickets 15/16)
 * only has to flip the store, not know anything about mounting.
 */
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useBootstrapQuery } from '../query/useBootstrap'
import { useExitTransition } from '../shell/useExitTransition'
import { useInertBackground } from '../shell/useInertBackground'
import './trackerSheet.css'
import { TrackerForm } from './TrackerForm'
import { TrackerSheet } from './TrackerSheet'
import { trackerSheetStore, useTrackerSheetState } from './trackerSheetStore'
import { useFocusTrap } from './useFocusTrap'

export function TrackerSheetHost() {
  const storeState = useTrackerSheetState()
  const active = storeState.mode !== 'closed'
  const openedFrom = storeState.mode === 'closed' ? null : storeState.openedFrom
  const containerRef = useFocusTrap<HTMLDivElement>(active, trackerSheetStore.close, openedFrom)
  // the store flips to closed instantly (focus restores right away, above);
  // the latch only keeps the DOM around while the exit animation plays.
  const { value: state, closing } = useExitTransition(storeState.mode === 'closed' ? null : storeState)
  const { data } = useBootstrapQuery()
  // kept inert through the same window the DOM is latched for — see
  // src/client/shell/useInertBackground.ts.
  useInertBackground(state !== null)

  if (state === null) return null

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

  // portaled to document.body so the sheet lands as a DOM sibling of
  // #app-root, not a descendant — see useInertBackground.ts's doc comment.
  return createPortal(
    <>
      <div
        className={closing ? 'tracker-sheet-scrim tracker-sheet-scrim--closing' : 'tracker-sheet-scrim'}
        onClick={trackerSheetStore.close}
      />
      <TrackerSheet title={title} onClose={trackerSheetStore.close} containerRef={containerRef} closing={closing}>
        {content}
      </TrackerSheet>
    </>,
    document.body,
  )
}
