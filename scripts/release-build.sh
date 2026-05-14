#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Glamornate Android release-build driver.
#
# Sequences:
#   1. Next.js static export (via scripts/build-mobile.sh which stages mobile
#      env + moves web-only files out of the way).
#   2. Capacitor sync into android/.
#   3. Gradle assembleRelease (.apk) + bundleRelease (.aab).
#   4. Prints the final artifact paths, exits non-zero on any step failure.
#
# Signing behavior:
#   - If android/app/keystore.properties is present, `release` buildType uses
#     that keystore. Output is Play-Store-uploadable.
#   - Otherwise Gradle falls back to DEBUG signing (see android/app/build.gradle).
#     The build will still succeed, but the .aab/.apk are NOT accepted by Play
#     Console. Use this path only for local smoke testing.
#
# Usage:
#   bash scripts/release-build.sh
#
# Docs:
#   - docs/runbooks/android-release-build.md    (step-by-step)
#   - docs/runbooks/android-keystore-setup.md   (one-time keystore creation)
#   - docs/runbooks/crashlytics-setup.md        (Firebase Crashlytics wiring)
# -----------------------------------------------------------------------------

set -euo pipefail

BANNER_TS="$(date -u +'%Y-%m-%d %H:%M:%S UTC')"
printf '\n========== [%s] mode=%s ts=%s ==========\n\n' "$(basename "$0")" "PRODUCTION (PlayIntegrity)" "$BANNER_TS"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

# Capture git short SHA for build-history audit log (Gap 2). Tolerate non-git
# checkouts (e.g. archive extraction) by falling back to a sentinel string.
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'no-git')"

log() { printf '[release-build] %s\n' "$*"; }
fail() { printf '[release-build] ERROR: %s\n' "$*" >&2; exit 1; }

# --- Step 0: preflight ------------------------------------------------------

if [[ ! -d android ]]; then
  fail "android/ directory not found (are you at the repo root?)."
fi

# Pull the release keystore + properties from GCP Secret Manager (RELEASE=1
# only — the script is a no-op for debug-signed local builds). This must run
# BEFORE the keystore.properties existence check below so that, with RELEASE=1,
# the missing-keystore branch can never run on a freshly-cloned machine.
# Hard-fail on a failed pull is intended (set -e propagates).
log "Step 0/4: load release keystore (no-op unless RELEASE=1)"
bash "${SCRIPT_DIR}/load-keystore.sh"

if [[ ! -f android/app/keystore.properties ]]; then
  # RELEASE=1 means "produce a Play-Store-uploadable artifact". In that mode,
  # falling back to DEBUG signing is always wrong — fail loudly instead of
  # silently producing a useless .aab.
  if [[ "${RELEASE:-0}" == "1" ]]; then
    fail "RELEASE=1 but android/app/keystore.properties is missing — refusing to build a debug-signed release. See docs/runbooks/android-keystore-setup.md."
  fi
  log "WARNING: android/app/keystore.properties is missing."
  log "         The gradle build will sign the release artifact with the DEBUG key."
  log "         This is fine for local smoke-testing, but the resulting .aab/.apk"
  log "         CANNOT be uploaded to the Play Store."
  log "         To require the upload keystore, run with RELEASE=1 (will fail fast)."
  log "         See docs/runbooks/android-keystore-setup.md to create an upload key."
fi

if [[ ! -f android/app/google-services.json ]]; then
  log "WARNING: android/app/google-services.json is missing."
  log "         Push notifications + Crashlytics will be disabled in this build."
  log "         See docs/runbooks/crashlytics-setup.md."
fi

# --- Step 1: Next.js static export + env shuffle (reuses build-mobile.sh) ---

# Pre-build typecheck gate (Gap 4). Fail fast on TS errors before we sink
# 10+ minutes into a Gradle build that will only fail at the same point.
log "Step 1/4: pnpm typecheck (pre-build gate)"
pnpm typecheck

log "Step 1/4: Next.js static export (via build-mobile.sh)"
# Production builds MUST mint App Check tokens via PlayIntegrity (Gap 6) —
# pin it explicitly so that an unset/inherited env var can never silently
# fall back to the Debug provider on a Play-Store-uploadable artifact.
export NEXT_PUBLIC_APPCHECK_PROVIDER=playIntegrity
bash "${SCRIPT_DIR}/build-mobile.sh"

# --- Step 1b: Static-export assertions (Phase 8 — fail fast) ----------------
#
# build-mobile.sh exits 0 even if Next.js's static export silently dropped a
# route. The booking-flow surface specifically needs `/customer/bookings` and
# the dynamic `/customer/bookings/[id]` segment to be emitted into out/. If
# either is missing we'd ship a release-signed AAB that opens to a blank
# page on the Play Store — fail loudly here rather than at runtime.
if [[ ! -f "out/customer/bookings/index.html" ]]; then
  echo "[build] FAIL: out/customer/bookings missing" && exit 2
fi
# Next 15+ emits the dynamic `[id]` route under `_/` in the filesystem instead
# of `[id]/`. Accept either form so the verify keeps catching real drops without
# false-alarming on the new export layout.
if [[ ! -d "out/customer/bookings/[id]" && ! -d "out/customer/bookings/_" ]]; then
  echo "[build] FAIL: out/customer/bookings/[id] (or _) missing" && exit 2
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

# --- Step 3: Gradle assembleRelease + bundleRelease -------------------------

log "Step 3/4: gradle assembleRelease + bundleRelease"
pushd android >/dev/null
if [[ ! -x ./gradlew ]]; then
  chmod +x ./gradlew
fi
# Gate `clean` behind CLEAN=1 (DEV-M3). By default, reuse Gradle's incremental
# state to keep local iteration fast. Remove `--no-daemon` (DEV-M4) so repeat
# invocations reuse the Gradle daemon for faster builds.
GRADLE_TASKS=(assembleRelease bundleRelease)
if [[ "${CLEAN:-0}" == "1" ]]; then
  GRADLE_TASKS=(clean "${GRADLE_TASKS[@]}")
fi
./gradlew "${GRADLE_TASKS[@]}"
popd >/dev/null

# --- Step 4: Report artifact paths ------------------------------------------

APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
AAB_PATH="android/app/build/outputs/bundle/release/app-release.aab"
MAPPING_PATH="android/app/build/outputs/mapping/release/mapping.txt"
BUILD_VARIANT="release"
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
else
  log "  APK  -> (not produced) expected at ${APK_PATH}"
fi
if [[ -f "${AAB_PATH}" ]]; then
  log "  AAB  -> ${ROOT_DIR}/${AAB_PATH}"
else
  log "  AAB  -> (not produced) expected at ${AAB_PATH}"
fi
if [[ -f "${MAPPING_PATH}" ]]; then
  log "  MAP  -> ${ROOT_DIR}/${MAPPING_PATH} (upload to Crashlytics for symbolication)"
fi

log "Done."
