# Operator Go-Live — Booking Flow Fix v3.1

## Overview

- **Date:** 2026-05-02 · **Branch:** `feat/industry-overhaul` · **Project:** `glamornate-758c6`
- **Safety tag (rollback target):** `safety/pre-wave1b-2026-05-02`

Single top-to-bottom runbook for shipping Booking Flow Fix v3.1 to PRODUCTION. Five intertwined changes ship together: **Stripe payment surface removal** (pay-at-spa state machine), **IST unification** (server-trusted), **wizard state machine reset** (no stale draft bleed-through), **anonymous → permanent UID account linking** (mergeUserAccounts callable), and **App Check classification on Firestore reads** (typed errors + retries).

You are the sole operator. Read top-to-bottom, copy-paste each command, verify after each step. **Do NOT skip ahead** — Step 7 (rules deploy) WILL break legacy `payment_pending` rows if Step 5 (migration) hasn't run cleanly first.

**Estimated total time:** 60-90 min for Steps 1-8 + ~30 min Step 9 (APK) + ~45 min Step 10 (T1-T9). Step 11 is 2 min. Step 12 is 14 days later.

---

## Before you start (preconditions)

- [ ] macOS shell open; cwd = `/Users/nitishbhardwaj/Desktop/Glamornate/frontend`.
- [ ] `firebase login:list` shows your account; `gcloud auth list` shows same identity active.
- [ ] `stripe config --list` confirms Stripe CLI authenticated against live Glamornate account.
- [ ] Android phone with USB debugging on, plugged in; `adb devices` lists it.
- [ ] Firebase Console open with App Check page accessible (Build → App Check → Apps).
- [ ] `df -h /` shows > 5 GB free.
- [ ] Branch `feat/industry-overhaul`, working tree clean; tag exists: `git tag -l safety/pre-wave1b-2026-05-02`.

---

## Glossary (5 lines)

- **Wave** — chunk of the v3.1 plan; Wave 1b = mechanical + migration; Wave 12 = stub deletion on day 14.
- **Migration** — `migrateRemoveStripe` script in `backend/functions/src/scripts/migrate-remove-stripe.ts` that flips legacy `payment_pending` / `payment_failed` / `draft` bookings to terminal states.
- **AppCheck debug UUID** — per-device token printed in `adb logcat` on first launch of a debug-signed APK; pasted into Firebase Console to bypass attestation on that device.
- **Functions** — Cloud Functions in `backend/functions/`, deployed via `backend/scripts/deploy-functions.sh`.
- **Rules** — `backend/firestore.rules`; new `isValidStatusTransition` table accepts only the 6 post-Stripe states.

---

### Step 1: Reconcile Stripe charges

**Pre-condition:** Stripe CLI authenticated; Firestore Console access for `glamornate-758c6`.

**Command(s):**
```bash
cd /Users/nitishbhardwaj/Desktop/Glamornate
stripe charges list --created.gte=$(date -v-30d -u +%Y-%m-%dT%H:%M:%SZ) > /tmp/stripe-charges-30d.json
cat /tmp/stripe-charges-30d.json | jq '.data[] | select(.status == "succeeded") | {id, amount, metadata}'
```

**Expected output:**
```
{ "id": "ch_3OabcXYZ", "amount": 79900, "metadata": { "bookingId": "bk_a1b2c3" } }
(or empty if no charges in last 30 days)
```

**Verification:** For each successful charge, open Firebase Console → Firestore → `bookings/<bookingId>`. If `bookingStatus == "payment_pending"`, manually edit it to `"confirmed"` BEFORE Step 5. **If you skip this, Step 5 will incorrectly cancel a paid booking.**

**Rollback:** Read-only step. If you mis-edited Firestore manually, restore from Step 2 backup.

**Estimated time:** 5-15 min.

---

### Step 2: Backup Firestore

**Pre-condition:** Bucket `gs://glamornate-758c6-backups` exists (created during initial setup).

**Command(s):**
```bash
firebase firestore:export gs://glamornate-758c6-backups/pre-stripe-removal-$(date +%Y%m%d-%H%M) --project glamornate-758c6
```

