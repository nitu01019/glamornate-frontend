#!/usr/bin/env bash
set -euo pipefail

# Bump version across package.json, android build.gradle, versionCode.
# Usage: ./scripts/bump-version.sh patch|minor|major

ARG="${1:-patch}"
case "$ARG" in
  patch|minor|major) ;;
  *) echo "Usage: $0 patch|minor|major" >&2; exit 1 ;;
esac

FRONTEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$FRONTEND_DIR"

# Bump package.json via pnpm
NEW_VERSION="$(pnpm version "$ARG" --no-git-tag-version | tail -1 | sed 's/^v//')"
echo "New version: $NEW_VERSION"

# Update android/app/build.gradle versionName + versionCode
sed -i.bak "s/versionName \"[^\"]*\"/versionName \"$NEW_VERSION\"/" android/app/build.gradle
CURRENT_CODE="$(grep 'versionCode ' android/app/build.gradle | head -1 | awk '{print $2}')"
NEW_CODE=$((CURRENT_CODE + 1))
sed -i.bak "s/versionCode $CURRENT_CODE/versionCode $NEW_CODE/" android/app/build.gradle
rm -f android/app/build.gradle.bak

# Commit
git add package.json android/app/build.gradle
git commit -m "chore(release): v$NEW_VERSION (code $NEW_CODE)"

echo "Bumped to v$NEW_VERSION, versionCode $NEW_CODE. Tag with: git tag v$NEW_VERSION"
