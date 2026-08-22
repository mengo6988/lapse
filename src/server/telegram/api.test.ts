import { afterEach, describe, expect, it, vi } from 'vitest'
import { getUpdates, sendMessage, TelegramError } from './api.js'

const BOT_TOKEN = '123456:abcdef'

function stubFetch(payload: unknown, status = 200) {
  const fetchMock = vi.fn(
    async (_url: string, _init: RequestInit) => ({ status, json: async () => payload }) as unknown as Response,
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function initOf(fetchMock: ReturnType<typeof stubFetch>): RequestInit {
  return fetchMock.mock.calls[0]![1]
}

function bodyOf(fetchMock: ReturnType<typeof stubFetch>): Record<string, unknown> {
  return JSON.parse(initOf(fetchMock).body as string)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getUpdates', () => {
  it('long-polls with the offset and asks only for messages', async () => {
    const fetchMock = stubFetch({ ok: true, result: [{ update_id: 7 }] })

    const updates = await getUpdates(BOT_TOKEN, 5, 30, new AbortController().signal)

    expect(updates).toEqual([{ update_id: 7 }])
    expect(fetchMock.mock.calls[0]![0]).toBe(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`)
    expect(bodyOf(fetchMock)).toEqual({ offset: 5, timeout: 30, allowed_updates: ['message'] })
  })

  it('throws with Telegram\'s own description when the call is refused', async () => {
    stubFetch({ ok: false, description: 'Unauthorized' })

    await expect(getUpdates(BOT_TOKEN, 0, 30, new AbortController().signal)).rejects.toThrow(
      TelegramError,
    )
  })

  it('passes the abort signal through, so a shutdown does not wait out the poll', async () => {
    const fetchMock = stubFetch({ ok: true, result: [] })
    const controller = new AbortController()

    await getUpdates(BOT_TOKEN, 0, 30, controller.signal)

    expect(initOf(fetchMock).signal).toBe(controller.signal)
  })
})

describe('sendMessage', () => {
  it('sends plain text to the one allowed chat', async () => {
    const fetchMock = stubFetch({ ok: true, result: {} })

    await sendMessage(BOT_TOKEN, { chatId: '4242', text: 'logged ✓ vacuuming' })

    expect(bodyOf(fetchMock)).toEqual({ chat_id: '4242', text: 'logged ✓ vacuuming' })
  })

  it('builds a persistent one-button-per-row keyboard', async () => {
    const fetchMock = stubFetch({ ok: true, result: {} })

    await sendMessage(BOT_TOKEN, { chatId: '4242', text: 'lapse', keyboard: ['vacuuming', 'run'] })

    expect(bodyOf(fetchMock).reply_markup).toEqual({
      keyboard: [[{ text: 'vacuuming' }], [{ text: 'run' }]],
      resize_keyboard: true,
      is_persistent: true,
    })
  })

  it('leaves the showing keyboard alone when none is given', async () => {
    const fetchMock = stubFetch({ ok: true, result: {} })

    await sendMessage(BOT_TOKEN, { chatId: '4242', text: 'nothing slipping', keyboard: null })

    expect(bodyOf(fetchMock)).not.toHaveProperty('reply_markup')
  })
})
