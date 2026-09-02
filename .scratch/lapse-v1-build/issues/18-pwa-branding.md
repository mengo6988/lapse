# 18 — PWA and branding assets

**What to build:** lapse installs to the iOS home screen with its own icon, opens without network, and quietly updates itself — no update prompt, ever.

**Blocked by:** 02 (Docker image and first deploy).

**Status:** ready-for-agent — build half done, device verification outstanding

- [x] `vite-plugin-pwa` precaches the app shell so a cold launch renders offline
- [x] Updates are silent: periodic `registration.update()`, `immediate: true`, and a reload on `vite:preloadError` — no prompt and no stale-chunk dead end
- [x] No-cache headers on the service worker and the entry HTML, so a new deploy is actually discoverable
- [x] Icon SVG source (serif "l" over the lavender bar) plus a committed generated PNG set at 192, 512, 512 maskable, and 180
- [x] Manifest names the app `Lapse` on OS surfaces with the base background color, while in-product copy stays lowercase
- [ ] Verified on the deployed URL: installs to an iOS home screen, launches standalone, opens offline

Verified locally instead: the build emits the manifest, the service worker precaching 14 entries (app shell, icons, and the woff2 faces), and four real PNGs at the right dimensions. `skipWaiting` and `clientsClaim` had to be set explicitly — the plugin only sets them itself when `injectRegister` is `auto`, and without them a new worker would wait forever, defeating silent updates. Font files were added to the precache glob so a genuinely cold offline launch renders in Source Serif 4 rather than a system fallback.

The last box needs a phone and the live deployment, so it follows the operator half of ticket 02.
