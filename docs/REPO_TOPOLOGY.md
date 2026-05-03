# Repository Topology

## Overview

The Glamornate platform consists of three repositories:

| Repository | Visibility | Purpose |
|---|---|---|
| `glamornate-frontend` (this repo) | **Public** | Source mirror of the customer-facing Next.js + Capacitor app |
| `glamornate-backend-` | **Public** | Source mirror of the Firebase Cloud Functions backend, Firestore rules, Storage rules |
| Internal monorepo (`Glamornate/`) | **Private** | Active development workspace, includes `packages/contracts`, `packages/data-catalog`, deployment runbooks |

## How they relate

- The two public repos are **read-only mirrors**. Active development happens in the private monorepo, and changes are periodically pushed out to these public repos as snapshot releases.
- The public repos contain **vendored copies** of the workspace packages `@glamornate/contracts` and `@glamornate/data-catalog` (see `src/lib/contracts/` and `src/data/catalog/` once Team 3 vendoring lands). This means consumers of the public repo can clone-and-build without access to the private workspace.
- Production deployment happens from the private monorepo via Firebase CLI; CI on the public repos validates buildability but does not deploy.

## Buildability roadmap

- **v0.1.0** (current): public mirror with stable structure; `pnpm install` may fail until vendoring is complete because `package.json` references workspace deps.
- **v0.2.0** (planned): workspace deps vendored inline; `pnpm install && pnpm build` works from a clean clone.

## Scratch repos

During development of these public mirrors, agent tooling occasionally writes to ephemeral scratch directories under `/tmp/`. These are not part of the project and auto-purge on system reboot.

## Production deployment

Production runs from the private monorepo. Public repo changes do not auto-deploy. Operators porting fixes from the public repo to the private monorepo are responsible for the deployment pipeline (see private monorepo's runbooks).
