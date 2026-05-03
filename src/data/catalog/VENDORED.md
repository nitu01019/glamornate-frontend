# Vendored: @glamornate/data-catalog

This directory contains a vendored copy of the `@glamornate/data-catalog`
package source from the private monorepo. It contains the curated spa
service catalog (categories, services, image asset references) used by
both the frontend and backend.

## Source of truth
The canonical version lives in the private monorepo at
`packages/data-catalog/`. This vendored copy is refreshed via the
maintainer script when the private package changes.

## Refresh procedure
```bash
MONOREPO_ROOT=/path/to/private/monorepo bash scripts/vendor-data-catalog.sh
```

## Imports
Inside this repo, import from `@/data/catalog/...` paths. Do NOT
re-introduce `@glamornate/data-catalog` workspace specifiers.

## License
Same MIT license as the parent repo.