**Expected output:**
```
i  Starting export of all collections in glamornate-758c6...
+  Exported all collections to gs://glamornate-758c6-backups/pre-stripe-removal-20260502-1430
```

**Verification:** `gsutil ls gs://glamornate-758c6-backups/ | grep pre-stripe-removal-$(date +%Y%m%d)` lists your timestamped folder. Save the path — you'll need it if Step 5 corrupts data.

**Rollback:** N/A — read-only.

**Estimated time:** 3-10 min.

---

### Step 3: Deploy functions only

**Pre-condition:** Step 2 backup verified in GCS; `git status` clean.

**Command(s):**
```bash
cd /Users/nitishbhardwaj/Desktop/Glamornate
bash backend/scripts/deploy-functions.sh --functions-only
```

**Expected output:**
```
[guard] ALLOW_APP_CHECK_DEBUG OK
[pre-flight] All N declared secrets bound.
✓  functions[createBooking(asia-south1)] Successful create operation.
✓  Deploy complete. firebase.json restored.
```

**Verification:** `firebase functions:list --project glamornate-758c6` lists the new state-machine handlers (`createBooking`, `cancelBooking`, `rescheduleBooking`, `mergeUserAccounts`). Note: `migrateRemoveStripe` is a CLI script (not a deployed callable) — it runs locally via the Admin SDK in Steps 4-5 and only requires that the new code paths are live so post-migration writes follow the new state machine.

**Rollback (DESTRUCTIVE):** If deploy fails mid-way, the script restores `firebase.json` via its trap. To roll back code: `git checkout safety/pre-wave1b-2026-05-02 -- backend/` then `bash backend/scripts/deploy-functions.sh`. Investigate `[guard]` / `[pre-flight]` output before retrying.

**Estimated time:** 6-12 min.

---

### Step 4: Dry-run migration

**Pre-condition:** Step 3 deploy succeeded. JDK 20 + npm + `gcloud auth application-default login` confirmed (run `gcloud auth application-default login` if not). cwd = `backend/functions`. The migration is a local CLI script (`backend/functions/src/scripts/migrate-remove-stripe.ts`) that talks to Firestore via the Admin SDK — not a deployed callable, so `firebase functions:shell` will NOT find it.

**Command(s):**
```bash
cd /Users/nitishbhardwaj/Desktop/Glamornate/backend/functions
npm run build  # compile TS → lib/ (required before first invocation)
MIGRATION_ACK=I-UNDERSTAND node lib/scripts/migrate-remove-stripe.js --dry-run --batch-size=100
```

**Expected output:**
```
[migrate-remove-stripe] starting (dryRun=true, batchSize=100)
[migrate-remove-stripe] result:
{
  "scanned": 19,
  "paymentPendingCancelled": 12,
  "paymentFailedCancelled": 3,
  "draftToConfirmed": 0,
  "draftToCancelled": 4,
  "errors": []
}
```

**Verification:** `errors` MUST be `[]` (empty array; the process exits 0). `paymentPendingCancelled` should NOT include any Step 1 booking you flipped to `confirmed`. If anything looks off, check `firebase functions:log --project glamornate-758c6` and resolve before Step 5. Record the counts + your name + timestamp in `frontend/docs/runbooks/booking-flow-fix-2026-05-02.md` Phase 0 decision log (audit trail per the [Stripe removal runbook](./stripe-removal-runbook.md) Step 3).

**Rollback:** Read-only — `--dry-run` writes nothing to Firestore (no audit rows either).

**Estimated time:** 3-5 min.

---

### Step 5: Real migration

**Pre-condition:** Step 4 reviewed & approved; counts logged; `errors: []`. Still in `backend/functions` with `lib/` compiled from Step 4.

**Command(s):**
```bash
cd /Users/nitishbhardwaj/Desktop/Glamornate/backend/functions
MIGRATION_ACK=I-UNDERSTAND node lib/scripts/migrate-remove-stripe.js --batch-size=100
```

