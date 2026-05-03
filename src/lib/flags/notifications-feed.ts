/**
 * Notifications-feed feature flag.
 *
 * Phase 2 introduces the real in-app notifications feed at
 * `/customer/notifications`, replacing the previous page that accidentally
 * duplicated the notification-settings UI. The new feed ships behind an env
 * flag so we can toggle it independently of the APK build.
 *
 * The canonical name is `NEXT_PUBLIC_NOTIFICATIONS_FEED_V1`. Next.js inlines
 * `NEXT_PUBLIC_*` env values at build time, so the flag is effectively a
 * compile-time toggle but we read `process.env` lazily so tests can use
 * `vi.stubEnv` at runtime.
 *
 * Default: the previous page was a broken duplicate of settings, so Phase 2
 * enables the feed by default when the env var is absent. The env var is
 * honoured strictly — set to `'0'` to explicitly opt back into legacy.
 *
 * See: docs/plans/2026-04-20-industry-overhaul/PHASE_2.md §8
 */

/** Canonical env-var name. Exported so infra + tests share one source of truth. */
export const NOTIFICATIONS_FEED_V1_FLAG_NAME =
  'NEXT_PUBLIC_NOTIFICATIONS_FEED_V1' as const;

/**
 * Returns whether the Phase 2 feed surface should render.
 *
 * - `'1'`  → true (feed enabled)
 * - `'0'`  → false (legacy path — intentionally opt-out)
 * - unset  → true (default-on because legacy was broken)
 * - other  → true (tolerant of truthy strings like `'true'`, `'yes'`)
 */
export function isNotificationsFeedV1Enabled(): boolean {
  const value = process.env[NOTIFICATIONS_FEED_V1_FLAG_NAME];
  if (value === undefined || value === null) return true;
  const normalized = value.trim().toLowerCase();
  if (normalized === '' || normalized === '1' || normalized === 'true' || normalized === 'yes') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no') {
    return false;
  }
  // Unknown values fall back to on — we prefer showing the new feed over the
  // broken legacy page.
  return true;
}
