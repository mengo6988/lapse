/**
 * Tracker/Variant writes on top of the shared `apiFetch`. The only thing
 * this layer adds is turning a failed response into the per-field messages
 * docs/design.md wants rendered next to the field that caused them — the
 * fetch, the session handling, and the error body all come from
 * src/client/api/client.ts, so there is a single fetch path in the client.
 *
 * Scoped to tracker/variant writes; tech-stack.md's outbox covers
 * POST /entries only, so everything here fails fast with no queueing.
 */
import { ApiError, apiFetch, jsonRequest } from '../api/client'
import { parseFieldErrors, parseGenericError } from './fieldErrors'

export { jsonRequest }

export class TrackerApiError extends Error {
  /** null for a request that never reached the server (offline, DNS, ...). */
  readonly status: number | null
  readonly fieldErrors: Record<string, string>

  constructor(status: number | null, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'TrackerApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

const NETWORK_FAILURE_MESSAGE = "couldn't save — try again"

export async function mutationFetch(path: string, init: RequestInit): Promise<unknown> {
  try {
    return await apiFetch(path, init)
  } catch (error) {
    if (!(error instanceof ApiError)) throw error

    // an unreachable server and an expired session both read the same to the
    // person filling in the form: the write did not land, try again.
    if (error.status === null || error.status === 401) {
      throw new TrackerApiError(error.status, NETWORK_FAILURE_MESSAGE)
    }

    throw new TrackerApiError(
      error.status,
      parseGenericError(error.body),
      parseFieldErrors(error.body),
    )
  }
}
