/**
 * Notifications feed feature-flag helpers.
 *
 * Phase-2 delivers a real in-app notifications feed at `/customer/notifications`
 * (replacing the current prefs-duplicate page). The new surface ships behind
 * a bundle-time feature flag so we can merge dark and flip live without an
 * additional redeploy once QA signs off. The legacy settings-duplicate page
 * remains the default until `NEXT_PUBLIC_NOTIFICATIONS_FEED_V1 === '1'`.
 *
 * Mirrors the convention established in `home-flags.ts`.
 *
 * See: docs/plans/2026-04-20-industry-overhaul/PHASE_2.md §6.4 (B4 role)
 */

/**
 * Canonical environment variable name for the Phase-2 notifications feed flag.
 * Exported so tests, rollout docs, and infra (Vercel env config) can reference
 * a single source of truth.
 */
export const NOTIFICATIONS_FEED_V1_FLAG_NAME =
  'NEXT_PUBLIC_NOTIFICATIONS_FEED_V1' as const;

/**
 * `true` when the Phase-2 notifications feed surface should render. Only the
 * exact string `'1'` enables the flag — any other value (including
 * `undefined`, `'0'`, `'true'`, whitespace) keeps the legacy page live. Match
 * is strict so we fail closed.
 */
export function isNotificationsFeedV1Enabled(): boolean {
  return process.env[NOTIFICATIONS_FEED_V1_FLAG_NAME] === '1';
}

/**
 * Module-level convenience evaluated at import time. Next.js inlines
 * `NEXT_PUBLIC_*` env vars at build time, so reading this constant in a
 * client component is equivalent to reading the env var at build time
 * without re-evaluating on every render.
 *
 * For tests that want to toggle the flag at runtime (e.g. `vi.stubEnv`),
 * prefer calling {@link isNotificationsFeedV1Enabled} instead of this
 * constant so the stubbed value is respected.
 */
export const isNotificationsFeedV1: boolean = isNotificationsFeedV1Enabled();
