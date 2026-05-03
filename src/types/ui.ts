/**
 * Glamornate - UI-only types
 *
 * These types are front-end view models, form shapes, and React store
 * state that intentionally do NOT belong in the shared `@glamornate/contracts`
 * workspace package. They describe client-side UI state only and should never
 * be exchanged over the wire.
 *
 * Re-exported from `@/types` (see `types/index.ts`) so existing call sites
 * such as `import type { LoginForm } from '@/types'` continue to resolve.
 */

import type { User, Booking, Spa, Service, Therapist, Slot, Addon, CustomerInfo, BookingStatus } from './index';

// === Form view-models ===
export interface LoginForm {
  email: string
  password: string
}

export interface RegisterForm {
  email: string
  password: string
  name: string
  phone?: string
}

export interface BookingForm {
  spaId: string
  serviceIds: string[]
  therapistId?: string
  slot: Slot
  addons?: Addon[]
  customer: CustomerInfo
  specialRequests?: string
}

// === Query/filter parameter shapes ===
export interface PaginationParams {
  page?: number
  limit?: number
}

export interface BookingFilters {
  status?: BookingStatus
  dateFrom?: string
  dateTo?: string
}

// === React store / provider state shapes ===
export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface BookingState {
  currentBooking: Booking | null
  selectedSpa: Spa | null
  selectedServices: Service[]
  selectedTherapist: Therapist | null
  selectedSlot: Slot | null
}
