/**
 * Open/closed state for the long-press log sheet (build ticket 13,
 * docs/design.md § Log sheet). A module-level external store, mirroring
 * src/client/tracker/trackerSheetStore.ts's shape (see that file's header
 * comment for why a plain useState/context wouldn't reach across Home and
 * List). SlippingCard, QuickLogTile and ListRowItem (three different
 * directories) each call `open()` directly on long-press, the same way the
 * FAB opens trackerSheetStore without any prop threaded down from a parent
 * — for Home in particular this isn't a style choice: SlippingSection and
 * QuickLogSection (build ticket 10, out of this ticket's file fence) sit
 * between HomeRoute and these cards/tiles and don't forward a long-press
 * callback, so a direct store call is the only way in.
 *
 * `openedFrom` is the row's own pressed element, handed in by the caller
 * (see useLongPress.ts + its call sites) rather than read here via
 * `document.activeElement` the way trackerSheetStore reads it — a
 * touch-driven long-press does not reliably focus the element the way a
 * click does, so the caller captures it explicitly instead.
 */
import { useSyncExternalStore } from 'react'
import type { LoggableRow } from './useLogRow'

export type LogSheetState =
  | { mode: 'closed' }
  | { mode: 'open'; target: LoggableRow; openedFrom: HTMLElement | null }

const CLOSED: LogSheetState = { mode: 'closed' }

let state: LogSheetState = CLOSED
const listeners = new Set<() => void>()

function set(next: LogSheetState) {
  state = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const logSheetStore = {
  read: (): LogSheetState => state,
  open: (target: LoggableRow, openedFrom: HTMLElement | null = null) => set({ mode: 'open', target, openedFrom }),
  close: () => set(CLOSED),
}

export function useLogSheetState(): LogSheetState {
  return useSyncExternalStore(subscribe, logSheetStore.read, logSheetStore.read)
}
