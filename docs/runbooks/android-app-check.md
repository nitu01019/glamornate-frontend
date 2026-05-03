# Android App Check — operator runbook

This runbook covers the **one-time Firebase Console setup** required before any Android APK (debug or release) can pass App Check on a real device. Without these steps every callable function and every `/api/v1/*` REST call from the device will be rejected with `App Check token missing` and the user-facing error toast will read **"Booking unavailable on this device. Reinstall the app or contact support."** (the kind-aware copy added in Phase C of `apk-network-request-failed-systematic-debug`).

Background context: see `<internal-debug-notes>` for the full systematic-debugging output that led here.

## Why this matters

The booking flow is a Firebase **callable** (`createBookingDraft` → `us-central1`). The backend enforces App Check via `enforceAppCheck: true` at `backend/functions/src/utils/callable-opts.ts:27`. The Capacitor app's WebView uses the JS Firebase SDK, which calls a `CustomProvider.getToken()` that bridges to `@capacitor-firebase/app-check`'s native plugin (`frontend/src/lib/app-check.ts:158-200`). The native plugin asks Play Integrity (release) or the Debug provider (debug) for a token. **If the device's signing fingerprint or debug-token UUID has not been registered in Firebase Console, the token mint fails, the request fires without the header, the backend rejects, and the JS SDK normalizes the failure as "Network request failed".**

## Path A — release-signed APK (production, recommended)

This is what you ship to users. Once configured, every device that installs your release APK passes App Check automatically — no per-device action.

### One-time Firebase Console setup

1. **Enable Play Integrity API in GCP** (~30 seconds).
   - Visit https://console.cloud.google.com/apis/library/playintegrity.googleapis.com?project=glamornate-758c6
   - Click **Enable** if not already.

2. **Register the release-keystore SHA-256 in Firebase Console**.
   - Open Firebase Console → Project Settings → General → Your apps → Android app `com.glamornate.app` → click **Add fingerprint**.
   - Paste this SHA-256 (extracted today from `android/app/glamornate-upload.keystore`):
     ```
     83:34:E7:DB:BB:5B:F9:8D:19:BB:21:FF:D1:3E:9F:F4:89:A5:8F:43:FE:E7:4A:B4:20:97:AD:25:FC:66:E5:E3
     ```
   - Save. Console may ask you to also paste the SHA-1 — both are at the bottom of this file.

3. **Re-download `google-services.json`** from the same Firebase Console screen (top of the page after fingerprint registration). Save it to `frontend/android/app/google-services.json` (overwriting the existing file).

4. **Confirm App Check enforcement is "Enforced"** at Firebase Console → Build → App Check → APIs. All three rows (Cloud Functions, Cloud Firestore, Identity Platform) should read **Enforced**, not **Monitor**.

### Build + install

