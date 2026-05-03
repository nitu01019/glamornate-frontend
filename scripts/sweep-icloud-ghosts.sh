#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Glamornate — iCloud ghost-duplicate sweep harness (defensive, dry-run default).
#
# Why this exists:
#   The Glamornate working tree lives on `~/Desktop`, which is iCloud-synced.
#   The macOS iCloud daemon (`bird`) periodically rewrites file inodes, evicts
#   on-disk content for cloud-only references, and — most disastrously for
#   gradle — produces ghost duplicates with names like:
#
#       app-release 2.aab
#       config (1).xml
#       layout copy.xml
#       file-system.probe
#       page 2.js
#
#   These ghosts break the Android build in subtle ways:
#
#   - `assets/public/page 2.js` ships into the APK as a duplicate static
#     asset; the Capacitor WebView serves the ghost on cold-start, the
#     bridge fails to find the real entry, and the app shows a blank screen
#     (memory: icloud_capsync_assets_public_ghosts.md).
#
#   - `res/xml/config N.xml` ghosts duplicate AAPT resource entries. AAPT
#     fails the build with "Resource compilation failed: duplicate value
#     for resource" and the gradle release errors out with a confusing
#     message that points at the wrong file (memory: icloud_ghosts_in_android_res.md).
#
#   - `.next/page.js` evicted by `bird` mid-build causes alternating CSS
#     404s and chunk-load crashes during dev. The fix on the .next side is
#     `distDir: '.next.nosync'` (already applied), but residual ghosts
#     from older builds persist and need sweeping (memory:
#     icloud_evicts_next_build_dir.md).
#
#   - `.gradle/file-system.probe` and friends are AGP's incremental-build
#     state probes; iCloud copies them into ghost variants on every sync,
#     poisoning gradle's up-to-date checks and forcing slower full rebuilds.
#
# Default behavior:
#   Dry-run. Prints candidates per search root, deletes nothing. Use this
#   before every `bash scripts/staging-release-build.sh` (or release-build.sh)
#   to confirm no ghosts will trip up gradle.
#
# Apply mode:
#   `bash scripts/sweep-icloud-ghosts.sh --apply` actually deletes the ghosts.
#   Bracketed by `killall -STOP bird cloudd` so iCloud can't recreate the
#   ghosts mid-deletion, with a trap that always restarts `bird`/`cloudd`
#   on EXIT (otherwise iCloud sync stays paused after the script exits).
#
# Usage:
#   bash scripts/sweep-icloud-ghosts.sh             # dry-run (default)
#   bash scripts/sweep-icloud-ghosts.sh --dry-run   # explicit dry-run
#   bash scripts/sweep-icloud-ghosts.sh --apply     # actually delete
#
# References (memory keys in MEMORY.md):
#   - icloud_capsync_assets_public_ghosts.md
#   - icloud_evicts_next_build_dir.md
#   - icloud_ghosts_in_android_res.md
#   - icloud_sync_duplicates.md
# -----------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

# --- Mode parse -------------------------------------------------------------

MODE="dry-run"
case "${1:-}" in
  --apply)
    MODE="apply"
    ;;
  ""|--dry-run)
    MODE="dry-run"
    ;;
  -h|--help)
    sed -n '2,60p' "${BASH_SOURCE[0]}"
    exit 0
    ;;
  *)
    echo "[sweep-icloud-ghosts] ERROR: unknown flag '$1' (use --apply or --dry-run)" >&2
    exit 2
    ;;
esac

log() { printf '[sweep-icloud-ghosts] %s\n' "$*"; }

log "mode: ${MODE}"
log "root: ${ROOT_DIR}"

# --- Search roots -----------------------------------------------------------

# These are the only places ghosts have ever been observed. Adding new roots
# is fine, but each addition should be backed by a concrete incident memory.
SEARCH_ROOTS=(
  "android/app/src/main/assets/public"
  "android/app/src/main/res"
  "android/app/build"
  "android/.gradle"
  "out"
  ".next"
  ".next.nosync"
  "node_modules/.cache"
)

