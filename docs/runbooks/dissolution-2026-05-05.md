# Monorepo Dissolution — Frontend Runbook (2026-05-05)

## What this is

On 2026-05-05 the pnpm workspace was dissolved. `frontend/` and `backend/` are
now independent codebases that happen to share a single git repo. Each folder
has its own lockfile, its own dependency tree, and its own toolchain.

In Finder you'll only see `backend/` and `frontend/` at the repo root. The
hidden files at the root (`.git/`, `.github/`, `.gitignore`, `.gitleaks.toml`,
`.editorconfig`, `.prettierrc`, `.prettierignore`) stay where they are — they're
shared infra, not code.

There is no longer a root `package.json`, no `pnpm-workspace.yaml`, no
`packages/` directory. Anything you used to run from the repo root now runs
from `frontend/` or `backend/` directly.

## Where shared code lives now

| Old location                      | New location                                            |
| --------------------------------- | ------------------------------------------------------- |
| `packages/contracts`              | `frontend/src/shared/contracts/` (+ mirror in backend)  |
| `packages/data-catalog`           | `frontend/src/shared/catalog/` (+ mirror in backend)    |
| `packages/config-eslint`          | deleted (was unused)                                    |
| `packages/config-prettier`        | deleted (was unused)                                    |
| `packages/config-tsconfig`        | deleted (was unused)                                    |

Contracts and catalog are duplicated across `frontend/src/shared/` and
`backend/functions/src/shared/`. **When you change a schema, copy the change to
the other folder.** There is no build step that does this for you.

## Install / dev / test / build

All commands run from `frontend/`:

```bash
cd frontend
pnpm install            # installs from frontend/pnpm-lock.yaml
pnpm dev                # Next.js dev server on :3000
pnpm typecheck          # tsc --noEmit
pnpm lint               # eslint
pnpm test               # vitest
pnpm build              # Next.js production build
pnpm build:mobile       # Capacitor APK staging build (uses staging-release-build.sh)
```

## pnpm.overrides

`frontend/package.json` now carries the `pnpm.overrides` block that used to
live at the repo root. It pins:

- `@radix-ui/react-slot ^1.2.4` — prevents the Next 15 dev-mode
  `Cannot read properties of undefined (reading 'call')` crash from a dual
  Radix Slot version × barrel optimizer interaction.
- `postcss ^8.5.11`, `tar ^7.5.13`, `minimatch ^9.0.5`,
  `@xmldom/xmldom ^0.8.13`, `uuid ^14.0.0` — CVE pins.

Don't drop these. If you bump them, verify Next dev still boots cleanly and
that the CVE advisories are still satisfied by the new version.

## CI workflows

Workflow files stay at the repo root in `.github/workflows/`. Each frontend job
sets:

```yaml
defaults:
  run:
    working-directory: frontend
# and on the cache step:
cache-dependency-path: frontend/pnpm-lock.yaml
```

Frontend-touching workflows: `android-build.yml`, `ci.yml`, `lighthouse.yml`,
`playwright-full.yml`, `playwright-smoke.yml`.

## Git / iCloud caveat

The Desktop is iCloud-synced. Heavy parallel git activity (multiple agents
writing the index simultaneously) caused iCloud's `bird`/`cloudd` daemons to
drop ghost files (`index 2`, `HEAD 3`, etc.) into `.git/`, corrupting the
index. Symptom: `fatal: unable to read tree (...)` on any git read.

Recovery:

```bash
killall -STOP bird cloudd
find .git -name "* [0-9]*" -print -delete   # sweep ghosts
rm -f .git/index
git read-tree HEAD
killall -CONT bird cloudd
```

If that doesn't recover, `git reset` against the last good commit and re-stage.
See the `icloud_ghost_dirs_next_export` and `icloud_evicts_next_build_dir`
memories for the broader pattern — same root cause, different symptom.
