/**
 * Logout (docs/design.md § Archived/Settings: "logout"; build ticket 22,
 * decisions 1-2). A plain button, not a confirm dialog: unlike the
 * destructive actions elsewhere on this screen, logging out costs nothing —
 * the password gets you straight back in.
 */
import { useLogout } from './useLogout'

export function LogoutButton() {
  const logout = useLogout()

  return (
    <button
      type="button"
      className="settings-logout"
      onClick={() => logout.mutate()}
      disabled={logout.isPending}
      aria-busy={logout.isPending}
    >
      log out
    </button>
  )
}
