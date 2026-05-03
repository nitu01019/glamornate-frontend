# Mobile Build (Android APK) Runbook

This document describes how to produce a Glamornate Android APK from the
Next.js web app via Capacitor.

iOS is explicitly **out of scope** for this recovery cycle.

---

## 1. Prerequisites

### 1.1 JDK 21

Capacitor 8 requires JDK 21. The easiest option on macOS is to use the JDK
bundled with Android Studio.

```bash
# macOS (Android Studio JBR)
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

# Alternative (Homebrew / system-installed JDK 21)
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"

java -version   # should print "openjdk version \"21.x.x\""
```

`scripts/build-mobile.sh` auto-sets `JAVA_HOME` to the Android Studio JBR if
`JAVA_HOME` is not already exported.

### 1.2 Android SDK / CLI tools

- Android SDK Platform 34
- Android SDK Build-Tools matching compileSdk 34
- Accept SDK licenses: `yes | sdkmanager --licenses`

The project is pinned to:

| Key         | Value |
|-------------|-------|
| compileSdk  | 34    |
| targetSdk   | 34    |
| minSdk      | 23    |
| AGP         | 8.13.0|
| JDK         | 21    |

### 1.3 Node

Node 20 (matches CI). `pnpm install --frozen-lockfile` in `frontend/`.

### 1.4 `.env.mobile`

The mobile build loads production-grade Firebase config from
`frontend/.env.mobile`. The file **must exist** before running the build — the
script fails fast if it is missing. See [env-vars.md](./env-vars.md) for the
required keys (owned by Team A / D).

Typical contents:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=glamornate-758c6
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_API_BASE_URL=https://us-central1-glamornate-758c6.cloudfunctions.net
```

---

## 2. Build the web bundle

From `frontend/`:

```bash
pnpm run build:mobile
```

This invokes `scripts/build-mobile.sh`, which:

1. Temporarily moves `src/app/api`, `src/app/sitemap.ts`, `src/app/robots.ts`,
   and `src/middleware.ts` out of the tree (static export cannot tolerate
   server routes).
2. Copies `.env.mobile` → `.env.production`.
3. Sets `BUILD_TARGET=mobile` and `JAVA_HOME`.
4. Runs `next build` (which, in mobile mode, produces a static export in
   `out/`).
5. Invokes `scripts/verify-static-export.sh out` to guarantee no API paths
   leaked into the static bundle.
6. Restores all moved files via a `trap`, even on failure.

If the script aborts, nothing is left in a partially-disabled state — the
`trap restore EXIT` clause runs unconditionally.

---

## 3. Sync to Capacitor & build APK

```bash
# From frontend/
npx cap sync android

# From frontend/android/
./gradlew assembleDebug
```

APK location:

```
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

For a release APK (unsigned):

```bash
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release-unsigned.apk
```

Signing is covered in `docs/release-signing.md` (future work).

---

## 4. Install & run on device

```bash
# List attached devices / emulators
adb devices

# Install (reinstall with -r)
adb install -r frontend/android/app/build/outputs/apk/debug/app-debug.apk

# Live logs
adb logcat | grep -i 'glamornate\|capacitor\|chromium'
```

Emulator: start a Pixel 6 API 34 image from Android Studio's AVD Manager.

---

## 5. Firebase App Check (debug tokens)

A release build enforces App Check. For local debug builds, register a debug
token:

1. Launch the app once on the device/emulator.
2. `adb logcat | grep DebugAppCheckProvider` — the library prints a UUID.
3. Paste that UUID into Firebase Console → App Check → Apps →
   **Glamornate Android** → "Manage debug tokens" → Add debug token.

Do **not** commit debug tokens to git; they are device-specific.

---

## 6. CI

See `.github/workflows/ci.yml`. Two parallel jobs:

- `frontend-check`: lint → typecheck → test → build
- `backend-check`: build → test

Both use Node 20 + npm. Mobile APK assembly is **not** part of CI — it runs
locally or in a dedicated release workflow (future).

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `.env.mobile missing` | Copy `.env.mobile.example` → `.env.mobile` and fill in Firebase keys (Team A/D). |
| `LEAK: API paths found in out` | Check that nothing in `src/app/**` outputs `/api/...`. The disable list in `build-mobile.sh` must cover every server route. |
| Gradle: "compileSdk 34 requires AGP X" | AGP 8.13 is pinned; do not upgrade without retesting. |
| `JAVA_HOME not set` or wrong JDK | `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"` |
| `SDK location not found` | Create `frontend/android/local.properties` with `sdk.dir=/Users/<you>/Library/Android/sdk` |
| App Check 403 on device | Register the debug token (§5). |
| Blank white screen | `adb logcat` for JS exceptions; check `out/index.html` exists; verify `capacitor.config.ts` `webDir` is `out`. |
| Gradle cache corrupt | `cd android && ./gradlew clean && rm -rf ~/.gradle/caches/build-cache-1` |

---

## 8. Assets (icons & splash)

App icons and splash screens are generated from a 1024×1024 source via
`@capacitor/assets`. Source path (once provided by Design): `frontend/public/icons/icon-1024.png`.

```bash
# Install once as a dev dep
pnpm add -D @capacitor/assets

# Generate
npx @capacitor/assets generate \
  --iconPath public/icons/icon-1024.png \
  --assetPath public/icons
```

Generated icons land in `frontend/android/app/src/main/res/mipmap-*` and
`drawable-*` directories. **Do not edit those files by hand** — regenerate
instead.

Status: source icon not yet checked in. Follow-up for Design team.

---

## 9. File references

- `frontend/scripts/build-mobile.sh` — the single source of truth for mobile builds
- `frontend/scripts/verify-static-export.sh` — guards against API route leaks
- `frontend/capacitor.config.ts` — `appId`, `webDir`, plugin config
- `frontend/android/variables.gradle` — SDK versions
- `frontend/android/app/build.gradle` — app module config
