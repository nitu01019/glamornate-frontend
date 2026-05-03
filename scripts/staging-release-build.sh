#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Glamornate Android STAGING release-build driver.
#
# What this produces:
#   A sideload-installable, R8-minified APK targeting the new `stagingRelease`
#   buildType (added by TEAM A in commit 10ca89f1). The artifact mirrors
#   production's R8 + resource-shrinking profile so we can smoke-test the
#   minified output on real devices, but it differs from production in two
#   important ways:
#
#     1. Signed with the DEBUG keystore (always — see android/app/build.gradle
#        `stagingRelease.signingConfig signingConfigs.debug`). This means the
#        artifact is NOT acceptable to the Play Store. It is for sideload
#        installs only (`adb install -r ...`).
#
#     2. Uses the Debug App Check provider (manifest placeholder
#        `appCheckProvider=debug`). The first cold-start of the freshly-
#        installed APK prints a one-time debug-secret UUID to logcat. The
#        operator MUST register that UUID in Firebase Console →
#        App Check → Apps → com.glamornate.app → Manage debug tokens
#        before the app can mint App Check tokens against the production
#        Functions backend. Without that registration, every callable
#        Function (enforceAppCheck=true) rejects with the user-visible
#        symptom "network request failed".
#
#        See `docs/runbooks/android-app-check.md` Path B for the operator
#        UUID workflow that TEAM A documented.
#
# Sequence (mirrors release-build.sh, with stagingRelease-specific tasks):
#   1. load-keystore.sh (no-op for staging — we always debug-sign).
#   2. scripts/build-mobile.sh (Next.js static export + env shuffle).
#   3. npx cap sync android (copy out/ → assets/public/).
#   4. ./gradlew assembleStagingRelease (no bundleStagingRelease — staging
#      is APK-only, never goes to Play Store).
#
# Production release path is unchanged. Use `scripts/release-build.sh`
# (RELEASE=1) for Play-Store-uploadable artifacts.
#
# Usage:
#   bash scripts/staging-release-build.sh
#
# Docs:
#   - docs/runbooks/android-release-build.md   ("Staging APK" section)
#   - docs/runbooks/android-app-check.md       (Path B: debug-token UUID flow)
#   - docs/runbooks/android-keystore-setup.md  (only relevant for prod release)
# -----------------------------------------------------------------------------

set -euo pipefail

BANNER_TS="$(date -u +'%Y-%m-%d %H:%M:%S UTC')"
printf '\n========== [%s] mode=%s ts=%s ==========\n\n' "$(basename "$0")" "STAGING (Debug AppCheck)" "$BANNER_TS"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

# Capture git short SHA for build-history audit log (Gap 2). Tolerate non-git
# checkouts (e.g. archive extraction) by falling back to a sentinel string.
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'no-git')"

log() { printf '[staging-release-build] %s\n' "$*"; }
fail() { printf '[staging-release-build] ERROR: %s\n' "$*" >&2; exit 1; }

# --- Step 0: preflight ------------------------------------------------------

if [[ ! -d android ]]; then
  fail "android/ directory not found (are you at the repo root?)."
fi

# Informational keystore.properties check. Staging is debug-signed by design
# (build.gradle pins `signingConfig signingConfigs.debug` for stagingRelease)
# so a missing keystore.properties is NOT an error here — staging never
# touches the upload keystore. We just print a one-line note for clarity.
log "Step 0/4: preflight (staging is always debug-signed by design)"
if [[ -f android/app/keystore.properties ]]; then
  log "  note: android/app/keystore.properties is present, but stagingRelease"
  log "        ignores it and signs with the debug keystore unconditionally."
else
  log "  note: android/app/keystore.properties is absent. That is fine for"
  log "        stagingRelease — debug keystore is used either way."
fi

# load-keystore.sh is a no-op when RELEASE!=1, but we still call it so the
# sequence matches release-build.sh's discipline (one less source of drift
# between the two scripts).
log "  load-keystore.sh (no-op for staging, RELEASE!=1)"
bash "${SCRIPT_DIR}/load-keystore.sh"

if [[ ! -f android/app/google-services.json ]]; then
  log "  WARNING: android/app/google-services.json is missing."
  log "           Push notifications + Crashlytics will be disabled in this build."
  log "           See docs/runbooks/crashlytics-setup.md."
fi

# --- Step 1: Next.js static export + env shuffle (reuses build-mobile.sh) ---

# Pre-build typecheck gate (Gap 4). Fail fast on TS errors before we sink
# 10+ minutes into a Gradle build that will only fail at the same point.
log "Step 1/4: pnpm typecheck (pre-build gate)"
pnpm typecheck

log "Step 1/4: Next.js static export (via build-mobile.sh)"
# Build-variant label kept for any future stagingRelease-only client gating.
# Production release-build.sh leaves it unset.
export NEXT_PUBLIC_BUILD_VARIANT=stagingRelease
# Symmetry with release-build.sh: pin the App Check provider explicitly so
# the static export embeds the correct provider into the JS bundle. Staging
# uses the Debug provider (UUID flow — see docs/runbooks/android-app-check.md).
export NEXT_PUBLIC_APPCHECK_PROVIDER=debug
bash "${SCRIPT_DIR}/build-mobile.sh"

# --- Step 1b: Static-export assertions (Phase 8 — fail fast) ----------------
#
# build-mobile.sh exits 0 even if Next.js's static export silently dropped a
# route. The booking-flow surface specifically needs `/customer/bookings` and
# the dynamic `/customer/bookings/[id]` segment to be emitted into out/. If
# either is missing we'd ship a debug-signed APK that opens to a blank page,
# so fail loudly here rather than at runtime.
if [[ ! -f "out/customer/bookings/index.html" ]]; then
  echo "[build] FAIL: out/customer/bookings missing" && exit 2
