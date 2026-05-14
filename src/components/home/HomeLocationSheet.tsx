'use client';

/**
 * HomeLocationSheet
 * -----------------
 * Bottom-sheet launched from `HomeLocationRow` when the user taps the
 * location block. Three sections, top-to-bottom (per design review F6):
 *
 *   1. "Use current location"     — GPS via Capacitor (native) / browser.
 *   2. "Your saved addresses"     — live Firestore list; tap to promote.
 *   3. "Manage addresses"         — deep-links to /customer/addresses.
 *
 * All three selection paths converge: a successful pick writes to the
 * Firestore addresses subcollection (via useAddresses callables) AND
 * mirrors to the in-memory location-provider so marketplace consumers
 * (spas-by-city, MostBookedSection, LocationHeader) stay in sync.
 *
 * Accessibility:
 *   - `aria-modal="true"` dialog semantics via Radix primitives.
 *   - Focus trap + Escape close provided by Radix.
 *   - First focusable element on open is the GPS row.
 *   - Backdrop click and swipe-down translate to onClose.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Briefcase, Home, MapPin, Navigation, Pencil, Plus, Tag, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-provider';
import { useLocation } from '@/lib/location-provider';
import { DETECTED_PHONE_SENTINEL, type SavedAddress, type AddressLabel } from '@/types';
import { useAddresses } from '@/lib/addresses/use-addresses';
import { useCurrentLocation } from '@/lib/location/hooks/useCurrentLocation';
import { LocationPulse } from '@/components/location/LocationPulse';
import { LocationRationaleModal } from '@/components/location/LocationRationaleModal';
import { formatDateIST } from '@/lib/date-ist';
import { cn } from '@/lib/utils';
import AddressSheetManualForm from '@/components/home/AddressSheetManualForm';
import { APIProviderRoot } from '@/components/maps/APIProviderRoot';
import PlaceAutocompleteInput, {
  type PickedLocation,
} from '@/components/maps/PlaceAutocompleteInput';
import { Button } from '@/components/ui/button';
import { useToastActions } from '@/lib/providers';

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface HomeLocationSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MANAGE_ADDRESSES_HREF = '/customer/addresses';

const LABEL_CONFIG: Record<
  AddressLabel,
  { icon: typeof Home; label: string; accentClass: string }
> = {
  home: { icon: Home, label: 'Home', accentClass: 'text-brand-maroon-500' },
  work: { icon: Briefcase, label: 'Work', accentClass: 'text-brand-maroon-500' },
  other: { icon: Tag, label: 'Other', accentClass: 'text-gray-500' },
  // GPS auto-save entry — never created by manual flows; written by the
  // home sheet's "Use current location" path and pruned on next detect.
  detected: { icon: Navigation, label: 'Detected', accentClass: 'text-brand-maroon-500' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sentinel phone shared with the backend Zod schema — see
 * `@/types`'s `DETECTED_PHONE_SENTINEL`. The backend enforces that ONLY a
 * `label === 'detected'` address may carry this value; UI surfaces detect
 * it and render a friendlier "GPS detected · tap to use" line instead of
 * the literal digits.
 */
export function isDetectedSentinelPhone(phone: string): boolean {
  return phone === DETECTED_PHONE_SENTINEL;
}

function formatAddressSubtitle(a: SavedAddress): string {
  if (a.label === 'detected' && isDetectedSentinelPhone(a.phone)) {
    return [a.flatHouse, a.street, a.city, a.pincode]
      .map((segment) => segment?.trim())
      .filter((segment): segment is string => Boolean(segment && segment.length > 0))
      .join(', ');
  }
  return [a.flatHouse, a.street, a.landmark, a.city, a.pincode]
    .map((segment) => segment?.trim())
    .filter((segment): segment is string => Boolean(segment && segment.length > 0))
    .join(', ');
}

