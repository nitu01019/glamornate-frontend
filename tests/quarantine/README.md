# Quarantine directory

Specs parked here because they've flaked. Each file is checked in with a link
to a GitHub issue; if the issue isn't closed within 5 business days the spec
is deleted.

Specs are excluded from `playwright-smoke.yml` by the default
`--grep-invert "@quarantine"` flag.

## Process

1. A spec fails twice in CI under `retries: 1` (see
   [`frontend/playwright.config.ts`](../../playwright.config.ts)).
2. File a GitHub issue titled `[flaky] tests/e2e/<path>`. Paste the last two
   failure traces from the Playwright HTML report.
3. Move the spec into this directory (`git mv` preserves history).
4. Tag every test block in the file with `@quarantine` in the test title so
   `--grep-invert "@quarantine"` skips it in smoke runs.
5. Link the issue URL in a leading comment inside the spec file.
6. The author (or on-call) has 5 business days to root-cause the flake and
   either fix the spec or delete it. Tests that are quarantined indefinitely
   actively harm the suite's credibility.

## Re-admitting a quarantined spec

- Remove the `@quarantine` tags.
- `git mv` the spec back under `tests/e2e/`.
- Close the tracking issue with a link to the PR that fixed the flake.
- Monitor the next 10 CI runs for recurrence.
