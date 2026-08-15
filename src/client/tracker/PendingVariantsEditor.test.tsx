import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PendingVariantsEditor, type PendingVariant } from './PendingVariantsEditor'

describe('PendingVariantsEditor', () => {
  it('renders no rows and an add button when empty', () => {
    render(<PendingVariantsEditor value={[]} onChange={() => {}} fieldErrors={{}} />)
    expect(screen.queryByLabelText('variant name')).toBeNull()
    expect(screen.getByRole('button', { name: 'add variant' })).toBeTruthy()
  })

  it('appends a blank draft row on "add variant"', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PendingVariantsEditor value={[]} onChange={onChange} fieldErrors={{}} />)

    await user.click(screen.getByRole('button', { name: 'add variant' }))

    expect(onChange).toHaveBeenCalledWith([{ localId: expect.any(String), name: '', thresholdDays: null }])
  })

  it('updates the row in place when its name is committed', async () => {
    const user = userEvent.setup()
    const value: PendingVariant[] = [{ localId: 'draft-1', name: '', thresholdDays: null }]
    const onChange = vi.fn()
    render(<PendingVariantsEditor value={value} onChange={onChange} fieldErrors={{}} />)

    await user.type(screen.getByLabelText('variant name'), 'front')
    await user.tab()

    expect(onChange).toHaveBeenCalledWith([{ localId: 'draft-1', name: 'front', thresholdDays: null }])
  })

  it('drops a row on remove', async () => {
    const user = userEvent.setup()
    const value: PendingVariant[] = [{ localId: 'draft-1', name: 'front', thresholdDays: null }]
    const onChange = vi.fn()
    render(<PendingVariantsEditor value={value} onChange={onChange} fieldErrors={{}} />)

    await user.click(screen.getByRole('button', { name: 'remove front' }))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('maps nested field errors to the row by index', () => {
    const value: PendingVariant[] = [{ localId: 'draft-1', name: '', thresholdDays: null }]
    render(
      <PendingVariantsEditor
        value={value}
        onChange={() => {}}
        fieldErrors={{ 'variants.0.name': 'required', 'variants.0.thresholdDays': 'too big' }}
      />,
    )

    expect(screen.getByText('required')).toBeTruthy()
    expect(screen.getByText('too big')).toBeTruthy()
  })
})
