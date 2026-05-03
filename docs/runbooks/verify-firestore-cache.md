# Verify Firestore noise silencing — `stagingRelease 2026-04-30`

This runbook validates Phase 4 of the APK fix plan landed correctly. Phase 4 was NARROWED — we did NOT swap the Firestore cache strategy (the `getFirestore(firebaseApp)` calls are unchanged). We only silenced the SDK's bloom-filter logs.

## Step 1 — Build and install the staging APK

```bash
cd frontend && pnpm build:mobile:staging
adb install -r android/app/build/outputs/apk/stagingRelease/app-stagingRelease.apk
```

Pass: APK assembles, installs, launches without crash.

## Step 2 — Open Chrome DevTools remote inspector

1. On Mac: open `chrome://inspect`.
2. Connect device via USB; ensure USB debugging is enabled.
3. Find the Glamornate WebView under "Remote Target", click "inspect" — DevTools opens.

Pass: Console tab is visible.

## Step 3 — Navigate the booking flow

In the app:
1. Sign in with a test account.
2. Browse to the customer dashboard.
3. Open a service detail page and start a booking.
4. Reach the "Review" step.

Pass: All pages load without error toasts.

## Step 4 — Check Console and Sentry for Firestore noise

In Chrome DevTools Console:
- Filter for `Firestore (` or `bloom filter`.
- Pass: ZERO log lines match. Previously these were emitted by the SDK on every snapshot listener.

In Sentry breadcrumb dashboard (https://sentry.io for project glamornate-prod):
- Filter recent breadcrumbs by category `console` or `log` looking for `Firestore (`.
- Pass: ZERO matches in the last 5 minutes. Previously these flooded Sentry storage.

## Step 5 — Regression check (the things we deliberately did not touch)

These flows must STILL WORK because we left `getFirestore(firebaseApp)` unchanged. If any of these break, Phase 4 has a regression and must be reverted:

### 5a — Booking realtime status

- As a customer with an active booking, watch the booking detail page.
- Have a spa staff member tap "Check In" on the admin app.
- Pass: status updates live (within 5 seconds) without page reload.

### 5b — Address realtime list

- Navigate to `/customer/addresses`.
- In a separate browser or device, add an address as the same user via the API.
- Pass: the list updates live without reload.

### 5c — Chat / messaging (if applicable)

- If the project has a chat feature, send a message on one device and observe it on another.
- Pass: real-time delivery works.

If 5a, 5b, and 5c all pass: Phase 4 is verified. The `setLogLevel('error')` gate did not break Firestore listeners.
If any fail: revert Phase 4 commit and investigate.

## Troubleshooting

**`Firestore (` still appears in Console**
`setLogLevel('error')` was not applied. Confirm `NODE_ENV === 'production'` at build time (mobile builds set this via Next.js). Confirm the `if` gate is at module scope, not inside a function.

**Real-time listeners stopped working**
This should NOT be related to Phase 4 — we did not touch `getFirestore` or `onSnapshot`. Investigate Phase 0 (App Check) registration first; that is the more common APK-side cause of snapshot listener failures.
