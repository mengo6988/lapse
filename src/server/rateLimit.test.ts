import { describe, expect, it } from 'vitest'
import { createFixedWindowLimiter, extractClientKey } from './rateLimit.js'

describe('extractClientKey', () => {
  it('uses the single hop when the header carries only one', () => {
    expect(extractClientKey('203.0.113.9')).toBe('203.0.113.9')
  })

  it('trusts the last hop, not a spoofed leading one, on a multi-hop header', () => {
    // A client can send its own X-Forwarded-For before reaching Traefik.
    // Traefik appends the real observed peer address to the END of the
    // header rather than replacing it, so "1.2.3.4" here is attacker-chosen
    // and "5.6.7.8" is the one Traefik itself set.
    expect(extractClientKey('1.2.3.4, 5.6.7.8')).toBe('5.6.7.8')
  })

  it('trims whitespace around hops', () => {
    expect(extractClientKey('1.2.3.4 ,  5.6.7.8  ')).toBe('5.6.7.8')
  })

  it('falls back to a shared unknown bucket when the header is absent', () => {
    expect(extractClientKey(undefined)).toBe('unknown')
    expect(extractClientKey(null)).toBe('unknown')
  })

  it('falls back to unknown for an empty or whitespace-only header', () => {
    expect(extractClientKey('')).toBe('unknown')
    expect(extractClientKey('   ')).toBe('unknown')
  })

  it('ignores a dangling trailing comma', () => {
    expect(extractClientKey('9.9.9.9, ')).toBe('9.9.9.9')
  })
})

describe('createFixedWindowLimiter', () => {
  it('allows exactly the first 10 attempts in a window and refuses the 11th', () => {
    let now = 0
    const limiter = createFixedWindowLimiter({ now: () => now })

    for (let i = 0; i < 10; i++) {
      expect(limiter.attempt('1.1.1.1')).toBe(true)
    }
    expect(limiter.attempt('1.1.1.1')).toBe(false)
  })

  it('allows attempts again once the 15-minute window has elapsed', () => {
    let now = 0
    const limiter = createFixedWindowLimiter({ now: () => now })

    for (let i = 0; i < 10; i++) limiter.attempt('1.1.1.1')
    expect(limiter.attempt('1.1.1.1')).toBe(false)

    now += 15 * 60 * 1000 // exactly one window later
    expect(limiter.attempt('1.1.1.1')).toBe(true)
  })

  it('does not allow the window to reset before it has actually elapsed', () => {
    let now = 0
    const limiter = createFixedWindowLimiter({ now: () => now })

    for (let i = 0; i < 10; i++) limiter.attempt('1.1.1.1')
    now += 15 * 60 * 1000 - 1 // one millisecond short of the window
    expect(limiter.attempt('1.1.1.1')).toBe(false)
  })

  it('tracks separate keys independently', () => {
    let now = 0
    const limiter = createFixedWindowLimiter({ now: () => now })

    for (let i = 0; i < 10; i++) limiter.attempt('1.1.1.1')
    expect(limiter.attempt('1.1.1.1')).toBe(false)
    expect(limiter.attempt('2.2.2.2')).toBe(true)
  })

  it('defaults to 10 attempts per 15 minutes when not configured', () => {
    const limiter = createFixedWindowLimiter()
    for (let i = 0; i < 10; i++) {
      expect(limiter.attempt('3.3.3.3')).toBe(true)
    }
    expect(limiter.attempt('3.3.3.3')).toBe(false)
  })
})
