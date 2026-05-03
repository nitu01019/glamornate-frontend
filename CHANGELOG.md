# Changelog

All notable changes to this public mirror are documented here.

The project adheres to [Semantic Versioning](https://semver.org/) and the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

## [Unreleased]

### Changed
- Sentry org/project no longer default to internal values — operators must
  supply `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` env vars.
  Build succeeds without them but sourcemap upload is skipped.

### Added
- `.env.example` documenting all required and optional env vars.
- `CHANGELOG.md` (this file).

## [v0.1.0] — 2026-05-03

### Added
- Initial public mirror release with full source tree (Next.js 15 +
  React 18 + Capacitor 8 + Firebase 12).
- MIT LICENSE, CONTRIBUTING, SECURITY, issue templates.
- GitHub Actions CI + CodeQL workflows.
- Branch protection on `main` (1 review required, no force-push).

### Known limitations
- Public repo references workspace deps `@glamornate/contracts` and
  `@glamornate/data-catalog` via `file:../packages/*`; not buildable
  from a clean clone until v0.2.0 vendoring lands.

---

## Historical entries (pre-mirror, retained for context)

### [stagingRelease 2026-04-30]

APK auth, booking, and location fix pass. All five user-visible failures
on the staging APK trace to a single convergent root cause (App Check
debug-token UUID not registered in Firebase Console) plus four
contributing code paths fixed in Phases 1-5.

### Added
- In-app debug screen at `/debug/app-check` (stagingRelease only) so
  operators can register the App Check UUID without adb logcat.
- LocationRationaleModal + WCAG 2.1 AA compliant rationale pre-prompt
  before requesting OS location permission.
- useEmailTypoSuggestion hook (gmail/yahoo/hotmail/outlook/icloud +
  Levenshtein distance <=1 detection).
- MapsKeyMissingFallback now handles 403/REQUEST_DENIED/RefererNotAllowed
  with a distinct "Map could not load" banner; SpaBookingLocationCard
  wires it into APIProvider's onError.
- 5 new runbooks: in-app UUID workflow, debug screen verification,
  Firestore cache verification, Maps client-key restrictions, and
  per-phase verification checklists.

### Changed
- auth-provider.tsx now throws AuthError carrying firebaseCode (was
  stripping it). All 6 throw sites tagged for Sentry except cancellation.
- error-handler.getUserFriendlyMessage extended with 21 Firebase auth
  code mappings (auth/wrong-password, auth/internal-error,
  auth/credential-already-in-use, app-check/token-error, etc.).
- 3 auth pages route through getUserFriendlyMessage; deleted the dead
  local translateFirebaseError functions.
- ReviewStep.tsx booking error path goes through error-handler; removed
  the suppression heuristic that hid the generic fallback.
- useSignupAvailability rewrite: silent pass-through on failure (no
  more amber pill), trigger='both' default, App Check token race timeout,
  one-shot retry, triggerCheck() for blur-fired immediate checks.
- capacitor-bridge.getCurrentPosition no longer pre-calls
  requestPermissions standalone (per @capacitor/geolocation@8.2.0
  GeolocationPlugin.kt analysis -- that call resolves synchronously
  before the OS dialog renders).
- normalizePermissionState now passes 'prompt-with-rationale' through
  unchanged (was collapsing to 'prompt').
- BookingLocationStep wires LocationRationaleModal + Open Settings CTA;
  fixed pre-existing TS2339/TS2353 errors.
- Production builds now silence Firestore SDK noise via setLogLevel('error')
  gated by NODE_ENV; Sentry breadcrumb filter drops bloom-filter logs.
- Backend checkSignupAvailability adds per-device rate limiting (20 req/60s
  keyed on App Check token fingerprint).

### Fixed
- Login/register/Google sign-in/booking failures previously surfaced as
  generic "An error occurred. Please try again." -- now show specific
  Firebase error messages (incorrect password, no account found,
  device verification failed, etc.).
- Location button on first tap previously showed "Location permission
  denied" before the OS dialog rendered -- now triggers OS dialog
  correctly via plugin's wired @PermissionCallback chain.
- Amber "Couldn't check availability -- continue anyway" pill no longer
  appears on App Check / network hiccups during signup.
- Maps 403 errors no longer break the booking flow with a blank screen.

### Operator actions still required
- **T1-A** (per device): register App Check debug UUID in Firebase Console
  at https://console.firebase.google.com/project/glamornate-758c6/appcheck.
  See docs/runbooks/android-app-check.md.
- **T1-B** (production release only -- not needed for stagingRelease APK):
  add release SHA-1 + SHA-256 to Firebase Console; re-download
  google-services.json. See docs/runbooks/android-app-check.md.

### Commits (feat/industry-overhaul branch)
- 89b90cd8 -- feat(app-check): in-app debug UUID screen + complete operator runbook
- 905af3e0 -- fix(auth): surface specific Firebase error codes; route auth + booking errors through error-handler
- 6c3c98b5 -- fix(location): delegate permission to plugin's wired callback; add rationale + open-settings UX
- e22f7779 -- feat(signup): industrial-grade availability check with retry, blur trigger, typo suggest, rate-limit
- 2dfaef6e -- chore(firestore): production setLogLevel + Sentry breadcrumb filter; silence bloom-filter noise
- 895d15f2 -- fix(maps): unified fallback for missing/invalid keys + restriction runbook

---

## [Round 2 — 2026-04-17] Phone-testing fixes (round 2)

### Added
- `/customer/payments` page — Saved Cards (empty state + Add Card dialog) and UPI handle form. Persistence deferred until Cloud Functions go live.
- `/blog` index + `/blog/[slug]` for 6 long-form posts (Korean Glass Skin, At-Home Spa Day, Bridal Prep Timeline, Body Polishing vs. Scrubbing, HydraGlo Facials, Hair Care Between Visits).
- Home redesign — Elite promo strip, 3+4 tile category grid (`FeaturedCategoryTile` + `SecondaryCategoryTile` + `CategoryTilesGrid`), animated "Most Booked" cycling label.
- New Tailwind tokens: `brand.cream.{50,100}`, `brand.peach.{50,100}`, `brand.eliteBg`, `brand.eliteText`, `shadow-tile-{sm,md}`, `rounded-tile`, `animate-marquee-up`.

### Changed
- `MostBookedSection` now wraps content in a tinted `bg-brand-cream-50` panel; pill tabs restyled (active: maroon + white text; inactive: white + border).
- Help page links to `/blog`.

### Security / Verified
- Independent forensic re-audit of Auth — VERDICT: SAFE. APK uses real Firebase (project `glamornate-758c6`); zero mock-bypass surface confirmed in `src/` and minified APK chunks. Memo: `docs/plans/investigations/round2/p1-auth-security-memo.md`.

### Build
- `npm run build:mobile` regenerates `out/` with all new routes statically exported (6 blog slug pages + payments + blog index).
- New APK rebuilt + delivered (see `docs/plans/round2-apk-delivery.md`).
