/**
 * Settings (build ticket 22; docs/design.md § Archived/Settings: "categories
 * manager, logout. Nothing else in v1."). A root tab — same depth as
 * Home/List — so unlike the depth-2 screens (ArchivedRoute, tracker detail)
 * it carries no back affordance of its own (docs/design.md § Navigation).
 * The archive entry point is a plain `<Link>` (docs/design.md § Navigation:
 * "archived is entered from settings") rather than a component import from
 * src/client/archived/, which this ticket's file fence keeps off-limits —
 * the route already exists (build ticket 16), this only has to point at it.
 */
import { Link } from 'react-router-dom'
import { CategoriesManager } from '../settings/CategoriesManager'
import { LogoutButton } from '../settings/LogoutButton'
import '../settings/settings.css'

export function SettingsRoute() {
  return (
    <section aria-label="settings" className="settings-route">
      <h1 className="settings-route__title">settings</h1>

      <section className="settings-route__section" aria-labelledby="settings-categories-heading">
        <h2 id="settings-categories-heading" className="settings-route__section-title">
          categories
        </h2>
        <CategoriesManager />
      </section>

      <section className="settings-route__section">
        <Link to="/archived" className="settings-route__archive-link">
          archived
        </Link>
      </section>

      <section className="settings-route__section">
        <LogoutButton />
      </section>
    </section>
  )
}
