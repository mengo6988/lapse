import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ActivityRoute } from './ActivityRoute'
import { SettingsRoute } from './SettingsRoute'

// per build ticket 09: activity and settings are honest stubs until
// milestone 5 — they must say so on screen, not fake content.
describe('stub routes', () => {
  it('activity announces itself as not built yet', () => {
    render(<ActivityRoute />)
    expect(screen.getByText('activity')).toBeTruthy()
    expect(screen.getByText(/not built yet/)).toBeTruthy()
  })

  it('settings announces itself as not built yet', () => {
    render(<SettingsRoute />)
    expect(screen.getByText('settings')).toBeTruthy()
    expect(screen.getByText(/not built yet/)).toBeTruthy()
  })
})