function primaryAddressLine(a: SavedAddress): string {
  const label = LABEL_CONFIG[a.label].label;
  return a.city ? `${label} · ${a.city}` : label;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type WriteStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pending'; readonly target: 'gps' | 'address'; readonly id?: string }
  | { readonly kind: 'error'; readonly message: string };

export default function HomeLocationSheet({ open, onClose }: HomeLocationSheetProps): JSX.Element {
  const locationCtx = useLocation();
  const { firebaseUser } = useAuth();

  // v3 (2026-05-13 — location unification): subcollection-backed addresses
  // via the modern callable surface. `migrationState` lets the empty-state
  // branch render a manual-entry form when the legacy→subcollection
  // migration errored out, so the user is never stranded.
  const {
    addresses,
    isLoading: addressesLoading,
    addAddress,
    setDefaultAddress,
    deleteAddress,
    migrationState,
  } = useAddresses();

  // The canonical live-location hook. The home sheet drives it through
  // `handleGps` and reacts to its state in `useEffect` below.
  const loc = useCurrentLocation();

  const currentDefault = useMemo<SavedAddress | null>(
    () => addresses.find((a) => a.isDefault) ?? null,
    [addresses],
  );

  const [writeStatus, setWriteStatus] = useState<WriteStatus>({ kind: 'idle' });
  const [manualOpen, setManualOpen] = useState<boolean>(false);
  // Inline save prompt after a Places autocomplete pick. When non-null, the
  // save card renders below the search input asking the user to label and
  // persist the typed address to Firestore (Swiggy/Uber pattern).
  const [pendingPlace, setPendingPlace] = useState<PickedLocation | null>(null);
  const [pendingLabel, setPendingLabel] = useState<'home' | 'work' | 'other'>('home');
  // Re-entry guard: prevents the auto-save effect from firing twice when
  // `loc.status` transitions through intermediate values.
  const gpsCommitFiredRef = useRef<boolean>(false);
  const gpsButtonRef = useRef<HTMLButtonElement>(null);
  const toast = useToastActions();
  const savePromptHeadingId = useId();

  // Android hardware back-button parity with the existing LocationPicker.
  // Layered: if the manual form is open, back closes it first.
  useEffect(() => {
    if (!open) return;
    const handler = (event: Event): void => {
      event.preventDefault();
      if (manualOpen) {
        setManualOpen(false);
        return;
      }
      onClose();
    };
    window.addEventListener('glamornate:back-button', handler);
    return () => window.removeEventListener('glamornate:back-button', handler);
  }, [open, onClose, manualOpen]);

  // Reset transient state whenever the sheet opens/closes. Radix keeps the
  // component mounted while animating, so without this `pendingPlace` would
  // leak across opens and re-show a stale save card.
  useEffect(() => {
    if (!open) {
      setWriteStatus({ kind: 'idle' });
      setManualOpen(false);
      setPendingPlace(null);
      setPendingLabel('home');
      gpsCommitFiredRef.current = false;
    }
  }, [open]);

  const openManualForm = useCallback(() => {
    setManualOpen(true);
  }, []);

  const closeManualForm = useCallback(() => {
    setManualOpen(false);
  }, []);

  const handleManualSaved = useCallback(() => {
    // The manual form already called `addAddress` + `setDefaultAddress`
    // internally and synced the in-memory provider. Just dismiss the sheet.
    setManualOpen(false);
    onClose();
  }, [onClose]);

  // -----------------------------------------------------------------------
  // GPS path (v4 — 2026-05-14): tap the radar-pulse row → useCurrentLocation
  // runs the canonical bridge + reverseGeocode pipeline → SILENT auto-save
  // as a `'detected'` address (no manual form, no name/phone prompt). The
  // home address bar updates via the provider mirror and the sheet closes.
  // Older `'detected'` entries are auto-pruned so the saved list keeps a
  // single "Detected (Today HH:MM)" snapshot at most.
  // -----------------------------------------------------------------------
  const handleGps = useCallback(() => {
    // Abandon any pending typed pick — user is actively choosing GPS instead.
    setPendingPlace(null);
    setWriteStatus({ kind: 'pending', target: 'gps' });
    gpsCommitFiredRef.current = false;
    // Opportunistic: cache-hit within 60 s closes the sheet instantly via
    // the success effect below; otherwise falls through to the full bridge.
    void loc.refreshOpportunistic();
  }, [loc]);

  // React to the hook's state machine. Effect fires when status / address /
  // coords / error / rationale change. Guarded by `gpsCommitFiredRef` and
  // `writeStatus` so we only act once per tap.
  useEffect(() => {
    if (writeStatus.kind !== 'pending' || writeStatus.target !== 'gps') return;
    if (gpsCommitFiredRef.current) return;

    // Error branch — surface the typed code in the inline error pill.
    // We deliberately do NOT auto-open the manual form: that was the v3
    // behavior that the user found surprising. Manual entry is reached
    // via the explicit "Add a new address" CTA further down the sheet.
    if (loc.status === 'error' && loc.error) {
      gpsCommitFiredRef.current = true;
      const message =
        loc.error === 'permission-permanent'
          ? 'Location is turned off for this app. Open Settings to allow it.'
          : loc.error === 'permission-denied'
          ? 'Location permission denied. Tap again to retry.'
          : loc.error === 'quota'
          ? 'Too many requests — try again in a minute.'
          : loc.error === 'service-down'
          ? 'Location service is paused. Pick a saved address instead.'
          : loc.error === 'no-results'
          ? 'Could not resolve your address. Pick a saved address instead.'
          : loc.error === 'timeout'
          ? 'Location is taking too long. Tap again to retry.'
          : 'Could not detect your location. Tap again to retry.';
      setWriteStatus({ kind: 'error', message });
      return;
    }

    // Success branch — silent auto-save as a 'detected' entry. Sentinel
    // values cover the rare cases where reverseGeocode didn't return a
    // pincode or the user has no phone on file — the addAddress callable
    // still accepts the payload, and the UI hides phone display for
    // 'detected' entries with the sentinel value (`isDetectedSentinelPhone`).
    if (loc.status === 'success' && loc.address && loc.coords) {
      gpsCommitFiredRef.current = true;
      const addr = loc.address;
      const coords = loc.coords;
      const fbu = firebaseUser;

      const now = new Date();
      const hhmm = formatDateIST(now, 'HH:mm');
      const detectedName = fbu?.displayName
        ? `${fbu.displayName} (Detected ${hhmm})`
        : `Detected location (Today ${hhmm})`;

      void (async () => {
        try {
          // Red-team T-B6: the address-cap (MAX_ADDRESSES_PER_USER = 20)
          // collides with the post-T-A2(C) insert-first order. A user with
          // 19 saved + 1 prior 'detected' would hit the cap at insert
          // before reaching the prune step, and the catch block surfaces
          // the raw backend error.
          //
          // Branching rule:
          //   - If addresses.length < 20 → insert first, prune after
          //     (T-A2(C) snapshot-race ordering, the happy path).
          //   - If addresses.length >= 20 → prune stale 'detected' entries
          //     FIRST to free a slot, then insert. We're already at the
          //     cap so the snapshot-race flicker is moot (the bar will
          //     show the new entry once the insert lands; there's no old
          //     entry to flash against).
          //   - If addresses.length >= 20 AND no stale detected to prune,
          //     surface a clear "address limit reached" message instead
          //     of letting the user see the raw backend error code.
          const stale = addresses.filter((a) => a.label === 'detected');
          const ADDRESS_CAP = 20;
          const atCap = addresses.length >= ADDRESS_CAP;

          if (atCap) {
            if (stale.length === 0) {
              // No detected entry to prune — user is at limit with all
              // manual entries. We can't auto-save without exceeding the
              // cap. Surface a friendlier message than the raw callable
              // error.
              setWriteStatus({
                kind: 'error',
                message:
                  'You’ve saved the maximum 20 addresses. Remove one from Manage addresses to detect a new location.',
              });
              return;
            }
            // Prune-first path (rare): drop the existing detected entry
            // before inserting the new one so the cap doesn't reject us.
            try {
              await Promise.all(stale.map((a) => deleteAddress.mutateAsync({ addressId: a.id })));
            } catch (pruneErr) {
              const message =
                pruneErr instanceof Error ? pruneErr.message : 'Could not refresh your location';
              setWriteStatus({ kind: 'error', message });
              return;
            }
          }

          // Insert the new 'detected' entry. Backend auto-promotes the
          // first address to default; we never explicitly promote
          // 'detected' so saved Home/Work entries stay the user's pick.
          await addAddress.mutateAsync({
            label: 'detected',
            name: detectedName,
            phone: fbu?.phoneNumber || DETECTED_PHONE_SENTINEL,
            flatHouse: addr.line1 || '-',
            street: addr.line1 || addr.formatted,
            city: addr.city || 'Unknown',
            state: addr.state || 'Unknown',
            pincode: addr.pincode || '000000',
            isDefault: false,
            geo: { lat: coords.lat, lng: coords.lng },
          });

          // Mirror to the in-memory location provider IMMEDIATELY so
          // HomeLocationRow + marketplace consumers (spas-by-city,
          // MostBookedSection, LocationHeader) re-render with the new
          // locale even if the user navigates away before pruning.
          locationCtx.setLocation({
            lat: coords.lat,
            lng: coords.lng,
            city: addr.city || 'Detected',
            area: addr.line1 || addr.city || 'Current location',
            fullAddress: addr.formatted,
          });

          setWriteStatus({ kind: 'idle' });
          onClose();

          // Best-effort cleanup of any remaining stale 'detected' entries
          // (only reachable on the happy path when not-at-cap, since the
          // at-cap branch already pruned). Failure is swallowed — next
          // GPS tap retries the cleanup.
          if (!atCap && stale.length > 0) {
            try {
              await Promise.all(stale.map((a) => deleteAddress.mutateAsync({ addressId: a.id })));
            } catch {
              // Swallow — auto-prune is cleanup, not the success path.
            }
          }
        } catch (err) {
          // Save failed (network / rate-limit / addAddress validation).
          // Surface inline; do NOT open the manual form — user retries
          // explicitly or picks a saved address.
          const message = err instanceof Error ? err.message : 'Could not save your location';
          setWriteStatus({ kind: 'error', message });
        }
      })();
    }
  }, [
    writeStatus,
    loc.status,
    loc.error,
    loc.address,
    loc.coords,
    addresses,
    addAddress,
    deleteAddress,
    locationCtx,
    onClose,
    firebaseUser,
  ]);

  // -----------------------------------------------------------------------
  // Tap a saved address (v3): promote via callable, mirror to in-memory
  // LocationProvider so marketplace consumers (spas-by-city etc.) update.
  // No more legacy-array reader in `setActiveLocation('saved-address')`.
  // -----------------------------------------------------------------------
  const handleSelectAddress = useCallback(
    async (addressId: string) => {
      setWriteStatus({ kind: 'pending', target: 'address', id: addressId });
      try {
        const picked = addresses.find((a) => a.id === addressId);
        if (!picked) {
          throw new Error('Address not found');
        }
        await setDefaultAddress.mutateAsync({ addressId });
        locationCtx.setLocation({
          lat: picked.geo?.lat ?? 0,
          lng: picked.geo?.lng ?? 0,
          city: picked.city,
          area: picked.landmark || picked.street || picked.city,
          fullAddress: [
            picked.flatHouse,
            picked.street,
            picked.landmark,
            picked.city,
            picked.pincode,
          ]
            .map((segment) => segment?.trim())
            .filter((segment): segment is string => Boolean(segment && segment.length > 0))
            .join(', '),
        });
        setWriteStatus({ kind: 'idle' });
        onClose();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not update your location';
        setWriteStatus({ kind: 'error', message });
      }
    },
    [addresses, setDefaultAddress, locationCtx, onClose],
  );

  // -----------------------------------------------------------------------
  // Places autocomplete pick — commits the picked location to the in-memory
  // LocationProvider immediately (so the home chip shows the real city) and
  // then surfaces an inline "Save this address?" card asking the user to
  // label and persist the entry to Firestore. The sheet does NOT close on
  // pick — user must Save (writes to Firestore) or × (keeps location, no
  // write). This mirrors Swiggy / Uber where a typed pick is "already
  // selected" but explicitly saved with a label.
  //
  // city comes from Google's parsed addressComponents (locality →
  // administrative_area_level_2 → sublocality fallback). Final fallback
  // 'Other' if Google omits all city-like fields. Never the literal
  // 'Custom' that the v2 code used.
  // -----------------------------------------------------------------------
  const handlePlacePick = useCallback(
    (pick: PickedLocation): void => {
      locationCtx.setLocation({
        lat: pick.coords.lat,
        lng: pick.coords.lng,
        city: pick.city ?? 'Other',
        area: pick.addressText,
        fullAddress: pick.addressText,
      });
      setPendingPlace(pick);
      setPendingLabel('home');
      // Intentional: do NOT call onClose() — the inline save card stays open
      // for the user to label + save, or dismiss via ×.
    },
    [locationCtx],
  );

  const handleSavePending = useCallback(async (): Promise<void> => {
    if (!pendingPlace) return;
    try {
      await addAddress.mutateAsync({
        label: pendingLabel,
        name: firebaseUser?.displayName ?? '',
        phone: firebaseUser?.phoneNumber ?? '',
        flatHouse: '',
        street: pendingPlace.addressText,
        city: pendingPlace.city ?? 'Other',
        state: pendingPlace.state ?? '',
        pincode: pendingPlace.postalCode ?? '',
        isDefault: true,
        geo: {
          lat: pendingPlace.coords.lat,
          lng: pendingPlace.coords.lng,
          accuracy: pendingPlace.coords.accuracy,
        },
      });
      toast.success('Address saved');
      setPendingPlace(null);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/maximum/i.test(msg) || /\b20\b/.test(msg) || /cap/i.test(msg)) {
        toast.error(
          'Address limit reached',
          "You've saved 20 addresses. Remove one to add another.",
        );
      } else {
        toast.error('Could not save address', 'Try again in a moment');
      }
    }
  }, [pendingPlace, pendingLabel, addAddress, firebaseUser, toast, onClose]);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-testid="home-location-sheet-overlay"
          className={cn(
            'fixed inset-0 z-[60] bg-black/50',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        />
        <DialogPrimitive.Content
          data-testid="home-location-sheet"
          aria-modal="true"
          onOpenAutoFocus={(event) => {
            // Route the initial focus to the GPS row, not Radix's default
            // first-focusable (which would be the close button).
            event.preventDefault();
            gpsButtonRef.current?.focus();
          }}
          className={cn(
            'fixed inset-x-0 bottom-0 z-[70]',
            'flex flex-col',
            'bg-white rounded-t-2xl shadow-2xl',
            'max-h-[80vh] overflow-hidden',
            'focus:outline-none',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-full',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-full',
            'duration-300 ease-out',
          )}
        >
          {/* APIProviderRoot scopes the Google Maps SDK to this sheet only.
              Home page lives outside /customer/ so there is no parent
              <APIProvider> to clash with. APIProviderRoot no-ops if the
              public key is missing; the SDK is only fetched when the
              sheet actually opens (next/dynamic ssr:false). */}
          <APIProviderRoot>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div
                aria-hidden="true"
                className="w-10 h-1 rounded-full bg-gray-300"
                data-testid="home-location-sheet-handle"
              />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 flex-shrink-0">
              <DialogPrimitive.Title className="text-lg font-semibold text-gray-900">
                Choose location
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500"
                aria-label="Close location sheet"
              >
                <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>

            <DialogPrimitive.Description className="sr-only">
              Choose a saved address, use your current GPS location, or manage your saved addresses.
            </DialogPrimitive.Description>

            {/* Scroll region */}
            <div className="overflow-y-auto px-4 pb-6 flex-1">
              {/* 1. GPS row — v3: routes through useCurrentLocation; the radar
                pulse renders during fetching so the user knows we're
                pinpointing. Visual layout (border, padding, copy hierarchy)
                is unchanged from v2. */}
              <button
                ref={gpsButtonRef}
                type="button"
                data-testid="home-location-sheet-gps"
                onClick={handleGps}
                disabled={writeStatus.kind === 'pending' || loc.status === 'fetching'}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl',
                  'border border-brand-maroon-200 bg-brand-maroon-50/50',
                  'hover:bg-brand-maroon-50 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                  'text-left',
                )}
              >
                {loc.status === 'fetching' ? (
                  <LocationPulse size="sm" ariaLabel="Detecting your location" />
                ) : (
                  <Navigation
                    className="w-5 h-5 text-brand-maroon-500 flex-shrink-0"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-brand-maroon-700">
                    {loc.status === 'fetching' ||
                    (writeStatus.kind === 'pending' && writeStatus.target === 'gps')
                      ? 'Detecting location…'
                      : 'Use current location'}
                  </p>
                </div>
              </button>

              {writeStatus.kind === 'error' && (
                <p
                  role="alert"
                  data-testid="home-location-sheet-error"
                  className="mt-2 text-xs text-red-600"
                >
                  {writeStatus.message}
                </p>
              )}

              {/* 1b. Places-search input — same Google Places autocomplete
                that the booking flow uses (BookingLocationStep). On pick we
                commit to the in-memory LocationProvider AND surface the
                inline save card below so the user can persist the typed
                address to Firestore with a Home / Work / Other label. */}
              <div className="mt-4" data-testid="home-location-sheet-place-search">
                <PlaceAutocompleteInput onPick={handlePlacePick} placeholder="Search an address" />
              </div>

              {pendingPlace && (
                <div
                  role="group"
                  aria-labelledby={savePromptHeadingId}
                  data-testid="home-location-sheet-save-prompt"
                  className="mt-4 rounded-xl border border-brand-maroon-200 bg-brand-maroon-50/40 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        id={savePromptHeadingId}
                        className="text-sm font-semibold text-brand-maroon-700"
                      >
                        Save this address?
                      </p>
                      <p className="mt-0.5 truncate text-xs text-gray-600">
                        {pendingPlace.addressText}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingPlace(null)}
                      className="-m-2 rounded-full p-2 text-gray-500 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500"
                      aria-label="Dismiss save prompt"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(['home', 'work', 'other'] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setPendingLabel(l)}
                        aria-pressed={pendingLabel === l}
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500',
                          pendingLabel === l
                            ? 'bg-brand-maroon-500 text-white border-brand-maroon-500'
                            : 'bg-white text-gray-700 border-gray-300',
                        )}
                      >
                        {l[0].toUpperCase() + l.slice(1)}
                      </button>
                    ))}
                  </div>
                  <Button
                    onClick={handleSavePending}
                    disabled={addAddress.isPending}
                    className="mt-3 w-full"
                    data-testid="home-location-sheet-save-confirm"
                  >
                    {addAddress.isPending ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              )}

              {/* 2. Saved addresses — v3: if migration errored AND we have no
                addresses to render, drop the user straight into the manual
                form so they're never stranded staring at an empty list. */}
              <div className="mt-4">
                {migrationState === 'errored' && addresses.length === 0 ? (
                  <EmptyAddressesBlock onAddManually={openManualForm} />
                ) : addressesLoading ? (
                  <SavedAddressesSkeleton />
                ) : addresses.length === 0 ? (
                  <EmptyAddressesBlock onAddManually={openManualForm} />
                ) : (
                  <>
                    <h3
                      data-testid="home-location-sheet-saved-heading"
                      className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2"
                    >
                      Your saved addresses
                    </h3>
                    <ul className="space-y-2">
                      {addresses.map((addr) => {
                        const config = LABEL_CONFIG[addr.label];
                        const LabelIcon = config.icon;
                        const isActive = currentDefault?.id === addr.id;
                        const isPending =
                          writeStatus.kind === 'pending' &&
                          writeStatus.target === 'address' &&
                          writeStatus.id === addr.id;
                        const subtitle = formatAddressSubtitle(addr);
                        return (
                          <li key={addr.id}>
                            <button
                              type="button"
                              data-testid={`home-location-sheet-address-${addr.id}`}
                              onClick={() => handleSelectAddress(addr.id)}
                              disabled={writeStatus.kind === 'pending'}
                              aria-pressed={isActive}
                              className={cn(
                                'w-full flex items-start gap-3 px-4 py-3 rounded-xl text-left',
                                'border border-gray-200 bg-white hover:bg-gray-50',
                                'transition-colors',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500',
                                'disabled:opacity-60 disabled:cursor-not-allowed',
                                isActive && 'border-brand-maroon-300 bg-brand-maroon-50/40',
                              )}
                            >
                              <LabelIcon
                                className={cn('w-5 h-5 flex-shrink-0 mt-0.5', config.accentClass)}
                                aria-hidden="true"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-gray-900 truncate">
                                  {primaryAddressLine(addr)}
                                </p>
                                {subtitle.length > 0 && (
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                    {subtitle}
                                  </p>
                                )}
                              </div>
                              {isPending && (
                                <span
                                  aria-hidden="true"
                                  className="w-4 h-4 rounded-full border-2 border-brand-maroon-500 border-t-transparent animate-spin flex-shrink-0 mt-1"
                                />
                              )}
                              {!isPending && isActive && (
                                <span className="text-xs font-medium uppercase tracking-wide text-brand-maroon-600 flex-shrink-0 mt-1">
                                  Active
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>

              {/* 3. Add a new address — triggers the inline manual form */}
              {!manualOpen && addresses.length > 0 && (
                <div className="mt-4">
                  <button
                    type="button"
                    data-testid="home-location-sheet-add-new"
                    onClick={openManualForm}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl',
                      'border border-dashed border-brand-maroon-300 bg-white',
                      'hover:bg-brand-maroon-50/40 transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500',
                      'text-left',
                    )}
                  >
                    <Plus
                      className="w-5 h-5 text-brand-maroon-500 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-brand-maroon-700">
                        Add a new address
                      </p>
                    </div>
                  </button>
                </div>
              )}

              {/* Manual entry form — expands in place. v4 (2026-05-14):
                triggered only by the explicit "Add a new address" CTA
                above. The GPS path now silently auto-saves a 'detected'
                address rather than opening this form. */}
              <AddressSheetManualForm
                open={manualOpen}
                onClose={closeManualForm}
                onSaved={handleManualSaved}
              />

              {/* 4. Manage addresses (secondary — for CRUD, not selection) */}
              <div className="mt-5 pt-4 border-t border-gray-100">
                <Link
                  href={MANAGE_ADDRESSES_HREF}
                  data-testid="home-location-sheet-manage"
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl',
                    'hover:bg-gray-50 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500',
                  )}
                >
                  <Pencil className="w-5 h-5 text-gray-500 flex-shrink-0" aria-hidden="true" />
                  <span className="text-sm font-semibold text-gray-900">Manage addresses</span>
                </Link>
              </div>
            </div>
          </APIProviderRoot>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>

      {/* v3: rationale modal driven by useCurrentLocation. Sibling of the
          sheet portal so its z-index can stack above the sheet without
          fighting the Radix portal hierarchy. */}
      <LocationRationaleModal
        open={loc.isRationaleOpen}
        onAllow={loc.acknowledgeRationale}
        onDeny={loc.dismissRationale}
      />
    </DialogPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function SavedAddressesSkeleton(): JSX.Element {
  return (
    <div data-testid="home-location-sheet-skeleton" className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-start gap-3 px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 animate-pulse"
        >
          <div className="w-5 h-5 rounded bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 bg-gray-200 rounded" />
            <div className="h-3 w-48 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface EmptyAddressesBlockProps {
  readonly onAddManually: () => void;
}

function EmptyAddressesBlock({ onAddManually }: EmptyAddressesBlockProps): JSX.Element {
  return (
    <div
      data-testid="home-location-sheet-empty"
      className="flex flex-col items-center text-center py-8 px-4"
    >
      <div className="w-14 h-14 rounded-full bg-brand-maroon-50 flex items-center justify-center mb-3">
        <MapPin className="w-7 h-7 text-brand-maroon-400" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-gray-900">No saved addresses yet</p>
      <p className="text-xs text-gray-500 mt-1 max-w-[240px]">
        Save your home or work address for faster booking.
      </p>
      <button
        type="button"
        onClick={onAddManually}
        data-testid="home-location-sheet-add-first"
        className={cn(
          'mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl',
          'bg-brand-maroon-500 text-white text-sm font-semibold',
          'hover:bg-brand-maroon-600 active:scale-[0.98] transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500',
        )}
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        Add your first address
      </button>
    </div>
  );
}
