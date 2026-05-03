# APK Smoke Checklist

> **Scope.** End-to-end post-install smoke for the Glamornate Android
> `stagingRelease` APK. Rows 1–5 are automated by
> [`scripts/smoke-android.sh`](../../scripts/smoke-android.sh). Rows 6–10
> require a human-in-the-loop because they involve UI gestures (Google
> account picker, GPS system dialog, payment sheet) that cannot be driven
> from `adb` alone.
>
> This runbook complements
> [`docs/runbooks/android-app-check.md`](./android-app-check.md), which
> covers the App Check debug-token registration loop in depth, and
> [`docs/runbooks/android-release-build.md`](./android-release-build.md),
> which covers building the artifact in the first place.

## Section 1 — Prerequisites

- An Android device or emulator connected over USB (or `adb connect`)
  with **USB debugging enabled** and the host's RSA key authorised.
  Confirm with `adb devices` — the second column must read `device`,
  not `unauthorized` or `offline`.
- The Glamornate app is **either uninstalled** or you have just run
  `adb shell pm clear com.glamornate.app`. The smoke script clears app
  state itself, but a totally-fresh install is the cleanest baseline for
  the very first run.
- A staging APK has been built locally:
  ```bash
  pnpm build:mobile:staging
  # produces android/app/build/outputs/apk/stagingRelease/app-stagingRelease.apk
  ```
  (See `scripts/staging-release-build.sh` for the exact pipeline.)
- The Firebase Console project is `glamornate-758c6` and you have at
  least **App Check Admin** + **Authentication Admin** roles on it.

## Section 2 — Install + first cold-start (operator)

The first cold-start is special because the Firebase JS SDK debug-provider
prints a one-time UUID that must be allow-listed in Firebase Console
before App Check tokens can be minted. The smoke script captures and
prints this UUID for you in Row 2.

1. **Install the APK.**
   ```bash
   adb install -r android/app/build/outputs/apk/stagingRelease/app-stagingRelease.apk
   ```

2. **Run the smoke script — first pass.**
   ```bash
   bash scripts/smoke-android.sh
   ```
   The script will:
   - clear app data (`pm clear com.glamornate.app`),
   - clear the logcat buffer,
   - cold-start the app via `monkey`,
   - capture 12 s of `threadtime` logcat to `/tmp/glamornate-smoke-<epoch>.log`,
   - run the five grep probes,
   - print a summary table.

   On this first pass, **Row 2 will print the debug-secret UUID** in its
   evidence column. Copy that UUID.

3. **Register the UUID in Firebase Console.**
   Navigate to:
   ```
   Firebase Console
     -> Project: glamornate-758c6
     -> App Check
     -> Apps -> com.glamornate.app
     -> Manage debug tokens
     -> Add debug token
   ```
   Use a descriptive name like `staging-2026-04-29-<deviceId>` so we can
   audit and rotate later.

4. **Wait ~60 s** for the registration to propagate to the App Check
   backend.

5. **Re-run the smoke script — second pass.**
   ```bash
   bash scripts/smoke-android.sh
   ```
   On this second pass, **Row 3 should PASS** because the App Check
   provider can now mint tokens against the registered UUID. Rows 1, 2,
   4, 5 should also remain PASS.

If Row 3 still fails after the second pass, jump to **Section 4 —
Failure triage**.

## Section 3 — Manual smoke (human-in-the-loop)

Once Rows 1–5 are green, walk through Rows 6–10 by hand. These exercise
the user-visible critical-path flows that the autoinstrumentation cannot
cover. Tick the checkbox for each row as you go.

| #  | User flow            | What to do                                                              | Expected                                                              | Logcat filter (optional sanity check)                                                  | Result                |
|----|----------------------|-------------------------------------------------------------------------|-----------------------------------------------------------------------|----------------------------------------------------------------------------------------|-----------------------|
| 6  | Google Sign-in       | Tap "Sign in with Google" -> choose account                             | Lands on `customer/home`; no toast                                    | `adb logcat -s "FirebaseAuth"` shows `signInWithCredential succeeded`                  | [ ] PASS  / [ ] FAIL  |
| 7  | Email sign-up        | Enter email + name -> Continue                                          | Bloom-filter availability check returns; sign-up form proceeds        | `adb logcat \| grep checkSignupAvailability` shows POST 200                            | [ ] PASS  / [ ] FAIL  |
| 8  | GPS permission       | Start booking -> "Use my location"                                      | System dialog appears; "Allow" returns coords within 10 s             | `adb logcat -s "GeolocationPlugin"`                                                    | [ ] PASS  / [ ] FAIL  |
| 9  | Slot availability    | Pick service -> Pick date                                               | "Checking availability" disappears within 3 s; slot list renders      | `adb logcat \| grep getAvailableSlots` shows POST 200                                  | [ ] PASS  / [ ] FAIL  |
| 10 | Booking creation     | Pick slot -> Continue -> Confirm                                        | `createBookingDraft` returns 200; payment sheet opens                 | `adb logcat \| grep createBookingDraft`                                                | [ ] PASS  / [ ] FAIL  |

