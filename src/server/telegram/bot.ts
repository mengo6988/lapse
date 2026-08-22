/**
 * Logging without opening the app (the user's own idea, and the shortest
 * answer to "make tracking as easy as possible" for anything that isn't an
 * iPhone with an Action Button).
 *
 * Open the chat, tap the button with the Tracker's name, done — the keyboard
 * is built from the live database, so it can't go stale the way a hardcoded
 * Shortcuts menu does, and it works from a watch, a laptop, or someone else's
 * phone. Typing part of a name works too.
 *
 * Two secrets, both required together or the bot never starts:
 *   LAPSE_TELEGRAM_BOT_TOKEN  from @BotFather
 *   LAPSE_TELEGRAM_CHAT_ID    the one chat allowed to talk to it
 *
 * The chat allowlist is the entire authorisation model, and it has to be:
 * anyone who finds the bot's @name can message it, and the token in the URL
 * only proves *this* process is the bot, never who is on the other end. A
 * message from any other chat is dropped without a reply — an "unauthorised"
 * answer would confirm the bot is live and worth attacking.
 */
import type { Db } from '../db.js'
import { createEntry } from '../entryWrites.js'
import { getUpdates, sendMessage, type TelegramUpdate } from './api.js'
import { daysSince, loggableRows, matchRow, slippingRows } from './rows.js'

/** Telegram holds the connection open this long when there is nothing waiting. */
const POLL_TIMEOUT_SECONDS = 30
/** after a failed poll — a Telegram outage, or no network — before trying again. */
const RETRY_DELAY_MS = 5000
/** Telegram caps a custom keyboard's usefulness long before this; a wall of buttons is not a menu. */
const KEYBOARD_LIMIT = 12

const HELP = [
  'lapse',
  '',
  'tap a button, or type part of a tracker name, to log it.',
  '/status — what is slipping',
  '/keyboard — rebuild the buttons after adding a tracker',
].join('\n')

export interface TelegramBotOptions {
  readonly db: Db
  readonly botToken: string
  readonly chatId: string
  readonly now?: () => Date
}

export interface BotReply {
  readonly text: string
  /** replaces the chat's persistent button list; omitted leaves it alone. */
  readonly keyboard?: string[]
}

/**
 * What to say back to one update, or `null` to say nothing at all.
 *
 * The chat allowlist lives here rather than in the loop so it is testable
 * without a network: it is the bot's entire authorisation model, and a
 * regression in it would hand a stranger the ability to write to the
 * database. Silence rather than a refusal is deliberate — an "unauthorised"
 * reply confirms the bot is live and worth attacking.
 */
export function updateReply(
  db: Db,
  update: TelegramUpdate,
  chatId: string,
  now: Date,
): BotReply | null {
  const message = update.message
  if (!message?.text) return null
  if (String(message.chat.id) !== chatId) return null
  return handleMessage(db, message.text, now)
}

/**
 * The reply to one line of chat text. Everything the bot actually decides
 * lives here — what a name matches, what gets written, what comes back — with
 * the network kept out at both ends, so all of it is testable against an
 * in-memory database.
 */
export function handleMessage(db: Db, text: string, now: Date): BotReply {
  const rows = loggableRows(db)
  const command = text.trim().toLowerCase().split(/[\s@]/)[0]

  if (command === '/start' || command === '/help' || command === '/keyboard') {
    return { text: HELP, keyboard: rows.slice(0, KEYBOARD_LIMIT).map((row) => row.label) }
  }

  if (command === '/status') {
    const slipping = slippingRows(rows, now)
    if (slipping.length === 0) return { text: 'nothing slipping' }
    return {
      text: slipping
        .map((row) => `${row.label} — ${daysSince(row.lastEntryAt, now)}d ago · every ${row.thresholdDays}d`)
        .join('\n'),
    }
  }

  const match = matchRow(rows, text)

  if (match.kind === 'none') {
    return { text: rows.length === 0 ? 'no trackers yet' : 'no match — /status, or /keyboard for the buttons' }
  }

  if (match.kind === 'many') {
    return { text: ['which one?', ...match.rows.map((row) => `· ${row.label}`)].join('\n') }
  }

  const result = createEntry(db, {
    trackerId: match.row.trackerId,
    ...(match.row.variantId === null ? {} : { variantId: match.row.variantId }),
  })
  if (!result.ok) return { text: `couldn't log — ${result.error}` }

  // The count is the row's *previous* last-done: "you last did this 12 days
  // ago" is the one fact worth carrying back, and it's gone the moment this
  // write lands.
  const previous = daysSince(match.row.lastEntryAt, now)
  const since = previous === null ? 'first time' : `was ${previous}d ago`
  return { text: `logged ✓ ${match.row.label} · ${since}` }
}

/**
 * Starts the poll loop. Returns a stop function; calling it aborts the
 * in-flight long poll and ends the loop, so a shutdown doesn't wait out
 * Telegram's 30 second hold.
 */
export function startTelegramBot({ db, botToken, chatId, now = () => new Date() }: TelegramBotOptions): () => void {
  const controller = new AbortController()
  let offset = 0

  async function poll(): Promise<void> {
    while (!controller.signal.aborted) {
      try {
        const updates = await getUpdates(botToken, offset, POLL_TIMEOUT_SECONDS, controller.signal)
        for (const update of updates) {
          // Advanced before handling, not after: the next getUpdates is what
          // acknowledges it, and a message this bot chokes on must not come
          // back forever. A log lost to a crash is one tap to redo; an
          // un-acknowledged poison message is a loop that never drains.
          offset = update.update_id + 1
          await handleUpdate(update)
        }
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('telegram poll failed:', error instanceof Error ? error.message : error)
        await sleep(RETRY_DELAY_MS, controller.signal)
      }
    }
  }

  async function handleUpdate(update: TelegramUpdate): Promise<void> {
    try {
      const reply = updateReply(db, update, chatId, now())
      if (!reply) return
      await sendMessage(botToken, { chatId, text: reply.text, keyboard: reply.keyboard ?? null })
    } catch (error) {
      // The Entry may well have been written before the reply failed to send.
      // Losing the confirmation is survivable; crashing the poll loop is not.
      console.error('telegram reply failed:', error instanceof Error ? error.message : error)
    }
  }

  void poll()
  return () => controller.abort()
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}
