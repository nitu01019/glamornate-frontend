# Glamornate — Frontend

Customer-facing web + Android app for the Glamornate spa booking platform. Single Next.js codebase compiled into both a Next.js App Router web build and a Capacitor-wrapped Android APK.

> **⚠️ This is a public source mirror.** The repo is published for code review and reference. The build pipeline depends on internal workspace packages (`@glamornate/contracts`, `@glamornate/data-catalog`) that live outside this repo, so a fresh `git clone` will **not** be buildable end-to-end without those packages. See [Build limitations](#build-limitations) below.

## Stack

Versions pinned in `package.json` (source of truth).

- **Next.js 15** (App Router) on **React 18**
- **TypeScript 5** strict
- **Tailwind CSS 3** + Radix UI primitives
- **TanStack Query 5** + sync-storage persister
- **Zustand 4** for ephemeral client state
- **React Hook Form 7** + **Zod 3** (schemas shared via `@glamornate/contracts`)
- **Firebase Web SDK 12** (auth, firestore, storage, messaging) + **App Check** (ReCaptcha v3)
- **Sentry** (`@sentry/nextjs`, `@sentry/capacitor`)
- **Capacitor 8** for the Android shell (geolocation, push, privacy-screen, firebase-auth, firebase-messaging)

Payment model: **pay-at-spa** — no online payment integration.

## Repository layout

```
.
├── src/
│   ├── app/             # Next.js App Router (routes, layouts, API handlers)
│   ├── components/      # React components (booking, account, admin, ui, ...)
│   ├── hooks/           # React hooks (auth, bookings, availability, FCM)
│   ├── lib/             # Firebase clients, auth, App Check, helpers
│   ├── store/           # Zustand stores (booking, cart, chat, popup)
│   ├── data/            # Static catalog + blog content
│   └── middleware.ts    # Next.js middleware (CSP, auth gates)
├── public/              # Static assets (service imagery, AssetLinks)
├── android/             # Capacitor Android shell
├── tests/               # Playwright E2E + Vitest unit/integration
├── docs/                # Public PRDs, runbooks, compliance docs
├── scripts/             # Build/release tooling
└── package.json
```

## Quick start

Prerequisites:
- Node.js ≥ 20
- pnpm 9
- (Mobile) Android Studio + JDK 17 (bundled with Android Studio)

```bash
pnpm install
pnpm dev              # http://localhost:3000
```

Populate `.env.local` from `.env.local.example` (Firebase web config, Sentry DSN, Google Maps API key, App Check ReCaptcha site key). All `NEXT_PUBLIC_*` values are public-by-design — they ship in the client bundle. Server-only secrets go in `.env.local`, not in source.

### Build limitations

This public mirror does **not** include the workspace packages `@glamornate/contracts` (Zod schemas + types) and `@glamornate/data-catalog` (service catalog data). They are referenced via `file:../packages/*` in `package.json` and pnpm will fail to install without them.

To make this repo buildable from a clean clone, you would need to either (a) publish the two packages to a registry and update `package.json`, or (b) inline their `dist/` output into `vendor/` and switch to local file paths. Neither is set up in this mirror.

## Common tasks

| Command | What it does |
|---|---|
| `pnpm dev` | Local Next.js dev server |
| `pnpm build` | Web production build |
| `pnpm typecheck` | TypeScript-only check |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright E2E (requires app running on `:3000`) |
| `pnpm build:mobile` | Android APK release build (`BUILD_TARGET=mobile`) |
| `pnpm build:mobile:staging` | Android staging APK (debug AppCheck, sideloadable) |

The mobile target flips Next.js into static-export mode (`output: 'export'`); Capacitor wraps `out/` into a WebView shell. See `docs/mobile-build.md` and `docs/runbooks/android-*.md` for the full mobile pipeline.

## Architecture highlights

- **App Check** enforced on backend callables and security-relevant Firestore reads. ReCaptcha v3 in production; debug provider gated behind `NEXT_PUBLIC_APP_CHECK_DEBUG === 'true'` AND `NEXT_PUBLIC_ENVIRONMENT === 'staging'`.
- **CSP** with nonce-based `script-src 'strict-dynamic'`, no `unsafe-eval`. See `src/middleware.ts`.
- **Firebase Admin SDK** is `'server-only'` and lazily proxied — accidental client-side import crashes loudly. Server routes use `verifyIdToken(token, /* checkRevoked */ true)` on every request.
- **Booking pricing is server-authoritative** — client price is display-only; the backend `createBooking` callable re-derives every line item from the spa's service catalog.
- **Account linking** (anonymous → phone) goes through a server-side `mergeUserAccounts` callable; bookings created pre-link are atomically transferred.
- **No Stripe / online payment** in the customer flow — pay-at-spa post-service.

## Documentation

- `docs/PRD-*.md` — product requirement documents (landing page redesign)
- `docs/mobile-build.md` — mobile build overview
- `docs/runbooks/android-keystore-setup.md` — keystore + signing
- `docs/runbooks/android-app-check.md` — App Check provider setup
- `docs/runbooks/android-release-build.md` — release APK pipeline
- `docs/runbooks/apk-smoke-checklist.md` — pre-release sanity checks
- `docs/runbooks/google-maps-key-setup.md` — Maps API key + restrictions
- `docs/runbooks/google-maps-client-key-restrictions.md`
- `docs/runbooks/rotate-google-maps-key.md`
- `docs/runbooks/crashlytics-setup.md`
- `docs/runbooks/verify-firestore-cache.md`
- `docs/compliance/` — Play Store data-safety, listing, reachability audit

## Status

This is a working snapshot of an active project. The codebase is in production-bound iteration; some advisory items (e.g., server-component conversion of admin/spa/customer layouts, deduplication of cart preview/validate routes, Promise.all in cart pricing math) are tracked as follow-ups.

## License

See `LICENSE` if present in the repo, otherwise contact the repo owner.
