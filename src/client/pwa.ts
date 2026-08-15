/// <reference types="vite-plugin-pwa/client" />
/**
 * Silent service worker registration (docs/tech-stack.md § SW update
 * behavior). registerType 'autoUpdate' makes the built worker skip waiting
 * and claim clients on its own; registerSW's default handling (no
 * onNeedRefresh/onNeedReload override) reloads the page once the new worker
 * takes control, so there is never a "new version available" prompt.
 */
import { registerSW } from 'virtual:pwa-register'

const UPDATE_POLL_MS = 15 * 60 * 1000
const PRELOAD_ERROR_RELOAD_KEY = 'lapse:reloaded-after-preload-error'

/**
 * iOS only checks for SW updates at launch and throttles further checks to
 * ~24h, so a deploy can sit undiscovered for a day in an app left open.
 * Fetching sw.js uncached first (the server sends no-cache headers on it,
 * see src/server/index.ts) avoids asking the browser to update() against a
 * cached copy of the worker script it hasn't noticed changed.
 */
function pollForUpdates(registration: ServiceWorkerRegistration): void {
  setInterval(() => {
    fetch('/sw.js', { cache: 'no-store' })
      .then(() => registration.update())
      .catch(() => {
        // offline or a transient failure — the next interval tries again.
      })
  }, UPDATE_POLL_MS)
}

/**
 * A deploy can remove a lazily-loaded chunk a still-open tab references,
 * turning a route navigation into a 404. Reloading picks up the new asset
 * map; the sessionStorage flag stops a persistently broken chunk from
 * looping reloads.
 */
function reloadOncePerSessionOnPreloadError(): void {
  window.addEventListener('vite:preloadError', () => {
    if (sessionStorage.getItem(PRELOAD_ERROR_RELOAD_KEY)) return
    sessionStorage.setItem(PRELOAD_ERROR_RELOAD_KEY, '1')
    window.location.reload()
  })
}

reloadOncePerSessionOnPreloadError()

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (registration) pollForUpdates(registration)
  },
})
