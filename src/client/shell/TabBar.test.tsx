import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { trackerSheetStore } from '../tracker'
import { TabBar } from './TabBar'

describe('TabBar', () => {
  afterEach(() => {
    trackerSheetStore.close()
  })

  it('renders the five nav slots: home, list, new tracker, activity, settings', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TabBar />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'home' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'list' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'new tracker' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'activity' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'settings' })).toBeTruthy()
  })

  it('marks only the active route with aria-current', () => {
    render(
      <MemoryRouter initialEntries={['/list']}>
        <TabBar />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'list' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'home' }).getAttribute('aria-current')).toBeNull()
  })

  it('the FAB is a real button, reachable by keyboard', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TabBar />
      </MemoryRouter>,
    )
    const fab = screen.getByRole('button', { name: 'new tracker' })
    expect(fab.tagName).toBe('BUTTON')
    expect(fab.tabIndex).not.toBe(-1)
  })

  it('the FAB opens the create-Tracker sheet (ticket 14)', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <TabBar />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'new tracker' }))

    expect(trackerSheetStore.read().mode).toBe('create')
  })
})
