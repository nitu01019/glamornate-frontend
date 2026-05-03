# Runbook — Firebase Crashlytics wiring for the Android app

**When to run this:** once, when you first enable crash reporting. Re-run the google-services.json step whenever you add a new Android app entry in the Firebase console (e.g. a staging package name).

**How long it takes:** ~15 minutes end-to-end.

**Who should run it:** the release engineer in charge of the build. Needs Firebase console access to project `glamornate-758c6` and push access to this repo.

---

## 1. Why Crashlytics

- Captures uncaught JVM + native crashes on Android and groups them by stack trace.
- Symbolicates obfuscated R8/ProGuard traces via `mapping.txt` (auto-uploaded by the Crashlytics gradle plugin).
- Shipping it is table stakes for a Play Store launch — without it we are blind to production crashes during the staged rollout.

## 2. Prerequisites

- Firebase project: `glamornate-758c6` (see `~/.claude/projects/.../MEMORY.md → Firebase Setup`).
- Android package name registered in the Firebase console: `com.glamornate.app`.
- Gradle classpath already wired in `android/build.gradle`:
  ```
  classpath 'com.google.firebase:firebase-crashlytics-gradle:3.0.2'
  ```
  (Agent 4D added this — verify with `grep firebase-crashlytics-gradle android/build.gradle`.)
- App-level plugin apply already wired in `android/app/build.gradle`:
  ```
  apply plugin: 'com.google.firebase.crashlytics'
  ```
  (Applied conditionally when `google-services.json` is present.)
- ProGuard rules in place (default `proguard-android-optimize.txt` keeps Crashlytics classes — no extra rules needed).

## 3. Register the Android app in Firebase (one-time)

1. Go to [console.firebase.google.com](https://console.firebase.google.com/) → project `glamornate-758c6`.
2. Click the gear icon → **Project settings** → **General** tab.
3. Scroll to **Your apps** → click the Android icon ("Add app") if `com.glamornate.app` is not yet listed.
4. Fill in:
   - Android package name: `com.glamornate.app`
   - App nickname: `Glamornate Android`
   - Debug signing certificate SHA-1 (optional — needed for Google Sign-In):
     ```bash
     keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1
     ```
   - Release signing certificate SHA-1: from `android/app/glamornate-upload.keystore` via:
     ```bash
     keytool -list -v -keystore android/app/glamornate-upload.keystore -alias glamornate-upload | grep SHA1
     ```
5. Click **Register app**.
6. Download `google-services.json`.
7. Place the file at `android/app/google-services.json`. It is *not* git-ignored by default — decide whether to commit it or treat it as a CI secret.
   - **Recommended:** commit the *production* `google-services.json` (it only contains public client identifiers, not secrets) so CI builds work without extra config.
   - If you ship multiple environments, keep separate `google-services.json` files under `android/app/src/{staging,prod}/google-services.json` and declare `productFlavors`.

## 4. Enable Crashlytics in the Firebase console

1. Still in the Firebase console → left nav → **Release & Monitor → Crashlytics**.
2. Click **Enable Crashlytics** if prompted.
3. Select `com.glamornate.app` from the app dropdown.
4. Follow the "Add SDK" wizard only up to the step where it asks you to add the gradle plugins — those are already wired by Agent 4D. The wizard should flip to "Waiting for first crash" within minutes.

## 5. Confirm Crashlytics fires on the device

After the next `bash scripts/release-build.sh` and sideload:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb logcat | grep -iE 'crashlytics|firebase'
```

You should see lines like:
```
I/FirebaseCrashlytics: Initializing Firebase Crashlytics 19.0.3
I/FirebaseCrashlytics: Installer package name is: com.android.vending
```

### Trigger a synthetic crash

We do not ship a dev-crash button in release builds — instead, use a `debug` buildType or a Capacitor plugin callable from a hidden profile menu. Minimum-effort synthetic crash via a one-liner native bridge (add to `MainActivity.java` temporarily, only in a scratch branch):

```java
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(android.os.Bundle s) {
    super.onCreate(s);
    // TEMP: synthetic crash 3s after start; delete before committing.
    new android.os.Handler().postDelayed(
      () -> { throw new RuntimeException("Crashlytics smoke test"); },
      3000
    );
  }
}
```

Rebuild, install, wait for the crash, revert the file, and confirm the crash appears in the Crashlytics dashboard within 60 seconds. **Delete the smoke-test code** before you commit anything.

## 6. Upload the ProGuard mapping file

The Crashlytics gradle plugin uploads `mapping.txt` automatically during `bundleRelease` / `assembleRelease`. If you bypass gradle (e.g. inspecting an .aab downloaded from Play Console), upload manually via:

```bash
./gradlew :app:uploadCrashlyticsMappingFileRelease
```

Mapping files live at `android/app/build/outputs/mapping/release/mapping.txt`.

## 7. Observability checklist

- [ ] `android/app/google-services.json` exists and references `com.glamornate.app`.
- [ ] `android/build.gradle` has the `firebase-crashlytics-gradle` classpath.
- [ ] `android/app/build.gradle` applies `com.google.firebase.crashlytics` when `google-services.json` is present.
- [ ] Firebase console → Crashlytics shows "SDK detected" for the Android app.
- [ ] A synthetic crash from a debug build appears in the dashboard within 60 seconds.
- [ ] `mapping.txt` upload visible in Crashlytics for the current versionCode (watch the "deobfuscation files" column).
- [ ] Alerts configured: Firebase console → Crashlytics → **Alerts** → email the release engineer on any new issue + on a velocity alert (>1% users affected).

## 8. Cost notes

Crashlytics itself is free. The only costs are the Cloud Storage footprint for mapping files (negligible) and any BigQuery export if you enable it (off by default). No action needed unless mapping files exceed ~1 GB/month, which implies dozens of versionCodes per month — not our situation in v1.

## 9. Rollback

If Crashlytics starts eating battery or causing ANRs (rare, but noted):

1. Remove the `apply plugin: 'com.google.firebase.crashlytics'` line in `android/app/build.gradle`.
2. Set `firebaseCrashlytics.mappingFileUploadEnabled false` if you want to keep the SDK but stop symbol uploads during debugging.
3. Rebuild + redeploy through the normal staged rollout.
4. Disable Crashlytics data collection at runtime as a last resort:
   ```java
   FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(false);
   ```

## 10. Known gaps / follow-ups

- **iOS parity** — not in scope for Phase 4; iOS Crashlytics wiring ships with the iOS release (see `docs/release/ios-roadmap.md`, to be written).
- **JS-layer (Next.js) error reporting** — Crashlytics only sees native crashes. JavaScript exceptions on the WebView are captured separately via Sentry (tracked in a follow-up). For Phase 4, unhandled JS errors surface in the Next.js console log only.
- **Breadcrumb coverage** — add Capacitor bridge hooks to log navigation + network lifecycle into Crashlytics breadcrumbs. Planned, not in Phase 4.
