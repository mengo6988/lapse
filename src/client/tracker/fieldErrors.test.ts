import { describe, expect, it } from 'vitest'
import { parseFieldErrors, parseGenericError } from './fieldErrors'

describe('parseFieldErrors', () => {
  it('maps a zod-validator issue to its top-level field name', () => {
    const body = {
      success: false,
      error: { issues: [{ path: ['name'], message: 'String must contain at least 1 character(s)' }] },
    }

    expect(parseFieldErrors(body)).toEqual({ name: 'String must contain at least 1 character(s)' })
  })

  it('joins a nested path with dots (e.g. a variant inside an inline create payload)', () => {
    const body = {
      success: false,
      error: { issues: [{ path: ['variants', 0, 'name'], message: 'required' }] },
    }

    expect(parseFieldErrors(body)).toEqual({ 'variants.0.name': 'required' })
  })

  it('keeps the first message when two issues target the same field', () => {
    const body = {
      success: false,
      error: {
        issues: [
          { path: ['thresholdDays'], message: 'too small' },
          { path: ['thresholdDays'], message: 'too big' },
        ],
      },
    }

    expect(parseFieldErrors(body)).toEqual({ thresholdDays: 'too small' })
  })

  it('returns an empty map for a body with no issues', () => {
    expect(parseFieldErrors({ success: false, error: { issues: [] } })).toEqual({})
  })

  it('returns an empty map for a body that is not a zod-validator failure', () => {
    expect(parseFieldErrors({ error: 'tracker not found' })).toEqual({})
    expect(parseFieldErrors(undefined)).toEqual({})
    expect(parseFieldErrors(null)).toEqual({})
    expect(parseFieldErrors('boom')).toEqual({})
  })
})

describe('parseGenericError', () => {
  it('reads the plain { error: string } shape routes use for non-validation failures', () => {
    expect(parseGenericError({ error: 'tracker not found' })).toBe('tracker not found')
  })

  it('falls back to a copy-voice message when the body has no usable error string', () => {
    expect(parseGenericError({ success: false, error: { issues: [] } })).toBe("couldn't save — try again")
    expect(parseGenericError(undefined)).toBe("couldn't save — try again")
  })
})
