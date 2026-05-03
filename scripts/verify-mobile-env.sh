#!/usr/bin/env bash
# Probe NEXT_PUBLIC_API_BASE_URL/health BEFORE building the mobile bundle.
# Fails the build if the URL doesn't return a 200 with the {"success":true,...}
# envelope. Prevents the regression where a wrong-region or wrong-path URL
# silently ships in the APK and surfaces as "Network request failed" toasts
# on every REST call.
#
# Usage:  bash scripts/verify-mobile-env.sh [.env.mobile]
# Exits non-zero on any failure so the caller (build-mobile.sh) aborts.

set -euo pipefail

ENV_FILE="${1:-.env.mobile}"
[[ -f "$ENV_FILE" ]] || { echo "[verify-mobile-env] $ENV_FILE missing"; exit 1; }

URL=$(grep -E '^NEXT_PUBLIC_API_BASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)
if [[ -z "${URL:-}" ]]; then
  echo "[verify-mobile-env] NEXT_PUBLIC_API_BASE_URL is empty in $ENV_FILE"
  exit 1
fi

PROBE="${URL%/}/health"
BODY=$(mktemp)
trap 'rm -f "$BODY"' EXIT

echo "[verify-mobile-env] probing ${PROBE}"
CODE=$(curl -sS -o "$BODY" -w "%{http_code}" --max-time 10 --retry 1 "$PROBE" || echo "000")

if [[ "$CODE" != "200" ]]; then
  echo "[verify-mobile-env] FAIL — got HTTP $CODE from $PROBE"
  echo "[verify-mobile-env] body (first 500 bytes):"
  head -c 500 "$BODY" || true
  echo
  exit 1
fi

if ! grep -q '"success":true' "$BODY"; then
  echo "[verify-mobile-env] FAIL — body missing {\"success\":true} envelope"
  head -c 300 "$BODY"
  exit 1
fi

echo "[verify-mobile-env] OK — $PROBE returned 200 with success envelope"
