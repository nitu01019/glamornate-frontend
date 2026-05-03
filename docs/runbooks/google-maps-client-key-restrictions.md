# Google Maps client-side API key — restrictions runbook

**Last updated:** 2026-04-30

This runbook covers the **client-side Maps JavaScript API key** shipped in the
Glamornate APK bundle (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`). The **backend
Geocoding key** is a separate key with different restriction needs — see
`google-maps-key-setup.md` and `rotate-google-maps-key.md` for that one.

The two keys are intentionally kept separate:

- The client-side key is bundled into the APK and visible to anyone who
  decompiles the app. Restrict it tightly to limit abuse.
- The backend key never leaves Cloud Functions and should never be placed in
  any `.env.*` file that gets bundled into the app.

---

## Operator URL

https://console.cloud.google.com/apis/credentials?project=glamornate-758c6

Navigate to: **APIs & Services → Credentials** → click the key named
`glamornate-client-maps-js` (or create it following the steps below if it
does not yet exist).

---

## Step 1 — Enable the required APIs

Before creating or restricting the key, ensure both APIs are enabled on the
project:

1. Go to **APIs & Services → Library**.
2. Search for and enable **Maps JavaScript API**.
3. Search for and enable **Places API**.
4. Do NOT enable Geocoding API, Distance Matrix API, Routes API, or any
   other Maps API — those belong to the backend key only.

---

## Step 2 — Create the client-side key (first-time setup only)

If a client-side Maps JS key already exists, skip to Step 3.

1. **APIs & Services → Credentials → + Create credentials → API key**.
2. A dialog appears. Click **Edit API key** before copying the key value.
3. Rename it to `glamornate-client-maps-js`.
4. Continue to Step 3 to apply restrictions before copying the key.

---

## Step 3 — Application restrictions (Android key)

Under the **Application restrictions** section, choose **Android apps**.

Click **Add an item** and enter both rows:

| Package name | SHA-1 certificate fingerprint |
|---|---|
| `com.glamornate.app` | `66:D2:05:5E:DC:F4:85:3E:E5:78:BA:12:51:7F:36:ED:85:A2:DE:3B` |
| `com.glamornate.app` | `00:1B:39:1D:2D:1A:B6:3B:C2:0B:92:64:2C:8C:11:2C:51:58:50:32` |

The first fingerprint covers **debug and stagingRelease builds** (signed with
the debug keystore). The second covers **production release builds** (signed
with `android/app/glamornate-upload.keystore`). Both are required so that
developer devices and the Play Store binary can both load the map.

See `android-app-check.md` (SHA fingerprint registry section) for the
authoritative source of these values.

---

## Step 4 — Application restrictions (web domains)

If the same key is also used for the web build (when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
is set for a web deployment), add HTTP referrer restrictions in addition to
the Android entries:

1. Under **Application restrictions**, select **HTTP referrers (web sites)**.
2. Add `*.glamornate.com/*`.
3. Add any staging/preview domains (e.g., `*.vercel.app/*`) during
   development, and remove them before going to production.

If this key is used for Android only (no web deployment), leave only the
Android restriction and skip this step.

---

## Step 5 — API restrictions

Under the **API restrictions** section, choose **Restrict key**.

From the dropdown, select **only**:

- Maps JavaScript API
- Places API

Do NOT add:

- Geocoding API — handled by the backend key, never by the client
- Distance Matrix API — backend only
- Routes API — backend only
- Any other API

Rationale: the client-side key is exposed in the APK bundle. Restricting it
to the two APIs the client actually calls (Maps JS for rendering, Places for
autocomplete) limits the blast radius if the key is extracted and misused.

---

## Step 6 — Save and copy the key

1. Click **Save**.
2. Click **Copy** to get the key value.
3. Add it to `frontend/.env.mobile` and `frontend/.env.local` (and any
   other `.env.*` files used by the mobile build):

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
```

4. Rebuild the APK so the new key value is bundled in at build time.

---

## Propagation delay

GCP can take up to 5 minutes to propagate restriction changes. Re-test in
the APK only after waiting the full 5 minutes.

---

## Symptom table — 403 / map failures

| Symptom | Cause | Fix |
|---|---|---|
| `RefererNotAllowedMapError` in browser console | HTTP referrer restriction is too strict (e.g., allows `https://glamornate.com` exactly but not `*.glamornate.com/*`) | Edit referrer restrictions; add wildcards or the specific origin |
| `REQUEST_DENIED` (403) on Maps JS load in APK | Either: (a) Android package + SHA combo not in restrictions list; (b) Maps JavaScript API not enabled on GCP project; (c) billing not enabled | Verify SHA-1 fingerprint matches the installed APK's signing keystore; check API enablement; check GCP billing |
| Blank map, no console error | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is an empty string or undefined at build time, OR a silent network-layer block | Check that the env var is set in `.env.mobile` and is present at the time the APK was built (it must be baked in at `next build`, not supplied at runtime) |
| `ApiNotActivatedMapError` | Maps JavaScript API was never enabled on this project | APIs & Services → Library → enable Maps JavaScript API |
| `OverQuotaMapError` | Daily quota exceeded | Increase quota in GCP, or check for an accidental API call loop |
| Map loads in browser but not in APK | Android application restriction missing the SHA-1 for the installed build type | Add the correct SHA-1 row in Step 3; wait 5 min for propagation |

---

## Verifying the SHA-1 fingerprint of an installed APK

If a `REQUEST_DENIED` error persists after adding the fingerprints and
waiting 5 minutes, verify the actual fingerprint baked into the installed APK:

```bash
# Using apksigner (preferred, part of Android build tools):
apksigner verify --print-certs path/to/app.apk

# Using keytool as an alternative:
keytool -printcert -jarfile path/to/app.apk
```

Compare the `SHA1` line in the output against the SHA-1 you added to GCP.
Any mismatch — including a colon-vs-no-colon formatting difference — will
cause the restriction to not match.

For debug and stagingRelease builds, the signing fingerprint comes from the
debug keystore at `~/.android/debug.keystore`. For release builds, it comes
from `android/app/glamornate-upload.keystore`.

---

## Distinction: client-side Maps JS key vs backend Geocoding key

| | Client-side Maps JS key | Backend Geocoding key |
|---|---|---|
| Env var name | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `GOOGLE_MAPS_GEOCODING_KEY` (Secret Manager) |
| Where it lives | APK bundle, baked in at `next build` | Cloud Functions runtime, never in the APK |
| Application restriction | Android apps (package + SHA-1) + HTTP referrers | None (Functions egress IPs rotate; IP allowlist would break) |
| API restriction | Maps JavaScript API, Places API | Geocoding API only |
| Visible to end users | Yes — extractable from the APK | No |
| Rotation | Build-time: update env var, rebuild APK | Runtime: `firebase functions:secrets:set GOOGLE_MAPS_GEOCODING_KEY` |
| Setup runbook | This file | `google-maps-key-setup.md` |
| Rotation runbook | Repeat Steps 3-6 above with a new key | `rotate-google-maps-key.md` |

If a 403 affects only the in-app map rendering (blank map or `REQUEST_DENIED`
in the WebView console), the issue is the client-side key. If both the map
and address-lookup (reverse geocode) fail simultaneously, check GCP billing
and API enablement at the project level — that affects both keys.

---

## Related runbooks

- `android-app-check.md` — SHA fingerprint registry (canonical source of
  the SHA-1 values used in Step 3)
- `google-maps-key-setup.md` — one-time setup for the backend Geocoding key
- `rotate-google-maps-key.md` — 90-day rotation for the backend Geocoding key
- `android-keystore-setup.md` — how the signing keystores themselves were
  created and where they are stored
