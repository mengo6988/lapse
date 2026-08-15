import { useLogWindowState } from './logWindowStore'

/**
 * `logged ✓` + undo (docs/design.md canonical strings), or a plain failure
 * message with no action. `role="status"`/`aria-live="polite"` — a log is
 * routine, not an interruption, so it's announced without stealing focus
 * (build ticket 12: "the toast announced politely to screen readers").
 * Mounted once per route (src/client/routes/HomeRoute.tsx,
 * src/client/routes/ListRoute.tsx) — only one is ever on screen at a time,
 * and both read the same module-level store, so the toast (and its 5s
 * window) survives navigating between them mid-log.
 */
export function LogToast() {
  const state = useLogWindowState()

  if (state.kind === 'closed') return null

  return (
    <div className="log-toast" role="status" aria-live="polite">
      <span className="log-toast__message">{state.toastMessage}</span>
      {state.kind === 'open' && (
        <button type="button" className="log-toast__undo" onClick={state.onUndo}>
          undo
        </button>
      )}
    </div>
  )
}
