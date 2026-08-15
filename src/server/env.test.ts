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
