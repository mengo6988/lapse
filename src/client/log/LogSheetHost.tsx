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
import { LogSheet } from './LogSheet'
import { logSheetStore, useLogSheetState } from './logSheetStore'
import { useLogRow, type EntryOverrides } from './useLogRow'
import { TrackerSheet } from '../tracker/TrackerSheet'
import { useFocusTrap } from '../tracker/useFocusTrap'

export function LogSheetHost() {
  const state = useLogSheetState()
  const active = state.mode === 'open'
  const openedFrom = state.mode === 'open' ? state.openedFrom : null
  const containerRef = useFocusTrap<HTMLDivElement>(active, logSheetStore.close, openedFrom)
  const { logEntry } = useLogRow()

  if (state.mode !== 'open') return null

  function handleSubmit(overrides: EntryOverrides) {
    if (state.mode !== 'open') return
    logEntry(state.target, overrides)
    logSheetStore.close()
  }

  return (
    <>
      <div className="tracker-sheet-scrim" onClick={logSheetStore.close} />
      <TrackerSheet title="log entry" onClose={logSheetStore.close} containerRef={containerRef}>
        <LogSheet now={new Date()} onSubmit={handleSubmit} />
      </TrackerSheet>
    </>
  )
}
