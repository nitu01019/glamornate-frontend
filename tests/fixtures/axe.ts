/**
 * Shared Playwright fixture: axe-core accessibility scanning.
 *
 * Phase 3 / Q3 — `@axe-core/playwright` is now a canonical devDependency,
 * so we replace the legacy "dynamic-import-or-skip" shim with a real
 * typed fixture any spec can extend. Usage:
 *
 *   import { test, expect } from '@fixtures/axe';        // (ts-path alias)
 *   // or the relative form:
 *   import { test, expect } from '../../fixtures/axe';
 *
 *   test('@a11y /services has no serious violations', async ({
 *     assertNoSeriousViolations,
 *   }) => {
 *     await assertNoSeriousViolations('/services');
 *   });
 *
 * Severity policy (per Phase 3 / Q3):
 *   - `impact: 'serious' | 'critical'` → test FAILS.
 *   - `impact: 'minor' | 'moderate'` → logged to console, test PASSES.
 *
 * Rationale: serious/critical are blockers by WCAG triage; minor/moderate
 * are either stylistic or require broader landmark restructuring we track
 * outside the PR-gating Playwright run.
 */

import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AxeFixtures = {
  /**
   * Factory that returns a fresh AxeBuilder pre-tagged with the default
   * WCAG tag set. Each call returns a new instance so a spec can chain
   * `.include(...)` / `.exclude(...)` without leaking state.
   */
  makeAxeBuilder: () => AxeBuilder;

  /**
   * Run axe on the current page (optionally navigating first) and throw
   * if any serious/critical violations are found.
   *
   * @param url Optional URL to `page.goto(url)` before scanning. When
   *   omitted, the fixture scans whatever page the spec has already
   *   brought into view.
   */
  assertNoSeriousViolations: (url?: string) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Default WCAG tag set
// ---------------------------------------------------------------------------

const DEFAULT_AXE_TAGS: ReadonlyArray<string> = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
];

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

export const test = base.extend<AxeFixtures>({
  makeAxeBuilder: async ({ page }, use) => {
    await use(() => new AxeBuilder({ page }).withTags([...DEFAULT_AXE_TAGS]));
  },

  assertNoSeriousViolations: async ({ page, makeAxeBuilder }, use) => {
    await use(async (url?: string): Promise<void> => {
      if (url !== undefined) {
        await page.goto(url);
        await page.waitForLoadState('domcontentloaded');
      }

      const results = await makeAxeBuilder().analyze();

      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      const advisory = results.violations.filter(
        (v) => v.impact === 'minor' || v.impact === 'moderate',
      );

      // Log (don't fail) minor/moderate findings so they stay visible in
      // CI logs without gating the PR.
      if (advisory.length > 0) {
        const advisorySummary = advisory
          .map((v) => `  - ${v.id} (${v.impact ?? 'unknown'}): ${v.help} [${v.nodes.length} nodes]`)
          .join('\n');
        // eslint-disable-next-line no-console
        console.info(
          `a11y advisory (minor/moderate) at ${page.url()}:\n${advisorySummary}`,
        );
      }

      if (serious.length > 0) {
        const summary = serious
          .map(
            (v) =>
              `${v.id} (${v.impact ?? 'unknown'}): ${v.help} [${v.nodes.length} nodes] — ${v.helpUrl}`,
          )
          .join('\n');
        throw new Error(`a11y serious/critical violations at ${page.url()}:\n${summary}`);
      }
    });
  },
});

export { expect };
