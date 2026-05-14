# Runbook — Building a signed Android release (APK + AAB)

**When to run this:** every time you want to produce a signed artifact for either a sideload test (.apk) or a Play Store upload (.aab).

**How long it takes:** 3–6 minutes on a warm Gradle cache, 10–15 minutes from a cold clone.

**Who should run it:** anyone in the release engineering rotation, after following `android-keystore-setup.md` at least once.

**Automated entry point:** `bash scripts/release-build.sh`. Everything below is what that script does, step by step, so you can run the pieces manually when debugging.

---

## 1. Prerequisites

1. Android SDK + platform-tools installed. Typical setup is Android Studio's bundled SDK at `~/Library/Android/sdk`.
2. Gradle wrapper usable: `./android/gradlew --version` works (the script `chmod +x`es it if needed).
3. `JAVA_HOME` points to JDK 21 or newer. Android Studio ships one at:
   ```bash
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   ```
4. Node 20+ + npm (the existing `scripts/build-mobile.sh` uses `npm run build`).
5. `android/app/keystore.properties` exists **if** you want a Play-Store-uploadable artifact (see `android-keystore-setup.md`). Without it the script still builds, but the artifact is debug-signed — fine for sideload smoke tests, useless for Play Console.
6. `android/app/google-services.json` exists **if** you want Crashlytics + push notifications enabled in this build (see `crashlytics-setup.md`).
7. `.env.mobile` exists at the repo root — `scripts/build-mobile.sh` copies it to `.env.production` during the Next.js build (see that script for the env layout).

## 2. One-shot: `scripts/release-build.sh`

```bash
cd /Users/nitishbhardwaj/Desktop/Glamornate/frontend
bash scripts/release-build.sh
```

On success, the script prints the output paths:

```
[release-build] Step 4/4: artifact summary
[release-build]   APK  -> .../android/app/build/outputs/apk/release/app-release.apk
[release-build]   AAB  -> .../android/app/build/outputs/bundle/release/app-release.aab
[release-build]   MAP  -> .../android/app/build/outputs/mapping/release/mapping.txt
```

The script exits non-zero on any step failure (Next.js build, cap sync, gradle assemble/bundle).

## 3. Manual sequence (when debugging a failure)

### 3.1 Build Next.js static export

```bash
npm run build:mobile
```

This is a thin wrapper over `bash scripts/build-mobile.sh` which:
- Hides `src/app/api`, `src/app/sitemap.ts`, `src/app/robots.ts`, and `src/middleware.ts` (Capacitor expects a pure static export).
- Copies `.env.mobile` → `.env.production` for the build.
- Runs `npm run build` (Next.js `next build` with `BUILD_TARGET=mobile`).
- Verifies the `out/` directory looks correct via `scripts/verify-static-export.sh`.
- Restores the hidden files on exit (even on failure).

### 3.2 Sync web assets into the Android project

```bash
npx cap sync android
```

This copies `out/` into `android/app/src/main/assets/public/` and updates Capacitor plugin registrations.

### 3.3 Gradle release build

```bash
cd android
./gradlew clean assembleRelease bundleRelease
```

- `assembleRelease` produces the `.apk`.
- `bundleRelease` produces the `.aab` — the only format Play Store accepts.
- `clean` wipes stale outputs and is cheap compared to signing work.

The first build after enabling Crashlytics uploads a mapping file to Firebase automatically (see `crashlytics-setup.md`).

## 4. Where the artifacts land

| Kind | Path (relative to repo root) | Purpose |
|------|------------------------------|---------|
| APK  | `android/app/build/outputs/apk/release/app-release.apk` | Sideload testing (`adb install`). |
| AAB  | `android/app/build/outputs/bundle/release/app-release.aab` | Upload to Play Console. |
| ProGuard map | `android/app/build/outputs/mapping/release/mapping.txt` | Symbolicate stack traces in Crashlytics. |

## 5. Verify the signature

The release process silently falls back to debug signing if `keystore.properties` is missing. Before shipping anything, verify the artifact is signed with the upload key you expect.

```bash
# APK
$ANDROID_HOME/build-tools/34.0.0/apksigner verify --verbose \
  android/app/build/outputs/apk/release/app-release.apk

# AAB can be inspected via bundletool
bundletool validate --bundle=android/app/build/outputs/bundle/release/app-release.aab

# Or via jarsigner
jarsigner -verify -verbose -certs \
  android/app/build/outputs/bundle/release/app-release.aab
```

