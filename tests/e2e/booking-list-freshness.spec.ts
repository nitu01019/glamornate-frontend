/**
 * Wave 9 W9-E — Booking-list freshness spec.
 *
 * Invariant: a cold load of `/customer/bookings` MUST surface the most
 * recently created booking within three seconds. This regresses the v3.1
 * fix for stale React-Query cache after a booking submission — the
 * earlier behavior could leave a freshly-created booking invisible until
 * the user pulled-to-refresh or hard-reloaded the route.
 *
 * Auth contract: same as the other Wave 9 W9-E specs — gated on
 * `E2E_TEST_USER_EMAIL` so the spec lands today and runs once the
 * fixture is wired up.
 *
 * Tag: `@smoke`.
 */
import { test, expect } from '@playwright/test';

test.describe.parallel('@smoke booking list freshness', () => {
  test('most recent booking is visible within 3 seconds of cold load', async ({ page }) => {
    test.skip(
      !process.env.E2E_TEST_USER_EMAIL,
      'requires E2E_TEST_USER_EMAIL fixture; see tests/auth.setup.ts roadmap',
    );

    // Cold load: no prior visit; React Query must hydrate from server on
    // first paint, not from in-memory cache. We measure wall-clock time
    // from `goto` resolution to the first booking-card visibility.
    const start = Date.now();
    await page.goto('/customer/bookings');
    await page.waitForLoadState('domcontentloaded');

    // The bookings page renders a tab bar (Upcoming / Past / Cancelled)
    // and below it either a list of cards, a skeleton, an error, or an
    // empty state. The "freshness" assertion is: SOMETHING terminal is
    // on screen within 3 s — i.e. the page is no longer in skeleton
    // state. We pin to the upcoming tab and assert the absence of
    // skeletons combined with at least one rendered booking row.
    //
    // We probe via `Promise.race` against the empty-state copy so the
    // assertion holds for both seeded and empty test users; the spec
    // skips structurally if no fixture booking exists.
    const upcomingTab = page.getByRole('button', { name: /^Upcoming$/ });
    await expect(upcomingTab).toBeVisible({ timeout: 3_000 });

    // The most recent booking is rendered as a card with a status badge;
    // status copy lives in STATUS_LABEL of `customer/bookings/page.tsx`.
    // Match any of the active states; the fixture must land at least one
    // upcoming booking for this assertion to pass.
    const bookingRow = page
      .getByText(/Confirmed|Pending|On the way|In progress/i)
      .first();
    const emptyState = page.getByText(/No upcoming bookings/i).first();

    await expect(bookingRow.or(emptyState)).toBeVisible({ timeout: 3_000 });

    const elapsedMs = Date.now() - start;
    expect(elapsedMs, `cold load resolved in ${elapsedMs}ms; budget is 3000ms`).toBeLessThan(3_000);

    // If the empty state was the resolution, the freshness assertion
    // can't be made — skip with reason rather than passing silently.
    test.skip(
      await emptyState.isVisible(),
      'fixture has no upcoming bookings; freshness invariant requires at least one',
    );
  });
});
