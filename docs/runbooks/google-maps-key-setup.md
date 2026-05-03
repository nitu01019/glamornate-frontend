# Runbook — Setting up the Google Maps Geocoding API key

**When to run this:** once, the first time you want the "Use current
location" button in the app to resolve real addresses.

**How long it takes:** ~15 minutes end-to-end (most of it is waiting for
Google Cloud to provision the API + your Firebase deploy).

**Who should run it:** the account owner for the Firebase project
`glamornate-758c6` (or whoever has both Firebase Admin and Google Cloud
Billing roles).

**What this costs:** Google charges roughly $5 per 1,000 Geocoding
requests after the $200/month free credit. With the 24-hour Firestore
cache we ship by default, most users cost $0 and a very active city
cluster costs cents per month. We also cap daily quota in Step 5 below.

Until this runbook is completed the app degrades gracefully: the
"Use current location" button still works as a UX trigger, but the
backend returns `geocode/not-configured` and the UI invites the user to
type their address manually. Nothing crashes.

---

## Checklist (follow in order)

### 1. Open the Google Cloud Console for the Firebase project

1. Go to https://console.cloud.google.com/.
2. In the project picker at the top, select the project that owns the
   Firebase project `glamornate-758c6`. (If you don't see it, ask
   whoever set up Firebase — Firebase projects automatically have a
   matching Google Cloud project.)

### 2. Enable the Geocoding API

1. In the left sidebar go to **APIs & Services → Library**.
2. Search for "Geocoding API".
3. Click the result and press the blue **Enable** button.
4. Wait for the green "API enabled" confirmation.

> **Do NOT enable Places API, Maps JavaScript API, or anything else.**
> We want the smallest possible attack surface. If you later add address
> autocomplete you'll create a *separate* key for Places with its own
> restrictions.

### 3. Create the API key

1. **APIs & Services → Credentials**.
2. Click **+ Create credentials → API key**.
3. A dialog appears with the new key. Click **Edit API key** (do NOT
   copy it yet — we'll restrict it first, then copy).
4. Rename it to **`glamornate-prod-geocoding`** so it's easy to find
   later.

### 4. Restrict the key (CRITICAL)

Still in the Edit API key dialog:

1. Under **Application restrictions**, leave **None** selected.
   - Rationale: the key is called from Firebase Functions. Functions'
     egress IPs rotate, so an IP allowlist would constantly break.
     Don't use HTTP referrers either — Cloud Functions has no referrer.
2. Under **API restrictions**, select **Restrict key**.
3. From the dropdown pick **only** `Geocoding API`. No other API.
4. Click **Save**.
5. Copy the key to your clipboard. Keep this tab open.

### 5. Set a daily quota (cost cap)

1. **APIs & Services → Geocoding API → Quotas**.
2. Find `Requests per day`.
3. Click the pencil icon and set it to **10,000** (adjust up later if
   needed).
4. Click **Save**.

### 6. Configure billing alerts

1. **Billing → Budgets & alerts → Create budget**.
2. Name: `glamornate-maps-monthly`.
3. Budget amount: ₹2,500 (or your local equivalent).
4. Actions: email alerts at 50%, 90%, 100%.
5. Scope: specifically the **Geocoding API** service so spa features'
   unrelated spend doesn't trip it.
6. Click **Finish**.

### 7. Store the key in Firebase Secret Manager

Open a terminal inside the repo:

```bash
cd backend/functions
firebase functions:secrets:set GOOGLE_MAPS_GEOCODING_KEY
```

Firebase prompts for the value — paste the key you copied in Step 4.5.
Firebase stores it in Google Secret Manager (NOT in `firebase
functions:config:set` — legacy `functions.config()` is deprecated).

### 8. Deploy the `reverseGeocode` Cloud Function

```bash
firebase deploy --only functions:reverseGeocode
```

Wait for the deploy to finish. The function pulls the secret at
startup; no other wiring is needed.

### 9. Smoke test on a real device

1. Open the Android app (or the web version, your choice).
2. Tap the location chip at the top.
3. In the sheet, tap **"Use current location"**.
4. Grant the permission prompt.
5. Within ~2 seconds the chip should update to a real street-level
   address.

If you see the friendly "Location service is not set up yet. Please
enter your address manually below." toast, the function is still
failing to read the secret. Re-run Step 7 and confirm the deploy in
Step 8 completed successfully.

### 10. Monitor for the first 24 hours

1. **Google Cloud → APIs & Services → Geocoding API → Metrics**.
2. Watch requests/min and error rate.
3. **Firebase Console → Functions → `reverseGeocode` → Logs**.
4. Confirm you see lines like `geocode resolved via google` — and no
   `geocode/not-configured` warnings.

---

## If something goes wrong

| Symptom | Most likely cause | Fix |
|---------|-------------------|-----|
| UI shows "Location service is not set up yet" | Secret not deployed | Re-run Step 7, then Step 8 |
| Logs show `geocode/request-denied` | Key restriction too strict OR Geocoding API not enabled on this project | Re-check Steps 2 and 4 |
| Logs show `geocode/quota` | Daily cap hit | Step 5 — raise the quota, or wait 24 h |
| Everything looks right but requests still fail | Wrong Google Cloud project selected | Go back to Step 1 |

---

## Key rotation

Google recommends rotating API keys every 90 days. Follow
[rotate-google-maps-key.md](./rotate-google-maps-key.md) when that time
comes around.
