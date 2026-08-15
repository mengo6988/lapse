import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createApp } from './app.js'
import { scheduleBackups } from './backupSchedule.js'
import { openDatabase } from './db.js'
import { parseEnv } from './env.js'
import { seedCategories } from './seed.js'

const CLIENT_DIR = 'dist/client'

/** Boot per docs/tech-stack.md § Boot sequence: env, database, then serve. */
function boot() {
  const env = parseEnv()
  const db = openDatabase(env.DATA_DIR)
  seedCategories(db)
  scheduleBackups(db.$client, env.DATA_DIR)

  const app = createApp({ db, password: env.LAPSE_PASSWORD })

  // The service worker and the entry HTML must always be revalidated, or a
  // deploy is invisible to an installed PWA (docs/tech-stack.md § SW update).
  app.use('/sw.js', async (c, next) => {
    await next()
    c.header('Cache-Control', 'max-age=0, must-revalidate')
  })
  app.use('/index.html', async (c, next) => {
    await next()
    c.header('Cache-Control', 'max-age=0, must-revalidate')
  })

  if (existsSync(CLIENT_DIR)) {
    app.use('/*', serveStatic({ root: CLIENT_DIR }))
    // SPA fallback: anything not a file and not /api is the app shell.
    app.get('*', serveStatic({ path: `${CLIENT_DIR}/index.html` }))
  } else {
    app.get('/', (c) => c.text('lapse — client not built yet (npm run build)'))
  }

  serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
    console.log(`lapse listening on :${port}`)
  })
}

try {
  boot()
} catch (error) {
  console.error('boot failed:', error instanceof Error ? error.message : error)
  process.exit(1)
}
