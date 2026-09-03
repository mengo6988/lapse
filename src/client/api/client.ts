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
 *
 * Every request also carries a deadline (.scratch/audit-fixes/spec.md
 * decision 1): a request that never settles — a flaky cellular hop, a proxy
 * that swallows the connection — would otherwise hold the outbox's drain
 * lock open forever, turning away every later retry trigger until the app is
 * force-closed. A timeout aborts the fetch, which lands in the same catch
 * below as a dropped connection and throws the same null-status `ApiError`,
 * so the outbox already retries it on the normal backoff with nothing to
 * change there. The deadline merges with any signal a caller already passes
 * rather than replacing it, and is a module constant rather than
 * configuration — nothing here calls for tuning it per request. jsdom's
 * `AbortSignal` lacks the `timeout`/`any` statics Node has, so this is a
 * plain timer plus an `AbortController` instead of leaning on either.
 */
import { session } from '../auth/session'

export class ApiError extends Error {
  /** null for a request that never reached the server (offline, DNS, a timeout, ...). */
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

/** not configuration — see this module's header comment. */
const REQUEST_DEADLINE_MS = 15_000

/**
 * An `AbortController` whose signal fires either when the deadline elapses
 * or when a caller-supplied signal aborts, whichever comes first. `clear`
 * must run once the request settles either way, or the timer outlives it.
 */
function withDeadline(callerSignal?: AbortSignal | null): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_DEADLINE_MS)
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort()
    else callerSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

export async function apiFetch(path: string, init?: RequestInit): Promise<unknown> {
  const { signal, clear } = withDeadline(init?.signal)
  let res: Response
  try {
    res = await fetch(path, { ...init, signal, credentials: 'same-origin' })
  } catch {
    throw new ApiError(null, `request to ${path} could not be sent`)
  } finally {
    clear()
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
