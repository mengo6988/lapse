import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { issueSession, matches, requireSession } from './auth.js'
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
  app.post('/api/auth/login', loginRateLimit(), zValidator('json', loginSchema), (c) => {
    if (!matches(c.req.valid('json').password, password)) {
      return c.json({ error: 'wrong password' }, 401)
    }
    issueSession(c, password)
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
