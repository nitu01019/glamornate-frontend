'use client';

import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  detectBrand,
  formatPanWithSpaces,
  isExpiryInFuture,
  luhnCheck,
  parseExpiry,
} from '@/lib/payments/card-format';
import type { SavedCard } from '@/types/payments';

/**
 * Minimum card input specs shared by the validation schema and the
 * `onSave` payload.
 */
const CARDHOLDER_MIN = 2;
const PAN_MIN_DIGITS = 13;
const PAN_MAX_DIGITS = 19;
const CVV_MIN = 3;
const CVV_MAX = 4;
const EXPIRY_LENGTH = 5; // MM/YY

const digitsOnly = (value: string): string => value.replace(/\D+/g, '');

const cardFormSchema = z.object({
  cardholderName: z.string().trim().min(CARDHOLDER_MIN, 'Please enter the cardholder name.'),
  pan: z
    .string()
    .transform((value) => digitsOnly(value))
    .refine((digits) => digits.length >= PAN_MIN_DIGITS && digits.length <= PAN_MAX_DIGITS, {
      message: 'Card number must be 13–19 digits.',
    })
    .refine((digits) => luhnCheck(digits), {
      message: 'That card number looks invalid.',
    }),
  expiry: z
    .string()
    .trim()
    .refine((raw) => parseExpiry(raw) !== null, {
      message: 'Use MM/YY format.',
    })
    .refine(
      (raw) => {
        const parts = parseExpiry(raw);
        if (!parts) return false;
        return isExpiryInFuture(parts.month, parts.year);
      },
      { message: 'Card is expired.' },
    ),
  cvv: z
    .string()
    .transform((value) => digitsOnly(value))
    .refine((digits) => digits.length >= CVV_MIN && digits.length <= CVV_MAX, {
      message: 'CVV must be 3 or 4 digits.',
    }),
});

type CardFormInput = z.input<typeof cardFormSchema>;
type CardFormOutput = z.output<typeof cardFormSchema>;

export type NewCardInput = Omit<SavedCard, 'id'>;

export interface AddCardFormProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: (card: NewCardInput) => void;
}

function buildSavedCard(values: CardFormOutput): NewCardInput {
  const digits = values.pan;
  const expiry = parseExpiry(values.expiry);
  // Schema guarantees expiry is valid by this point.
  const safeExpiry = expiry ?? { month: 1, year: new Date().getFullYear() };

  return {
    brand: detectBrand(digits),
    last4: digits.slice(-4),
    expMonth: safeExpiry.month,
    expYear: safeExpiry.year,
    isDefault: false,
  };
}

function formatExpiryWhileTyping(raw: string): string {
  const digits = digitsOnly(raw).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function AddCardForm({ open, onOpenChange, onSave }: AddCardFormProps): JSX.Element {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CardFormInput>({
    resolver: zodResolver(cardFormSchema),
    defaultValues: {
      cardholderName: '',
      pan: '',
      expiry: '',
      cvv: '',
    },
    mode: 'onBlur',
  });

  const handleDialogChange = useCallback(
    (nextOpen: boolean): void => {
      if (!nextOpen) reset();
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset],
  );

  const onSubmit = handleSubmit((values) => {
    const card = buildSavedCard(values as CardFormOutput);
    onSave(card);
    reset();
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a new card</DialogTitle>
          <DialogDescription>
            Your card details are only validated locally — nothing is sent to a server yet.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate aria-label="Add card form">
          <div className="space-y-1.5">
            <Label htmlFor="cardholderName">Cardholder name</Label>
            <Input
              id="cardholderName"
              autoComplete="cc-name"
              aria-invalid={Boolean(errors.cardholderName) || undefined}
              aria-describedby={errors.cardholderName ? 'cardholderName-error' : undefined}
              {...register('cardholderName')}
            />
            {errors.cardholderName ? (
              <p id="cardholderName-error" role="alert" className="text-xs text-brand-maroon-700">
                {errors.cardholderName.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pan">Card number</Label>
            <Input
              id="pan"
              inputMode="numeric"
              autoComplete="cc-number"
              maxLength={23 /* 19 digits + 4 spaces */}
              placeholder="4111 1111 1111 1111"
              aria-invalid={Boolean(errors.pan) || undefined}
              aria-describedby={errors.pan ? 'pan-error' : undefined}
              {...register('pan', {
                onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                  const formatted = formatPanWithSpaces(event.target.value);
                  setValue('pan', formatted, { shouldValidate: false });
                },
              })}
            />
            {errors.pan ? (
              <p id="pan-error" role="alert" className="text-xs text-brand-maroon-700">
                {errors.pan.message}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="expiry">Expiry</Label>
              <Input
                id="expiry"
                inputMode="numeric"
                autoComplete="cc-exp"
                maxLength={EXPIRY_LENGTH}
                placeholder="MM/YY"
                aria-invalid={Boolean(errors.expiry) || undefined}
                aria-describedby={errors.expiry ? 'expiry-error' : undefined}
                {...register('expiry', {
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    setValue('expiry', formatExpiryWhileTyping(event.target.value), {
                      shouldValidate: false,
                    });
                  },
                })}
              />
              {errors.expiry ? (
                <p id="expiry-error" role="alert" className="text-xs text-brand-maroon-700">
                  {errors.expiry.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cvv">CVV</Label>
              <Input
                id="cvv"
                inputMode="numeric"
                autoComplete="cc-csc"
                maxLength={CVV_MAX}
                placeholder="123"
                aria-invalid={Boolean(errors.cvv) || undefined}
                aria-describedby={errors.cvv ? 'cvv-error' : undefined}
                {...register('cvv', {
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    setValue('cvv', digitsOnly(event.target.value), {
                      shouldValidate: false,
                    });
                  },
                })}
              />
              {errors.cvv ? (
                <p id="cvv-error" role="alert" className="text-xs text-brand-maroon-700">
                  {errors.cvv.message}
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(isSubmitting && 'cursor-progress')}
            >
              Save card
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddCardForm;
