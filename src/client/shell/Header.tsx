import { useNavigate } from 'react-router-dom'
import { SearchIcon } from './icons'

/**
 * wordmark + magnifier only. the sliders icon was deliberately dropped
 * (docs/design.md § Navigation) — it duplicated the tab bar's settings slot
 * and the list's filter chips. the magnifier always routes to the list tab
 * with search open; the list route itself owns opening the input in place.
 */
export function Header() {
  const navigate = useNavigate()

  function openSearch() {
    navigate({ pathname: '/list', search: '?search=open' })
  }

  return (
    <header className="app-header">
      <span className="app-header__wordmark">lapse</span>
      <button type="button" className="icon-button" aria-label="search" onClick={openSearch}>
        <SearchIcon />
      </button>
    </header>
  )
}
