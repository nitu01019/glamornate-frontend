import { z } from 'zod';

// ============ Common Schemas ============

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email address');

/**
 * Phone number validation schema (India)
 */
export const phoneSchema = z
  .string()
  .min(10, 'Phone number must be at least 10 digits')
  .max(15, 'Phone number is too long')
  .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, 'Invalid phone number');

/**
 * Password validation schema
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

/**
 * Name validation schema
 */
export const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name is too long')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes');

/**
 * PIN code validation schema (India)
 */
export const pincodeSchema = z
  .string()
  .regex(/^\d{6}$/, 'Invalid PIN code');

/**
 * Date validation schema (YYYY-MM-DD)
 */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
  .refine((val) => {
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, 'Invalid date');

/**
 * Time validation schema (HH:mm)
 */
export const timeSchema = z
  .string()
  .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format');

/**
 * Slug validation schema
 */
export const slugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(100, 'Slug is too long')
  .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens');

/**
 * URL validation schema
 */
export const urlSchema = z
  .string()
  .url('Invalid URL format');

/**
 * Rating validation schema (1-5)
 */
export const ratingSchema = z
  .number()
  .min(1, 'Rating must be at least 1')
  .max(5, 'Rating must be at most 5');

/**
 * Positive number validation schema
 */
export const positiveNumberSchema = z
  .number()
  .positive('Value must be positive');

/**
 * Non-negative number validation schema
 */
export const nonNegativeNumberSchema = z
  .number()
  .nonnegative('Value must be non-negative');

/**
 * OTP validation schema (6 digits)
 */
export const otpSchema = z
  .string()
  .regex(/^\d{6}$/, 'OTP must be 6 digits');

// ============ Collection Schemas ============

/**
 * Booking validation schema
 */
export const bookingDraftSchema = z.object({
  spaId: z.string().min(1, 'Spa ID is required'),
  therapistId: z.string().min(1, 'Therapist ID is required'),
  serviceIds: z.array(z.string()).min(1, 'At least one service must be selected'),
  addons: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: positiveNumberSchema,
  })).optional().default([]),
  slot: z.object({
    date: dateSchema,
    start: timeSchema,
    end: timeSchema,
    duration: positiveNumberSchema,
  }),
  notes: z.string().max(500, 'Notes too long').optional(),
  specialRequests: z.string().max(500, 'Special requests too long').optional(),
});

/**
 * Spa registration validation schema
 */
export const spaRegistrationSchema = z.object({
  name: z.string().min(3, 'Spa name must be at least 3 characters').max(100, 'Spa name too long'),
  slug: slugSchema,
  description: z.string().min(10, 'Description too short').max(2000, 'Description too long'),
  shortDescription: z.string().min(10, 'Short description too short').max(200, 'Short description too long'),
  location: z.object({
    address: z.string().min(5, 'Address too short'),
    city: z.string().min(2, 'City too short'),
    state: z.string().min(2, 'State too short'),
    pincode: pincodeSchema,
    geo: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
    timezone: z.string(),
  }),
  contact: z.object({
    phone: phoneSchema,
    email: emailSchema,
    whatsapp: phoneSchema.optional(),
  }),
  categories: z.array(z.enum(['massage', 'facial', 'body', 'pedicure', 'manicure', 'wellness']))
    .min(1, 'At least one category must be selected'),
  amenities: z.array(z.enum(['parking', 'wifi', 'shower', 'locker', 'ac', 'robes', 'refreshments']))
    .optional(),
  operatingHours: z.object({
    mon: z.object({ open: timeSchema, close: timeSchema, isOpen: z.boolean() }),
    tue: z.object({ open: timeSchema, close: timeSchema, isOpen: z.boolean() }),
    wed: z.object({ open: timeSchema, close: timeSchema, isOpen: z.boolean() }),
    thu: z.object({ open: timeSchema, close: timeSchema, isOpen: z.boolean() }),
    fri: z.object({ open: timeSchema, close: timeSchema, isOpen: z.boolean() }),
    sat: z.object({ open: timeSchema, close: timeSchema, isOpen: z.boolean() }),
    sun: z.object({ open: timeSchema, close: timeSchema, isOpen: z.boolean() }),
  }),
});

/**
 * Review validation schema
 */
export const reviewSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  rating: ratingSchema,
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  comment: z.string().min(10, 'Review too short').max(1000, 'Review too long'),
  aspects: z.object({
    ambiance: ratingSchema.optional(),
    service: ratingSchema.optional(),
    therapist: ratingSchema.optional(),
    hygiene: ratingSchema.optional(),
  }).optional(),
  photos: z.array(z.string()).optional(),
});

/**
 * Support ticket validation schema
 */
export const supportTicketSchema = z.object({
  type: z.enum(['booking_issue', 'payment_issue', 'service_issue', 'account_issue', 'spam_report', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  subject: z.string().min(5, 'Subject too short').max(100, 'Subject too long'),
  description: z.string().min(10, 'Description too short').max(2000, 'Description too long'),
  bookingId: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

/**
 * Voucher code validation schema
 */
export const voucherCodeSchema = z
  .string()
  .min(3, 'Voucher code too short')
  .max(20, 'Voucher code too long')
  .toUpperCase();

/**
 * Coordinates validation schema
 */
export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Pagination params validation schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// ============ Helper Functions ============

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const result = emailSchema.safeParse(email);
  return result.success;
}

/**
 * Validate phone number
 */
export function isValidPhone(phone: string): boolean {
  const result = phoneSchema.safeParse(phone);
  return result.success;
}

/**
 * Validate password strength
 */
export function isValidPassword(password: string): boolean {
  const result = passwordSchema.safeParse(password);
  return result.success;
}

/**
 * Validate URL
 */
export function isValidUrl(url: string): boolean {
  try {
    const result = urlSchema.safeParse(url);
    return result.success;
  } catch {
    return false;
  }
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

/**
 * Validate and sanitize name
 */
export function validateName(name: string): string | null {
  const sanitized = sanitizeString(name);
  const result = nameSchema.safeParse(sanitized);
  return result.success ? sanitized : null;
}

/**
 * Check if date is in the future
 */
export function isFutureDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date > new Date();
}

/**
 * Check if date is in the past
 */
export function isPastDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date < new Date();
}

/**
 * Validate date is between min and max days from now
 */
export function isDateInRange(dateString: string, minDays: number, maxDays: number): boolean {
  const date = new Date(dateString);
  const now = new Date();
  const minDate = new Date(now.getTime() + minDays * 24 * 60 * 60 * 1000);
  const maxDate = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);
  return date >= minDate && date <= maxDate;
}

/**
 * Generate safe error message from Zod error
 */
export function getZodErrorMessage(error: z.ZodError): string {
  const firstError = error.errors[0];
  if (firstError) {
    return `${firstError.path.join('.')}: ${firstError.message}`;
  }
  return 'Validation failed';
}

/**
 * Validate object against schema
 */
export function validateObject<T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; error?: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: getZodErrorMessage(result.error) };
}
