import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { scheduleBackups } from './backupSchedule.js'
import { openDatabase } from './db.js'
import { parseEnv } from './env.js'
import { seedCategories } from './seed.js'
import { startTelegramBot } from './telegram/bot.js'

const CLIENT_DIR = 'dist/client'

/** Boot per docs/tech-stack.md § Boot sequence: env, database, then serve. */
function boot() {
  const env = parseEnv()
  const db = openDatabase(env.DATA_DIR)
  seedCategories(db)
  scheduleBackups(db.$client, env.DATA_DIR)

  const clientBuilt = existsSync(CLIENT_DIR)
  const app = createApp({
    db,
    password: env.LAPSE_PASSWORD,
    apiToken: env.LAPSE_API_TOKEN,
    clientDir: clientBuilt ? CLIENT_DIR : undefined,
  })

  // Both or neither: a bot token with no chat id would answer anyone who
  // finds it. Absent, lapse is exactly what it was before.
  if (env.LAPSE_TELEGRAM_BOT_TOKEN && env.LAPSE_TELEGRAM_CHAT_ID) {
    startTelegramBot({
      db,
      botToken: env.LAPSE_TELEGRAM_BOT_TOKEN,
      chatId: env.LAPSE_TELEGRAM_CHAT_ID,
    })
    console.log('telegram bot polling')
  }

  if (!clientBuilt) {
    app.get('/', (c) => c.text('lapse — client not built yet (pnpm build)'))
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
