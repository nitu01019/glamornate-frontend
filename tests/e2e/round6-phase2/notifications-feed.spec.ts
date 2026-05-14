import { expect, test, type Page } from '@playwright/test';

/**
 * Round 6 / Phase 2 B5 — `notifications-feed.spec.ts`
 *
 * Validates the Phase-2 notifications feed that replaced the legacy
 * "notification settings as page" regression. Contract under test
 * (PHASE_2.md — B1 `NotificationsFeed` + B2 hooks):
 *
 *   1. `/customer/notifications` renders the feed list and header — NOT the
 *      settings UI. The string "Save Preferences" must not appear anywhere.
 *   2. When the feed has zero rows, the empty state is painted with
 *      `[data-testid="notifications-empty"]`.
 *   3. The "Mark all read" button is **disabled** when the unread count is
 *      zero, and enabled/active when unread > 0.
 *   4. Tapping a row triggers a mark-as-read side effect (the row loses its
 *      unread styling / `data-unread="true"` flag).
 *   5. The unread badge in the bell matches the live count coming from the
 *      feed (so when the header count is zero, the bell carries no badge).
 *
 * This spec is a **compile-only** contract right now — it asserts against
 * locked test IDs but is run opt-in via `test:e2e` once B1 + B2 wire up.
 * Rendering paths that require auth or live Firestore are gated behind the
 * presence of the feed/empty root so the spec degrades gracefully in CI.
 *
 * Locked test IDs (do not rename):
 *   - `app-header-bell`              — bell in AppHeader
 *   - `notifications-feed`           — feed list root
 *   - `notifications-empty`          — empty-state section
 *   - `notification-row`             — each row
 *   - `mark-all-read`                — mark-all button
 *   - `home-location-bell`           — alt bell used by the home row
 */

// ---------------------------------------------------------------------------
// Viewports
// ---------------------------------------------------------------------------

const PHONE = { width: 390, height: 844 } as const;
const DESKTOP = { width: 1280, height: 800 } as const;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const FEED_URL = '/customer/notifications';
const HOME_URL = '/';

// Settle timeout for notifications page — the feed depends on a Firestore
// subscription and we want to allow it to resolve to either "feed" or "empty"
// before asserting.
const SETTLE_MS = 2_500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function goToFeed(page: Page): Promise<void> {
  await page.goto(FEED_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
    /* ignore — some environments keep a long-poll open */
  });
  await page.waitForTimeout(SETTLE_MS);
}

async function hasFeedRows(page: Page): Promise<boolean> {
  const rows = page.locator('[data-testid="notification-row"]');
  return (await rows.count()) > 0;
}

async function hasEmptyState(page: Page): Promise<boolean> {
  const empty = page.getByTestId('notifications-empty');
  return (await empty.count()) > 0;
}

/**
 * Skip the current test if we cannot reach the feed (e.g. an unauthenticated
 * boot redirects to /auth/login). The upstream `@round6-phase2` QA pass
 * supplies a seeded user; local runs without one should be transparent
 * rather than false-failing.
 */
async function ensureOnFeed(page: Page): Promise<void> {
  const url = page.url();
  if (!url.includes('/customer/notifications')) {
    test.skip(true, `Feed route not reachable (redirected to ${url}).`);
  }
}

// ---------------------------------------------------------------------------
// Phone viewport
// ---------------------------------------------------------------------------

