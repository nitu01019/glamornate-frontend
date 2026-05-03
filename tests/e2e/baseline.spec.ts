/**
 * Phase 0 baseline spec — empirically validate S1-S5 symptoms.
 *
 * This spec is intended to run AFTER `npm run dev` boots successfully. On the
 * 2026-04-17 recovery run the dev server did not boot because the app router
 * contains two dynamic segments with different slug names at the same path
 * (`src/app/services/[id]` and `src/app/services/[slug]`), so this spec was
 * never executed end-to-end. Keeping it in-tree as the hand-off artifact for
 * Phase 2.
 *
 * Usage once the dev server boots:
 *   npx playwright test tests/e2e/baseline.spec.ts \
 *     --project='Mobile Chrome' --reporter=list --timeout=60000
 *
 * Evidence is written to `frontend/docs/plans/baseline-evidence/`.
 */

import { test, expect, type Page, type Request } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

// ---------------------------------------------------------------------------
// Evidence helpers
// ---------------------------------------------------------------------------

const EVIDENCE_DIR = path.join(__dirname, '..', '..', 'docs', 'plans', 'baseline-evidence');
const SUMMARY_PATH = path.join(EVIDENCE_DIR, 'summary.json');

interface SymptomEvidence {
  status: 'FIXED' | 'BROKEN' | 'PARTIAL' | 'ERROR';
  details: Record<string, unknown>;
  error?: string;
}

function writeSummary(key: string, evidence: SymptomEvidence): void {
  let summary: Record<string, unknown> = {};
  if (fs.existsSync(SUMMARY_PATH)) {
    try {
      summary = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf-8')) as Record<string, unknown>;
    } catch {
      summary = {};
    }
  }
  summary[key] = evidence;
  summary._meta = {
    timestamp: new Date().toISOString(),
    generator: 'tests/e2e/baseline.spec.ts',
  };
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2));
}

interface RequestLog {
  method: string;
  url: string;
  status: number | null;
  resourceType: string;
  fromCache: boolean;
}

function attachNetworkLogger(page: Page): {
  logs: RequestLog[];
  stop: () => void;
} {
  const logs: RequestLog[] = [];

  const onRequestFinished = async (request: Request) => {
    const response = await request.response().catch(() => null);
    const fromCache = response ? (await response.serverAddr().catch(() => null)) === null : false;
    logs.push({
      method: request.method(),
      url: request.url(),
      status: response ? response.status() : null,
      resourceType: request.resourceType(),
      fromCache,
    });
  };

  page.on('requestfinished', (request) => {
    void onRequestFinished(request);
  });

  return {
    logs,
    stop: () => {
      page.removeAllListeners('requestfinished');
    },
  };
}

function countCalls(logs: RequestLog[], fragment: string): number {
  return logs.filter((log) => log.url.includes(fragment)).length;
}

// ---------------------------------------------------------------------------
// S1 - Cache survival across routes
// ---------------------------------------------------------------------------

test('S1: cache survives / -> /account -> / navigation', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const logger = attachNetworkLogger(page);

  await page.goto('/account');
  await page.waitForLoadState('networkidle');
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  logger.stop();

  const categoriesCalls = countCalls(logger.logs, '/services/categories');
  const promotionsCalls = countCalls(logger.logs, '/promotions');
  const trendingCalls = countCalls(logger.logs, '/search/trending');

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, 's1-return-home.png'),
    fullPage: true,
  });

  test.info().attach('s1-network-summary', {
    body: JSON.stringify(
      {
        categoriesCalls,
        promotionsCalls,
        trendingCalls,
        totalApiCalls: logger.logs.filter((l) => l.url.includes('/api/')).length,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });

  const totalRefetches = categoriesCalls + promotionsCalls + trendingCalls;
  writeSummary('S1_cache_across_routes', {
    status: totalRefetches === 0 ? 'FIXED' : 'BROKEN',
    details: {
      categoriesCalls,
      promotionsCalls,
      trendingCalls,
      totalApiCalls: logger.logs.filter((l) => l.url.includes('/api/')).length,
    },
  });

  // Expected: 0 refetches on return to home (cache hit via React Query).
  expect(totalRefetches).toBe(0);
});

// ---------------------------------------------------------------------------
// S2 - Category card navigation
// ---------------------------------------------------------------------------

test('S2: each category card navigates to a valid detail page', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const categoryLinks = page.locator('a[href^="/services/category/"]');
  const count = await categoryLinks.count();
  expect(count).toBeGreaterThan(0);

  const results: Array<{
    slug: string;
    url: string;
    heading: string;
    notFound: boolean;
  }> = [];

  for (let i = 0; i < count; i += 1) {
    const link = categoryLinks.nth(i);
    const href = (await link.getAttribute('href')) ?? '';
    const slug = href.split('/').pop() ?? '';

    await link.click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const heading = (await page.locator('h1').first().textContent()) ?? '';
    const notFound = (await page.getByText(/category not found/i).count()) > 0;

    results.push({ slug, url, heading: heading.trim(), notFound });

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, `s2-${slug || `idx-${i}`}.png`),
      fullPage: false,
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  }

  test.info().attach('s2-category-results', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });

  const broken = results.filter((r) => r.notFound || r.heading === '');
  writeSummary('S2_category_navigation', {
    status: broken.length === 0 ? 'FIXED' : broken.length === results.length ? 'BROKEN' : 'PARTIAL',
    details: {
      totalCards: results.length,
      brokenCount: broken.length,
      brokenSlugs: broken.map((r) => r.slug),
      results,
    },
  });

  expect(broken).toEqual([]);
});

