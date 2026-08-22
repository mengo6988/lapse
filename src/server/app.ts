import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { clearSession, issueSession, matches, requireSession } from './auth.js'
import type { Db } from './db.js'
import { loginRateLimit } from './rateLimit.js'
import { bootstrapRoutes } from './routes/bootstrap.js'
import { categoryRoutes } from './routes/categories.js'
import { entryRoutes } from './routes/entries.js'
import { trackerRoutes } from './routes/trackers.js'

export type AppDeps = {
  db: Db
  password: string
}

const loginSchema = z.object({ password: z.string().min(1) })

const LOGIN_BODY_LIMIT_BYTES = 2 * 1024

/**
 * The API surface, built around injected dependencies so integration tests can
 * hand it an in-memory database and drive it through `app.request()`.
 */
export function createApp({ db, password }: AppDeps) {
  const app = new Hono()

  // Unauthenticated: the Docker HEALTHCHECK target and the way in.
  app.get('/api/health', (c) => c.json({ status: 'ok' }))

  // Rate limited before validation: an attempt counts whether or not the
  // body is well-formed (ADR-0003 amendment — 10 attempts per 15 minutes).
  //
  // Size-capped ahead of both, because this is the one write anyone on the
  // internet can reach. `zValidator` reads the whole body into memory before
  // it can reject anything, and lapse is a single un-clustered Node process
  // (docs/tech-stack.md § Ops) — so without a cap, one oversized POST is
  // enough to take the app down for its actual user. A password is a few
  // dozen bytes; 2KB is already generous.
  app.post(
    '/api/auth/login',
    bodyLimit({ maxSize: LOGIN_BODY_LIMIT_BYTES, onError: (c) => c.json({ error: 'payload too large' }, 413) }),
    loginRateLimit(),
    zValidator('json', loginSchema),
    (c) => {
      if (!matches(c.req.valid('json').password, password)) {
        return c.json({ error: 'wrong password' }, 401)
      }
      issueSession(c, password)
      return c.json({ ok: true })
    },
  )

  // Unauthenticated, like login: a logout must always succeed, even against
  // a missing or already-stale cookie, so the client is never blocked from
  // leaving a broken session (build ticket 22). There is no server-side
  // session store (the cookie is a deterministic HMAC of the password, see
  // auth.ts) — clearing it only forgets the browser's copy, it can't revoke
  // a token someone else captured. Single-user app on a SameSite=Lax cookie,
  // so CSRF machinery isn't worth it for a call that only ever destroys the
  // caller's own session.
  app.post('/api/auth/logout', (c) => {
    clearSession(c)
    return c.json({ ok: true })
  })

  app.use('/api/*', requireSession(password))

  app.route('/api', bootstrapRoutes({ db }))
  app.route('/api', trackerRoutes({ db }))
  app.route('/api', entryRoutes({ db }))
  app.route('/api', categoryRoutes({ db }))

  return app
}

export type App = ReturnType<typeof createApp>
