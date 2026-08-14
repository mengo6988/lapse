# iOS PWA update & offline behavior research

Type: research
Status: resolved

## Question

Pin down how vite-plugin-pwa `registerType: 'autoUpdate'` actually behaves in an installed iOS standalone PWA, so the Offline-lite grill can settle update UX on facts:

- When does a new SW take control (skipWaiting/clientsClaim defaults in vite-plugin-pwa) — on next launch, mid-session, or never until all tabs close?
- Stale-bundle failure modes: lazy-loaded hashed chunks 404ing after deploy, precache manifest pitfalls
- Storage reality in installed iOS PWAs (2025–2026): CacheStorage / localStorage / IndexedDB quotas and eviction; anything iOS 26 changed
- Practical size limits for a persisted TanStack Query cache in localStorage
- Known vite-plugin-pwa iOS-specific issues (GitHub issues, blog post-mortems)

## Answer

Resolved 2026-08-14 by research agent.

### 1. SW update lifecycle with `autoUpdate` on iOS

- `registerType: 'autoUpdate'` forces `workbox.skipWaiting` + `clientsClaim` true — but that only swaps the *controller*; it does **not** reload the open page. Auto page reload requires calling `registerSW({ immediate: true })` from `virtual:pwa-register` in the entry point. ([auto-update guide](https://vite-pwa-org.netlify.app/guide/auto-update.html))
- iOS reality: update checks run on navigation, throttled to once per 24h; iOS standalone apps are **frozen** on background, not killed, so foregrounding does not reliably re-check. In the wild, installed-PWA SW updates land "between 24 hours and 2 weeks" unless the user force-kills and cold-relaunches. ([vite-plugin-pwa#554](https://github.com/vite-pwa/vite-plugin-pwa/issues/554))
- **Cannot rely on a mid-session update reaching an open iOS instance.** Realistic update points: genuine cold launch (24h+ since last check), or app code explicitly calling `registration.update()`.

### 2. Stale-bundle failure modes + mitigations

Failure: after deploy, old shell lazy-imports an old hashed chunk the server no longer has → `net::ERR_ABORTED 404` / blank white screen until Cache Storage cleared. ([#457](https://github.com/vite-pwa/vite-plugin-pwa/issues/457), [#726](https://github.com/vite-pwa/vite-plugin-pwa/issues/726))

Mitigations (overlapping, none sufficient alone on iOS):
1. `navigateFallback: '/index.html'` + `navigateFallbackDenylist: [/^\/api/]`
2. `cleanupOutdatedCaches: true`
3. `registerSW({ immediate: true })` — reload on controllerchange
4. `window.addEventListener('vite:preloadError', () => location.reload())` — Vite-level catch for the stale-chunk 404, with a sessionStorage guard against reload loops
5. **HTTP layer**: `Cache-Control: max-age=0, must-revalidate` on `sw.js` and `index.html` — a proxy caching `sw.js` defeats everything else ([discussion #821](https://github.com/vite-pwa/vite-plugin-pwa/discussions/821))
6. Workbox silently *excludes* files over 2 MiB from precache (`maximumFileSizeToCacheInBytes`) — check large chunks/fonts.

### 3. Storage reality, installed iOS PWA (2025–2026)

- Installed home-screen app gets its **own storage partition** separate from Safari tabs (cookies, localStorage, IndexedDB, SW registration; Cache API reportedly shared).
- Quota since iOS 17: same as browser — up to ~60% of disk per origin. ([WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/))
- Eviction: home-screen apps qualify heuristically for persistent-mode storage (favored over Safari tabs), but **no `navigator.storage.persist()` control on iOS** — persistence is OS-granted, not requestable. WebKit removes unused SW registrations and unopened caches "after a period of a few weeks." ([workers-at-your-service](https://webkit.org/blog/8090/workers-at-your-service/))
- **Consequence: treat ALL client storage as disposable performance cache; the self-hosted server is the record of truth.** (Outbox contents are the one at-risk exception — drain promptly.)
- iOS 26: every add-to-home-screen now defaults to standalone full web app (confirms earlier research); no material SW/caching semantic changes in Safari 26.

### 4. Persisted TanStack Query cache: use IndexedDB, not localStorage

- iOS localStorage quota ~5MB, **shared across the whole origin**, strictly enforced.
- TanStack docs + maintainer guidance: `createAsyncStoragePersister` + **`idb-keyval`** as the storage adapter — faster, >5MB, no serialization step (stores Dates natively). Persist writes throttled to 1/s by default. ([persistQueryClient](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient), [discussion #3198](https://github.com/TanStack/query/discussions/3198))
- This changes `docs/tech-stack.md`'s "persisted cache (localStorage)" line → IndexedDB. Aligns with outbox research (ticket 03) which independently landed on IndexedDB.

### 5. Known iOS-specific vite-plugin-pwa issues

- [#554](https://github.com/vite-pwa/vite-plugin-pwa/issues/554) — update prompt never fires on iOS; only workaround force-quit + relaunch.
- [#789](https://github.com/vite-pwa/vite-plugin-pwa/issues/789) — **first** update after install: `controlling` fires with `isUpdate = false`, reload logic never triggers; the very first deploy after a user installs lapse may silently swap SW without reloading. Periodic check + `vite:preloadError` net covers it.
- [Discussion #821](https://github.com/vite-pwa/vite-plugin-pwa/discussions/821) — maintainer checklist: SW updates only when SW *bytes* change (byte-for-byte compare); verify HTTP caching; registration code must run on every route.

### Implications for lapse — config to adopt

```js
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api/],
    cleanupOutdatedCaches: true,
  },
})
```

Entry point — the periodic `registration.update()` recipe is the main lever against iOS's launch-only checking ([periodic-sw-updates guide](https://vite-pwa-org.netlify.app/guide/periodic-sw-updates.html)):

```js
import { registerSW } from 'virtual:pwa-register'

const intervalMS = 15 * 60 * 1000 // compensates for iOS not checking mid-session

registerSW({
  immediate: true, // reload on controllerchange — fine for a tracker, no form-loss risk
  onRegisteredSW(swUrl, r) {
    r && setInterval(async () => {
      if (r.installing || !navigator.onLine) return
      const resp = await fetch(swUrl, { cache: 'no-store' })
      if (resp?.status === 200) await r.update()
    }, intervalMS)
  },
})

window.addEventListener('vite:preloadError', () => {
  window.location.reload() // stale lazy-chunk 404 safety net (guard against loops)
})
```

Server must send `Cache-Control: max-age=0, must-revalidate` on `sw.js` + `index.html` (Hono static config → Ops grill).
