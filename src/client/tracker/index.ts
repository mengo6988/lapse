/**
 * Public entry point for the create/edit Tracker sheet. The FAB
 * (src/client/shell/TabBar.tsx) calls `openCreateTrackerSheet`; a future
 * entry point elsewhere (tickets 15/16 — e.g. a tracker row or detail
 * screen) calls `openEditTrackerSheet(trackerId)`. Neither needs to know
 * `TrackerSheetHost` exists — it's mounted once in AppShell and reacts to
 * the shared store.
 */
export { TrackerSheetHost } from './TrackerSheetHost'
export { trackerSheetStore } from './trackerSheetStore'
import { trackerSheetStore } from './trackerSheetStore'

export function openCreateTrackerSheet(): void {
  trackerSheetStore.openCreate()
}

export function openEditTrackerSheet(trackerId: string): void {
  trackerSheetStore.openEdit(trackerId)
}
