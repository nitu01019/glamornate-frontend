# Stripe Removal — Operator Runbook

**Date:** 2026-05-02
**Plan:** `/Users/nitishbhardwaj/Desktop/Booking Flow Fix Plan v3.1 FINAL (Council-Approved) - 2026-05-02.md`
**Branch:** `feat/industry-overhaul`

This runbook captures the **mandatory operator gate** between Wave 1b and Wave 2 (Patch SB-2 + SB-7) — the migration MUST run BEFORE the new Firestore rules deploy, because the new rules deny the legacy `'payment_pending'` / `'payment_failed'` / `'draft'` states and would lock out residual rows.

The Wave 1b commits (`daf974a9` mechanical, `f...` migration tests, `f...` rules narrowing) ARE landed on the branch. They are NOT yet deployed. This document tells you the safe deploy order.

---

## Pre-flight (before any deploy)

1. **Stripe Dashboard reconciliation** (Patch SB-7 — REQUIRED):
   ```bash
   stripe charges list --created.gte=$(date -v-30d -u +%Y-%m-%dT%H:%M:%SZ) > /tmp/stripe-charges-30d.json
   ```
   Diff against Firestore `bookingStatus: 'payment_pending'` rows. If ANY successful Stripe charge maps to a booking still in `payment_pending` Firestore state — manually flip that booking to `'confirmed'` BEFORE running the migration. The migration's `'payment_pending' → 'cancelled'` rule would otherwise wipe a paid customer.

2. **Confirm secrets are still intact** (we keep them for the 14-day stub):
   ```bash
   firebase functions:secrets:access STRIPE_SECRET_KEY --project glamornate-758c6
   firebase functions:secrets:access STRIPE_WEBHOOK_SECRET --project glamornate-758c6
   ```

3. **Snapshot the pre-migration state** (rollback aid):
   ```bash
   firebase firestore:export gs://glamornate-758c6-backups/pre-stripe-removal-$(date +%Y%m%d-%H%M) \
     --project glamornate-758c6
   ```

---

## Operator gate sequence (runs IN THIS ORDER)

> Every step is gated on the previous step's verification. Do not skip ahead.

### Step 1 — Deploy migration code only (NOT rules)

```bash
cd /Users/nitishbhardwaj/Desktop/Glamornate
bash backend/scripts/deploy-functions.sh --functions-only
```

The new Firestore rules in this commit set will **break legacy doc reads** if deployed before the migration runs. Functions deploy first so we have the migrate callable available without touching rules.

### Step 2 — Migration dry-run

```bash
firebase functions:shell --project glamornate-758c6
```
Inside the shell:
```js
migrateRemoveStripe({ dryRun: true, batchSize: 100 })
```
The script logs counts:
- `paymentPendingCancelled`
- `paymentFailedCancelled`
- `draftToConfirmed`
- `draftToCancelled`
- `errors`

**Operator decision point.** Review the counts. If anything looks off, fix data manually first.

### Step 3 — Sign-off

Write the dry-run output to `frontend/docs/runbooks/booking-flow-fix-2026-05-02.md` Phase 0 decision log + your name + timestamp. This is the audit trail.

### Step 4 — Migration live

```js
migrateRemoveStripe({ dryRun: false, batchSize: 100 })
```

Verify in Firestore Console:
```
collection: bookings
filter: bookingStatus == 'payment_pending'
expected: 0 results
filter: bookingStatus == 'payment_failed'
expected: 0 results
filter: bookingStatus == 'draft'
expected: 0 results
```

### Step 5 — Customer comms (Patch CR-7)

For every user whose booking was flipped from `payment_pending` / `payment_failed` → `cancelled`, send:

- **Email** (template in plan §"Customer comms plan"):
  > Subject: We've simplified booking — your incomplete booking has been cancelled
  > [body explains pay-at-spa, offers re-booking link]

- **In-app banner** is shipped in code already (gated on env flag, 14-day TTL). Confirm it's on by setting:
  ```bash
  firebase functions:config:set booking.pay_at_spa_banner_enabled=true --project glamornate-758c6
  ```

### Step 6 — NOW deploy new Firestore rules

```bash
bash backend/scripts/deploy-functions.sh --rules-only
```

The new rules' `isValidStatusTransition` table accepts only the 6 post-Stripe states. Residual docs (if any escaped Step 4) become read-only — they fall through to deny-by-default.

### Step 7 — Deploy remaining function changes

```bash
bash backend/scripts/deploy-functions.sh
```

This redeploys everything (rules + indexes + functions). The `prebuild` script in `backend/functions/package.json` will FAIL the build if the date has crossed `2026-05-16T00:00:00Z` (Wave 12 stub-deletion deadline). If build fails for that reason — proceed to Wave 12.

### Step 8 — Day-14 stub removal (queued for 2026-05-16)

GitHub issue created in Wave 11.8. On 2026-05-16:
1. Stripe Dashboard → Webhooks → Delete the endpoint pointing at our function.
2. `firebase functions:secrets:destroy STRIPE_SECRET_KEY --project glamornate-758c6`
3. `firebase functions:secrets:destroy STRIPE_WEBHOOK_SECRET --project glamornate-758c6`
4. Wave 12 commit deletes the stub. Redeploy.

---

## Rollback

If the migration corrupts data:

1. **STOP all writes** to Firestore (toggle App Check enforcement OFF temporarily, or kill all instances).
2. Restore from the pre-migration export:
   ```bash
   firebase firestore:import gs://glamornate-758c6-backups/pre-stripe-removal-<TIMESTAMP> \
     --project glamornate-758c6
   ```
3. Revert the Wave 1b commits:
   ```bash
   git revert <1b3-sha>..<1b1-sha> --no-commit
   git commit -m "revert: Wave 1b — rolling back Stripe removal"
   ```
4. Redeploy: `bash backend/scripts/deploy-functions.sh`

---

## Cloud Logging filters for monitoring

**Stripe webhook stub invocations (expected to trend to zero over 14 days):**
```
resource.type="cloud_function"
resource.labels.function_name="handleStripeWebhook"
jsonPayload.event="stripe_webhook_noop"
```

**Migration progress logs:**
```
resource.type="cloud_function"
jsonPayload.script="migrate-remove-stripe"
```

**App Check denials (canary for rules misconfiguration):**
```
resource.type="firestore"
severity="WARNING"
textPayload =~ "permission_denied"
```
