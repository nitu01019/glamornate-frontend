# Sentry Configuration

This app integrates with Sentry for error tracking and performance monitoring (web + Capacitor).

## Required environment variables

| Variable | Required? | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Yes (web) | Sentry DSN for the client-side SDK; embedded in the bundle |
| `SENTRY_AUTH_TOKEN` | Yes (CI) | Used by `@sentry/nextjs` webpack plugin to upload sourcemaps |
| `SENTRY_ORG` | Yes (CI) | Sentry organization slug |
| `SENTRY_PROJECT` | Yes (CI) | Sentry project slug |
| `NEXT_PUBLIC_SENTRY_TUNNEL` | Optional | Path for the Sentry tunnel route (mitigates ad-blockers) |

## How to obtain credentials

1. Sign up at https://sentry.io and create an organization + project
2. Copy the DSN from Project Settings → Client Keys
3. Generate an auth token at https://sentry.io/settings/account/api/auth-tokens/ with scope `project:releases`

## Local development

Add to `.env.local`:
```
NEXT_PUBLIC_SENTRY_DSN=<your-dsn>
SENTRY_AUTH_TOKEN=<your-auth-token>
SENTRY_ORG=<your-org-slug>
SENTRY_PROJECT=<your-project-slug>
```

## CI / Production

Set the same variables in your CI environment (GitHub Actions secrets, Vercel environment variables, etc.). Without `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN`, the Sentry webpack plugin will skip sourcemap upload and emit a warning.

## Forking this repo

If you fork this public mirror, you must supply your own Sentry credentials. The default org/project values used previously in this codebase have been stripped (see Team 2 PR `chore/team2-sentry-env-driven`); without env vars set, sourcemaps will not upload.

## Privacy considerations

- `replaysSessionSampleRate` is set to `0` (no full-session replay; privacy-first default)
- `replaysOnErrorSampleRate` is set to `0.5` for the web client
- Add a `beforeSend` hook in `sentry.client.config.ts` to scrub PII (uid, phone, email) from event payloads if your customer base requires it
