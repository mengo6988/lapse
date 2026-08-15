import { Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from '../auth/session'
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
 */
export function AppShell() {
  const status = useSession()

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