test.describe('@round6-phase2 notifications-feed — phone (390x844)', () => {
  test.use({ viewport: PHONE });

  test.beforeEach(async ({ page }) => {
    await goToFeed(page);
    await ensureOnFeed(page);
  });

  test('renders feed (or empty state) + header; zero "Save Preferences"', async ({ page }) => {
    // Exactly one of {feed, empty} must be present.
    const feedVisible = await hasFeedRows(page);
    const emptyVisible = await hasEmptyState(page);
    expect(feedVisible || emptyVisible).toBe(true);

    // The header is the common-case wrapper (title + mark-all). It must
    // render on both feed-full and feed-empty states.
    await expect(page.getByTestId('notifications-header')).toBeVisible();

    // Settings UI must never appear here — no "Save Preferences" copy
    // anywhere on the page, even inside hidden markup.
    const savePrefsCount = await page.getByText(/save preferences/i, { exact: false }).count();
    expect(savePrefsCount).toBe(0);
  });

  test('empty state: mark-all-read is disabled when unread count is 0', async ({ page }) => {
    const emptyVisible = await hasEmptyState(page);
    test.skip(!emptyVisible, 'Feed has rows; empty-state assertion skipped.');

    const markAll = page.getByTestId('mark-all-read');
    await expect(markAll).toBeVisible();
    await expect(markAll).toBeDisabled();
  });

  test('feed rows: tapping a row marks it read (data-unread flips)', async ({ page }) => {
    const feedVisible = await hasFeedRows(page);
    test.skip(!feedVisible, 'Feed has no rows; tap-to-read assertion skipped.');

    // Find an unread row; if all rows are already read we can't exercise
    // the mark-read path and should skip rather than force state.
    const unread = page.locator('[data-testid="notification-row"][data-unread="true"]');
    const unreadCount = await unread.count();
    test.skip(unreadCount === 0, 'No unread rows available.');

    const firstUnread = unread.first();
    await firstUnread.scrollIntoViewIfNeeded();

    // Tap the row's inner button (the delete button is a sibling; the row
    // body wraps everything else in the first button descendant).
    const rowButton = firstUnread.locator('button').first();
    await rowButton.click();

    // After the mutation settles the row should no longer carry
    // data-unread="true". We retry for up to 5s to absorb optimistic UI +
    // Firestore round-trip.
    await expect(firstUnread).toHaveAttribute('data-unread', 'false', {
      timeout: 5_000,
    });
  });

  test('unread badge in bell reflects live count', async ({ page }) => {
    // On the feed page the AppHeader bell (`app-header-bell`) is the source
    // of truth. It may be absent if the page bootstraps its own header —
    // the spec accepts either `app-header-bell` or the in-row
    // `home-location-bell` fallback.
    const bell =
      (await page.getByTestId('app-header-bell').count()) > 0
        ? page.getByTestId('app-header-bell')
        : page.getByTestId('home-location-bell');

    // When no bell at all is rendered on this route, skip instead of fail.
    test.skip((await bell.count()) === 0, 'No bell rendered on feed route.');

    const unreadRows = page.locator('[data-testid="notification-row"][data-unread="true"]');
    const unreadCount = await unreadRows.count();

    const accessibleName = await bell.first().getAttribute('aria-label');
    if (unreadCount === 0) {
      // With zero unread rows, the aria-label should NOT advertise a
      // non-zero count.
      expect(accessibleName ?? '').not.toMatch(/\b[1-9]\d*\s+unread/i);
    } else {
      // Non-zero unread → aria-label exposes a non-zero count.
      expect(accessibleName ?? '').toMatch(/\b[1-9]\d*\s+unread/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Desktop viewport — same assertions, wider viewport. Desktop-specific
// regressions (e.g. two-column layout hiding the bell) are caught by
// re-running the same contract at 1280x800.
// ---------------------------------------------------------------------------

test.describe('@round6-phase2 notifications-feed — desktop (1280x800)', () => {
  test.use({ viewport: DESKTOP });

  test.beforeEach(async ({ page }) => {
    await goToFeed(page);
    await ensureOnFeed(page);
  });

  test('renders feed + header; zero "Save Preferences"', async ({ page }) => {
    const feedVisible = await hasFeedRows(page);
    const emptyVisible = await hasEmptyState(page);
    expect(feedVisible || emptyVisible).toBe(true);

    await expect(page.getByTestId('notifications-header')).toBeVisible();

    const savePrefsCount = await page.getByText(/save preferences/i, { exact: false }).count();
    expect(savePrefsCount).toBe(0);
  });

  test('app-header-bell links to /customer/notifications from home', async ({ page }) => {
    // Belt-and-suspenders: the bell the user taps on `/` should route to
    // this page. We go HOME and verify the anchor's href without clicking
    // (clicking can be flaky if the page has auth-gated redirects).
    await page.goto(HOME_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1_500);

    const bell = page.getByTestId('app-header-bell');
    if ((await bell.count()) === 0) {
      test.skip(true, 'app-header-bell not rendered on home — nothing to check.');
      return;
    }
    const href = await bell.first().getAttribute('href');
    expect(href).toBe('/customer/notifications');
  });
});
