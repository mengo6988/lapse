import type { MiddlewareHandler } from 'hono'

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10
const UNKNOWN_CLIENT_KEY = 'unknown'

/**
 * The client key for the login rate limiter, taken from X-Forwarded-For.
 *
 * This deployment has exactly one reverse proxy in front of the app —
 * Traefik, terminating TLS directly from the internet (docs/tech-stack.md §
 * Ops) — and no `forwardedHeaders.trustedIPs` or `.insecure` is configured
 * in compose.yaml. Traefik's default (`notAppendXForwardedFor: false`) is to
 * APPEND the real observed connecting peer address to the end of whatever
 * X-Forwarded-For arrived, never to replace it. So a client that pre-sends
 * `X-Forwarded-For: 1.2.3.4, 5.6.7.8` before hitting Traefik ends up with
 * Traefik's own observation tacked on as a THIRD value — the attacker
 * controls every hop except the last one. ADR-0003's amendment says to key
 * on "the first X-Forwarded-For hop (set by Traefik)": under append
 * semantics, the hop Traefik itself sets is the LAST one, not index 0 of the
 * list, so that's what this reads. Taking index 0 literally would let an
 * attacker bypass the limiter by varying a self-chosen leading hop on every
 * request.
 *
 * A missing or empty header (shouldn't happen behind Traefik, but the
 * ticket asks this be handled explicitly) buckets under one shared key
 * rather than throwing.
 */
export function extractClientKey(header: string | undefined | null): string {
  if (!header) return UNKNOWN_CLIENT_KEY

  const hops = header
    .split(',')
    .map((hop) => hop.trim())
    .filter((hop) => hop.length > 0)

  return hops.at(-1) ?? UNKNOWN_CLIENT_KEY
}

export type FixedWindowLimiterOptions = {
  windowMs?: number
  maxAttempts?: number
  now?: () => number
}

export type FixedWindowLimiter = {
  attempt: (key: string) => boolean
  /** live window count — the only way to observe that expired entries are dropped. */
  size: () => number
}

type WindowState = {
  count: number
  windowStart: number
}

/**
 * Fixed-window request counter, in memory, one process. Lapse runs as a
 * single container with no clustering (docs/tech-stack.md § Ops), so a Map
 * is the whole store — no shared cache needed, and nothing here has to
 * survive a restart.
 */
export function createFixedWindowLimiter({
  windowMs = WINDOW_MS,
  maxAttempts = MAX_ATTEMPTS,
  now = Date.now,
}: FixedWindowLimiterOptions = {}): FixedWindowLimiter {
  const hits = new Map<string, WindowState>()

  function attempt(key: string): boolean {
    const current = now()
    const existing = hits.get(key)

    if (!existing || current - existing.windowStart >= windowMs) {
      hits.set(key, { count: 1, windowStart: current })
      // Every distinct source address that ever touches the login route
      // leaves a Map entry, and a public host gets scanned continuously —
      // so a process that stays up for months (restart: unless-stopped)
      // accumulates them forever unless something drops the expired ones.
      // Sweeping here rather than on a timer keeps the limiter a pure
      // function of its `now`, with no interval to own or shut down: the
      // sweep costs one pass over a Map that this same line is the only
      // thing that grows.
      evictExpired(current)
      return true
    }

    if (existing.count >= maxAttempts) {
      return false
    }

    hits.set(key, { count: existing.count + 1, windowStart: existing.windowStart })
    return true
  }

  /** drops every window that has already elapsed — they compare identical to absent. */
  function evictExpired(current: number): void {
    for (const [key, state] of hits) {
      if (current - state.windowStart >= windowMs) hits.delete(key)
    }
  }

  return { attempt, size: () => hits.size }
}

/**
 * Rate limits login attempts only — mounted on `/api/auth/login` alone, per
 * ADR-0003's amendment. `now` is injectable so tests can control the window
 * without sleeping.
 */
export function loginRateLimit(now: () => number = Date.now): MiddlewareHandler {
  const limiter = createFixedWindowLimiter({ now })

  return async (c, next) => {
    const key = extractClientKey(c.req.header('x-forwarded-for'))
    if (!limiter.attempt(key)) {
      return c.json({ error: 'too many attempts, try again later' }, 429)
    }
    await next()
  }
}
