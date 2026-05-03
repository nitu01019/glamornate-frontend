import { create } from 'zustand'
import type {
  BookingLocation,
  BookingAddress,
  TimeSlot,
} from '@/types'

/** Result returned after a successful booking creation */
export interface BookingDraftResult {
  bookingId: string
  bookingNumber?: string
  pricing?: {
    services: number
    addons: number
    tax: number
    discount: number
    platformFee: number
    total: number
    currency: string
  }
  expiresAt?: string
}

interface BookingState {
  step: number
  spaId: string | null
  therapistId: string | null
  location: BookingLocation | null
  address: BookingAddress | null
  selectedDate: string | null
  selectedTimeSlot: string | null
  availableSlots: TimeSlot[]
  notes: string
  isSubmitting: boolean
  bookingResult: BookingDraftResult | null

  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  setSpaId: (spaId: string) => void
  setTherapistId: (therapistId: string) => void
  setLocation: (loc: BookingLocation) => void
  setAddress: (addr: BookingAddress) => void
  setDate: (date: string) => void
  setTimeSlot: (slot: string) => void
  setAvailableSlots: (slots: TimeSlot[]) => void
  setNotes: (notes: string) => void
  setSubmitting: (val: boolean) => void
  setBookingResult: (result: BookingDraftResult) => void
  reset: () => void
}

const INITIAL_STATE: Pick<
  BookingState,
  | 'step'
  | 'spaId'
  | 'therapistId'
  | 'location'
  | 'address'
  | 'selectedDate'
  | 'selectedTimeSlot'
  | 'availableSlots'
  | 'notes'
  | 'isSubmitting'
  | 'bookingResult'
> = {
  step: 1,
  spaId: null,
  therapistId: null,
  location: null,
  address: null,
  selectedDate: null,
  selectedTimeSlot: null,
  availableSlots: [],
  notes: '',
  isSubmitting: false,
  bookingResult: null,
}

export const useBookingStore = create<BookingState>()((set) => ({
  ...INITIAL_STATE,

  setStep: (step) => set({ step }),

  nextStep: () => set((state) => ({ step: state.step + 1 })),

  prevStep: () => set((state) => ({ step: Math.max(1, state.step - 1) })),

  setSpaId: (spaId) => set({ spaId }),

  setTherapistId: (therapistId) => set({ therapistId }),

  setLocation: (location) => set({ location }),

  setAddress: (address) => set({ address }),

  setDate: (selectedDate) => set({ selectedDate }),

  setTimeSlot: (selectedTimeSlot) => set({ selectedTimeSlot }),

  setAvailableSlots: (availableSlots) => set({ availableSlots }),

  setNotes: (notes) => set({ notes }),

  setSubmitting: (isSubmitting) => set({ isSubmitting }),

  setBookingResult: (bookingResult) => set({ bookingResult }),

  reset: () => set({ ...INITIAL_STATE }),
}))
