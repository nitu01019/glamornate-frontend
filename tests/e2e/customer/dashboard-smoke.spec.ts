/**
 * A4.2 — Customer project wire-up smoke spec.
 *
 * Goal: prove the `customer` Playwright project actually runs after the
 * `__never__` placeholder in playwright.config.ts was replaced with the
 * `tests/e2e/customer/` glob. This spec is intentionally small — its job is
 * to anchor the project, not to exhaustively cover the dashboard.
 *
 * Tagged `@customer` so future flows can opt in via grep filters
 * (e.g. `playwright test --grep @customer`). Auth is provided by the
 * persisted storageState at `tests/.auth/customer.json`, prepared by the
 * `setup` project (see tests/auth.setup.ts).
 */
import { test, expect } from '@playwright/test'

test.describe('@customer dashboard smoke', () => {
  test('home renders without console errors for signed-in customer', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // Page rendered some main element — keep selector loose since the home
    // surface is feature-flagged. Existence of <main> confirms hydration.
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 })

    expect(consoleErrors, `unexpected console errors: ${consoleErrors.join(' | ')}`).toEqual([])
  })
})
