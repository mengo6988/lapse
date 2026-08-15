/**
 * Logout (build ticket 22, decisions 1-2): posts to the new, unauthenticated
 * `POST /api/auth/logout` (src/server/app.ts), then always runs three local
 * steps regardless of whether that call succeeded — a logout must never be
 * blocked by being offline. In order: clear the in-memory query cache,
 * delete the persisted IndexedDB snapshot (src/client/query/persister.ts's
 * `QUERY_CACHE_KEY`, src/client/query/storage.ts's `createIdbStorage`), then
 * mark the shared session unauthorized (src/client/auth/session.ts) so
 * AppShell swaps in the login screen.
 *
 * Order matters on the last step: `apiFetch` marks the session *authed* on
 * any 2xx response (src/client/api/client.ts), so `markUnauthorized()` has
 * to run after the network call settles, not before — otherwise a
 * successful logout response would silently re-authenticate the shell.
 *
 * The IndexedDB removal gets its own try/catch, separate from the network
 * one: a storage failure is exactly as unblocking as a network failure —
 * the point of logging out is leaving the shell, not a guarantee that every
 * byte on disk was reachable to delete it.
 *
 * `store` is optional and forwarded to `createIdbStorage`, the same
 * injection point src/client/query/provider.tsx uses, so tests can supply an
 * in-memory stand-in — jsdom has no IndexedDB.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../api/client'
import { session } from '../auth/session'
import { QUERY_CACHE_KEY } from '../query/persister'
import { createIdbStorage, type KeyValStore } from '../query/storage'

export function useLogout(store?: KeyValStore) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' })
      } catch {
        // offline, or the server call itself failed — still log out locally.
      }
      queryClient.clear()
      try {
        await createIdbStorage(store).removeItem(QUERY_CACHE_KEY)
      } catch {
        // best-effort: an IndexedDB failure shouldn't block leaving the shell either.
      }
      session.markUnauthorized()
    },
  })
}
