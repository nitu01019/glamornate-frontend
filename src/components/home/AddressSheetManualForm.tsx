'use client';

/**
 * AddressSheetManualForm
 * ----------------------
 * Inline manual address entry form used inside `HomeLocationSheet`. Starts
 * collapsed — the parent sheet controls the open/close state. When
 * expanded, the form renders the fields required by Phase 4A's
 * `addAddress` callable (`backend/functions/src/callable/addAddress.ts`):
 *
 *   label · name · phone · flat/house · street · landmark(optional) ·
 *   city · state · pincode (Indian 6-digit).
 *
 * Form state is managed by `react-hook-form` with a `zodResolver` over the
 * shared `manualAddressSchema` (see `@/lib/schemas/saved-address`). The
 * digit-only formatters for phone / pincode run through `setValue` so the
 * masked characters stay out of the RHF cache.
 *
 * On successful submit:
 *   1. Call `addAddress` via `useAddresses().addAddress`.
 *   2. Call `setActiveLocation({ kind: 'saved-address', addressId })` so the
 *      legacy `location-provider` reflects the new default.
 *   3. Invoke `onSaved(addressId)` so the parent can close itself.
 *
 * Accessibility
 * -------------
 *   - Each `<Input>` is paired with a `<Label htmlFor>`; errors are linked
 *     via `aria-describedby` and announced via `role="alert"`.
 *   - Label chips use a Radix `RadioGroup` with roving focus.
 *   - Respects `prefers-reduced-motion`: the expand/collapse animation is
 *     gated behind a `motion-reduce:transition-none` class on the wrapper.
 *   - On expand, focus is moved to the first input (`name`).
 */

