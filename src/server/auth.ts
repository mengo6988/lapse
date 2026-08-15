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

export function requireSession(password: string): MiddlewareHandler {
  const expected = sessionToken(password)
  return async (c, next) => {
    const cookie = getCookie(c, SESSION_COOKIE)
    if (!cookie || !matches(cookie, expected)) {
      return c.json({ error: 'unauthorized' }, 401)
    }
    await next()
  }
}
