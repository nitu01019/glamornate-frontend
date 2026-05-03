import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      '@/': path.resolve(__dirname, './src') + '/',
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:3000',
      },
    },
    globals: true,
    exclude: ['tests/e2e/**', 'tests/manual/**', 'node_modules/**'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      // A4.2 Ratchet rule: thresholds = min(80, floor(actualPct) + 5). Update
      // these whenever a coverage run shows headroom — never reduce them. The
      // intent is that coverage either climbs or holds; any regression must
      // surface in CI before merge.
      //
      // Last measured (2026-04-26 on feat/industry-overhaul):
      //   lines 52.72%, statements 52.08%, branches 53.82%, functions 47.42%
      thresholds: { lines: 57, branches: 58, functions: 52, statements: 57 },
    },
  },
})
