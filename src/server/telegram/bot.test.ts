import { eq } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'
import { describe, expect, it } from 'vitest'
import type { Db } from '../db.js'
import { entries, trackers, variants } from '../schema.js'
import { createTestDb } from '../testing.js'
import { handleMessage, updateReply } from './bot.js'

const NOW = new Date('2026-08-22T12:00:00.000Z')

function addTracker(db: Db, name: string, thresholdDays: number | null = null): string {
  const id = uuidv7()
  db.insert(trackers)
    .values({ id, name, categoryId: null, thresholdDays, archivedAt: null, createdAt: new Date().toISOString() })
    .run()
  return id
}

function addVariant(db: Db, trackerId: string, name: string): string {
  const id = uuidv7()
  db.insert(variants)
    .values({ id, trackerId, name, thresholdDays: null, deletedAt: null, createdAt: new Date().toISOString() })
    .run()
  return id
}

function addEntry(db: Db, trackerId: string, occurredAt: string, variantId: string | null = null): void {
  db.insert(entries)
    .values({ id: uuidv7(), trackerId, variantId, occurredAt, durationMinutes: null, note: null, createdAt: occurredAt })
    .run()
}

describe('handleMessage', () => {
  it('logs an Entry for a matched name and says how long it had been', () => {
    const db = createTestDb()
    const trackerId = addTracker(db, 'vacuuming', 7)
    addEntry(db, trackerId, '2026-08-10T12:00:00.000Z')

    const reply = handleMessage(db, 'vacuuming', NOW)

    expect(reply.text).toBe('logged ✓ vacuuming · was 12d ago')
    expect(db.select().from(entries).all()).toHaveLength(2)
  })

  it('says "first time" for a Tracker that has never been logged', () => {
    const db = createTestDb()
    addTracker(db, 'vacuuming')

    expect(handleMessage(db, 'vacuuming', NOW).text).toBe('logged ✓ vacuuming · first time')
  })

  it('attributes a Variant log to that Variant, not the Tracker', () => {
    const db = createTestDb()
    const trackerId = addTracker(db, 'tyre pressure')
    const volvo = addVariant(db, trackerId, 'volvo')
    addVariant(db, trackerId, 'crv')

    handleMessage(db, 'tyre pressure · volvo', NOW)

    const written = db.select().from(entries).all()
    expect(written).toHaveLength(1)
    expect(written[0]?.variantId).toBe(volvo)
  })

  it('writes nothing when the name is ambiguous', () => {
    const db = createTestDb()
    const trackerId = addTracker(db, 'tyre pressure')
    addVariant(db, trackerId, 'volvo')
    addVariant(db, trackerId, 'crv')

    const reply = handleMessage(db, 'tyre', NOW)

    expect(reply.text).toBe('which one?\n· tyre pressure · volvo\n· tyre pressure · crv')
    expect(db.select().from(entries).all()).toHaveLength(0)
  })

  it('writes nothing when nothing matches', () => {
    const db = createTestDb()
    addTracker(db, 'vacuuming')

    expect(handleMessage(db, 'oil change', NOW).text).toContain('no match')
    expect(db.select().from(entries).all()).toHaveLength(0)
  })

  it('says so when there is nothing to log yet', () => {
    expect(handleMessage(createTestDb(), 'anything', NOW).text).toBe('no trackers yet')
  })

  it('does not log an archived Tracker', () => {
    const db = createTestDb()
    const trackerId = addTracker(db, 'vacuuming')
    db.update(trackers).set({ archivedAt: NOW.toISOString() }).where(eq(trackers.id, trackerId)).run()

    expect(handleMessage(db, 'vacuuming', NOW).text).toBe('no trackers yet')
    expect(db.select().from(entries).all()).toHaveLength(0)
  })

  describe('/start', () => {
    it('returns the buttons, one per row', () => {
      const db = createTestDb()
      addTracker(db, 'vacuuming')
      const trackerId = addTracker(db, 'tyre pressure')
      addVariant(db, trackerId, 'volvo')

      expect(handleMessage(db, '/start', NOW).keyboard).toEqual(['vacuuming', 'tyre pressure · volvo'])
    })

    it('answers /start@botname too — groups append the bot name', () => {
      const db = createTestDb()
      addTracker(db, 'vacuuming')

      expect(handleMessage(db, '/start@lapsebot', NOW).keyboard).toEqual(['vacuuming'])
    })

    it('logs nothing', () => {
      const db = createTestDb()
      addTracker(db, 'vacuuming')

      handleMessage(db, '/keyboard', NOW)

      expect(db.select().from(entries).all()).toHaveLength(0)
    })
  })

  describe('/status', () => {
    it('lists what is slipping, most overdue first', () => {
      const db = createTestDb()
      const weekly = addTracker(db, 'weekly', 7)
      const monthly = addTracker(db, 'monthly', 30)
      addEntry(db, weekly, '2026-08-14T12:00:00.000Z') // 8d on 7d  → 1.14
      addEntry(db, monthly, '2026-06-23T12:00:00.000Z') // 60d on 30d → 2.0

      expect(handleMessage(db, '/status', NOW).text).toBe(
        'monthly — 60d ago · every 30d\nweekly — 8d ago · every 7d',
      )
    })

    it('says "nothing slipping" when nothing is', () => {
      const db = createTestDb()
      addTracker(db, 'vacuuming', 30)

      expect(handleMessage(db, '/status', NOW).text).toBe('nothing slipping')
    })
  })
})

describe('updateReply', () => {
  const CHAT_ID = '4242'
  const update = (chatId: number, text?: string) => ({
    update_id: 1,
    message: { message_id: 1, chat: { id: chatId }, ...(text === undefined ? {} : { text }) },
  })

  it('answers the one allowed chat', () => {
    const db = createTestDb()
    addTracker(db, 'vacuuming')

    expect(updateReply(db, update(4242, 'vacuuming'), CHAT_ID, NOW)?.text).toContain('logged ✓')
  })

  it('ignores every other chat, and writes nothing — anyone can find the bot', () => {
    const db = createTestDb()
    addTracker(db, 'vacuuming')

    expect(updateReply(db, update(9999, 'vacuuming'), CHAT_ID, NOW)).toBeNull()
    expect(db.select().from(entries).all()).toHaveLength(0)
  })

  it('stays silent rather than refusing — a reply would confirm the bot is live', () => {
    expect(updateReply(createTestDb(), update(9999, '/start'), CHAT_ID, NOW)).toBeNull()
  })

  it('ignores an update with no message at all', () => {
    expect(updateReply(createTestDb(), { update_id: 1 }, CHAT_ID, NOW)).toBeNull()
  })

  it('ignores a message with no text — a photo is not a log', () => {
    expect(updateReply(createTestDb(), update(4242), CHAT_ID, NOW)).toBeNull()
  })
})
