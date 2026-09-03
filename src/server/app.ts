import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { serveStatic } from '@hono/node-server/serve-static'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { clearSession, issueSession, matches, requireApiAccess } from './auth.js'
import type { Db } from './db.js'
import { loginRateLimit } from './rateLimit.js'
import { bootstrapRoutes } from './routes/bootstrap.js'
import { categoryRoutes } from './routes/categories.js'
import { entryRoutes } from './routes/entries.js'
import { trackerRoutes } from './routes/trackers.js'

export type AppDeps = {
  db: Db
  password: string
  /** optional bearer credential for non-browser callers — see requireApiAccess. */
  apiToken?: string
  /**
   * the built client to serve as static files + SPA fallback, per
   * docs/tech-stack.md § Repo shape. Omitted by tests that never touch static
   * serving; the boot script always passes it once `dist/client` exists.
   */
  clientDir?: string
}

const loginSchema = z.object({ password: z.string().min(1) })

const LOGIN_BODY_LIMIT_BYTES = 2 * 1024

/**
 * Static client serving plus the SPA fallback, moved here from the boot
 * script (src/server/index.ts) so a test can point it at a temporary
 * directory and drive it through the same `app.request()` interface as every
 * other route test.
 *
 * The revalidation header is decided by what is being served, not by what
 * path was asked for: a real page load asks for `/` or a deep link, never
 * literally `/index.html`, and both are answered by the SPA fallback below.
 * Without it a deploy is invisible to an installed PWA on iOS
 * (docs/tech-stack.md § SW update).
 */
function serveClient(app: Hono, clientDir: string): void {
  app.use('*', async (c, next) => {
    await next()
    const isServiceWorker = c.req.path === '/sw.js'
    const isHtml = (c.res.headers.get('content-type') ?? '').includes('text/html')
    if (isServiceWorker || isHtml) {
      c.header('Cache-Control', 'max-age=0, must-revalidate')
    }
  })

  app.use('/*', serveStatic({ root: clientDir }))
  // SPA fallback: anything not a file and not /api is the app shell.
  app.get('*', serveStatic({ path: `${clientDir}/index.html` }))
}

/**
 * The API surface, built around injected dependencies so integration tests can
 * hand it an in-memory database and drive it through `app.request()`.
 */
export function createApp({ db, password, apiToken, clientDir }: AppDeps) {
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

  app.use('/api/*', requireApiAccess(password, apiToken))

  app.route('/api', bootstrapRoutes({ db }))
  app.route('/api', trackerRoutes({ db }))
  app.route('/api', entryRoutes({ db }))
  app.route('/api', categoryRoutes({ db }))

  // A typo'd or removed API path must fail loudly, not answer 200 with the
  // HTML shell (the SPA fallback below would otherwise catch it, same as any
  // other unmatched path). Registered after every route mount and after
  // requireApiAccess above, so an unauthenticated request to an unknown path
  // still 401s — route existence must never leak before auth.
  app.all('/api/*', (c) => c.json({ error: 'not found' }, 404))

  if (clientDir) serveClient(app, clientDir)

  return app
}

export type App = ReturnType<typeof createApp>
