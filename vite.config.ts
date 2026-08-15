import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  root: 'src/client',
  plugins: [
    react(),
    // registerType/workbox settings are pinned by docs/tech-stack.md § SW
    // update behavior — injectRegister is off because src/client/pwa.ts
    // registers the worker itself, so silent-update logic lives in one place.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon-180.png'],
      manifest: {
        // OS home-screen label is capitalized; in-product copy stays
        // lowercase "lapse" (docs/design.md § Branding).
        name: 'Lapse',
        short_name: 'Lapse',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#1e1e2e',
        theme_color: '#1e1e2e',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Workbox's default glob misses font files, which would leave a cold
        // offline launch rendering the ledger in a system fallback face.
        globPatterns: ['**/*.{js,css,html,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
        // The plugin only sets these two automatically when injectRegister
        // is 'auto'; since injectRegister is off here, a new worker would
        // otherwise sit in "waiting" forever with nothing to send it the
        // skip-waiting message. Both are required for silent autoUpdate.
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
})
