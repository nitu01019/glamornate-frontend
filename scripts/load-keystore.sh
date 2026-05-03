#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Glamornate Android — release keystore loader.
#
# Pulls the release upload keystore + properties file from GCP Secret Manager
# when RELEASE=1. Local dev (RELEASE unset / RELEASE!=1) is a no-op so debug-
# signed APK builds still work without Secret Manager access.
#
# Why:
#   The release keystore is the only thing that lets us push Play Store updates.
#   Storing it on a single laptop's disk is a single-point-of-failure: laptop
#   theft / loss = no further APK updates ever. Source of truth lives in
#   Secret Manager (with mandatory 1Password offsite backup); local copies are
#   ephemeral and refreshed on demand by this script.
#
# Prereqs (RELEASE=1 only):
#   - Google Cloud SDK installed (`gcloud`)
#   - One-time: `gcloud auth application-default login`
#   - Secrets pre-populated in project glamornate-758c6:
#       * android-release-keystore       (binary keystore, base64-encoded)
#       * android-keystore-properties    (text, key=value lines)
#     See docs/runbooks/android-keystore-setup.md for upload instructions.
#
# Outputs (RELEASE=1):
#   frontend/android/app/glamornate-upload.keystore   (chmod 600)
#   frontend/android/app/keystore.properties          (chmod 600)
#
# Both paths are .gitignore'd. Local copy lifetime SHOULD be <= 30 days; just
# re-run this script (RELEASE=1) to refresh from Secret Manager. Mandatory
# offsite backup lives in 1Password — see runbook.
#
# Behavior:
#   - RELEASE!=1  -> exit 0 (no-op; debug-signed path)
#   - RELEASE=1   -> hard-fail on any error (set -euo pipefail). A failed pull
#                    aborts the build, which is the intended behavior.
# -----------------------------------------------------------------------------

set -euo pipefail

if [[ "${RELEASE:-0}" != "1" ]]; then
  echo "[load-keystore] RELEASE!=1 — skipping (debug-signed path)"
  exit 0
fi

PROJECT_ID="glamornate-758c6"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

KEYSTORE_OUT="${FRONTEND_DIR}/android/app/glamornate-upload.keystore"
PROPS_OUT="${FRONTEND_DIR}/android/app/keystore.properties"

# Secret names match what's actually in GCP Secret Manager (verified via
# `gcloud secrets list --project=glamornate-758c6 --filter="name~keystore"`).
# Earlier names `android-release-keystore` / `android-keystore-properties`
# were never created — fixing the mismatch on 2026-04-29.
KEYSTORE_SECRET="glamornate-upload-keystore"
PROPS_SECRET="glamornate-upload-keystore-properties"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "[load-keystore] ERROR: gcloud not installed." >&2
  echo "[load-keystore]        Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install" >&2
  exit 1
fi

if ! command -v base64 >/dev/null 2>&1; then
  echo "[load-keystore] ERROR: base64 not on PATH." >&2
  exit 1
fi

mkdir -p "$(dirname "${KEYSTORE_OUT}")"

echo "[load-keystore] fetching keystore from Secret Manager (project=${PROJECT_ID}, secret=${KEYSTORE_SECRET})…"
# Use --format='get(payload.data)' to receive base64 explicitly. Plain
# `gcloud secrets versions access` writes raw bytes to stdout; macOS shell
# UTF-8-decodes the binary keystore mid-pipe and corrupts it (PKCS12 magic
# bytes 0x30 0x82 become 0x30 0xEF 0xBF 0xBD = U+FFFD replacement).
gcloud secrets versions access latest \
  --secret="${KEYSTORE_SECRET}" \
  --project="${PROJECT_ID}" \
  --format='get(payload.data)' \
  | base64 --decode > "${KEYSTORE_OUT}"
chmod 600 "${KEYSTORE_OUT}"

echo "[load-keystore] fetching keystore.properties from Secret Manager (secret=${PROPS_SECRET})…"
gcloud secrets versions access latest \
  --secret="${PROPS_SECRET}" \
  --project="${PROJECT_ID}" \
  > "${PROPS_OUT}"
chmod 600 "${PROPS_OUT}"

echo "[load-keystore] OK"
echo "[load-keystore]   keystore  -> ${KEYSTORE_OUT}"
echo "[load-keystore]   props     -> ${PROPS_OUT}"
echo "[load-keystore] reminder: refresh local copy within 30 days; verify 1Password offsite backup."