Sanity check the fingerprint matches the one saved in your password manager when you created the keystore:

```bash
keytool -printcert -jarfile android/app/build/outputs/apk/release/app-release.apk \
  | grep -E 'Owner|SHA256'
```

If the fingerprint does not match, DO NOT upload — inspect `android/app/keystore.properties` and re-run `scripts/release-build.sh`.

## 6. Sideload test

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.glamornate.app/.MainActivity
```

Spot-check on the device:
- App opens without an immediate crash.
- Sign-in flow works (hitting the real Firebase backend).
- Location prompt fires when asked (confirms `@capacitor/geolocation` is wired).
- Crashlytics dashboard receives a test event within 60 s of triggering a dev-only crash button (if wired — see `crashlytics-setup.md`).

## 7. Upload to Play Console (internal testing track)

1. Sign in at [Play Console](https://play.google.com/console).
2. Select the Glamornate app.
3. **Testing → Internal testing → Create new release**.
4. Drag the `.aab` produced above into the release page.
5. Fill the release notes (keep it terse: "v0.1.0 — initial Play Store build").
6. Click **Review → Start rollout to Internal testing**.
7. Add your test account email under **Testers** if not already present.
8. Watch for Play's pre-launch report (crashes, ANRs, policy flags) over the next ~2 hours.

Common rejection reasons and where to fix them:

| Reason | Fix |
|--------|-----|
| Missing Privacy Policy URL | `docs/compliance/PLAY_STORE_LISTING.md §4`. |
| Data Safety form incomplete | `docs/compliance/DATA_SAFETY.md`. |
| Permission not justified | `docs/compliance/PLAY_STORE_LISTING.md §7` + AndroidManifest.xml comments. |
| App crashes in pre-launch report | Inspect crash stack, patch, rebuild, re-upload as a new release. |
| Signing key mismatch (after key rotation) | Follow `android-keystore-setup.md §6` — Play App Signing upload-key change. |

## 8. Troubleshooting

### "SDK location not found"
Create `android/local.properties` with:
```
sdk.dir=/Users/<you>/Library/Android/sdk
```

### "Could not resolve com.google.firebase:firebase-crashlytics-gradle"
Run `./gradlew --refresh-dependencies clean assembleRelease`. If it persists, confirm you have network access to `dl.google.com` and `repo.maven.apache.org`.

### "Invalid key specification: Tag number over 30 is not supported"
The keystore is corrupt or the password is wrong. Re-verify via `keytool -list -v -keystore android/app/glamornate-upload.keystore`.

### "Android App Bundle build failed: Unable to determine version for <module>"
Delete `android/app/build/` and re-run the script — this is almost always a stale cache from switching Capacitor versions.

### "jarsigner: certificate chain not validated"
You are signing with the wrong keystore. Check `keystore.properties` points at the *upload* keystore, not a debug one.

## 9. Done-checklist

- [ ] `bash scripts/release-build.sh` exits 0.
- [ ] `apksigner verify --verbose` reports `Verified using v1 scheme`, `Verified using v2 scheme` (or v3), signer name matches upload key.
- [ ] Sideloaded APK launches on at least one real device.
- [ ] `.aab` uploaded to Play Console Internal testing track.
- [ ] `mapping.txt` uploaded to Crashlytics (automatic when Crashlytics plugin is applied).
- [ ] Release notes saved in `docs/release/` (optional but recommended).

---

## 10. Staging APK (sideload-installable, R8-minified, Debug AppCheck)

**When to run this:** when you need to smoke-test the R8-minified output on a real device before promoting it to a Play Store upload, or when an operator needs a fast sideload artifact for App Check debug-token verification on a fresh device.

**Why this is separate from `release`:** the `stagingRelease` Gradle buildType (added in commit `10ca89f1`) mirrors production's R8 + resource-shrinking profile but is **always debug-signed** and uses the **Debug App Check provider**. The artifact `app-stagingRelease.apk` therefore:

- ✅ Is installable on any developer device via `adb install -r ...` (no upload-keystore prerequisite).
- ✅ Exercises the same R8 / ProGuard rules as production, so missing-keep regressions surface early.
- ❌ **CANNOT be uploaded to the Play Store** — Play rejects debug-signed artifacts.
- ❌ Will mint App Check tokens only after the operator registers the per-install debug-secret UUID in Firebase Console (one-time per device install).

For a Play Store upload, use the production `release` buildType via `scripts/release-build.sh` with `RELEASE=1`.

### 10.1 Pre-build ghost sweep (defensive)

The Glamornate working tree lives on iCloud-synced `~/Desktop`. The macOS iCloud daemon (`bird`) periodically produces ghost duplicates with names like `app-release 2.aab`, `config (1).xml`, and `file-system.probe` that break gradle in subtle ways (incidents documented in memory keys `icloud_capsync_assets_public_ghosts.md`, `icloud_ghosts_in_android_res.md`, and `icloud_evicts_next_build_dir.md`).

```bash
pnpm mobile:sweep
# Dry-run by default. Expect "found 0 candidates" across all roots.
# If candidates are listed, re-run with `--apply` to delete them:
#   bash scripts/sweep-icloud-ghosts.sh --apply
```

### 10.2 Build the staging APK

```bash
pnpm build:mobile:staging
```

Equivalent to `bash scripts/staging-release-build.sh`. The script:

1. Calls `scripts/load-keystore.sh` (no-op for staging — debug-signed always).
2. Runs `scripts/build-mobile.sh` (Next.js static export + env shuffle).
3. Runs `npx cap sync android` (copies `out/` into `android/app/src/main/assets/public/`).
4. Runs `./gradlew assembleStagingRelease` (APK only — no `bundleStagingRelease` because staging never goes to Play Store).
5. Prints the artifact path, SHA-256 fingerprint (via `shasum -a 256`), and file size.

Outputs:

| Kind | Path | Purpose |
|------|------|---------|
| APK | `android/app/build/outputs/apk/stagingRelease/app-stagingRelease.apk` | Sideload install only |
| ProGuard map | `android/app/build/outputs/mapping/stagingRelease/mapping.txt` | Symbolicate stack traces locally |

### 10.3 Install on a developer device

```bash
adb install -r android/app/build/outputs/apk/stagingRelease/app-stagingRelease.apk
```

`-r` reinstalls in place if the package is already on the device.

### 10.4 Capture the debug-secret UUID from logcat

The Debug App Check provider prints a one-time UUID on the very first cold-start of each freshly-installed APK. Capture it:

```bash
adb logcat | grep -i "App Check"
```

Then cold-start the app (force-stop + launch). Look for a line like:

```
D FirebaseAppCheck: Enter this debug secret into the allow list in
                    the Firebase Console for your project: <UUID-HERE>
