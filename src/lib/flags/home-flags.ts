/**
 * Home page feature-flag helpers.
 *
 * The Phase-1 Home redesign ships behind two decoupled bundle-time feature
 * flags so we can roll the clean Yes-Madam-style hero and the 13-tile
 * big-tile category grid out independently:
 *   - `NEXT_PUBLIC_HOME_V2_HERO === '1'` enables the new clean hero carousel.
 *   - `NEXT_PUBLIC_HOME_V2_GRID === '1'` enables the new 13-tile big-tile
 *     category grid; the legacy 4-per-row `CategoryTilesGrid` stays live
 *     otherwise.
 * Both default to disabled so we fail closed on any unexpected value.
 *
 * See: docs/plans/2026-04-20-industry-overhaul/PHASE_1.md §6.3
 * See: docs/plans/2026-04-20-industry-overhaul/HEADER-HERO-HOTFIX-PLAN.md §3
 */

/**
 * Canonical environment variable name for the Phase-1 Home v2 big-tile grid
 * flag. Exported so tests, rollout docs, and infra (Vercel env config) can
 * reference a single source of truth.
 */
export const HOME_V2_FLAG_NAME = 'NEXT_PUBLIC_HOME_V2_GRID' as const;

/**
 * `true` when the Phase-1 Home v2 big-tile category grid should render.
 * Only the exact string `'1'` enables the flag — any other value
 * (including `undefined`, `'0'`, `'true'`, whitespace) keeps the legacy
 * 4-per-row `CategoryTilesGrid` live. Match is strict so we fail closed.
 */
export function isHomeV2Enabled(): boolean {
  return process.env[HOME_V2_FLAG_NAME] === '1';
}

/**
 * Module-level convenience evaluated at import time. Next.js inlines
 * `NEXT_PUBLIC_*` env vars at build time, so reading this constant in a
 * client component is equivalent to reading the env var at build time
 * without re-evaluating on every render.
 *
 * For tests that want to toggle the flag at runtime (e.g. `vi.stubEnv`),
 * prefer calling {@link isHomeV2Enabled} instead of this constant so the
 * stubbed value is respected.
 */
export const isHomeV2: boolean = isHomeV2Enabled();

/**
 * Canonical environment variable name for the Phase-1 Home v2 clean hero
 * carousel flag. Exported so tests, rollout docs, and infra (Vercel env
 * config) can reference a single source of truth.
 */
export const HOME_V2_HERO_FLAG_NAME = 'NEXT_PUBLIC_HOME_V2_HERO' as const;

/**
 * `true` when the Phase-1 Home v2 clean hero carousel should render. Only
 * the exact string `'1'` enables the flag — any other value (including
 * `undefined`, `'0'`, `'true'`, whitespace) keeps the legacy
 * `HeroBannerCarousel` live. Match is strict so we fail closed.
 */
export function isHomeV2HeroEnabled(): boolean {
  return process.env[HOME_V2_HERO_FLAG_NAME] === '1';
}

/**
 * Module-level convenience evaluated at import time. Next.js inlines
 * `NEXT_PUBLIC_*` env vars at build time, so reading this constant in a
 * client component is equivalent to reading the env var at build time
 * without re-evaluating on every render.
 *
 * For tests that want to toggle the flag at runtime (e.g. `vi.stubEnv`),
 * prefer calling {@link isHomeV2HeroEnabled} instead of this constant so
 * the stubbed value is respected.
 */
export const isHomeV2Hero: boolean = isHomeV2HeroEnabled();
