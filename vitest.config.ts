import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'client',
          environment: 'jsdom',
          root: import.meta.dirname,
          include: ['src/client/**/*.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          root: import.meta.dirname,
          include: ['src/server/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      // Excluded per docs/tech-stack.md § Testing: entrypoints, SW glue,
      // migrations and config carry no logic worth a test.
      exclude: [
        'src/client/main.tsx',
        // registers a service worker as an import side effect — nothing to
        // unit test, and jsdom has no worker to register against.
        'src/client/pwa.ts',
        'src/client/**/*.d.ts',
        'src/server/index.ts',
        'src/server/schema.ts',
        'src/server/testing.ts',
        '**/*.test.{ts,tsx}',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 80,
      },
    },
  },
})
