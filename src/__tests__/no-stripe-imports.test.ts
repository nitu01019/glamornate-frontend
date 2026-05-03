/**
 * Regression test (Patch SB-5): assert that no production source file
 * imports the Stripe SDK or any `@stripe/*` package. This guards the
 * Phase 1 Stripe removal landed in v3.1.
 *
 * Scope:
 *   - frontend/src/**\/*.{ts,tsx}   (excluding the __tests__ tree)
 *   - backend/functions/src/**\/*.ts (excluding the __tests__ tree)
 *
 * The matcher is built from constituent strings rather than embedded
 * literally so that this test file itself never matches its own import
 * regex during the scan.
 */
import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const FRONTEND_SRC = path.resolve(__dirname, '..');
const BACKEND_SRC = path.resolve(__dirname, '..', '..', '..', 'backend', 'functions', 'src');

// Build the literal package names from segments so this file is not a
// self-match. The names are reassembled at runtime by the regex below.
const FORBIDDEN_PACKAGE_NAMES = ['stri' + 'pe', '@stri' + 'pe/'];

/**
 * Detect ES module / CJS imports of the forbidden packages. Patterns
 * captured:
 *   - import x from 'stripe'
 *   - import x from "stripe"
 *   - import { foo } from '@stripe/react-stripe-js'
 *   - require('stripe')
 *   - require("@stripe/stripe-js")
 */
const IMPORT_REGEX = new RegExp(
  String.raw`(?:from\s+|require\(\s*)['"](` +
    FORBIDDEN_PACKAGE_NAMES.map((p) => p.replace('/', '\\/')).join('|') +
    String.raw`)[^'"]*['"]`,
);

const FILE_EXTENSIONS = new Set(['.ts', '.tsx']);
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '__tests__']);

async function walk(dir: string, acc: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, acc);
    } else if (entry.isFile() && FILE_EXTENSIONS.has(path.extname(entry.name))) {
      // Skip test files — the regex itself mentions package names.
      if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
      if (/\.spec\.(ts|tsx)$/.test(entry.name)) continue;
      acc.push(full);
    }
  }
  return acc;
}

async function findOffendingFiles(root: string): Promise<string[]> {
  const files = await walk(root);
  const offenders: string[] = [];
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    if (IMPORT_REGEX.test(content)) {
      offenders.push(path.relative(root, file));
    }
  }
  return offenders;
}

describe('Stripe import guard (Patch SB-5)', () => {
  it('frontend/src has no stripe or @stripe/* imports', async () => {
    const offenders = await findOffendingFiles(FRONTEND_SRC);
    expect(offenders).toEqual([]);
  });

  it('backend/functions/src has no stripe or @stripe/* imports', async () => {
    const offenders = await findOffendingFiles(BACKEND_SRC);
    expect(offenders).toEqual([]);
  });
});
