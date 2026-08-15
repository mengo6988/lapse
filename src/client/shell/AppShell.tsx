import { Navigate, Route, Routes } from 'react-router-dom'
import { ArchivedRoute } from '../archived/ArchivedRoute'
import { useSession } from '../auth/session'
import { TrackerDetailRoute } from '../detail/TrackerDetailRoute'
import { useOutboxDrain } from '../outbox/useOutboxDrain'
import { ActivityRoute } from '../routes/ActivityRoute'
import { HomeRoute } from '../routes/HomeRoute'
import { ListRoute } from '../routes/ListRoute'
import { SettingsRoute } from '../routes/SettingsRoute'
import { TrackerSheetHost } from '../tracker'
import { Header } from './Header'
import { LoginScreen } from './LoginScreen'
import { TabBar } from './TabBar'

/**
 * root of the app. gates on session state — only 'unauthorized' swaps in the
 * login screen, per build ticket 09 — then hosts the four root routes under
 * the shared header/tab bar chrome. TrackerSheetHost (ticket 14) is mounted
 * once here, alongside the tabs it floats above — it renders nothing while
 * closed, so the FAB and any future edit entry point can open it without
 * either owning where it lives.
 *
 * useOutboxDrain (build ticket 17) is mounted here for the same reason: the
 * offline queue has to keep draining wherever the user happens to be, and a
 * standalone iOS PWA has no Background Sync to do it while the app is shut.
 * It sits above the login gate because a hook can't live behind an early
 * return, which costs nothing: a drain attempted while unauthorized stops on
 * the first 401 without touching the queue, and the queue is drained again
 * the moment a real session brings the shell back.
 */
export function AppShell() {
  const status = useSession()
  useOutboxDrain()

  if (status === 'unauthorized') {
    return <LoginScreen />
  }

  return (
    <div className="app-shell">
      <div className="noise-overlay" aria-hidden="true" />
      <Header />
      <main className="app-shell__screen">
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/list" element={<ListRoute />} />
          {/* depth-2 screens: no tab of their own, each carries its own back
              affordance because a standalone iOS PWA has no back gesture. */}
          <Route path="/tracker/:trackerId" element={<TrackerDetailRoute />} />
          <Route path="/archived" element={<ArchivedRoute />} />
          <Route path="/activity" element={<ActivityRoute />} />
          <Route path="/settings" element={<SettingsRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
      <TrackerSheetHost />
    </div>
  )
}
