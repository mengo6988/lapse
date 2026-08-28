/**
 * Mounts the long-press log sheet (docs/design.md § Log sheet, build ticket
 * 13) whenever logSheetStore says to. Rendered once per route (HomeRoute.tsx,
 * ListRoute.tsx — see logSheetStore.ts's header comment for why this can't
 * be a single AppShell-level host the way TrackerSheetHost is), mirroring
 * how <LogToast/> is already duplicated across both routes and reads the
 * one shared module store, so a long-press started on either screen behaves
 * identically regardless of which route is mounted when it opens.
 *
 * Submitting calls straight into useLogRow's `logEntry` (src/client/log/
 * useLogRow.ts) with the sheet's entryOverrides — the exact same
 * freeze/optimistic-write/POST/undo choreography a plain tap gets, per this
 * ticket's acceptance criteria, because it's the same function underneath.
 */
import { createPortal } from 'react-dom'
import { useExitTransition } from '../shell/useExitTransition'
import { useInertBackground } from '../shell/useInertBackground'
import { LogSheet } from './LogSheet'
import { logSheetStore, useLogSheetState } from './logSheetStore'
import { useLogRow, type EntryOverrides } from './useLogRow'
import { TrackerSheet } from '../tracker/TrackerSheet'
import { useFocusTrap } from '../tracker/useFocusTrap'

export function LogSheetHost() {
  const storeState = useLogSheetState()
  const active = storeState.mode === 'open'
  const openedFrom = storeState.mode === 'open' ? storeState.openedFrom : null
  const containerRef = useFocusTrap<HTMLDivElement>(active, logSheetStore.close, openedFrom)
  // the store flips to closed instantly (focus restores right away, above);
  // the latch only keeps the DOM around while the exit animation plays.
  const { value: state, closing } = useExitTransition(storeState.mode === 'open' ? storeState : null)
  const { logEntry } = useLogRow()
  // kept inert through the same window the DOM is latched for — see
  // src/client/shell/useInertBackground.ts.
  useInertBackground(state !== null)

  if (state === null) return null

  function handleSubmit(overrides: EntryOverrides) {
    // checked against the live store, not the latch — a submit that lands
    // during the 200ms exit window must not log twice.
    if (storeState.mode !== 'open') return
    logEntry(storeState.target, overrides)
    logSheetStore.close()
  }

  // portaled to document.body so the sheet lands as a DOM sibling of
  // #app-root, not a descendant — see useInertBackground.ts's doc comment.
  return createPortal(
    <>
      <div
        className={closing ? 'tracker-sheet-scrim tracker-sheet-scrim--closing' : 'tracker-sheet-scrim'}
        onClick={logSheetStore.close}
      />
      <TrackerSheet title="log entry" onClose={logSheetStore.close} containerRef={containerRef} closing={closing}>
        <LogSheet now={new Date()} onSubmit={handleSubmit} />
      </TrackerSheet>
    </>,
    document.body,
  )
}
