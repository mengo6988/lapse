/**
 * Typed fetch wrapper for `/api/*`. The API is same-origin (Vite proxies it
 * in dev, Hono serves it directly in prod), so the browser attaches the
 * session cookie automatically — `credentials: 'same-origin'` just makes
 * that explicit.
 *
 * A 401 means the session cookie is missing or stale: it marks the shared
 * session unauthorized (see src/client/auth/session.ts) so the shell can
 * route to login, then throws — callers never swallow it silently. Any
 * other non-2xx status also throws. Only a genuinely successful response
 * marks the session authed.
 *
 * A failed response keeps its parsed body on the error rather than
 * discarding it: `@hono/zod-validator` returns per-field messages on a 400,
 * and docs/design.md requires those next to the field that caused them.
 * This is the only fetch path in the client, so session handling has one
 * definition instead of drifting between two wrappers.
 */
import { session } from '../auth/session'

export class ApiError extends Error {
  /** null for a request that never reached the server (offline, DNS, ...). */
  readonly status: number | null
  /** the parsed error body, or undefined when there wasn't a readable one. */
  readonly body: unknown

  constructor(status: number | null, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export async function apiFetch(path: string, init?: RequestInit): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(path, { ...init, credentials: 'same-origin' })
  } catch {
    throw new ApiError(null, `request to ${path} could not be sent`)
  }

  if (res.status === 401) {
    session.markUnauthorized()
    throw new ApiError(401, `unauthorized: ${path}`)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => undefined)
    throw new ApiError(res.status, `request to ${path} failed with status ${res.status}`, body)
  }

  session.markAuthed()
  // a 204 (DELETE /variants/:id, and friends) has no body to parse.
  if (res.status === 204) return null
  return res.json()
}

/** JSON POST/PATCH request init — every mutation call needs this shape. */
export function jsonRequest(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }
}
