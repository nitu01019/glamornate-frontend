# Delete-Account Reachability Audit

**Generated:** 2026-04-20
**Owner:** Agent 3D
**Target:** Delete Account entry point must be reachable from app root in
≤ 2 taps for signed-in users (Google Play account deletion policy,
https://support.google.com/googleplay/android-developer/answer/13327111).

---

## 1. Starting state

- User is **signed in**.
- User is on the app root (`/`) after launch.
- The bottom navigation bar (`src/components/layout/BottomNav.tsx`) is visible
  with five tabs: Home, Services, Cart, Bookings, Account.

## 2. Shortest path to Delete Account

| Step | Action | Resulting page | Tap count |
|------|--------|----------------|-----------|
| 1 | Tap the **Account** tab in the bottom nav (icon: User) | `/account` | 1 |
| 2 | Scroll to the bottom and tap **Delete Account** in the last card | `/data-deletion` | 2 |

**Tap total: 2. Target: ≤ 2. Status: PASS.**

### 2.1 Screenshot of tap 1

File: `docs/compliance/screenshots/step-1-account-tab.png`
TODO: capture on release candidate build.

### 2.2 Screenshot of tap 2

File: `docs/compliance/screenshots/step-2-delete-row.png`
TODO: capture on release candidate build.

## 3. Source of truth

- Bottom nav tabs: `src/components/layout/BottomNav.tsx`, lines 17-23.
  The Account tab has `href="/account"`.
- Account page layout: `src/app/account/page.tsx`.
  The Delete Account `MenuRow` sits in the last `SectionCard` and links to
  `/data-deletion` (`icon={<Trash2 />}`, `label="Delete Account"`).

## 4. Alternate paths

For completeness, the following longer paths also reach deletion:

| Path | Taps | Notes |
|------|------|-------|
| Bottom nav &rarr; Account &rarr; Delete Account | **2** | Primary path. Meets policy. |
| Direct URL `/data-deletion` | **0** | The Play Store listing itself points to this URL, so a reviewer can verify without installing the app. |
| Bottom nav &rarr; Account &rarr; Privacy Policy &rarr; In-app deletion section link | **3** | Non-primary path. Exists as a safety net if the user lands on the privacy page. Not counted against the 2-tap budget. |

## 5. Mitigations if the 2-tap path ever regresses

- The automated Playwright spec `tests/e2e/account/delete-reachability.spec.ts`
  fails the build if the Delete Account row disappears from the Account page.
- The footer (`src/components/layout/Footer.tsx`) also exposes a `Delete
  Account` link that navigates to `/data-deletion`. This ensures web users
  have a direct path even if the mobile Account page changes.

## 6. Policy citations

- Google Play Account Deletion policy (2024):
  https://support.google.com/googleplay/android-developer/answer/13327111
- Data Safety form requirement:
  https://support.google.com/googleplay/android-developer/answer/10787469

## 7. Gaps / TODOs

- Capture the two screenshots referenced in section 2 on a release-candidate
  build. Place them under `docs/compliance/screenshots/`.
- Record a 30-second screen video of the 2-tap flow; upload to the Play Console
  under "Reviewer notes".
- Re-run the audit after any navigation refactor (e.g., moving the Account tab,
  renaming `/data-deletion`).
