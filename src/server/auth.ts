import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'

export const SESSION_COOKIE = 'lapse_session'
const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60

/**
 * Single-password auth per ADR-0003. There is no session store: the cookie
 * value is a token derived from the password, so verifying it is the same
 * timing-safe comparison as logging in.
 */
export function sessionToken(password: string): string {
  return createHmac('sha256', password).update('lapse-session-v1').digest('hex')
}

export function matches(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch, which would leak length by
  // exception; compare a fixed-width digest of each instead.
  const digest = (buf: Buffer) => createHmac('sha256', 'lapse-compare').update(buf).digest()
  return timingSafeEqual(digest(a), digest(b))
}

export function issueSession(c: Context, password: string): void {
  setCookie(c, SESSION_COOKIE, sessionToken(password), {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
}

export function clearSession(c: Context): void {
  setCookie(c, SESSION_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
  })
}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null
  const [scheme, ...rest] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer') return null
  const token = rest.join(' ').trim()
  return token.length > 0 ? token : null
}

/**
 * The browser's session cookie, or a long-lived bearer token when one is
 * configured.
 *
 * The cookie is what a person holds; the token is what a *machine* holds — an
 * Apple Shortcut on the Action Button, a script, the Telegram bot. They can't
 * share one credential: Shortcuts has no reliable way to capture a Set-Cookie
 * from a login response and replay it on later runs, which is why the API is
 * otherwise unreachable from anything but the app itself. And the token can't
 * just be the password, because the password's whole protection is living in
 * an httpOnly cookie nothing can read back out, while a token pasted into a
 * Shortcut travels with that Shortcut every time it's exported or shared.
 *
 * Same blast radius as the password once presented (full /api/*, no scopes),
 * which is ADR-0003's single-user stance held rather than widened. Rotating it
 * is changing the env var and restarting.
 */
export function requireApiAccess(password: string, apiToken?: string): MiddlewareHandler {
  const expected = sessionToken(password)
  return async (c, next) => {
    const cookie = getCookie(c, SESSION_COOKIE)
    if (cookie && matches(cookie, expected)) return next()

    const presented = bearerToken(c.req.header('authorization'))
    if (apiToken && presented && matches(presented, apiToken)) return next()

    return c.json({ error: 'unauthorized' }, 401)
  }
}