fi
if [[ ! -d "out/customer/bookings/[id]" ]]; then
  echo "[build] FAIL: out/customer/bookings/[id] missing" && exit 2
fi
# Account-linking flow (booking-flow-fix v3.1) — fails closed if the static
# export silently dropped the route (Gap 3).
if [[ ! -f "out/customer/account/link/index.html" ]]; then
  echo "[build] FAIL: out/customer/account/link missing" && exit 2
fi

# --- Step 2: Capacitor sync (sandwiched between iCloud sweeps) -------------
#
# `npx cap sync` from a Desktop-iCloud-synced clone produces ghost duplicates
# in assets/public/, res/xml/, and .gradle/ that break gradle's release
# pipeline (memory: icloud_capsync_assets_public_ghosts.md +
# icloud_ghosts_in_android_res.md). Sweep before and after — the sweep is
# idempotent so the bracketing is cheap.

log "Step 2/4: iCloud ghost sweep (pre-cap-sync)"
bash "${SCRIPT_DIR}/sweep-icloud-ghosts.sh" --apply

log "Step 2/4: npx cap sync android"
npx cap sync android

log "Step 2/4: iCloud ghost sweep (post-cap-sync)"
bash "${SCRIPT_DIR}/sweep-icloud-ghosts.sh" --apply

# --- Step 3: Gradle assembleStagingRelease ----------------------------------

log "Step 3/4: gradle assembleStagingRelease (APK-only — no bundle for staging)"
# Match build-mobile.sh: gradle needs a JDK on PATH. Bash-tool subshells don't
# inherit the user's interactive JAVA_HOME, so default to Android Studio's
# bundled JBR (matches scripts/build-mobile.sh and scripts/load-keystore.sh).
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
pushd android >/dev/null
if [[ ! -x ./gradlew ]]; then
  chmod +x ./gradlew
fi
GRADLE_TASKS=(assembleStagingRelease)
if [[ "${CLEAN:-0}" == "1" ]]; then
  GRADLE_TASKS=(clean "${GRADLE_TASKS[@]}")
fi
./gradlew "${GRADLE_TASKS[@]}"
popd >/dev/null

# --- Step 4: Report artifact path + SHA-256 fingerprint ---------------------

APK_PATH="android/app/build/outputs/apk/stagingRelease/app-stagingRelease.apk"
MAPPING_PATH="android/app/build/outputs/mapping/stagingRelease/mapping.txt"
BUILD_VARIANT="stagingRelease"
BUILD_HISTORY_LOG="${ROOT_DIR}/.build-history.log"

log "Step 4/4: artifact summary"

# Guard: if the gradle step failed early enough that no APK directory was
# produced, the SHA log step must NOT abort with a confusing error. Skip
# cleanly and let the caller see the gradle failure as the root cause.
[ -d android/app/build/outputs/apk ] || { echo "[build] no APK produced; skipping SHA log"; exit 0; }

if [[ -f "${APK_PATH}" ]]; then
  log "  APK  -> ${ROOT_DIR}/${APK_PATH}"
  if command -v shasum >/dev/null 2>&1; then
    # SHA-1 chosen to match the device fingerprint shown in Firebase Console
    # → App Check (Gap 1). Do NOT switch to SHA-256 without coordinating with
    # the App Check operator runbook.
    SHA1="$(shasum -a 1 "${APK_PATH}" | awk '{print $1}')"
    log "  SHA1 -> ${SHA1}"

    # Append a single line to the build-history log. Format:
    #   YYYY-MM-DD HH:MM:SS UTC | <variant> | <git-short-sha> | <relpath> | <sha1> | <status>
    BUILD_TS="$(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    printf '%s | %s | %s | %s | %s | %s\n' \
      "${BUILD_TS}" "${BUILD_VARIANT}" "${GIT_SHA}" "${APK_PATH}" "${SHA1}" "ok" \
      >> "${BUILD_HISTORY_LOG}"
    log "  HISTORY -> appended to ${BUILD_HISTORY_LOG}"
  else
    log "  SHA1 -> (shasum unavailable on PATH; skipping fingerprint)"
  fi
  if command -v stat >/dev/null 2>&1; then
    # macOS stat syntax differs from GNU; try BSD form first, fall back to GNU.
    SIZE_BYTES="$(stat -f%z "${APK_PATH}" 2>/dev/null || stat -c%s "${APK_PATH}" 2>/dev/null || echo 'unknown')"
    log "  SIZE   -> ${SIZE_BYTES} bytes"
  fi
else
  fail "expected APK was not produced at ${APK_PATH}"
fi

if [[ -f "${MAPPING_PATH}" ]]; then
  log "  MAP  -> ${ROOT_DIR}/${MAPPING_PATH} (R8 mapping — keep for crash symbolication)"
fi

log ""
log "Next steps for the operator:"
log "  1. adb install -r ${APK_PATH}"
log "  2. adb logcat | grep -i 'App Check'  # capture the debug-secret UUID"
log "  3. Register the UUID in Firebase Console (App Check → Manage debug tokens)"
log "  4. See docs/runbooks/android-app-check.md Path B for full instructions."
log ""
log "DO NOT upload app-stagingRelease.apk to Play Store — it is debug-signed."
log "Use scripts/release-build.sh (RELEASE=1) for production .aab uploads."
log "Done."