// ---------------------------------------------------------------------------
// S3 - Trending chip propagation
// ---------------------------------------------------------------------------

test('S3: trending chips return distinct result sets', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Open search overlay (bottom-nav search icon or SearchBar).
  const searchButton = page
    .getByRole('button', { name: /search/i })
    .or(page.locator('[aria-label*="Search" i]'))
    .first();
  await searchButton.click();

  await page
    .getByRole('heading', { name: /trending near you/i })
    .waitFor({ state: 'visible', timeout: 10_000 });

  const chips = page.locator('button[aria-label^="Search for "]');
  const chipCount = Math.min(await chips.count(), 4);
  expect(chipCount).toBeGreaterThan(0);

  const labels: string[] = [];
  for (let i = 0; i < chipCount; i += 1) {
    labels.push((await chips.nth(i).innerText()).trim());
  }

  const results: Array<{ query: string; url: string; firstFive: string[] }> = [];

  for (const label of labels) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page
      .getByRole('button', { name: /search/i })
      .or(page.locator('[aria-label*="Search" i]'))
      .first()
      .click();
    await page.getByRole('button', { name: new RegExp(`Search for ${label}`, 'i') }).click();
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const items = page.locator('[data-testid="search-result-card"], li, article');
    const firstFive: string[] = [];
    const itemCount = Math.min(await items.count(), 5);
    for (let j = 0; j < itemCount; j += 1) {
      firstFive.push((await items.nth(j).innerText()).slice(0, 80).trim());
    }
    results.push({ query: label, url, firstFive });
  }

  test.info().attach('s3-chip-results', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, 's3-last-chip.png'),
    fullPage: true,
  });

  // No two chips should return identical first-5 results.
  const serialized = results.map((r) => JSON.stringify(r.firstFive));
  const unique = new Set(serialized);
  writeSummary('S3_trending_chips', {
    status: unique.size === serialized.length ? 'FIXED' : 'BROKEN',
    details: {
      chipsClicked: results.length,
      uniqueResultSets: unique.size,
      results,
    },
  });

  expect(unique.size).toBe(serialized.length);
});

// ---------------------------------------------------------------------------
// S4 - Deal of the Day rendering
// ---------------------------------------------------------------------------

test('S4: PromoSection renders either a deal card or an empty-state card', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Scroll to the Deal of the Day header.
  const header = page.getByRole('heading', { name: /deal of the day/i });
  await header.scrollIntoViewIfNeeded();

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, 's4-promo-section.png'),
    fullPage: false,
  });

  const dealCard = page.locator('[data-testid="deal-card"]');
  const emptyState = page.getByText(/no deal available today/i);
  const anyImg = page.locator('section img').first();

  const hasDealCard = (await dealCard.count()) > 0;
  const hasEmptyState = (await emptyState.count()) > 0;
  const hasImage = (await anyImg.count()) > 0;

  test.info().attach('s4-rendering', {
    body: JSON.stringify({ hasDealCard, hasEmptyState, hasImage }, null, 2),
    contentType: 'application/json',
  });

  writeSummary('S4_deal_of_day', {
    status: hasDealCard ? 'FIXED' : hasEmptyState ? 'PARTIAL' : 'BROKEN',
    details: { hasDealCard, hasEmptyState, hasImage },
  });

  // Bug reproduces if NO card shows at all (heading only).
  expect(hasDealCard || hasEmptyState).toBe(true);
});

// ---------------------------------------------------------------------------
// S5 - Asset reload on navigation
// ---------------------------------------------------------------------------

test('S5: most images served from cache on return navigation', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const logger = attachNetworkLogger(page);

  await page.goto('/account');
  await page.waitForLoadState('networkidle');
  await page.goto('/services/category/massages').catch(() => {});
  await page.waitForLoadState('networkidle');
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  logger.stop();

  const imageLogs = logger.logs.filter((l) => l.resourceType === 'image');
  const cached = imageLogs.filter((l) => l.fromCache).length;
  const fresh = imageLogs.filter((l) => !l.fromCache).length;

  test.info().attach('s5-image-cache', {
    body: JSON.stringify(
      {
        totalImages: imageLogs.length,
        cachedImages: cached,
        freshImages: fresh,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, 's5-return-home.png'),
    fullPage: true,
  });

  writeSummary('S5_asset_cache', {
    status: imageLogs.length === 0 ? 'PARTIAL' : cached >= fresh ? 'FIXED' : 'BROKEN',
    details: {
      totalImages: imageLogs.length,
      cachedImages: cached,
      freshImages: fresh,
    },
  });

  // Expected: majority of images served from cache on repeat visit.
  if (imageLogs.length > 0) {
    expect(cached).toBeGreaterThanOrEqual(fresh);
  }
});
