#!/usr/bin/env bash
# sync-contracts.sh — re-sync @glamornate/contracts dist/* into the frontend
# and backend node_modules trees.
#
# Why this exists
# ----------------
# `@glamornate/contracts` is consumed via `file:` links from both the
# frontend and the backend functions package. pnpm + npm copy the package
# at install time but do NOT re-copy after a subsequent `pnpm build` inside
# `packages/contracts/`. That means a fresh schema or a renamed field is
# invisible to consumers until someone manually copies `dist/` over.
#
# This script is the canonical "make consumers see the new types" step. Run
# it after every contracts edit, before running tests or typechecking.
#
# See `~/.claude/projects/.../memory/contracts_package_resync_required.md`
# for the underlying gotcha.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "[sync-contracts] building @glamornate/contracts at ${ROOT}/packages/contracts"
cd "${ROOT}/packages/contracts"
pnpm build

DIST_SRC="${ROOT}/packages/contracts/dist"

declare -a TARGETS=(
  "${ROOT}/frontend/node_modules/@glamornate/contracts/dist"
  "${ROOT}/backend/functions/node_modules/@glamornate/contracts/dist"
)

for target in "${TARGETS[@]}"; do
  if [ ! -d "${target}" ]; then
    echo "[sync-contracts] WARN: target missing, creating: ${target}"
    mkdir -p "${target}"
  fi
  echo "[sync-contracts] copying dist/ → ${target}"
  # pnpm/npm sometimes materialise the consumer's `dist/` as hardlinks to
  # the source `dist/`. Hardlinks share an inode, so a naive `rm -rf
  # target/` would delete the source file too. We instead use `rsync
  # --delete` (which detaches before copying) when available and fall
  # back to `cp -R` only as a last resort. The fallback intentionally
  # does NOT delete stale files first to avoid the hardlink trap; that
  # is acceptable because the standard path is rsync.
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "${DIST_SRC}/" "${target}/"
  else
    cp -R "${DIST_SRC}/." "${target}/" 2>/dev/null || true
  fi
done

echo "[sync-contracts] done."