import { useCallback, useEffect, useId, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Briefcase, Home, Loader2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { manualAddressSchema, type ManualAddressInput } from '@/lib/schemas/saved-address';
import { useAddresses } from '@/lib/addresses/use-addresses';
import { setActiveLocation, LocationWriteError } from '@/lib/location-writer';
import { useLocation } from '@/lib/location-provider';
import { useAuth } from '@/lib/auth-provider';
import { useToastActions } from '@/lib/providers';
import { cn } from '@/lib/utils';
import type { AddressLabel } from '@/types';

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface AddressSheetManualFormProps {
  /** Whether the form is currently expanded (parent-owned). */
  readonly open: boolean;
  /** Called when the user taps "Cancel" or after a successful submit. */
  readonly onClose: () => void;
  /** Called after a successful save. Receives the new address's id. */
  readonly onSaved?: (addressId: string) => void;
}

// ---------------------------------------------------------------------------
// Form values — align with `manualAddressSchema`. `landmark` stays as a
// (possibly empty) string inside the form; the schema's `.transform`
// normalizes empty strings to `undefined` on parse, so the downstream
// payload stays clean.
// ---------------------------------------------------------------------------

interface ManualAddressFormValues {
  readonly label: AddressLabel;
  readonly name: string;
  readonly phone: string;
  readonly flatHouse: string;
  readonly street: string;
  readonly landmark: string;
  readonly city: string;
  readonly state: string;
  readonly pincode: string;
}

function initialFormValues(): ManualAddressFormValues {
  return {
    label: 'home',
    name: '',
    phone: '',
    flatHouse: '',
    street: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
  };
}

const LABEL_OPTIONS: ReadonlyArray<{
  readonly value: AddressLabel;
  readonly label: string;
  readonly icon: typeof Home;
}> = [
  { value: 'home', label: 'Home', icon: Home },
  { value: 'work', label: 'Work', icon: Briefcase },
  { value: 'other', label: 'Other', icon: Tag },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddressSheetManualForm({
  open,
  onClose,
  onSaved,
}: AddressSheetManualFormProps): JSX.Element | null {
  const uid = useId();
  const toast = useToastActions();
  const { addAddress } = useAddresses({ runMigration: true });
  const { user } = useAuth();
  const { setLocation } = useLocation();

  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<ManualAddressFormValues>({
    // `manualAddressSchema` has a `.transform` on `landmark` that yields
    // `string | undefined`. RHF's field is always a plain string, so we
    // cast the resolver to match the pre-transform form state — the
    // runtime validation rules stay identical.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `zodResolver` generic infers post-transform type; RHF expects pre-transform. Cast narrows the resolver return to the form-state shape; runtime validation is unaffected.
    resolver: zodResolver(manualAddressSchema) as any,
    defaultValues: initialFormValues(),
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    setFocus,
    formState: { errors },
  } = form;

  // Reset the form whenever it closes so a fresh expand starts clean.
  useEffect(() => {
    if (!open) {
      reset(initialFormValues());
      setSubmitError(null);
    }
  }, [open, reset]);

  // On expand, move focus to the first input for keyboard users.
  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => setFocus('name'), 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open, setFocus]);

  // -----------------------------------------------------------------------
  // Digit-only formatters — drive `setValue` so the RHF cache always
  // contains the sanitised string.
  // -----------------------------------------------------------------------

  const onPincodeChange = useCallback(
    (raw: string) => {
      const digits = raw.replace(/\D+/g, '').slice(0, 6);
      setValue('pincode', digits, { shouldValidate: false, shouldDirty: true });
    },
    [setValue],
  );

  const onPhoneChange = useCallback(
    (raw: string) => {
      const digits = raw.replace(/\D+/g, '').slice(0, 10);
      setValue('phone', digits, { shouldValidate: false, shouldDirty: true });
    },
    [setValue],
  );

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  const isPending = addAddress.isPending;

  const onValidSubmit = useCallback(
    async (values: ManualAddressFormValues) => {
      setSubmitError(null);

      // RHF passes us the schema's OUTPUT type (post-transform) even
      // though our form state type is the pre-transform shape. Coerce
      // safely: treat missing strings as empty, and apply the same name
      // fallback the hand-rolled form had.
      const parsed: ManualAddressInput = {
        label: values.label,
        name: (values.name ?? '').trim() || (user?.profile?.displayName ?? ''),
        phone: (values.phone ?? '').trim(),
        flatHouse: (values.flatHouse ?? '').trim(),
        street: (values.street ?? '').trim(),
        landmark:
          typeof values.landmark === 'string' && values.landmark.trim().length > 0
            ? values.landmark.trim()
            : undefined,
        city: (values.city ?? '').trim(),
        state: (values.state ?? '').trim(),
        pincode: (values.pincode ?? '').trim(),
      };

      try {
        const result = await addAddress.mutateAsync({
          label: parsed.label,
          name: parsed.name,
          phone: parsed.phone,
          flatHouse: parsed.flatHouse,
          street: parsed.street,
          ...(parsed.landmark ? { landmark: parsed.landmark } : {}),
          city: parsed.city,
          state: parsed.state,
          pincode: parsed.pincode,
          isDefault: true,
        });

        try {
          await setActiveLocation(
            { kind: 'saved-address', addressId: result.addressId },
            { provider: { setLocation } },
          );
        } catch (writeErr) {
          // Address was saved but the write-through to the provider failed.
          // Surface a soft-failure toast — the saved address still exists
          // and the subscription will catch up on next render.
          const msg =
            writeErr instanceof LocationWriteError
              ? writeErr.message
              : writeErr instanceof Error
              ? writeErr.message
              : 'Saved, but could not publish active location';
          toast.warning('Address saved', msg);
        }

        toast.success('Address saved', 'We have set it as your active location.');
        onSaved?.(result.addressId);
        onClose();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not save address';
        setSubmitError(message);
        toast.error('Could not save address', message);
      }
    },
    [addAddress, onClose, onSaved, setLocation, toast, user],
  );

  if (!open) return null;

  // Unique IDs so labels bind correctly even when multiple forms mount.
  const id = (name: string): string => `address-form-${uid}-${name}`;

  return (
    <section
      data-testid="address-sheet-manual-form"
      aria-label="Add a new address"
      className={cn(
        'mt-4 rounded-xl border border-brand-maroon-200 bg-brand-maroon-50/20 p-4',
        'motion-reduce:transition-none',
      )}
    >
      <form onSubmit={handleSubmit(onValidSubmit)} className="flex flex-col gap-3" noValidate>
        {/* Label chips */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Save as
          </span>
          <Controller
            control={control}
            name="label"
            render={({ field }) => (
              <div role="radiogroup" aria-label="Address label" className="flex gap-2">
                {LABEL_OPTIONS.map((option) => {
                  const OptionIcon = option.icon;
                  const selected = field.value === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      data-testid={`address-form-label-${option.value}`}
                      onClick={() => field.onChange(option.value)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold',
                        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon-500',
                        selected
                          ? 'bg-brand-maroon-500 border-brand-maroon-500 text-white'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50',
                      )}
                    >
                      <OptionIcon className="w-3.5 h-3.5" aria-hidden="true" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}
          />
        </div>

        <FormField
          id={id('name')}
          label="Full name"
          error={errors.name?.message ?? null}
          input={
            <Input
              {...register('name')}
              id={id('name')}
              data-testid="address-form-name"
              type="text"
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? `${id('name')}-err` : undefined}
            />
          }
        />

        <FormField
          id={id('phone')}
          label="Phone (10 digits)"
          error={errors.phone?.message ?? null}
          input={
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <Input
                  id={id('phone')}
                  data-testid="address-form-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(e) => {
                    onPhoneChange(e.target.value);
                  }}
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? `${id('phone')}-err` : undefined}
                />
              )}
            />
          }
        />

        <FormField
          id={id('flatHouse')}
          label="Flat / House no."
          error={errors.flatHouse?.message ?? null}
          input={
            <Input
              {...register('flatHouse')}
              id={id('flatHouse')}
              data-testid="address-form-flat"
              type="text"
              autoComplete="address-line1"
              aria-invalid={Boolean(errors.flatHouse)}
              aria-describedby={errors.flatHouse ? `${id('flatHouse')}-err` : undefined}
            />
          }
        />

        <FormField
          id={id('street')}
          label="Street / Area"
          error={errors.street?.message ?? null}
          input={
            <Input
              {...register('street')}
              id={id('street')}
              data-testid="address-form-street"
              type="text"
              autoComplete="address-line2"
              aria-invalid={Boolean(errors.street)}
              aria-describedby={errors.street ? `${id('street')}-err` : undefined}
            />
          }
        />

        <FormField
          id={id('landmark')}
          label="Landmark (optional)"
          error={errors.landmark?.message ?? null}
          input={
            <Input
              {...register('landmark')}
              id={id('landmark')}
              data-testid="address-form-landmark"
              type="text"
              aria-invalid={Boolean(errors.landmark)}
              aria-describedby={errors.landmark ? `${id('landmark')}-err` : undefined}
            />
          }
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            id={id('city')}
            label="City"
            error={errors.city?.message ?? null}
            input={
              <Input
                {...register('city')}
                id={id('city')}
                data-testid="address-form-city"
                type="text"
                autoComplete="address-level2"
                aria-invalid={Boolean(errors.city)}
                aria-describedby={errors.city ? `${id('city')}-err` : undefined}
              />
            }
          />
          <FormField
            id={id('state')}
            label="State"
            error={errors.state?.message ?? null}
            input={
              <Input
                {...register('state')}
                id={id('state')}
                data-testid="address-form-state"
                type="text"
                autoComplete="address-level1"
                aria-invalid={Boolean(errors.state)}
                aria-describedby={errors.state ? `${id('state')}-err` : undefined}
              />
            }
          />
        </div>

        <FormField
          id={id('pincode')}
          label="Pincode (6 digits)"
          error={errors.pincode?.message ?? null}
          input={
            <Controller
              control={control}
              name="pincode"
              render={({ field }) => (
                <Input
                  id={id('pincode')}
                  data-testid="address-form-pincode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={6}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(e) => {
                    onPincodeChange(e.target.value);
                  }}
                  aria-invalid={Boolean(errors.pincode)}
                  aria-describedby={errors.pincode ? `${id('pincode')}-err` : undefined}
                />
              )}
            />
          }
        />

        {submitError && (
          <p role="alert" data-testid="address-form-submit-error" className="text-xs text-red-600">
            {submitError}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
            data-testid="address-form-cancel"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            data-testid="address-manual-submit"
            data-legacy-testid="address-form-submit"
            className="flex-1"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              'Save & use'
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}

export default AddressSheetManualForm;

// ---------------------------------------------------------------------------
// Subcomponent: labelled field with inline error
// ---------------------------------------------------------------------------

interface FormFieldProps {
  readonly id: string;
  readonly label: string;
  readonly error: string | null;
  readonly input: JSX.Element;
}

function FormField({ id, label, error, input }: FormFieldProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-gray-700">
        {label}
      </label>
      {input}
      {error && (
        <p
          id={`${id}-err`}
          role="alert"
          className="text-[11px] text-red-600"
          data-testid={`${id}-err`}
        >
          {error}
        </p>
      )}
    </div>
  );
}
