/**
 * The IndexedDB-backed persister for the query cache (docs/tech-stack.md §
 * Offline-lite). `store` is forwarded to `createIdbStorage` so tests can
 * inject an in-memory stand-in.
 */
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { Persister } from '@tanstack/react-query-persist-client'
import { createIdbStorage, type KeyValStore } from './storage'

export const QUERY_CACHE_KEY = 'lapse-query-cache'

export function createQueryPersister(store?: KeyValStore): Persister {
  return createAsyncStoragePersister({
    storage: createIdbStorage(store),
    key: QUERY_CACHE_KEY,
  })
}
