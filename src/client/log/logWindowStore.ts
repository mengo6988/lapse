/**
 * Cross-cutting undo-window + toast state for tap-to-log (build ticket 12).
 * Module-level `useSyncExternalStore` store, matching the shape of
 * src/client/tracker/trackerSheetStore.ts — a `React.createContext` would
 * force home and list to share a common ancestor above the routes that
 * mount them, which AppShell.tsx (out of this ticket's scope) doesn't
 * provide, and it wouldn't survive route navigation any better than this
 * does. Home and List both read this one store, so a log-tap on either
 * observes the same 5s window regardless of which screen the user is on
 * when it started or expires.
 *
 * The undo-window's own expiry timer lives *here*, not in a component ref:
 * Home and List each mount their own `useLogRow()` call
 * (src/client/log/useLogRow.ts), so navigating between them unmounts one
 * hook instance and mounts another. A `useRef`-owned timer would be orphaned
 * by that unmount — this timer is owned by the module instead, so it
 * survives navigation and a later tap can always find (and clear) it.
 */
import { useSyncExternalStore } from 'react'
import type { FreezeSnapshot } from './computeFreezeSnapshot'

export type { FreezeSnapshot }

interface OpenState {
  readonly kind: 'open'
  /** the Entry id this window is undoable for — lets a stale async result recognise it's been superseded. */
  readonly entryId: string
  /**
   * HomeRow.id / ListRow.key of the tapped row — drives the settle animation
   * and the frozen row's "now" count. Null when the log didn't move any
   * row's last-done (build ticket 13: a backdated Entry that lands behind
   * the row's existing latest), so the toast and its undo still appear but
   * nothing settles green or claims to have just happened.
   */
  readonly rowId: string | null
  readonly freeze: FreezeSnapshot
  readonly toastMessage: string
  readonly onUndo: () => void
}

interface MessageState {
  readonly kind: 'message'
  readonly toastMessage: string
}

interface ClosedState {
  readonly kind: 'closed'
}

export type LogWindowState = OpenState | MessageState | ClosedState

const CLOSED: LogWindowState = { kind: 'closed' }
const UNDO_WINDOW_MS = 5000
const MESSAGE_DURATION_MS = 4000

let state: LogWindowState = CLOSED
/** bumps only when a window closes via natural expiry — the signal home/list use to fade-in a resort. never bumped by undo, which restores the previous state exactly with no visible re-sort. */
let resortToken = 0
let expireTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function set(next: LogWindowState) {
  state = next
  for (const listener of listeners) listener()
}

function clearExpireTimer() {
  if (expireTimer !== null) {
    clearTimeout(expireTimer)
    expireTimer = null
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const logWindowStore = {
  read: (): LogWindowState => state,
  readResortToken: (): number => resortToken,

  open(params: {
    entryId: string
    rowId: string | null
    freeze: FreezeSnapshot
    toastMessage: string
    onUndo: () => void
  }) {
    clearExpireTimer()
    set({ kind: 'open', ...params })
    expireTimer = setTimeout(() => {
      expireTimer = null
      resortToken += 1
      set(CLOSED)
    }, UNDO_WINDOW_MS)
  },

  /** undo, or a superseding tap: closes without touching resortToken — no fade, the state it restores/replaces was already on screen. */
  closeSilently() {
    clearExpireTimer()
    set(CLOSED)
  },

  showMessage(message: string) {
    clearExpireTimer()
    set({ kind: 'message', toastMessage: message })
    setTimeout(() => {
      // only dismiss if nothing newer has already replaced this exact message.
      if (state.kind === 'message' && state.toastMessage === message) set(CLOSED)
    }, MESSAGE_DURATION_MS)
  },

  dismissMessage() {
    set(CLOSED)
  },
}

export function useLogWindowState(): LogWindowState {
  return useSyncExternalStore(subscribe, logWindowStore.read, logWindowStore.read)
}

export function useResortToken(): number {
  return useSyncExternalStore(subscribe, logWindowStore.readResortToken, logWindowStore.readResortToken)
}
