# Emulator GPS Testing — Glamornate Capacitor App

## TL;DR

**Android emulators have no real GPS.** They report only what `adb emu geo fix` sets. Your host Mac's location is irrelevant. If "Use current location" returns "Jammu" on an emulator, that's because someone set Jammu via `adb`, not because of a Maps key issue.

## Why this matters

Operators have flagged "the app picks a random location, not my real one" — this is expected emulator behavior, not a bug. The emulator's geolocation HAL ignores the host machine entirely.

## How to set the emulator's location

### Option A — adb command (fastest)

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

# Format: adb -s <emulator-id> emu geo fix <longitude> <latitude>
# Note: longitude FIRST, then latitude.

# Jammu (the default Glamornate spa location):
adb -s emulator-5554 emu geo fix 74.86 32.73

# Mumbai:
adb -s emulator-5554 emu geo fix 72.8777 19.0760

# Bengaluru:
adb -s emulator-5554 emu geo fix 77.5946 12.9716
```

### Option B — Android Studio Extended Controls (visual)

1. Click the `⋯` (three dots) button on the emulator window.
2. **Location** tab.
3. Search a place name OR enter lat/lon directly.
4. Click **Send**.

## Verifying the emulator received the fix

Watch logcat for the geolocation callback:

```bash
adb -s emulator-5554 logcat -d | grep -iE "coords.*latitude|requestPos|Native geolocation"
```

A successful fix logs something like:

```
Capacitor/Console: Msg: {"timestamp":..., "coords":{"latitude":32.7299983,"longitude":74.8599983,"accuracy":5,...}}
```

## Granting location permission to the app (one-time per install)

If "Use current location" silently does nothing on a fresh install, the OS permission dialog may have been dismissed. Force-grant via adb:

```bash
adb -s emulator-5554 shell pm grant com.glamornate.app android.permission.ACCESS_FINE_LOCATION
adb -s emulator-5554 shell pm grant com.glamornate.app android.permission.ACCESS_COARSE_LOCATION
```

## Reverse-geocode separation

The address text shown in the bottom sheet ("Jammu — General Bus Stand…") comes from a server-side `reverseGeocode` Cloud Function in `us-central1` that uses the `GOOGLE_MAPS_GEOCODING_KEY` Secret Manager secret — **NOT** the client-side `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

Therefore:

- A wrong/missing client `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` does **NOT** cause wrong reverse-geocoded addresses.
- A wrong reverse-geocoded address means either (a) the emulator is sending wrong coords, or (b) the Cloud Function's `GOOGLE_MAPS_GEOCODING_KEY` secret is misconfigured.

The client key is only used for: Maps JS rendering, Places autocomplete, draggable map pin.

## Testing real-device GPS

To test against your actual location, install the APK on a real Android phone:

```bash
adb devices                                    # confirm phone is connected
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Real-device GPS is the only way to verify the geolocation flow against your actual coordinates. Emulator testing only proves the code path works against a known mock fix.

## Related

- `frontend/src/lib/location/capacitor-bridge.ts` — `requestPositionWithFallback` 3-step chain (last-known → coarse → high-accuracy).
- `frontend/src/lib/geolocation.ts` — `requestCoords` wrapper wired to the fallback chain.
- `frontend/docs/runbooks/google-maps-client-key-restrictions.md` — client API key Android-package + SHA-1 restrictions.
- `frontend/docs/runbooks/google-maps-key-setup.md` — server-side `GOOGLE_MAPS_GEOCODING_KEY` setup.
