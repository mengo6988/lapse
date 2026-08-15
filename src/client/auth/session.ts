/**
 * Session state shared between the query layer (which learns about a 401 from
 * the API) and the shell (which decides whether to show the login screen).
 * Deliberately not a React context: the fetch wrapper is not a component.
 */
import { useSyncExternalStore } from 'react'

export type SessionState = 'unknown' | 'authed' | 'unauthorized'

let state: SessionState = 'unknown'
const listeners = new Set<() => void>()

function set(next: SessionState) {
  if (next === state) return
  state = next
  for (const listener of listeners) listener()
}

export const session = {
  read: (): SessionState => state,
  markAuthed: () => set('authed'),
  markUnauthorized: () => set('unauthorized'),
  reset: () => set('unknown'),
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, session.read, session.read)
}
