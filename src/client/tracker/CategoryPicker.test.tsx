import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Category } from '../api'
import { CategoryPicker } from './CategoryPicker'

const categories: Category[] = [
  { id: 'house', name: 'house', color: '#fff', createdAt: '' },
  { id: 'car', name: 'car', color: '#000', createdAt: '' },
]

describe('CategoryPicker', () => {
  it('renders a "none" chip plus one chip per category', () => {
    render(<CategoryPicker categories={categories} value={null} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'none' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'house' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'car' })).toBeTruthy()
  })

  it('marks the selected category pressed', () => {
    render(<CategoryPicker categories={categories} value="car" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'car' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'house' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('calls onChange with the category id, or null for "none"', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CategoryPicker categories={categories} value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'house' }))
    expect(onChange).toHaveBeenCalledWith('house')

    await user.click(screen.getByRole('button', { name: 'none' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('shows a field error', () => {
    render(<CategoryPicker categories={categories} value={null} onChange={() => {}} error="unknown category" />)
    expect(screen.getByText('unknown category')).toBeTruthy()
  })
})
