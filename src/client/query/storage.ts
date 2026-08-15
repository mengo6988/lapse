/**
 * Adapts idb-keyval's get/set/del to the AsyncStorage shape the query
 * persister expects (docs/tech-stack.md § Offline-lite: IndexedDB, not
 * localStorage). `store` is injectable so tests substitute a plain
 * in-memory object — jsdom has no IndexedDB, and this is less machinery
 * than pulling in fake-indexeddb.
 */
import { del, get, set } from 'idb-keyval'
import type { AsyncStorage } from '@tanstack/react-query-persist-client'

export interface KeyValStore {
  get: (key: string) => Promise<string | undefined>
  set: (key: string, value: string) => Promise<void>
  del: (key: string) => Promise<void>
}

const defaultStore: KeyValStore = { get, set, del }

export function createIdbStorage(store: KeyValStore = defaultStore): AsyncStorage<string> {
  return {
    getItem: (key) => store.get(key),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.del(key),
  }
}
