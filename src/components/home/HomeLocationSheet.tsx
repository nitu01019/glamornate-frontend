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
 * All three selection paths funnel through `location-writer.setActiveLocation`
 * so the Firestore default AND the legacy `location-provider` stay in sync
 * (autoplan T3 / F5).
 *
 * Accessibility:
 *   - `aria-modal="true"` dialog semantics via Radix primitives.
 *   - Focus trap + Escape close provided by Radix.
 *   - First focusable element on open is the GPS row.
 *   - Backdrop click and swipe-down translate to onClose.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Briefcase, Home, MapPin, Navigation, Pencil, Plus, Tag, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-provider';
import { useLocation } from '@/lib/location-provider';
import { getFirebaseFirestore } from '@/lib/firebase-client';
import { doc, onSnapshot } from 'firebase/firestore';
import type { SavedAddress, AddressLabel } from '@/types';
import {
  setActiveLocation,
  setActiveLocationFromGps,
  LocationWriteError,
} from '@/lib/location-writer';
import { useToastActions } from '@/lib/providers';
import { cn } from '@/lib/utils';
import AddressSheetManualForm from '@/components/home/AddressSheetManualForm';

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
  work: { icon: Briefcase, label: 'Work', accentClass: 'text-blue-500' },
  other: { icon: Tag, label: 'Other', accentClass: 'text-gray-500' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAddressSubtitle(a: SavedAddress): string {
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
// useAllAddresses — lightweight list subscription (separate from the hook
// that picks the *default* address). Returns the live array from Firestore.
// ---------------------------------------------------------------------------

interface UseAllAddressesResult {
  readonly addresses: readonly SavedAddress[];
  readonly isLoading: boolean;
}

function useAllAddresses(enabled: boolean): UseAllAddressesResult {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;
  const [addresses, setAddresses] = useState<readonly SavedAddress[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(enabled && uid));

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    if (!uid) {
      setAddresses([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const db = getFirebaseFirestore();
    const userRef = doc(db, 'users', uid);
    const unsubscribe = onSnapshot(
      userRef,
      (snap) => {
        const data = snap.exists()
          ? (snap.data() as { addresses?: readonly SavedAddress[] })
          : undefined;
        setAddresses(data?.addresses ?? []);
        setIsLoading(false);
      },
      () => {
        // Treat transient permission-denied / offline errors as "no data"
        // rather than surfacing a disruptive state in the sheet.
        setAddresses([]);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [enabled, uid]);

  return { addresses, isLoading };
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
  const toast = useToastActions();
  const { addresses, isLoading: addressesLoading } = useAllAddresses(open);
  // Derive the current default directly from the subscription (which is
  // authoritative for the "addresses" array on users/{uid}). This avoids a
  // second Firestore listener and keeps the sheet self-contained.
  const currentDefault = useMemo<SavedAddress | null>(
    () => addresses.find((a) => a.isDefault) ?? null,
    [addresses],
  );

  const [writeStatus, setWriteStatus] = useState<WriteStatus>({ kind: 'idle' });
  const [manualOpen, setManualOpen] = useState<boolean>(false);
  const gpsButtonRef = useRef<HTMLButtonElement>(null);

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

  // Reset transient state whenever the sheet opens/closes.
  useEffect(() => {
    if (!open) {
      setWriteStatus({ kind: 'idle' });
      setManualOpen(false);
    }
  }, [open]);

  const providerSurface = useMemo(
    () => ({ setLocation: locationCtx.setLocation }),
    [locationCtx.setLocation],
  );

  const openManualForm = useCallback(() => {
    setManualOpen(true);
  }, []);

  const closeManualForm = useCallback(() => {
    setManualOpen(false);
  }, []);

  const handleManualSaved = useCallback(() => {
    // The manual form already called `setActiveLocation` internally. All we
    // need to do here is dismiss the sheet so the UI reflects the new default.
    setManualOpen(false);
    onClose();
  }, [onClose]);

  const handleGps = useCallback(async () => {
    setWriteStatus({ kind: 'pending', target: 'gps' });
    try {
      const result = await setActiveLocationFromGps({ provider: providerSurface });

      // `setActiveLocationFromGps` returns a tagged result when the backend
      // geocode callable is not configured / rate-limited / errored.
      if (result && typeof result === 'object' && 'status' in result) {
        if (result.status === 'ok') {
          setWriteStatus({ kind: 'idle' });
          onClose();
          return;
        }
        if (result.status === 'not-configured') {
          setWriteStatus({ kind: 'idle' });
          setManualOpen(true);
          toast.info(
            'Location service not set up yet',
            'Please enter your address manually below.',
          );
          return;
        }
        if (result.status === 'quota') {
          setWriteStatus({
            kind: 'error',
            message: 'Too many requests — please enter manually or try again in a minute.',
          });
          setManualOpen(true);
          return;
        }
        // `error` — generic failure; keep the sheet open so the user can retry
        // or fall back to manual entry.
        setWriteStatus({
          kind: 'error',
          message:
            'message' in result && typeof result.message === 'string'
              ? result.message
              : 'Could not detect your location',
        });
        setManualOpen(true);
        return;
      }

      // Back-compat: legacy resolve-with-void path.
      setWriteStatus({ kind: 'idle' });
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof LocationWriteError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not detect your location';
      setWriteStatus({ kind: 'error', message });
    }
  }, [onClose, providerSurface, toast]);

  const handleSelectAddress = useCallback(
    async (addressId: string) => {
      setWriteStatus({ kind: 'pending', target: 'address', id: addressId });
      try {
        await setActiveLocation(
          { kind: 'saved-address', addressId },
          { provider: providerSurface },
        );
        onClose();
      } catch (err: unknown) {
        const message =
          err instanceof LocationWriteError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Could not update your location';
        setWriteStatus({ kind: 'error', message });
      }
    },
    [onClose, providerSurface],
  );

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
            {/* 1. GPS row */}
            <button
              ref={gpsButtonRef}
              type="button"
              data-testid="home-location-sheet-gps"
              onClick={handleGps}
              disabled={writeStatus.kind === 'pending'}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl',
                'border border-brand-maroon-200 bg-brand-maroon-50/50',
                'hover:bg-brand-maroon-50 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500',
                'disabled:opacity-60 disabled:cursor-not-allowed',
                'text-left',
              )}
            >
              <Navigation
                className="w-5 h-5 text-brand-maroon-500 flex-shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-brand-maroon-700">
                  {writeStatus.kind === 'pending' && writeStatus.target === 'gps'
                    ? 'Detecting location…'
                    : 'Use current location'}
                </p>
                <p className="text-xs text-brand-maroon-600/70 mt-0.5">GPS will pin your spot</p>
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

            {/* 2. Saved addresses */}
            <div className="mt-5">
              {addressesLoading ? (
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
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-maroon-600 flex-shrink-0 mt-1">
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
                  <Plus className="w-5 h-5 text-brand-maroon-500 flex-shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-brand-maroon-700">
                      Add a new address
                    </p>
                    <p className="text-xs text-brand-maroon-600/70 mt-0.5">
                      Enter the details manually
                    </p>
                  </div>
                </button>
              </div>
            )}

            {/* Manual entry form — expands in place */}
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
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
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