**Expected output:** Same shape as Step 4 but with `dryRun=false`. Counts MUST match Step 4 dry-run exactly (idempotency invariant). `errors: []`. Process exits 0.

**Verification:** Firebase Console → Firestore → `bookings`, run three queries:
1. `bookingStatus == "payment_pending"` → **0 results**
2. `bookingStatus == "payment_failed"` → **0 results**
3. `bookingStatus == "draft"` → **0 results**

If any query returns rows, do NOT proceed to Step 7.

**Rollback (DESTRUCTIVE):** If counts diverged or errors > 0:
1. STOP — do not run Step 7. Legacy rules are still in effect, so reads still work.
2. Restore Firestore: `firebase firestore:import gs://glamornate-758c6-backups/pre-stripe-removal-<TIMESTAMP> --project glamornate-758c6`
3. Roll back code: `git checkout safety/pre-wave1b-2026-05-02` then `bash backend/scripts/deploy-functions.sh`.

**Estimated time:** 5-10 min.

---

### Step 6: Email migrated customers

**Pre-condition:** Step 5 verified — zero `payment_pending` / `payment_failed` / `draft` rows.

**Command(s):**
```bash
firebase firestore:get bookings --project glamornate-758c6 \
  --where 'cancellationReason==stripe_removal_migration' \
  --output /tmp/migrated-cancellations.json
cat /tmp/migrated-cancellations.json | jq '.[] | {bookingId: .id, userId: .userId, customerEmail: .customerEmail}'
firebase functions:config:set booking.pay_at_spa_banner_enabled=true --project glamornate-758c6
```

For each `customerEmail`, send the template under "Customer comms plan" in `/Users/nitishbhardwaj/Desktop/Booking Flow Fix Plan v3.1 FINAL (Council-Approved) - 2026-05-02.md`:

> **Subject:** We've simplified booking — your incomplete booking has been cancelled
>
> Hi <name>, we've removed online payment to make booking faster. Your incomplete booking from <date> has been cancelled with no charge. Pay at the spa — re-book at <https://glamornate.app/book>.

**Expected output:**
```
[{"bookingId":"bk_a1b2","userId":"uid_xyz","customerEmail":"customer@example.com"}, ...]
✔  Functions config updated.
```

**Verification:** Open the deployed app on a logged-in device — "We've simplified booking" banner appears at top of home screen. Cloud Logging filter `jsonPayload.event == "pay_at_spa_banner_shown"` shows impressions.

**Rollback:** Banner off: `firebase functions:config:set booking.pay_at_spa_banner_enabled=false --project glamornate-758c6`.

**Estimated time:** 5-15 min.

---

### Step 7: Deploy rules

**Pre-condition:** Step 5 verification confirmed (zero legacy rows); Step 6 comms sent. **DO NOT RUN BEFORE STEP 5 SUCCEEDS** — new rules deny legacy states and would lock readers out of residual rows.

**Command(s):**
```bash
cd /Users/nitishbhardwaj/Desktop/Glamornate
bash backend/scripts/deploy-functions.sh --rules-only
```

**Expected output:**
```
✓  cloud.firestore: rules file backend/firestore.rules compiled successfully
✓  firestore: released rules backend/firestore.rules to cloud.firestore
```

**Verification:** Firebase Console → Firestore → Rules tab — "Last published" within last minute. Search for `isValidStatusTransition` — accepts only 6 post-Stripe states (`pending`, `confirmed`, `in_progress`, `completed`, `cancelled`, `no_show`). Load the customer app, view past bookings — list renders in <3s with no permission errors.

**Rollback (DESTRUCTIVE):** If rules break reads:
```bash
git checkout safety/pre-wave1b-2026-05-02 -- backend/firestore.rules
bash backend/scripts/deploy-functions.sh --rules-only
```

**Estimated time:** 2-4 min.

---

### Step 8: Deploy everything else

**Pre-condition:** Step 7 rules live; customer app reads bookings successfully.

**Command(s):**
```bash
cd /Users/nitishbhardwaj/Desktop/Glamornate
bash backend/scripts/deploy-functions.sh
```

