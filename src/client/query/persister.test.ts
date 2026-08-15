import { describe, expect, it } from 'vitest'
import type { KeyValStore } from './storage'
import { createQueryPersister } from './persister'

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

describe('createQueryPersister', () => {
  it('round-trips a persisted client through the injected store', async () => {
    const persister = createQueryPersister(createFakeKeyValStore())
    const persistedClient = {
      timestamp: Date.now(),
      buster: '',
      clientState: { queries: [], mutations: [] },
    }

    await persister.persistClient(persistedClient)
    const restored = await persister.restoreClient()

    expect(restored).toEqual(persistedClient)
  })

  it('returns undefined when nothing has been persisted yet', async () => {
    const persister = createQueryPersister(createFakeKeyValStore())

    await expect(persister.restoreClient()).resolves.toBeUndefined()
  })

  it('removeClient clears the persisted snapshot', async () => {
    const persister = createQueryPersister(createFakeKeyValStore())
    await persister.persistClient({ timestamp: Date.now(), buster: '', clientState: { queries: [], mutations: [] } })

    await persister.removeClient()

    await expect(persister.restoreClient()).resolves.toBeUndefined()
  })
})
