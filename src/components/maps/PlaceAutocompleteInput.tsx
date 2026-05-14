'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Input } from '@/components/ui/input';
import { useDebounceValue } from '@/hooks/useDebounceValue';
import { cn } from '@/lib/utils';

export interface PickedLocation {
  coords: { lat: number; lng: number; accuracy: number };
  addressText: string;
  placeId: string;
  source: 'address_typed';
  city?: string;
  state?: string;
  postalCode?: string;
}

interface PlaceAddressComponent {
  longText: string | null;
  shortText: string | null;
  types: string[];
}

function extractAddressParts(components: PlaceAddressComponent[] | undefined): {
  city?: string;
  state?: string;
  postalCode?: string;
} {
  if (!components || components.length === 0) return {};
  const findByType = (...types: string[]): string | undefined => {
    for (const type of types) {
      const match = components.find((c) => c.types.includes(type));
      if (match?.longText) return match.longText;
    }
    return undefined;
  };
  return {
    city: findByType(
      'locality',
      'administrative_area_level_2',
      'sublocality_level_1',
      'sublocality',
    ),
    state: findByType('administrative_area_level_1'),
    postalCode: findByType('postal_code'),
  };
}

interface PlaceAutocompleteInputProps {
  onPick: (loc: PickedLocation) => void;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
}

interface SuggestionItem {
  id: string;
  primary: string;
  secondary: string;
  prediction: unknown;
}

const MAX_SUGGESTIONS = 5;
const DEBOUNCE_MS = 250;
const MIN_QUERY_LEN = 2;

export default function PlaceAutocompleteInput({
  onPick,
  placeholder = 'Search address',
  defaultValue = '',
  className,
}: PlaceAutocompleteInputProps) {
  const placesLib = useMapsLibrary('places');
  const [query, setQuery] = useState<string>(defaultValue);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const sessionTokenRef = useRef<unknown>(null);
  const debouncedQuery = useDebounceValue(query.trim(), DEBOUNCE_MS);

  useEffect(() => {
    if (!placesLib) return;
    const PlacesNs = placesLib as unknown as {
      AutocompleteSessionToken: new () => unknown;
    };
    sessionTokenRef.current = new PlacesNs.AutocompleteSessionToken();
  }, [placesLib]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!placesLib || debouncedQuery.length < MIN_QUERY_LEN) {
        setSuggestions([]);
        return;
      }
      const PlacesNs = placesLib as unknown as {
        AutocompleteSuggestion: {
          fetchAutocompleteSuggestions: (req: {
            input: string;
            sessionToken: unknown;
            includedRegionCodes?: readonly string[];
            language?: string;
          }) => Promise<{ suggestions: unknown[] }>;
        };
      };
      try {
        setLoading(true);
        // India-focused product — restrict autocomplete to IN results so a
        // search like "MG R" doesn't surface global street names. `language`
        // pins the response strings to English so the suggestion text and
        // the rest of the customer surface stay in the same language.
        const result = await PlacesNs.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: debouncedQuery,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ['in'],
          language: 'en',
        });
        if (cancelled) return;
        const next: SuggestionItem[] = result.suggestions
          .slice(0, MAX_SUGGESTIONS)
          .map((s, idx) => {
            const sg = s as {
              placePrediction?: {
                placeId?: string;
                mainText?: { text?: string };
                secondaryText?: { text?: string };
                text?: { text?: string };
              };
            };
            const pp = sg.placePrediction;
            return {
              id: pp?.placeId ?? `s-${idx}`,
              primary: pp?.mainText?.text ?? pp?.text?.text ?? '',
              secondary: pp?.secondaryText?.text ?? '',
              prediction: s,
            };
          })
          .filter((item) => item.primary.length > 0);
        setSuggestions(next);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [placesLib, debouncedQuery]);

  const handleSelect = async (item: SuggestionItem) => {
    setOpen(false);
    const sg = item.prediction as {
      placePrediction?: {
        toPlace: () => {
          fetchFields: (req: { fields: string[] }) => Promise<unknown>;
          location?: { lat: () => number; lng: () => number };
          formattedAddress?: string;
          id?: string;
          addressComponents?: PlaceAddressComponent[];
        };
      };
    };
    const placePrediction = sg.placePrediction;
    if (!placePrediction) return;
    try {
      const place = placePrediction.toPlace();
      await place.fetchFields({
        fields: ['location', 'formattedAddress', 'id', 'addressComponents'],
      });
      const lat = place.location?.lat() ?? 0;
      const lng = place.location?.lng() ?? 0;
      const addressText = place.formattedAddress ?? '';
      const placeId = place.id ?? '';
      const parts = extractAddressParts(place.addressComponents);
      setQuery(addressText || item.primary);
      onPick({
        coords: { lat, lng, accuracy: 0 },
        addressText,
        placeId,
        source: 'address_typed',
        city: parts.city,
        state: parts.state,
        postalCode: parts.postalCode,
      });

      // Per Google Places billing: a session ends when `fetchFields()` is
      // called on a chosen place. Reusing the same token for the next
      // search reopens the closed session and triggers per-keystroke
      // billing instead of per-pick. Rotate the token after a successful
      // pick so the next type-and-pick cycle bills as its own session.
      // (Red-team T-B3 finding.)
      if (placesLib) {
        const PlacesNs = placesLib as unknown as {
          AutocompleteSessionToken: new () => unknown;
        };
        sessionTokenRef.current = new PlacesNs.AutocompleteSessionToken();
      }
    } catch {
      // Silently fail; user can retry by typing again.
    }
  };

  const showDropdown = useMemo(() => open && suggestions.length > 0, [open, suggestions.length]);

  // Keyboard navigation: ArrowDown / ArrowUp move the highlighted index;
  // Enter selects. Pointed-at item is also rendered with focus styles and
  // exposed via `aria-activedescendant` so screen readers track focus
  // within the listbox without actually moving DOM focus off the input
  // (the ARIA "listbox-with-input" composite-widget pattern).
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  const listboxId = 'place-autocomplete-listbox';
  const activeOptionId =
    activeIndex >= 0 && activeIndex < suggestions.length
      ? `${listboxId}-opt-${suggestions[activeIndex].id}`
      : undefined;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        void handleSelect(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className={cn('relative w-full', className)}>
      <Input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay close so onClick on a suggestion can fire first.
          window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        aria-label="Search for an address"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls={showDropdown ? listboxId : undefined}
        aria-activedescendant={activeOptionId}
        role="combobox"
      />
      {showDropdown ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-brand-maroon-200 bg-white shadow-lg"
        >
          {suggestions.map((item, idx) => {
            const isActive = idx === activeIndex;
            return (
              <li
                key={item.id}
                id={`${listboxId}-opt-${item.id}`}
                role="option"
                aria-selected={isActive}
              >
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void handleSelect(item);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    'block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-brand-maroon-50 focus:outline-none',
                    isActive && 'bg-brand-maroon-50',
                  )}
                >
                  <div className="font-medium text-gray-900">{item.primary}</div>
                  {item.secondary ? (
                    <div className="text-xs text-gray-500">{item.secondary}</div>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {loading && query.length >= MIN_QUERY_LEN ? (
        <p className="mt-1 text-xs text-brand-maroon-400">Searching…</p>
      ) : null}
    </div>
  );
}
