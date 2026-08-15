/**
 * Persisted TanStack Query provider (docs/tech-stack.md § Offline-lite).
 * `PersistQueryClientProvider` restores the last IndexedDB snapshot into a
 * fresh QueryClient as soon as the component mounts, so a cold reload paints
 * from last-known state instead of an empty list while bootstrap refetches
 * over the network.
 *
 * `store` overrides the default IndexedDB-backed store; it exists so tests
 * can inject a plain in-memory object (see src/client/query/storage.ts) — it
 * is not meant to be passed in production, where main.tsx mounts this with
 * no props.
 */
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useState, type ReactNode } from 'react'
import { createQueryClient } from './client'
import { createQueryPersister } from './persister'
import type { KeyValStore } from './storage'

interface AppQueryProviderProps {
  children: ReactNode
  store?: KeyValStore
}

export function AppQueryProvider({ children, store }: AppQueryProviderProps) {
  const [queryClient] = useState(createQueryClient)
  const [persister] = useState(() => createQueryPersister(store))

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      {children}
    </PersistQueryClientProvider>
  )
}