**Expected output:**
```
✓  functions: deployed all functions
✓  firestore: indexes deployed
✓  Deploy complete.
```

The `prebuild` script will FAIL the build if today's date is past `2026-05-16T00:00:00Z` (Wave 12 deadline). If you see that, jump to Step 12.

**Verification:** `bash backend/scripts/verify-deploy.sh` — all callable smoke checks pass.

**Rollback:** Same as Step 3.

**Estimated time:** 6-12 min.

---

### Step 9: Build staging APK + register UUID

**Pre-condition:** Step 8 clean; Android phone connected; `adb devices` lists it.

**Command(s):**
```bash
cd /Users/nitishbhardwaj/Desktop/Glamornate/frontend
pnpm build:mobile:staging
adb install -r android/app/build/outputs/apk/stagingRelease/app-stagingRelease.apk
adb logcat -s AppCheck:* FirebaseAppCheck:* | tee /tmp/appcheck-uuid.log
```

Launch the app. In `/tmp/appcheck-uuid.log`, find:
```
Enter this debug secret into the allow list in the Firebase Console: <UUID>
```

**Expected output:**
```
✓  build:mobile:staging — assembleStagingRelease completed
android/app/build/outputs/apk/stagingRelease/app-stagingRelease.apk (16.5 MB)
Performing Streamed Install — Success
D/AppCheck: Enter this debug secret: 4f9a2c1e-...
```

**Verification:** Copy the UUID. Firebase Console → Build → App Check → Apps → select `com.glamornate.app` Android app → kebab menu → "Manage debug tokens" → Add token, paste UUID, name `<your-device>-2026-05-02`, save. Reload the app; book screens open without "Network request failed". For deeper detail see [android-app-check.md](./android-app-check.md) and [apk-smoke-checklist.md](./apk-smoke-checklist.md).

**Rollback:** APK build is non-destructive. If app crashes, follow the smoke checklist.

**Estimated time:** 15-25 min.

---

### Step 10: Real-device tests T1-T9

**Pre-condition:** Step 9 APK installed; UUID registered; signed in as a test customer. Today is **2026-05-02**.

**Command(s) / actions:** Tail logs in a second terminal during the run:
```bash
firebase functions:log --project glamornate-758c6 --follow
```
Walk all 9 tests in order:

- **T1** — Book a service for **today, 19:00 IST** at device clock ~16:00 IST. Wizard goes home → service → time → confirm without freezing. Confirmation in <3s. Firestore `bookings/<id>` shows `bookingStatus: "confirmed"` and `serviceTime: 2026-05-02T13:30:00Z` (19:00 IST = 13:30 UTC).
- **T2** — Without leaving the app, book a SECOND slot for **today, 20:00 IST**. Verify wizard reset — no leftover service/address from T1.
- **T3** — Open "My Bookings". Both render within 3s, sorted by start time ascending.
- **T4** — Cancel T2. Status flips to `cancelled` in UI immediately and in Firestore within 5s.
- **T5** — Reschedule T1 to **today, 21:00 IST**. New time renders in IST (not UTC); Firestore `serviceTime` matches `2026-05-02T15:30:00Z`.
- **T6** — Sign out, sign back in via Google. `mergeUserAccounts` fires in logs. Bookings list still shows T1 (rescheduled).
- **T7** — Force-quit and relaunch in airplane mode. Bookings render from cache. Re-enable network — fresh data syncs cleanly.
- **T8** — Try to book in the past (**today, 09:00 IST** at 16:00 IST). Server rejects with clear "slot in past" error.
- **T9** — Long-tap a booking → "View receipt". Reads "Pay at spa" — no Stripe references anywhere.

**Expected output:** All 9 pass. Cloud Logging shows zero `permission_denied` warnings for your test user.

**Verification:** Watch the streaming log for `severity == "ERROR"` lines tied to your UID — zero tolerance.

**Rollback (DESTRUCTIVE):** If any test fails, STOP. Decide between (a) hotfix forward or (b) full rollback: `git checkout safety/pre-wave1b-2026-05-02`, restore Firestore from Step 2 backup if data corrupted, redeploy. Document the failure in the audit log.

