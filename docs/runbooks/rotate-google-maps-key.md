# Runbook — Rotating the Google Maps Geocoding API key

**Cadence:** every 90 days (or immediately if you suspect the key leaked).

**Why we rotate:** even with strong server-side restrictions, an API key
that sits in a single place forever eventually gets copied into a log,
a screenshot, a shared doc, or a support ticket. 90-day rotation caps
the blast radius of any such leak.

**Downtime:** zero if you follow the order below. The old key stays
live while the new key is provisioned, deployed, and verified, then
you revoke the old key last.

---

## Pre-flight

- [ ] You completed [google-maps-key-setup.md](./google-maps-key-setup.md).
- [ ] You have access to both Firebase (for Secret Manager) and Google
      Cloud Console (for the Credentials page).
- [ ] You're not rotating at a peak traffic window. Evening IST is
      safer than lunchtime.

---

## Rotation procedure

### Step 1 — Create the NEW key

1. Go to https://console.cloud.google.com/ → **APIs & Services →
   Credentials**.
2. Click **+ Create credentials → API key**.
3. Name it `glamornate-prod-geocoding-<yyyymmdd>` (use today's date).
4. Apply the **same** restrictions as the old key:
   - Application restrictions: **None**.
   - API restrictions: **Restrict key → Geocoding API only**.
5. Copy the new key value. Keep this tab open.

### Step 2 — Push the new key into Secret Manager as a NEW VERSION

Firebase Secret Manager keeps the last N versions of a secret. Setting
the secret again creates a new version; old versions stay available
for rollback until you explicitly destroy them.

```bash
cd backend/functions
firebase functions:secrets:set GOOGLE_MAPS_GEOCODING_KEY
```

Paste the NEW key when prompted. Firebase confirms with something like:

```
✔ Created a new secret version projects/.../secrets/GOOGLE_MAPS_GEOCODING_KEY/versions/<N>
```

Record the version number (`<N>`) — you'll want it in Step 5 if you
have to roll back.

### Step 3 — Redeploy the function so it picks up the new version

```bash
firebase deploy --only functions:reverseGeocode
```

The function now reads the new key. The OLD key is still valid inside
Google Cloud — it hasn't been deleted yet — so even if this deploy
partially fails, requests keep working.

### Step 4 — Smoke test

1. On a real device, tap **"Use current location"** in the app.
2. Confirm an address appears within ~2 s.
3. In the Cloud Function logs, look for `geocode resolved via google`.
4. In the Google Cloud Console → **APIs & Services → Credentials**,
   find the NEW key. Under "Usage", you should see request counts
   tick up. The OLD key should be idle.

If the new key is failing:

- Go to Step 5, roll back, investigate, then try again.

### Step 5 — (Only if Step 4 failed) Roll back

```bash
firebase functions:secrets:access GOOGLE_MAPS_GEOCODING_KEY@<N-1>
# Copy the OLD key value (version N-1).
firebase functions:secrets:set GOOGLE_MAPS_GEOCODING_KEY
# Paste the old key.
firebase deploy --only functions:reverseGeocode
```

Then investigate what's wrong with the new key (Step 1 restrictions?
Wrong project selected?) and restart the rotation.

### Step 6 — Revoke the OLD key

Once you've verified the new key is serving all traffic for at least
30 minutes:

1. Back in **APIs & Services → Credentials**, find the OLD key
   (`glamornate-prod-geocoding-<previous-date>`).
2. Click the trash icon.
3. Confirm deletion.

### Step 7 — Clean up stale Secret Manager versions (optional)

After another 7 days of uneventful production traffic:

```bash
firebase functions:secrets:destroy GOOGLE_MAPS_GEOCODING_KEY@<N-1>
```

This destroys the old secret version. The current (new) version is
unaffected. Keeping the last 2 versions is a reasonable balance
between rollback safety and least-privilege.

---

## Emergency rotation (suspected leak)

If you suspect the key was exposed (accidentally committed, posted to
Slack, dumped into a log), do this INSTEAD of the normal flow:

1. **First**, go to Google Cloud Console and delete the exposed key.
   Every request in flight will start failing.
2. Then do Steps 1-3 above to provision and deploy a replacement.
3. In the Cloud Functions logs, audit the hour leading up to the
   deletion for any anomalous request patterns — if traffic spiked or
   came from unexpected user agents, treat that as a separate incident.
4. Write an incident note (date, symptom, scope, how you found it) so
   the 90-day cadence recovers from this point.

---

## Checklist summary

- [ ] New key created with same restrictions as old key
- [ ] New key stored in Secret Manager (new version)
- [ ] `reverseGeocode` function redeployed
- [ ] Smoke test passed on a real device
- [ ] Old key shows zero traffic in Cloud Console for 30+ minutes
- [ ] Old key deleted from Google Cloud Console
- [ ] (After 7 days) old Secret Manager version destroyed
