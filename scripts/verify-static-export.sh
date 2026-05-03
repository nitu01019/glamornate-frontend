#!/usr/bin/env bash
set -e
OUT="${1:-out}"
LEAKED=$(grep -rl -E "^/api/|_next/server/app/api" "$OUT" 2>/dev/null | head -1 || true)
if [[ -n "$LEAKED" ]]; then
  echo "LEAK: API paths found in $OUT ($LEAKED)"; exit 1
fi
[[ -f "$OUT/index.html" ]] || { echo "missing $OUT/index.html"; exit 1; }
echo "static-export clean"
