import { describe, expect, it } from 'vitest'
import { parseEnv } from './env.js'

describe('parseEnv', () => {
  it('defaults the port and data dir', () => {
    expect(parseEnv({ LAPSE_PASSWORD: 'hunter2' })).toEqual({
      PORT: 3000,
      DATA_DIR: '/data',
      LAPSE_PASSWORD: 'hunter2',
    })
  })

  it('reads the port as a number', () => {
    expect(parseEnv({ LAPSE_PASSWORD: 'x', PORT: '8080' }).PORT).toBe(8080)
  })

  it('refuses to boot without a password', () => {
    expect(() => parseEnv({})).toThrow(/LAPSE_PASSWORD/)
    expect(() => parseEnv({ LAPSE_PASSWORD: '' })).toThrow(/LAPSE_PASSWORD/)
  })

  it('refuses a nonsense port', () => {
    expect(() => parseEnv({ LAPSE_PASSWORD: 'x', PORT: 'http' })).toThrow(/PORT/)
    expect(() => parseEnv({ LAPSE_PASSWORD: 'x', PORT: '-1' })).toThrow(/PORT/)
  })
})

describe('optional secrets', () => {
  const base = { LAPSE_PASSWORD: 'pw' }

  it('leaves the api token unset when it is absent', () => {
    expect(parseEnv({ ...base } as NodeJS.ProcessEnv).LAPSE_API_TOKEN).toBeUndefined()
  })

  it('accepts a 32-character api token', () => {
    const token = 'a'.repeat(32)

    expect(parseEnv({ ...base, LAPSE_API_TOKEN: token } as NodeJS.ProcessEnv).LAPSE_API_TOKEN).toBe(token)
  })

  it('refuses a short api token rather than serving a guessable bypass of the login route', () => {
    expect(() => parseEnv({ ...base, LAPSE_API_TOKEN: 'lapse123' } as NodeJS.ProcessEnv)).toThrow(
      /LAPSE_API_TOKEN/,
    )
  })

  it('carries the telegram pair through', () => {
    const env = parseEnv({
      ...base,
      LAPSE_TELEGRAM_BOT_TOKEN: '123:abc',
      LAPSE_TELEGRAM_CHAT_ID: '4242',
    } as NodeJS.ProcessEnv)

    expect(env.LAPSE_TELEGRAM_BOT_TOKEN).toBe('123:abc')
    expect(env.LAPSE_TELEGRAM_CHAT_ID).toBe('4242')
  })
})

describe('blank optional secrets', () => {
  it('reads a blank api token as unset — .env ships the key empty', () => {
    const env = parseEnv({ LAPSE_PASSWORD: 'pw', LAPSE_API_TOKEN: '' } as NodeJS.ProcessEnv)

    expect(env.LAPSE_API_TOKEN).toBeUndefined()
  })

  it('reads blank telegram vars as unset, so no bot starts', () => {
    const env = parseEnv({
      LAPSE_PASSWORD: 'pw',
      LAPSE_TELEGRAM_BOT_TOKEN: '  ',
      LAPSE_TELEGRAM_CHAT_ID: '',
    } as NodeJS.ProcessEnv)

    expect(env.LAPSE_TELEGRAM_BOT_TOKEN).toBeUndefined()
    expect(env.LAPSE_TELEGRAM_CHAT_ID).toBeUndefined()
  })
})
