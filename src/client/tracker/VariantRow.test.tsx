import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { VariantRow } from './VariantRow'

function renderRow(overrides: Partial<React.ComponentProps<typeof VariantRow>> = {}) {
  const props = {
    rowId: 'v1',
    name: 'front',
    thresholdDays: null,
    onNameCommit: vi.fn(),
    onThresholdChange: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  }
  render(<VariantRow {...props} />)
  return props
}

describe('VariantRow', () => {
  it('shows the variant name in a labelled input', () => {
    renderRow()
    expect((screen.getByLabelText('variant name') as HTMLInputElement).value).toBe('front')
  })

  it('commits a rename on blur, trimmed, only when changed', async () => {
    const user = userEvent.setup()
    const { onNameCommit } = renderRow()
    const input = screen.getByLabelText('variant name')

    await user.clear(input)
    await user.type(input, '  rear  ')
    await user.tab()

    expect(onNameCommit).toHaveBeenCalledWith('rear')
  })

  it('does not commit on blur when the name is unchanged', async () => {
    const user = userEvent.setup()
    const { onNameCommit } = renderRow()

    await user.click(screen.getByLabelText('variant name'))
    await user.tab()

    expect(onNameCommit).not.toHaveBeenCalled()
  })

  it('commits on Enter without submitting an ancestor form', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    const onNameCommit = vi.fn()
    render(
      <form onSubmit={onSubmit}>
        <VariantRow rowId="v1" name="front" thresholdDays={null} onNameCommit={onNameCommit} onThresholdChange={vi.fn()} onRemove={vi.fn()} />
      </form>,
    )

    await user.clear(screen.getByLabelText('variant name'))
    await user.type(screen.getByLabelText('variant name'), 'rear{Enter}')

    expect(onNameCommit).toHaveBeenCalledWith('rear')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("threshold picker labels its none chip 'inherit parent'", () => {
    renderRow()
    expect(screen.getByRole('button', { name: 'inherit parent' })).toBeTruthy()
  })

  it('calls onThresholdChange immediately on a preset click', async () => {
    const user = userEvent.setup()
    const { onThresholdChange } = renderRow()

    await user.click(screen.getByRole('button', { name: '1w' }))

    expect(onThresholdChange).toHaveBeenCalledWith(7)
  })

  it('calls onRemove immediately, with an accessible label naming the variant', async () => {
    const user = userEvent.setup()
    const { onRemove } = renderRow({ name: 'front' })

    await user.click(screen.getByRole('button', { name: 'remove front' }))

    expect(onRemove).toHaveBeenCalled()
  })

  it('shows per-field errors', () => {
    renderRow({ nameError: 'required', thresholdError: 'too big' })
    expect(screen.getByText('required')).toBeTruthy()
    expect(screen.getByText('too big')).toBeTruthy()
  })
})
