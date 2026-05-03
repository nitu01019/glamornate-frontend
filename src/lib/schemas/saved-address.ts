/**
 * saved-address
 * -------------
 * Zod schema for manual address entry from the HomeLocationSheet. Mirrors
 * the backend contract in
 * `backend/functions/src/utils/addresses.ts#AddressInputSchema`, with
 * tighter client-side rules for Indian customer expectations:
 *
 *   - phone: exactly 10 digits (Indian mobile numbers).
 *   - pincode: exactly 6 digits (Indian postal code).
 *
 * All text fields trim whitespace. Optional `landmark` may be omitted or
 * an empty string, both of which resolve to `undefined` so the callable
 * payload stays clean.
 */

import { z } from 'zod';

export const addressLabelSchema = z.enum(['home', 'work', 'other']);

/**
 * Full manual-entry schema. Every text field is trimmed and length-bounded
 * to match the backend limits; phone + pincode are digit-only and exact
 * length.
 */
export const manualAddressSchema = z.object({
  label: addressLabelSchema,
  name: z
    .string()
    .trim()
    .min(1, 'Please enter your full name.')
    .max(80, 'Name is too long.'),
  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'Enter a 10-digit phone number.'),
  flatHouse: z
    .string()
    .trim()
    .min(1, 'Flat or house number is required.')
    .max(120, 'Flat / house value is too long.'),
  street: z
    .string()
    .trim()
    .min(1, 'Street / area is required.')
    .max(200, 'Street / area value is too long.'),
  landmark: z
    .string()
    .trim()
    .max(200, 'Landmark is too long.')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  city: z
    .string()
    .trim()
    .min(1, 'City is required.')
    .max(80, 'City is too long.'),
  state: z
    .string()
    .trim()
    .min(1, 'State is required.')
    .max(80, 'State is too long.'),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter a 6-digit pincode.'),
});

export type ManualAddressInput = z.infer<typeof manualAddressSchema>;

/**
 * Parse-or-throw helper — convenience for code paths that treat validation
 * failures as programmer error rather than a user-facing condition.
 */
export function parseManualAddress(input: unknown): ManualAddressInput {
  return manualAddressSchema.parse(input);
}
