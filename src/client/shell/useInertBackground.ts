/**
 * Marks the app root (#app-root, set on .app-shell in AppShell.tsx) inert
 * while a sheet is open, so a screen reader's virtual cursor can't wander
 * into the backgrounded app the way Tab-only focus trapping allows (build
 * ticket 02, docs/design.md § Motion). Sheets portal their scrim + dialog to
 * document.body (see TrackerSheetHost/LogSheetHost/QueuedSheet/
 * EntryEditSheet) specifically so they land as a DOM sibling of #app-root
 * rather than a descendant — inert cascades to every descendant, so the
 * sheet itself would go unreachable too if it lived inside the node this
 * inertes.
 *
 * Module-level ref count rather than a plain boolean: if a second sheet's
 * mount effect runs before a still-closing first sheet's unmount effect
 * does, the count keeps the root inert until both clear, instead of one
 * cleanup prematurely un-inerting the root out from under the other.
 */
import { useEffect } from 'react'

const APP_ROOT_ID = 'app-root'
let openCount = 0

export function useInertBackground(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const root = document.getElementById(APP_ROOT_ID)
    openCount += 1
    root?.setAttribute('inert', '')
    return () => {
      openCount = Math.max(0, openCount - 1)
      if (openCount === 0) root?.removeAttribute('inert')
    }
  }, [active])
}
