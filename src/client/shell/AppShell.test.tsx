import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bootstrapQueryKey } from '../query/useBootstrap'
import { session } from '../auth/session'
import { AppShell } from './AppShell'

// HomeRoute and TrackerSheetHost both read the bootstrap query cache
// (ticket 08/14), so any AppShell render needs a QueryClientProvider
// ancestor. The cache is pre-seeded so these render/navigation tests never
// need a real fetch; stubbing fetch too is a defensive belt-and-braces.
function renderShell(initialPath = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  queryClient.setQueryData(bootstrapQueryKey, { categories: [], trackers: [] })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppShell />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  session.reset()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ categories: [], trackers: [] }) }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AppShell', () => {
  it('shows the login screen when the session is unauthorized', () => {
    session.markUnauthorized()
    renderShell()
    expect(screen.getByRole('button', { name: 'log in' })).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'tabs' })).toBeNull()
  })

  it('shows the tabbed app when the session is authed', () => {
    session.markAuthed()
    renderShell()
    expect(screen.getByRole('navigation', { name: 'tabs' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'home' })).toBeTruthy()
  })

  it('shows the tabbed app when the session state is still unknown', () => {
    // reset() leaves state 'unknown' — per build ticket 09 only
    // 'unauthorized' swaps in the login screen.
    renderShell()
    expect(screen.getByRole('navigation', { name: 'tabs' })).toBeTruthy()
  })

  it('tapping the list tab navigates to the list route', async () => {
    session.markAuthed()
    renderShell()
    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: 'list' }))
    expect(screen.getByRole('region', { name: 'list' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'home' })).toBeNull()
  })

  it('tapping the activity tab reaches the honest stub', async () => {
    session.markAuthed()
    renderShell()
    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: 'activity' }))
    expect(screen.getByText('activity')).toBeTruthy()
    expect(screen.getByText(/not built yet/)).toBeTruthy()
  })

  it('tapping the settings tab reaches the honest stub', async () => {
    session.markAuthed()
    renderShell()
    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: 'settings' }))
    expect(screen.getByText('settings')).toBeTruthy()
    expect(screen.getByText(/not built yet/)).toBeTruthy()
  })

  it('an unknown path redirects home', () => {
    session.markAuthed()
    renderShell('/nowhere')
    expect(screen.getByRole('region', { name: 'home' })).toBeTruthy()
  })
})
