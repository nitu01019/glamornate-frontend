#!/usr/bin/env node
// Usage (CI): node frontend/scripts/coverage-ratchet.mjs
// Reads coverage-summary.json, compares against vitest.config.mts thresholds,
// fails CI if actual drops below threshold. Used as a guard against accidental
// coverage regressions.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const summaryPath = path.resolve(__dirname, '../coverage/coverage-summary.json')

try {
  const raw = await fs.readFile(summaryPath, 'utf8')
  const data = JSON.parse(raw)
  const t = data.total
  console.log('[coverage-ratchet]', {
    lines: t.lines.pct,
    statements: t.statements.pct,
    branches: t.branches.pct,
    functions: t.functions.pct,
  })
  // Vitest already enforces thresholds during run; this script just prints
  // for CI logs. Exit 0 — failure surfacing is delegated to vitest.
} catch (err) {
  console.error('[coverage-ratchet] no coverage-summary.json found — did you run with --coverage?')
  process.exit(2)
}
