# frontend

The customer-facing Glamornate web app. Same workspace also produces the Android APK via Capacitor.

> ⚠️ **First-time onboarding?** See the canonical [**Onboarding Gotchas**](../README.md#onboarding-gotchas) in the root README before your first build (date-fns v3, `.env.production` clobber, iCloud ghost files, contracts resync, Stripe sentinel ordering, etc.). The list below is a frontend-scoped subset and may drift.

## Overview

This is the primary booking surface: home, search, service detail, booking flow, payment (Stripe Elements), account, and post-booking states. It runs in three shapes from a single codebase:

- **Web (production)** — Next.js server build, deployed to Vercel / Firebase Hosting.
- **Web (local dev)** — `next dev` on `http://localhost:3000`.
- **Android APK** — `BUILD_TARGET=mobile` flips Next.js into static-export mode (`output: 'export'`), Capacitor wraps the resulting `out/` into a WebView shell.

The marketing website is a separate project maintained outside this monorepo and is not covered here.

## Stack

Versions pinned in `package.json` (see that file for the source of truth).

- Next.js `15.5.15` (App Router) on React `^18.2.0`
- TypeScript `^5.3.3`, strict
- Tailwind CSS `^3.4.1` + `tailwindcss-animate`, Radix UI primitives
- TanStack Query `^5.17.19` with `@tanstack/query-sync-storage-persister`
- Zustand `^4.4.7` for ephemeral client state
- React Hook Form `^7.49.3` + Zod `^3.22.4` (schemas shared via `@glamornate/contracts`)
- Stripe Elements (`@stripe/react-stripe-js ^2.9.0`, `@stripe/stripe-js ^4.10.0`)
- Firebase web SDK `^12.11.0` (auth, firestore, storage, messaging)
- Sentry (`@sentry/nextjs 10.43.0`, `@sentry/capacitor ^3.2.1`)
- Capacitor `^8.3.1` (`@capacitor/android`, `@capacitor/ios`, plugins for keyboard, splash, status bar, geolocation, privacy screen, push, firebase-auth, firebase-messaging)
- Vitest `^4.1.3` + `@testing-library/react ^16.3.2` (unit/component)
- Playwright `^1.59.1` (e2e, multi-browser + mobile emulation)

Package manager: **pnpm@9.15.0**. Node: **>=20**.

## Scripts

All commands run from this directory. Use `pnpm` — `npm` works but is not the supported path.

```bash
pnpm dev                # next dev on :3000
pnpm build              # next build (web target). prebuild runs image opt + blur generation
pnpm start              # next start (serve the built web app)
pnpm lint               # next lint
pnpm typecheck          # tsc --noEmit
pnpm clean              # rm -rf .next node_modules

pnpm optimize:images    # scripts/optimize-images.mjs (sharp pipeline for /public)
pnpm generate:blur      # scripts/generate-blur.mjs (blur-up placeholders)

pnpm test               # vitest watch
pnpm test:run           # vitest run (CI mode)
pnpm test:coverage      # vitest run --coverage (v8)
pnpm test:e2e           # playwright test

pnpm build:mobile       # bash scripts/build-mobile.sh — static export for Capacitor
pnpm cap:sync           # npx cap sync (copy web assets into android/ + ios/)
pnpm cap:open:android   # open Android Studio
pnpm cap:open:ios       # open Xcode

pnpm lighthouse         # lhci autorun (uses lighthouserc.js + lighthouse-budget.json)
```

`prebuild` is wired to `pnpm build`, so image optimization and blur generation always run before a web build.

## Local development

```bash
pnpm install            # from this directory; pnpm workspace will resolve ../packages/*
pnpm dev
```

Env files (gitignored, copy from `.env.example` at the repo root or ask the operator):

- `.env.local` — local dev secrets (Firebase web config, Stripe publishable, NEXT_PUBLIC_* flags).
- `.env.production` — used by `next build`. **Mobile builds overwrite this** from `.env.mobile` (see `scripts/build-mobile.sh`); restore it from git after a mobile build if you also do web builds locally.
- `.env.mobile` — required for `pnpm build:mobile`. Holds the production Firebase + API config the APK ships with.

Public flags are namespaced `NEXT_PUBLIC_*` (see `src/lib/flags/*.ts`). The Playwright web server enables four flags by default — `HOME_V2_GRID`, `HOME_V2_HERO`, `ADDRESS_SHEET_V2`, `NOTIFICATIONS_FEED_V1` — so dev parity with e2e expects those on.

## Testing

Unit / component tests live next to source under `src/**/*.test.ts(x)` and in `tests/unit/`, `tests/components/`, `tests/integration/`. Run them with vitest:

```bash
pnpm test               # watch mode
pnpm test:run           # one-shot
pnpm test:coverage      # writes coverage/ (v8 reporter)
```

E2E specs live under `tests/e2e/` and run across five Playwright projects: chromium, firefox, webkit, Mobile Chrome (Pixel 5), Mobile Safari (iPhone 12). The dev server is auto-started by `playwright.config.ts`.

```bash
pnpm test:e2e
pnpm test:e2e --project=chromium
pnpm test:e2e tests/e2e/booking-flow.spec.ts
```

Auth state convention: `tests/auth.setup.ts` signs a customer in once and writes session storage to `tests/.auth/customer.json`. Specs that need an authenticated session use the `customer` Playwright project (depends on `setup`) so they don't re-run sign-in for every spec. The directory is gitignored — regenerate by running the setup project. Quarantined / known-flaky specs live in `tests/quarantine/`.

CI defaults (`process.env.CI`): `retries=1`, `workers=1`, `forbidOnly=true`. Reports land in `tests/report/` (HTML, JSON, JUnit).

## Mobile build (Capacitor → Android APK)

The full runbook lives at `../docs/runbooks/mobile-plugins.md` and covers plugin registration, Firebase Android config, signing, and Play Console upload. Quick local APK:

```bash
pnpm build:mobile                    # writes static export to out/ (uses .env.mobile)
npx cap sync android                 # copies out/ + plugin native code into android/
cd android && ./gradlew assembleDebug
# APK at android/app/build/outputs/apk/debug/app-debug.apk
```

`scripts/build-mobile.sh` temporarily moves server-only paths (`src/app/api`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/middleware.ts`) out of the way for the static export and restores them on exit. Don't kill the build mid-run — if you do, run `git status` and restore the renamed `.bak` / `_api_disabled` paths manually.

`capacitor.config.ts` registers SplashScreen, StatusBar, Keyboard, Geolocation, PrivacyScreen, and FirebaseAuthentication (`skipNativeAuth: true` — the web SDK stays the source of truth, the native plugin only mints a Google ID token to feed `signInWithCredential`).

Release builds: `scripts/release-build.sh` (signed AAB), `scripts/bump-version.sh` (versionCode/versionName).

## Linking the contracts package

Workspace deps `@glamornate/contracts` and `@glamornate/data-catalog` are resolved via `file:../packages/*` entries in `package.json`. pnpm install handles them, but file-link semantics mean the workspace consumes the **published `dist/`** of each package, not source. After editing `packages/contracts/src` you must rebuild the package and copy its dist into both consumers:

```bash
# from repo root
pnpm --filter @glamornate/contracts build
cp packages/contracts/dist/* frontend/node_modules/@glamornate/contracts/dist/
cp packages/contracts/dist/* backend/functions/node_modules/@glamornate/contracts/dist/
```

A clean reinstall (`pnpm install --force` from the repo root) also works but is slower. Symptom of a stale link: TypeScript errors on shapes that match the source but not the bundled `dist/index.d.ts`.

## Common gotchas

> ⚠️ See root README **[Onboarding Gotchas](../README.md#onboarding-gotchas)** for the canonical list (this section may drift).

- **iCloud-sync ghost files / dirs.** This workspace lives under `~/Desktop` which is iCloud-synced. iCloud occasionally creates `Foo 2.tsx` and `api 2/` style duplicates that Next.js will happily try to compile, breaking static export with no useful error. Both globs are now in the root `.gitignore`. If a build mysteriously fails, run `git status` first and remove ghosts with explicit paths — **never run `git clean -fd` blindly**, it has wiped real untracked files in this tree before. Dry-run with `git clean -nd` first if you must.
- **`date-fns` import paths.** This project pins `date-fns@^3.3.1`. v3 dropped the `.mjs` ESM subpath; importing `date-fns/isBefore.mjs` (or any other function with `.mjs`) will fail at build time. Use `import { isBefore } from 'date-fns'` or the bare path `date-fns/isBefore`. A regression here recently broke the booking calendar.
- **Mobile build `.env.production` clobber.** `build:mobile` overwrites `.env.production` with `.env.mobile`. After a mobile build, restore it (`git checkout .env.production` if tracked, or recopy from your secrets manager) before doing a web build.
- **Sentry sourcemaps.** `next.config.mjs` wires `withSentryConfig`. Without `SENTRY_AUTH_TOKEN` in the build env, sourcemap upload is silently skipped — the build still succeeds, but Sentry events on prod will be minified.
- **Static-export incompatibilities.** In mobile mode, custom `headers()`, `next/image` server optimization, and route handlers (`src/app/api`) are unavailable. The mobile build script removes the API directory; the image loader is swapped to `src/lib/image-loader.ts` (pass-through). New code that touches those primitives needs an `if (isMobile)` branch.

## Pointers

- `../README.md` — repo-level overview, workspace layout, environment matrix.
- `../CONTRIBUTING.md` — branch naming, commit convention, PR checklist.
- `../docs/runbooks/` — operator runbooks (mobile plugins, Android keystore, CI secrets, landing repo, user-gates phases).
- `../backend/` — Firebase Functions (callables, Stripe webhook, Firestore rules) consumed by this app.
- `../packages/contracts/` — Zod schemas + TypeScript types shared between frontend and backend.
- `./docs/`, `./CATALOG.md`, `./CHANGELOG.md` — workspace-local docs.