```

Copy the UUID. (If logcat is noisy, add `-T 1` and `-d` to read since timestamp.)

### 10.5 Register the UUID in Firebase Console

1. Open Firebase Console → project `glamornate-758c6` → **App Check** in the left rail.
2. Click the **Apps** tab and find `com.glamornate.app` (Android).
3. Open the dropdown next to the app and pick **Manage debug tokens**.
4. **Add debug token** → name it after the device (e.g., `Pixel 7 Pro — Nitish — staging`) → paste the UUID.
5. Save and wait ~60 seconds for propagation.

See `docs/runbooks/android-app-check.md` Path B (added by TEAM A) for the full per-device UUID workflow including known failure modes.

### 10.6 Smoke test

Run through `docs/runbooks/apk-smoke-checklist.md` (TEAM E will create this — refer forward) once the UUID is registered. Critical paths to confirm: cold-start → sign-in → location prompt → booking-create flow → push-notification subscribe.

### 10.7 What NOT to do with `app-stagingRelease.apk`

- **DO NOT** upload this artifact to Play Store. It is debug-signed and uses the Debug App Check provider; Play Console will reject it on signature mismatch and, even if accepted, it would fail App Check enforcement in production traffic.
- **DO NOT** ship this to external testers via TestFlight-equivalents. It is for internal sideload only.
- For Play Store uploads, use `bash scripts/release-build.sh` with `RELEASE=1` (production keystore + Play Integrity provider).

### 10.8 Cleanup after testing

The `stagingRelease` build directory (`android/app/build/outputs/apk/stagingRelease/`) is git-ignored alongside the rest of `build/`. No manual cleanup is required, but `pnpm mobile:sweep --apply` is a good habit before the next release-build run.
