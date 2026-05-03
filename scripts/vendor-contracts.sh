#!/usr/bin/env bash
# Refresh src/lib/contracts/ from a sibling private monorepo.
# Maintainer-only; consumers of the public mirror do not run this.
#
# Usage:
#   MONOREPO_ROOT=/path/to/private/monorepo bash scripts/vendor-contracts.sh

set -euo pipefail

if [[ -z "${MONOREPO_ROOT:-}" ]]; then
  echo "Set MONOREPO_ROOT to the private monorepo root."
  exit 1
fi

SRC="$MONOREPO_ROOT/packages/contracts/src/"
DEST="$(cd "$(dirname "$0")/.." && pwd)/src/lib/contracts/"

if [[ ! -d "$SRC" ]]; then
  echo "Source not found: $SRC"
  exit 1
fi

# Preserve VENDORED.md, replace everything else
cp "$DEST/VENDORED.md" /tmp/.vendored-md.contracts
rm -rf "$DEST"
mkdir -p "$DEST"
rsync -a --exclude='*.test.ts' --exclude='__tests__' "$SRC" "$DEST"
mv /tmp/.vendored-md.contracts "$DEST/VENDORED.md"

echo "Vendored from $SRC -> $DEST"
