import { describe, expect, it } from 'vitest'
import { normalizeColor } from './color'

describe('normalizeColor', () => {
  it('lowercases an uppercase hex color', () => {
    expect(normalizeColor('#B4BEFE')).toBe('#b4befe')
  })

  it('leaves an already-lowercase color unchanged', () => {
    expect(normalizeColor('#b4befe')).toBe('#b4befe')
  })

  it('lowercases a mixed-case color', () => {
    expect(normalizeColor('#B4bEfE')).toBe('#b4befe')
  })
})
