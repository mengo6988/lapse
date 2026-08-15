/**
 * Open/closed state for the create/edit Tracker sheet (docs/design.md: a
 * sheet at depth 2, not a fifth tab route). A module-level external store
 * rather than React context, matching src/client/auth/session.ts — the FAB
 * (src/client/shell/TabBar.tsx) and a future edit entry point (tickets 15/16,
 * e.g. tracker detail) both need to open it without either owning the other.
 *
 * `openedFrom` is captured here, synchronously at open time, rather than
 * inside the sheet's own focus-trap effect: by the time that effect runs,
 * the sheet's content (e.g. the name field's autoFocus) may already have
 * taken focus, which would make a later `document.activeElement` read wrong.
 */
import { useSyncExternalStore } from 'react'

export type TrackerSheetState =
  | { mode: 'closed' }
  | { mode: 'create'; openedFrom: HTMLElement | null }
  | { mode: 'edit'; trackerId: string; openedFrom: HTMLElement | null }

const CLOSED: TrackerSheetState = { mode: 'closed' }

let state: TrackerSheetState = CLOSED
const listeners = new Set<() => void>()

function set(next: TrackerSheetState) {
  state = next
  for (const listener of listeners) listener()
}

function activeElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const trackerSheetStore = {
  read: (): TrackerSheetState => state,
  openCreate: () => set({ mode: 'create', openedFrom: activeElement() }),
  openEdit: (trackerId: string) => set({ mode: 'edit', trackerId, openedFrom: activeElement() }),
  close: () => set(CLOSED),
}

export function useTrackerSheetState(): TrackerSheetState {
  return useSyncExternalStore(subscribe, trackerSheetStore.read, trackerSheetStore.read)
}
