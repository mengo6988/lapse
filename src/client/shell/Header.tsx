import { useNavigate } from 'react-router-dom'
import { PendingChip } from '../outbox/PendingChip'
import { SearchIcon } from './icons'

/**
 * wordmark + pending chip + magnifier. the sliders icon was deliberately
 * dropped (docs/design.md § Navigation) — it duplicated the tab bar's
 * settings slot and the list's filter chips. the magnifier always routes to
 * the list tab with search open; the list route itself owns opening the
 * input in place.
 *
 * The pending chip (build ticket 19) renders unconditionally here rather
 * than only on the home tab, which is where docs/design.md's § Feel section
 * describes it living: Header is shared chrome across every tab, and
 * hiding "your logs haven't landed" on four of five tabs is worse than
 * showing it everywhere — a queued write is app-wide state, not a
 * home-screen concern. It renders nothing itself while the outbox is
 * empty, so this costs nothing on the (overwhelmingly common) synced path.
 */
export function Header() {
  const navigate = useNavigate()

  function openSearch() {
    navigate({ pathname: '/list', search: '?search=open' })
  }

  return (
    <header className="app-header">
      <span className="app-header__wordmark">lapse</span>
      <PendingChip />
      <button type="button" className="icon-button" aria-label="search" onClick={openSearch}>
        <SearchIcon />
      </button>
    </header>
  )
}
