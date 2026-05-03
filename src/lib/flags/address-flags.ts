/**
 * Address bottom-sheet v2 feature-flag helpers.
 *
 * Phase-2 extends `HomeLocationSheet` with an inline manual entry form so
 * users can add a new address without navigating away to `/customer/addresses`.
 * The enhancement ships behind a bundle-time feature flag so we can merge
 * dark and flip live without an additional redeploy once QA signs off. The
 * legacy deep-link-to-CRUD behavior remains the default until
 * `NEXT_PUBLIC_ADDRESS_SHEET_V2 === '1'`.
 *
 * Mirrors the convention established in `home-flags.ts`.
 *
 * See: docs/plans/2026-04-20-industry-overhaul/PHASE_2.md §6.4 (B4 role)
 */

/**
 * Canonical environment variable name for the Phase-2 address-sheet v2 flag.
 * Exported so tests, rollout docs, and infra (Vercel env config) can reference
 * a single source of truth.
 */
export const ADDRESS_SHEET_V2_FLAG_NAME =
  'NEXT_PUBLIC_ADDRESS_SHEET_V2' as const;

/**
 * `true` when the Phase-2 address sheet v2 surface (inline manual entry form)
 * should render. Only the exact string `'1'` enables the flag — any other
 * value (including `undefined`, `'0'`, `'true'`, whitespace) keeps the legacy
 * deep-link-to-CRUD behavior live. Match is strict so we fail closed.
 */
export function isAddressSheetV2Enabled(): boolean {
  return process.env[ADDRESS_SHEET_V2_FLAG_NAME] === '1';
}

/**
 * Module-level convenience evaluated at import time. Next.js inlines
 * `NEXT_PUBLIC_*` env vars at build time, so reading this constant in a
 * client component is equivalent to reading the env var at build time
 * without re-evaluating on every render.
 *
 * For tests that want to toggle the flag at runtime (e.g. `vi.stubEnv`),
 * prefer calling {@link isAddressSheetV2Enabled} instead of this constant
 * so the stubbed value is respected.
 */
export const isAddressSheetV2: boolean = isAddressSheetV2Enabled();
