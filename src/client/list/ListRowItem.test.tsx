import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ListRowItem } from './ListRowItem'
import type { ListRow } from './buildListRows'

const NOW = new Date('2026-08-15T12:00:00.000Z')

function row(overrides: Partial<ListRow> = {}): ListRow {
  return {
    key: 'k',
    trackerId: 't',
    variantId: null,
    name: 'vacuum house',
    variantName: null,
    categoryId: null,
    thresholdDays: 7,
    lastEntryAt: null,
    urgency: 'never',
    ...overrides,
  }
}

/** the row's own tap-to-log button, as distinct from the swipe-revealed "details" one. */
function tapButton(): HTMLElement {
  return screen.getByRole('button', { name: /vacuum house/ })
}

describe('ListRowItem', () => {
  it('renders inside a real, focusable button so the whole row is one 44px+ tap target', () => {
    render(<ListRowItem row={row({ urgency: 'overdue', lastEntryAt: '2026-08-01T00:00:00.000Z' })} now={NOW} />)

    const listItem = screen.getByRole('listitem')
    const button = tapButton()
    expect(button.getAttribute('type')).toBe('button')
    expect(listItem.contains(button)).toBe(true)
    expect(button.textContent).toContain('vacuum house')
  })

  it('calls onTap with the row when clicked (build ticket 12)', () => {
    const onTap = vi.fn()
    const theRow = row({ urgency: 'overdue', lastEntryAt: '2026-08-01T00:00:00.000Z' })
    render(<ListRowItem row={theRow} now={NOW} onTap={onTap} />)

    fireEvent.click(tapButton())

    expect(onTap).toHaveBeenCalledWith(theRow)
  })

  it('preserves the existing urgency classes and bar on the row surface, restructuring does not change them', () => {
    render(<ListRowItem row={row({ urgency: 'overdue', lastEntryAt: '2026-08-01T00:00:00.000Z' })} now={NOW} />)

    // the classes moved from the <li> onto the sliding surface inside it when
    // the swipe wrapper took over rendering the <li> (build ticket 15).
    const surface = document.querySelector('.swipe-row__content') as HTMLElement
    expect(screen.getByRole('listitem').contains(surface)).toBe(true)
    expect(surface.className).toContain('list-row--overdue')
    expect(surface.querySelector('.list-row__bar--overdue')).toBeTruthy()
  })

  it('a justLogged row shows "now" and the settle animation class', () => {
    render(
      <ListRowItem
        row={row({ urgency: 'fresh', lastEntryAt: NOW.toISOString() })}
        now={NOW}
        justLogged
      />,
    )

    expect(tapButton().className).toContain('log-settle')
    expect(screen.getByText('now')).toBeTruthy()
  })

  // docs/design.md § List: swipe left reveals a single "details" action, and
  // that is the only way into the detail screen — tap and long-press are both
  // spent on logging.
  it('offers a details action that opens the row detail (build ticket 15)', () => {
    const onOpenDetail = vi.fn()
    const theRow = row({ urgency: 'overdue', lastEntryAt: '2026-08-01T00:00:00.000Z' })
    render(<ListRowItem row={theRow} now={NOW} onOpenDetail={onOpenDetail} />)

    fireEvent.click(screen.getByRole('button', { name: 'details' }))

    expect(onOpenDetail).toHaveBeenCalledWith(theRow)
  })

  it('without justLogged, shows the ordinary day-bucketed count', () => {
    render(<ListRowItem row={row({ urgency: 'overdue', lastEntryAt: '2026-08-01T00:00:00.000Z' })} now={NOW} />)

    expect(screen.getByText('14d')).toBeTruthy()
    expect(tapButton().className).not.toContain('log-settle')
  })
})