**Estimated time:** 30-60 min.

---

### Step 11: Create Wave 12 reminder issue

**Pre-condition:** Step 10 all 9 tests passed.

**Command(s):**
```bash
cd /Users/nitishbhardwaj/Desktop/Glamornate
gh issue create \
  --title "[Wave 12] Delete Stripe webhook stub on 2026-05-16" \
  --body-file frontend/docs/runbooks/wave-12-stub-deletion.md \
  --milestone "2026-05-16"
```

**Expected output:**
```
https://github.com/<org>/glamornate/issues/<NNN>
```

**Verification:** Open the URL. Body is the full Wave 12 runbook; milestone is `2026-05-16`. If the milestone doesn't exist: `gh api repos/:owner/:repo/milestones -f title='2026-05-16' -f due_on='2026-05-16T00:00:00Z'`, then re-run.

**Rollback:** `gh issue close <NNN>` if duplicate.

**Estimated time:** 2 min.

---

### Step 12: On 2026-05-16 — delete Stripe webhook stub

**Pre-condition:** Calendar date on or after **2026-05-16**. Step 11 issue still open. Cloud Logging `function_name == "handleStripeWebhook"` shows ~zero hits over the last 24h.

**Command(s):** Follow [wave-12-stub-deletion.md](./wave-12-stub-deletion.md) end-to-end. Summary:

```bash
cd /Users/nitishbhardwaj/Desktop/Glamornate && git checkout feat/industry-overhaul && git pull
# Stripe Dashboard → Developers → Webhooks → delete Glamornate endpoint (manual UI)
firebase functions:secrets:destroy STRIPE_SECRET_KEY --project glamornate-758c6
firebase functions:secrets:destroy STRIPE_WEBHOOK_SECRET --project glamornate-758c6
rm backend/functions/src/events/handleStripeWebhook.ts
# Edit backend/functions/src/index.ts: remove handleStripeWebhook export + import
# Edit backend/functions/package.json: delete the `prebuild` script (STUB_EXPIRY_MS guard)
bash backend/scripts/deploy-functions.sh
git add -A
git commit -m "chore(booking): Phase 12 — final Stripe webhook stub deletion (14-day grace complete)"
git push origin feat/industry-overhaul
# Close Step 11 issue with the deploy SHA
```

**Expected output:**
```
Function handleStripeWebhook (deleted)
✓  Deploy complete.
```

**Verification:** `firebase functions:list --project glamornate-758c6 | grep handleStripeWebhook` prints nothing. Cloud Logging filter `resource.labels.function_name="handleStripeWebhook"` shows zero hits in the past hour.

**Rollback:** If deploy fails, `git revert HEAD`, restore secrets via `firebase functions:secrets:set` (stash values before destroying), recreate the Stripe Dashboard endpoint, redeploy. By 2026-05-16 retry traffic is near zero so rollback is mostly cosmetic.

**Estimated time:** 10 min.

---

## Reference runbooks

[stripe-removal](./stripe-removal-runbook.md) (Steps 1-8) · [wave-12](./wave-12-stub-deletion.md) (Step 12) · [android-app-check](./android-app-check.md) (Step 9 UUID) · [apk-smoke-checklist](./apk-smoke-checklist.md) (Steps 9-10) · [android-release-build](./android-release-build.md) · [verify-firestore-cache](./verify-firestore-cache.md) (Step 7).

---

## Final audit-trail entry

After Step 11, append to `frontend/docs/runbooks/booking-flow-fix-2026-05-02.md` Phase 0 decision log:

```
2026-05-02 <HH:MM> IST — Operator: Nitish
Steps 1-11 complete. Migration counts: paymentPendingCancelled=<N>, paymentFailedCancelled=<N>,
draftToConfirmed=<N>, draftToCancelled=<N>, errors=0.
Real-device tests T1-T9: all pass.
Wave 12 reminder issue: <URL>
Safety tag for rollback: safety/pre-wave1b-2026-05-02
```

The deploy is GO when this entry is committed.
