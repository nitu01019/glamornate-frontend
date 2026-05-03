# Vendored: @glamornate/contracts

This directory contains a vendored copy of the `@glamornate/contracts`
package source from the private monorepo. It is the single source of
truth for Zod schemas and shared TypeScript types used by both the
frontend and backend.

## Source of truth
The canonical version lives in the private monorepo at
`packages/contracts/`. This vendored copy is refreshed via the
maintainer script when the private package changes.

## Refresh procedure
```bash
MONOREPO_ROOT=/path/to/private/monorepo bash scripts/vendor-contracts.sh
```

## Imports
Inside this repo, import from `@/lib/contracts/...` paths. Do NOT
re-introduce `@glamornate/contracts` workspace specifiers; that
indirection would break clean-clone builds.

## License
Same MIT license as the parent repo.
