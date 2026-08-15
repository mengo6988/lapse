/**
 * The launch-time round trip per docs/spec.md § API: hydrates categories,
 * trackers, and their latest Entries in one request. `AppQueryProvider`'s
 * bootstrap query (src/client/query/useBootstrap.ts) is the only intended
 * caller — other tickets read Trackers/Categories through that cache entry.
 */
import { apiFetch } from './client'
import { bootstrapPayloadSchema, type BootstrapPayload } from './types'

export async function fetchBootstrap(): Promise<BootstrapPayload> {
  const raw = await apiFetch('/api/bootstrap')
  return bootstrapPayloadSchema.parse(raw)
}
