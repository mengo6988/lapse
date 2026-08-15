import { describe, expect, it } from 'vitest'
import { createIdbStorage, type KeyValStore } from './storage'

/** In-memory stand-in for idb-keyval's store — jsdom has no IndexedDB. */
function createFakeKeyValStore(): KeyValStore {
  const map = new Map<string, string>()
  return {
    get: async (key) => map.get(key),
    set: async (key, value) => {
      map.set(key, value)
    },
    del: async (key) => {
      map.delete(key)
    },
  }
}

describe('createIdbStorage', () => {
  it('round-trips a value through set and get', async () => {
    const storage = createIdbStorage(createFakeKeyValStore())

    await storage.setItem('key', 'value')

    await expect(storage.getItem('key')).resolves.toBe('value')
  })

  it('returns undefined for a missing key', async () => {
    const storage = createIdbStorage(createFakeKeyValStore())

    await expect(storage.getItem('missing')).resolves.toBeUndefined()
  })

  it('removes a value', async () => {
    const store = createFakeKeyValStore()
    const storage = createIdbStorage(store)
    await storage.setItem('key', 'value')

    await storage.removeItem('key')

    await expect(storage.getItem('key')).resolves.toBeUndefined()
  })

  it('keeps separate injected stores independent', async () => {
    const storageA = createIdbStorage(createFakeKeyValStore())
    const storageB = createIdbStorage(createFakeKeyValStore())

    await storageA.setItem('key', 'a')

    await expect(storageB.getItem('key')).resolves.toBeUndefined()
  })
})
