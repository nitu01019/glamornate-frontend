# Test Fixture Conventions

## Reserved test ranges (use these, NOT real-looking data)

- **Email**: Use `@glamornate.test` (RFC 2606 reserved test TLD) or `@example.com` (RFC 2606 reserved). Never use `@glamornate.com` (our real domain) — a misconfigured test could spam real inboxes.
- **Phone**: Use `+91 90000 00xxx` reserved test range (E.164 examples). Never use plausible-looking real numbers like `+91 98765 43210`.
- **Names**: Use `Test User`, `QA Customer`, `Spa Owner Test`, etc. Generic, obviously fake.
- **UIDs**: Use `test-uid-1`, `test-uid-2` ... or use the Firebase emulator's auto-generated uids.

## Why
- Mocks that accidentally make real network calls should hit dead ends, not real customers/employees.
- Public repo readers should be able to grep for "real customer data" and find none.
- Compliance: privacy reviews are easier if test data is obviously synthetic.

## Helper functions
See `tests/helpers/seed-user.ts` for the canonical pattern (`qa-*@glamornate.test`).
