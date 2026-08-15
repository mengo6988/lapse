import { NavLink } from 'react-router-dom'
import { openCreateTrackerSheet } from '../tracker'
import { ActivityIcon, HomeIcon, ListIcon, PlusIcon, SettingsIcon } from './icons'

function tabClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'tab-bar__tab tab-bar__tab--active' : 'tab-bar__tab'
}

/**
 * five slots per docs/design.md § Navigation: home, list, center FAB
 * (opens the create-Tracker sheet, ticket 14), activity, settings.
 * NavLink supplies aria-current="page" on the active route for free.
 */
export function TabBar() {
  return (
    <nav className="tab-bar" aria-label="tabs">
      <NavLink to="/" end className={tabClassName} aria-label="home">
        <HomeIcon />
      </NavLink>
      <NavLink to="/list" className={tabClassName} aria-label="list">
        <ListIcon />
      </NavLink>
      <div className="tab-bar__fab-slot">
        <button type="button" className="fab" aria-label="new tracker" onClick={openCreateTrackerSheet}>
          <PlusIcon />
        </button>
      </div>
      <NavLink to="/activity" className={tabClassName} aria-label="activity">
        <ActivityIcon />
      </NavLink>
      <NavLink to="/settings" className={tabClassName} aria-label="settings">
        <SettingsIcon />
      </NavLink>
    </nav>
  )
}