```bash
cd <repo-root>
pnpm build:mobile:release
# Produces android/app/build/outputs/apk/release/app-release.apk + .aab
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

After install, Firebase Console → Build → App Check → Apps → `com.glamornate.app` → Requests should show **Verified** count > 0 within 60 seconds of opening the app.

## Path B — debug-signed APK (developer convenience, fastest unblock)

Use this when you've already installed a debug APK on a device and need the booking flow to work *right now* without rebuilding. Works **per-device** — each new device or fresh install needs a separate registration.

### Get the debug-secret UUID off the device

```bash
# Mac (this repo's host)
export ANDROID_HOME=$HOME/Library/Android/sdk
"$ANDROID_HOME/platform-tools/adb" devices                         # confirm device shows as 'device'
"$ANDROID_HOME/platform-tools/adb" logcat -c                       # clear buffer
"$ANDROID_HOME/platform-tools/adb" logcat | grep -A1 "App Check"   # leave running
# Cold-start the app on the device (force stop + tap icon).
# Within 5 seconds you will see, in logcat:
#
# D/com.google.firebase.appcheck: Enter this debug secret into the allow list in
#   the Firebase Console for your project: 12345678-abcd-...
#
# Copy the UUID and Ctrl-C the logcat tail.
```

### Register the UUID

Firebase Console → Build → App Check → Apps → click `com.glamornate.app` → **Manage debug tokens** → **Add debug token** → paste UUID, name it `nitish-pixel-2026-04-29` (date-stamped, identifiable) → Save.

Wait 60 seconds for propagation. The same APK will now work on this device — no reinstall needed.

## Unified debug UUID — APK reads it from `.env.local` at build time

The `stagingRelease` build type pins the App Check Debug UUID at compile time
from `frontend/.env.local` (`NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN`). The same UUID
is also used by the localhost web dev server (the JS App Check init reads the
same env var at runtime).

This removes the need for a per-device, on-device UUID lookup. Register the
single UUID once in Firebase Console and **both the APK and `localhost:3000`**
mint accepted App Check tokens.

How it works under the hood:

- `android/app/build.gradle` reads `NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN` from
  `frontend/.env.local` and emits it as
  `BuildConfig.APP_CHECK_DEBUG_TOKEN` on the `stagingRelease` buildType only.
- `MainActivity.onCreate` writes that value to the same SharedPreferences file
  the Firebase Debug App Check SDK reads from
  (`com.google.firebase.appcheck.debug.store.<persistenceKey>`, key
  `com.google.firebase.appcheck.debug.DEBUG_SECRET`) **before** installing
  `DebugAppCheckProviderFactory.getInstance()`. The SDK's
  `retrieveStoredDebugSecret()` then returns our pinned value instead of
  generating a fresh one.
- If `.env.local` is absent or the key is empty, the field falls back to an
  empty string and the SDK auto-generates a per-device UUID (legacy behavior).
  In that case, follow the logcat path below to capture and register it.

## Direct Firebase Console URL

To register a debug-secret UUID without navigating the full Firebase Console hierarchy:

1. Open https://console.firebase.google.com/project/glamornate-758c6/appcheck
2. Click your Android app (`com.glamornate.app`) in the app list.
3. Click **Manage debug tokens**.
4. Click **Add**.
5. Paste the UUID — either the pinned value from `frontend/.env.local` (`NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN`) or one captured from logcat.
6. Give it a descriptive name (e.g., `staging-YYYY-MM-DD-devicename`).
7. Click **Save**.

Propagation takes approximately 60 seconds. Registration is per-device and persistent — you do not need to re-register unless the device's App Check UUID changes (which happens on a fresh OS install or app data wipe).

## Path A vs Path B

| | Path A (release + SHA-256) | Path B (debug + UUID) |
|---|---|---|
| Production-ready | Yes | No |
| Works on Play Store | Yes | Path B has no path to Play Store |
| Works for unlimited devices | Yes (one-time setup) | No — register per device |
| Uses Play Integrity attestation | Yes | No (Debug provider) |
| Re-registration needed on app reinstall | No | Sometimes (depends on UUID stability) |

**Recommendation:** Always Path A for any artifact reaching real users. Path B is only for tight-loop development.

## SHA fingerprint registry

The table below is the canonical record of all signing fingerprints for this project and their registration status. Update this table whenever fingerprints are added to or removed from Firebase Console.

| Build type | SHA-1 | SHA-256 | Status in Firebase Console |
| --- | --- | --- | --- |
| Debug (used by `assembleDebug` and `assembleStagingRelease`) | `66:D2:05:5E:DC:F4:85:3E:E5:78:BA:12:51:7F:36:ED:85:A2:DE:3B` | (not used for App Check) | Registered — appears in `android/app/google-services.json:22` as `certificate_hash: 66d2055e...` |
| Production release SHA-1 (`android/app/glamornate-upload.keystore`) | `00:1B:39:1D:2D:1A:B6:3B:C2:0B:92:64:2C:8C:11:2C:51:58:50:32` | — | NOT registered — operator must add (see steps below) |
| Production release SHA-256 (`android/app/glamornate-upload.keystore`) | — | `83:34:E7:DB:BB:5B:F9:8D:19:BB:21:FF:D1:3E:9F:F4:89:A5:8F:43:FE:E7:4A:B4:20:97:AD:25:FC:66:E5:E3` | NOT registered — operator must add for Play Integrity (see steps below) |

### How to add release fingerprints

These steps are required before any `assembleRelease` APK or Play Store build can pass App Check or Google Sign-in.

1. Open https://console.firebase.google.com/project/glamornate-758c6/settings/general
2. Scroll to the **Your apps** section and click the Android app `com.glamornate.app`.
3. Click **Add fingerprint**.
4. Paste the production release SHA-1: `00:1B:39:1D:2D:1A:B6:3B:C2:0B:92:64:2C:8C:11:2C:51:58:50:32` → Save.
5. Click **Add fingerprint** again.
6. Paste the production release SHA-256: `83:34:E7:DB:BB:5B:F9:8D:19:BB:21:FF:D1:3E:9F:F4:89:A5:8F:43:FE:E7:4A:B4:20:97:AD:25:FC:66:E5:E3` → Save.
7. Click **Download google-services.json** at the top of the same page.
8. Replace `frontend/android/app/google-services.json` with the downloaded file.
9. Update the "Status in Firebase Console" cells in the table above to "Registered".

## How to verify a device is healthy

After install + console action:

1. Open the app, sign in.
2. Tap "Book" → "Confirm Booking".
3. Expected: Stripe payment sheet opens, no "Booking unavailable on this device" toast.
4. Firebase Console → Build → App Check → Apps → `com.glamornate.app` → Requests (last 5 min, filter Cloud Functions): **Verified > 0, Unverified ~0**.
5. If Sentry is configured (`NEXT_PUBLIC_SENTRY_DSN` set in `.env.mobile`), confirm the event tag `app_check.token_present=true` on any background callable.

## How to diagnose a failing device

Logcat is the source of truth:

```bash
adb logcat | grep -iE "App Check|app-check|FirebaseAppCheck"
```

Key signals:

- `Enter this debug secret into the allow list...` → Path B applies; UUID not registered.
- `App attestation failed: <reason>` → Path A applies; SHA-256 missing from Firebase Console OR Play Integrity API not enabled.
- `Play Integrity is not available on this device` → device is too old / missing Play Services. Per-device unfixable; user must update Play Services or use a different device.
- `app-check.native.initialized` with a fresh `expireMs` → tokens ARE minting; failure is downstream (Firestore rules, callable business logic). Investigate elsewhere.

## USB debugging troubleshooting

If `adb devices` shows nothing, work through this checklist in order.

### Enable Developer Options and USB Debugging on the device

1. Open **Settings** → **About phone**.
2. Tap **Build number** seven times in quick succession. A toast will confirm "You are now a developer!".
3. Go back to **Settings** → **Developer Options** (it now appears in the main Settings menu or under System, depending on Android version).
4. Enable **USB Debugging**.

### Connect and authorize

1. Plug the device into the Mac with a USB cable.
2. On the device, a dialog will appear: **"Allow USB debugging?"** with the host computer's RSA fingerprint. Tap **Allow** (tick "Always allow from this computer" to avoid seeing this prompt again).
3. Run `adb devices`. The device should appear as `<serial>  device`. If it shows `unauthorized`, the RSA dialog was not accepted — see below.

### Troubleshooting `adb devices` returning empty or `unauthorized`

- **Device shows as `unauthorized`**: Go to **Developer Options** → **Revoke USB debugging authorizations**. Unplug the cable, replug it, and accept the RSA fingerprint prompt on the device again.
- **Device does not appear at all**: Try a different USB cable (data cables only — charge-only cables carry no data). Try a different USB port on the Mac.
- **`adb` command not found on Mac**: Install the Android platform tools via Homebrew:
  ```bash
  brew install android-platform-tools
  ```
  Alternatively, use the full path: `$ANDROID_HOME/platform-tools/adb` where `ANDROID_HOME=$HOME/Library/Android/sdk`.
- **Multiple devices**: If more than one device/emulator is connected, `adb` commands require `-s <serial>`. Use `adb -s <serial> logcat ...`.

## Rotation policy

- **Rotate release keystore**: every 25 years (matches `keytool` default validity). Tracked in `docs/runbooks/android-keystore-setup.md`. After rotation, repeat Path A step 2 with the new SHA-256.
- **Rotate debug tokens**: when a developer leaves the team, delete their per-device entries in Firebase Console → App Check → Apps → Manage debug tokens. Tokens themselves never expire; they're invalidated only on console deletion.

## Path B — stagingRelease (R8-minified, sideload-installable)

Use this when you need to validate the R8-minified release pipeline (Capacitor reflective method keeps, resource shrinking, ProGuard rules) on a developer device without involving the Play Store. The `stagingRelease` buildType mirrors `release` for code shrinking and obfuscation but signs with the debug keystore and uses the **Debug App Check provider** so any device can install and exercise it.

This is distinct from the manual debug-token flow above: that one uses `assembleDebug` (no R8). This one uses `assembleStagingRelease` (full R8) and is the recommended pre-flight before producing a Play Store `assembleRelease`.

### Steps

1. **Build the staging APK.**
   ```bash
   cd <repo-root>
   pnpm build:mobile:staging
   # Will exist after TEAM D ships. Produces:
   #   android/app/build/outputs/apk/stagingRelease/app-stagingRelease.apk
   ```

2. **Install on the device.**
   ```bash
   adb install -r android/app/build/outputs/apk/stagingRelease/app-stagingRelease.apk
   ```

3. **Confirm the pinned UUID is in `.env.local`.**
   ```bash
   grep NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN frontend/.env.local
   ```
   This is the value the APK pinned at build time. The same UUID is used by
   localhost web. Optional sanity check on logcat:
   ```bash
   adb logcat | grep -iE "AppCheck|app-check"
   ```
   On cold-start you should see `AppCheck: Pre-populated SharedPreferences with pinned UUID from BuildConfig (unified with web).`

4. **Register the UUID in Firebase Console (one-time).**
   Firebase Console → App Check → Apps → click `com.glamornate.app` → **Manage debug tokens** → **Add debug token** → paste the value from `.env.local`, name it `unified-dev` → Save. If you already registered this UUID for localhost web, this step is a no-op.

5. **Wait ~60 s for propagation, then proceed to smoke testing.** The booking flow and other callable endpoints should now succeed; verify under Firebase Console → App Check → Apps → `com.glamornate.app` → Requests.
