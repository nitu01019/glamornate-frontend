#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

API_DIR=src/app/api
BAK_API=_api_disabled
FILES_TO_MOVE=(src/app/sitemap.ts src/app/robots.ts src/middleware.ts)

restore() {
  [[ -d "$BAK_API" ]] && mv "$BAK_API" "$API_DIR" || true
  for f in "${FILES_TO_MOVE[@]}"; do [[ -f "${f}.bak" ]] && mv "${f}.bak" "$f"; done
}
trap restore ERR EXIT

[[ -d "$API_DIR" ]] && mv "$API_DIR" "$BAK_API"
for f in "${FILES_TO_MOVE[@]}"; do [[ -f "$f" ]] && mv "$f" "${f}.bak"; done

[[ -f .env.mobile ]] || { echo ".env.mobile missing"; exit 1; }

# Probe the configured API URL before committing to a 90-second build.
# A wrong-region or wrong-path URL would otherwise silently ship in the APK and
# surface as "Network request failed" toasts on every REST call (see
# /Users/nitishbhardwaj/.claude/plans/apk-network-request-failed-systematic-debug.md).
bash "$(dirname "$0")/verify-mobile-env.sh" .env.mobile

cp .env.mobile .env.production

export BUILD_TARGET=mobile
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"

npm run build
./scripts/verify-static-export.sh out
