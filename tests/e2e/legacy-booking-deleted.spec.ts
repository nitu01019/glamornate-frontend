import { test, expect } from '@playwright/test';

/**
 * SC-11 / V-7 / V-4 — Phase 1, Task 1.1 (spec-fe-2, 2026-05-08).
 *
 * The legacy `/booking` wizard was deleted in this commit:
 *   - frontend/src/app/booking/{page,error,loading}.tsx — entire dir
 *   - frontend/src/components/booking/{DateTimeStep,LocationStep,
 *     ReviewStep,ConfirmationStep}.tsx — wizard step components
 *
 * The single surviving booking entry point is `/customer/book-new`. This
 * spec locks the deletion: any future re-introduction of `/booking` (e.g.,
 * accidentally restoring the dir from git) trips this 404 assertion.
 *
 * V-4 (broken `getBookingsForDate` slot blocker) closes by construction:
 * its sole consumer was DateTimeStep.tsx (now deleted). The helper in
 * `frontend/src/lib/firebase-client/bookings.ts` still exists — Phase 3
 * spec-conn-3 owns its hard-gate / removal (out of scope for Task 1.1).
 */
test('GET /booking returns 404 (legacy wizard deleted, SC-11)', async ({ page }) => {
  const response = await page.goto('/booking', { waitUntil: 'domcontentloaded' });
  // Next.js App Router emits 404 with status code 404; the response object
  // is non-null because the navigation itself succeeded (just to a 404 page).
  expect(response?.status()).toBe(404);
});