# --- Ghost name patterns ----------------------------------------------------
#
# The find expression below matches any of these patterns:
#   - `* 2.*`       e.g., `app-release 2.aab`
#   - `* (1).*`     e.g., `config (1).xml`            (numeric in parens)
#   - `* copy*`     e.g., `layout copy.xml`, `app copy 2.aab`
#   - `*-copy.*`    e.g., `app-copy.apk`               (dash-copy variant)
#   - `*.probe`     e.g., `.gradle/file-system.probe`
#   - `* [0-9].*`   e.g., `page 2.js`, `page 3.js`     (single-digit suffix)
#
# We use `find … \( pat -o pat -o … \)` so the pattern set is one OR-group;
# this lets us run a single `find -delete` per root in --apply mode instead
# of N invocations.

# --- iCloud daemon control (apply mode only) --------------------------------

restart_icloud() {
  # Always run on EXIT in --apply mode. Safe to call multiple times.
  killall -CONT bird cloudd 2>/dev/null || true
}

if [[ "${MODE}" == "apply" ]]; then
  log "pausing iCloud daemons (bird, cloudd) for the duration of the sweep"
  killall -STOP bird cloudd 2>/dev/null || true
  trap restart_icloud EXIT
fi

# --- Sweep ------------------------------------------------------------------

TOTAL_FOUND=0
TOTAL_DELETED=0

for ROOT in "${SEARCH_ROOTS[@]}"; do
  if [[ ! -d "${ROOT}" ]]; then
    printf '[sweep-icloud-ghosts]   skip %-44s (not present)\n' "${ROOT}"
    continue
  fi

  # Note: -name patterns must be quoted to prevent zsh/bash globbing before
  # find sees them. The `* [0-9].*` and `* 2.*` patterns include literal
  # spaces; quoting handles that too.
  CANDIDATES=$(find "${ROOT}" -type f \( \
      -name "* 2.*" \
      -o -name "* [0-9].*" \
      -o -name "* (*).*" \
      -o -name "* copy*" \
      -o -name "*-copy.*" \
      -o -name "*.probe" \
    \) 2>/dev/null || true)

  if [[ -z "${CANDIDATES}" ]]; then
    printf '[sweep-icloud-ghosts]   ok   %-44s found 0 candidates\n' "${ROOT}"
    continue
  fi

  COUNT=$(printf '%s\n' "${CANDIDATES}" | grep -c . || true)
  TOTAL_FOUND=$((TOTAL_FOUND + COUNT))
  printf '[sweep-icloud-ghosts]   hit  %-44s found %d candidates\n' "${ROOT}" "${COUNT}"

  # Print individual candidates indented for triage. Limit to 25 per root
  # to avoid drowning the operator in output if a build cache went rogue.
  printf '%s\n' "${CANDIDATES}" | head -n 25 | sed 's/^/[sweep-icloud-ghosts]        /'
  REMAINDER=$((COUNT - 25))
  if [[ "${REMAINDER}" -gt 0 ]]; then
    printf '[sweep-icloud-ghosts]        … and %d more (truncated)\n' "${REMAINDER}"
  fi

  if [[ "${MODE}" == "apply" ]]; then
    # Re-run with -delete so we delete and count atomically per-root.
    DELETED=$(find "${ROOT}" -type f \( \
        -name "* 2.*" \
        -o -name "* [0-9].*" \
        -o -name "* (*).*" \
        -o -name "* copy*" \
        -o -name "*-copy.*" \
        -o -name "*.probe" \
      \) -print -delete 2>/dev/null | grep -c . || true)
    TOTAL_DELETED=$((TOTAL_DELETED + DELETED))
    printf '[sweep-icloud-ghosts]   del  %-44s deleted %d files\n' "${ROOT}" "${DELETED}"
  fi
done

# --- Summary ----------------------------------------------------------------

log ""
log "summary"
log "  total candidates found  : ${TOTAL_FOUND}"
if [[ "${MODE}" == "apply" ]]; then
  log "  total candidates deleted: ${TOTAL_DELETED}"
  log "  total candidates kept   : $((TOTAL_FOUND - TOTAL_DELETED))"
  log ""
  log "iCloud daemons will be resumed on exit (trap)."
else
  log "  mode = dry-run; no files were deleted."
  if [[ "${TOTAL_FOUND}" -gt 0 ]]; then
    log "  re-run with --apply to delete the candidates above."
  fi
fi
log "done."
