import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ArchiveSection } from './ArchiveSection'

describe('ArchiveSection', () => {
  it('shows only the archive trigger initially, no confirm copy', () => {
    render(<ArchiveSection onArchive={() => {}} />)
    expect(screen.getByRole('button', { name: 'archive' })).toBeTruthy()
    expect(screen.queryByText(/hidden from home and list/)).toBeNull()
  })

  it('reveals an inline confirm on first click, without calling onArchive yet', async () => {
    const user = userEvent.setup()
    const onArchive = vi.fn()
    render(<ArchiveSection onArchive={onArchive} />)

    await user.click(screen.getByRole('button', { name: 'archive' }))

    expect(screen.getByText(/hidden from home and list/)).toBeTruthy()
    expect(onArchive).not.toHaveBeenCalled()
  })

  it('cancel returns to the initial state', async () => {
    const user = userEvent.setup()
    render(<ArchiveSection onArchive={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'archive' }))
    await user.click(screen.getByRole('button', { name: 'cancel' }))

    expect(screen.queryByText(/hidden from home and list/)).toBeNull()
  })

  it('calls onArchive on the second (confirming) click', async () => {
    const user = userEvent.setup()
    const onArchive = vi.fn()
    render(<ArchiveSection onArchive={onArchive} />)

    await user.click(screen.getByRole('button', { name: 'archive' }))
    await user.click(screen.getByRole('button', { name: 'archive' }))

    expect(onArchive).toHaveBeenCalled()
  })

  it('disables the confirm button while archiving', async () => {
    const user = userEvent.setup()
    render(<ArchiveSection onArchive={() => {}} archiving />)

    await user.click(screen.getByRole('button', { name: 'archive' }))

    expect(screen.getByRole('button', { name: 'archive' }).hasAttribute('disabled')).toBe(true)
  })

  it('shows a server error', () => {
    render(<ArchiveSection onArchive={() => {}} error="couldn't save — try again" />)
    expect(screen.getByText("couldn't save — try again")).toBeTruthy()
  })
})