Record the date, device, and APK build SHA next to the table when you
file the result, so historical smokes are auditable.

## Section 4 — Failure triage

| Symptom                                                          | Likely cause                                                                                            | Action                                                                                                                                                       |
|------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Row 1 FAIL (`selectedProvider=playintegrity`)                    | Manifest `meta-data` not propagating to the release build.                                              | Check `manifestPlaceholders` in `android/app/build.gradle` `stagingRelease { ... }` block; rebuild with `pnpm build:mobile:staging`.                          |
| Row 2 missing UUID                                               | `BuildConfig.DEBUG=false` AND `appCheckProvider != "debug"` — MainActivity is reading the wrong source. | Verify TEAM A's MainActivity reads the manifest meta-data correctly; rebuild.                                                                                |
| Row 3 FAIL after UUID registered                                 | Token propagation lag, OR wrong Firebase project, OR UUID typo.                                         | Wait another 60 s. Verify Firebase Console project = `glamornate-758c6`. Re-copy the UUID from logcat — UUIDs are case-sensitive.                            |
| Row 4 FAIL (`Network request failed` toast)                      | App Check or region issue resurfacing.                                                                  | Confirm logcat for `selectedProvider=debug`. Inspect Sentry breadcrumb `app_check.classification`. Check that callable URL uses `asia-south1`.               |
| Row 5 FAIL (plugin not in logcat)                                | R8 stripped a Capacitor plugin.                                                                         | Re-check TEAM C's `android/app/proguard-rules.pro` (`-keep` rules for capacitor-firebase, geolocation). Inspect `mapping/stagingRelease/usage.txt` for `removed:` lines on plugin classes. |
| Row 6 (Google Sign-in) FAIL with `developer error`               | SHA-1 of debug keystore not registered in Firebase Console.                                             | In Firebase Console -> Authentication -> Sign-in providers -> Google -> add SHA-1 `66:D2:05:5E:DC:F4:85:3E:E5:78:BA:12:51:7F:36:ED:85:A2:DE:3B`.            |
| Row 8 GPS dialog never appears                                   | Permissions never requested — could be R8 strip OR a code-path bug.                                     | Verify `GeolocationPlugin` shows up in `adb logcat`. If absent: R8 strip (see Row 5 triage). If present: trace the JS call path in `useGeolocation`.        |
| Row 9 slow / spinner stuck                                       | Callable region misconfiguration OR slow Firestore region.                                              | Inspect logcat for `getAvailableSlots` — confirm host is `asia-south1-glamornate-758c6.cloudfunctions.net`, not `us-central1-...`.                          |
| Row 10 `createBookingDraft` 500                                  | Backend regression unrelated to APK.                                                                    | Tail Cloud Functions logs: `gcloud functions logs read createBookingDraft --region=asia-south1 --limit=50`.                                                  |

If a symptom is not in this table, capture the logcat file
(`/tmp/glamornate-smoke-*.log`) and the Sentry event ID, and file a new
triage entry once the root cause is known.

## Section 5 — Rollback

- All four TEAM commits behind this smoke (TEAM A `10ca89f1`, TEAM C
  `da33e383`, TEAM D `55d8beb5`, gradle fallback `6a06475c`) revert
  cleanly with `git revert <sha>` — none of them touch shared schema,
  stored secrets, or production data.
- The production `release` buildType is **untouched** by this work. Only
  the new `stagingRelease` buildType is exercised by the APK smoke. If a
  smoke regression is suspected to have leaked into production, compare
  the production APK's `BuildConfig.APP_CHECK_PROVIDER` (must be
  `playintegrity`) against staging's (`debug`).
- The smoke script itself is a read-only logcat capture plus `pm clear`
  on a single staging-only package; rolling it back is purely a file
  delete with no runtime effect.
