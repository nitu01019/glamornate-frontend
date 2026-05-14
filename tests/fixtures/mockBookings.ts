/**
 * Mock Bookings Data
 *
 * Sample booking data for testing purposes.
 */

import type { Booking, BookingStatus, BookingSource } from '@/types';

export const mockBookings: Booking[] = [
  {
    id: 'booking_001',
    userId: 'user_customer_1',
    spaId: 'spa_mumbai_serenity',
    spaName: 'Serenity Spa & Wellness',
    therapistId: 'therapist_001',
    therapistName: 'Anjali Patel',
    serviceIds: ['srv_massage_aromatherapy'],
    slot: {
      date: '2026-03-24',
      start: '14:00',
      end: '15:00',
      duration: 60,
    },
    services: [
      {
        serviceId: 'srv_massage_aromatherapy',
        serviceName: 'Aromatherapy Massage',
        price: 2500,
        duration: 60,
        quantity: 1,
      },
    ],
    addons: [
      {
        id: 'addon_herbal_pack',
        name: 'Herbal Heat Pack',
        price: 500,
      },
    ],
    pricing: {
      services: 2500,
      addons: 500,
      tax: 540,
      discount: 0,
      platformFee: 150,
      total: 3690,
      currency: 'INR',
    },
    paymentDetails: {
      provider: 'razorpay',
      status: 'succeeded',
      paymentIntentId: 'pay_00123456789',
      amount: 3690,
      currency: 'INR',
    },
    bookingStatus: 'confirmed' as BookingStatus,
    statusHistory: [
      {
        status: 'draft' as BookingStatus,
        to: 'draft' as BookingStatus,
        actor: 'customer',
        actorId: 'user_customer_1',
        timestamp: '2026-03-20T10:30:00Z',
      },
      {
        status: 'confirmed' as BookingStatus,
        from: 'draft' as BookingStatus,
        to: 'confirmed' as BookingStatus,
        actor: 'customer',
        actorId: 'user_customer_1',
        timestamp: '2026-03-20T10:35:00Z',
      },
    ],
    customer: {
      name: 'Priya Sharma',
      phone: '+91 98765 43210',
      notes: 'Prefer lavender essential oil',
      preferences: 'Soft pressure',
    },
    notes: 'Customer requested lavender oil',
    specialRequests: 'Soft pressure please',
    reminderSent: {
      at_24hr: true,
      at_2hr: false,
    },
    isActive: true,
    createdBy: 'customer' as BookingSource,
    createdAt: '2026-03-20T10:30:00Z',
    updatedAt: '2026-03-24T10:00:00Z',
    scheduledAt: '2026-03-24T14:00:00Z',
  },
  {
    id: 'booking_002',
    userId: 'user_customer_1',
    spaId: 'spa_delhi_bliss',
    spaName: 'Bliss Wellness Center',
    serviceIds: ['srv_facial_gold'],
    slot: {
      date: '2026-03-25',
      start: '11:00',
      end: '12:30',
      duration: 90,
    },
    services: [
      {
        serviceId: 'srv_facial_gold',
        serviceName: 'Gold Radiance Facial',
        price: 5000,
        duration: 90,
        quantity: 1,
      },
    ],
    addons: [
      {
        id: 'addon_eye',
        name: 'Eye Treatment',
        price: 800,
      },
    ],
    pricing: {
      services: 5000,
      addons: 800,
      tax: 1044,
      discount: 500,
      platformFee: 290,
      total: 6634,
      currency: 'INR',
    },
    paymentDetails: {
      provider: 'razorpay',
      status: 'succeeded',
      paymentIntentId: 'pay_00123456790',
      amount: 6634,
      currency: 'INR',
    },
    bookingStatus: 'confirmed' as BookingStatus,
    statusHistory: [
      {
        status: 'draft' as BookingStatus,
        to: 'draft' as BookingStatus,
        actor: 'customer',
        actorId: 'user_customer_1',
        timestamp: '2026-03-21T15:00:00Z',
      },
      {
        status: 'payment_pending' as BookingStatus,
        from: 'draft' as BookingStatus,
        to: 'payment_pending' as BookingStatus,
        actor: 'customer',
        actorId: 'user_customer_1',
        timestamp: '2026-03-21T15:01:00Z',
      },
      {
        status: 'confirmed' as BookingStatus,
        from: 'payment_pending' as BookingStatus,
        to: 'confirmed' as BookingStatus,
        actor: 'system',
        timestamp: '2026-03-21T15:05:00Z',
      },
    ],
    customer: {
      name: 'Priya Sharma',
      phone: '+91 98765 43210',
    },
    reminderSent: {
      at_24hr: true,
      at_2hr: false,
    },
    isActive: true,
    createdBy: 'customer' as BookingSource,
    createdAt: '2026-03-21T15:00:00Z',
    updatedAt: '2026-03-24T10:00:00Z',
    scheduledAt: '2026-03-25T11:00:00Z',
  },
  {
    id: 'booking_003',
    userId: 'user_customer_2',
    spaId: 'spa_bangalore_urban',
    spaName: 'Urban Oasis',
    therapistId: 'therapist_003',
    therapistName: 'Kavitha Rao',
    serviceIds: ['srv_manicure_classic', 'srv_pedicure_classic'],
    slot: {
      date: '2026-03-23',
      start: '16:00',
      end: '17:30',
      duration: 90,
    },
    services: [
      {
        serviceId: 'srv_manicure_classic',
        serviceName: 'Classic Manicure',
        price: 600,
        duration: 30,
        quantity: 1,
      },
      {
        serviceId: 'srv_pedicure_classic',
        serviceName: 'Classic Pedicure',
        price: 800,
        duration: 45,
        quantity: 1,
      },
    ],
    addons: [
      {
        id: 'addon_gel',
        name: 'Gel Polish',
        price: 400,
      },
    ],
    pricing: {
      services: 1400,
      addons: 400,
      tax: 324,
      discount: 100,
      platformFee: 90,
      total: 2114,
      currency: 'INR',
    },
    paymentDetails: {
      provider: 'razorpay',
      status: 'succeeded',
      paymentIntentId: 'pay_00123456791',
      amount: 2114,
      currency: 'INR',
    },
    bookingStatus: 'completed' as BookingStatus,
    statusHistory: [
      {
        status: 'draft' as BookingStatus,
        to: 'draft' as BookingStatus,
        actor: 'customer',
        actorId: 'user_customer_2',
        timestamp: '2026-03-22T14:00:00Z',
      },
      {
        status: 'confirmed' as BookingStatus,
        from: 'draft' as BookingStatus,
        to: 'confirmed' as BookingStatus,
        actor: 'customer',
        actorId: 'user_customer_2',
        timestamp: '2026-03-22T14:02:00Z',
      },
      {
        status: 'in_progress' as BookingStatus,
        from: 'confirmed' as BookingStatus,
        to: 'in_progress' as BookingStatus,
        actor: 'spa',
        actorId: 'staff_spa_urban',
        timestamp: '2026-03-23T16:00:00Z',
      },
      {
        status: 'completed' as BookingStatus,
        from: 'in_progress' as BookingStatus,
        to: 'completed' as BookingStatus,
        actor: 'spa',
        actorId: 'staff_spa_urban',
        timestamp: '2026-03-23T17:30:00Z',
      },
    ],
    customer: {
      name: 'Amit Kumar',
      phone: '+91 87654 32109',
    },
    checkIn: '2026-03-23T16:00:00Z',
    checkOut: '2026-03-23T17:30:00Z',
    reminderSent: {
      at_24hr: true,
      at_2hr: true,
    },
    isActive: true,
    createdBy: 'customer' as BookingSource,
    createdAt: '2026-03-22T14:00:00Z',
    updatedAt: '2026-03-23T17:30:00Z',
    scheduledAt: '2026-03-23T16:00:00Z',
  },
  {
    id: 'booking_004',
    userId: 'user_customer_1',
    spaId: 'spa_mumbai_serenity',
    spaName: 'Serenity Spa & Wellness',
    serviceIds: ['srv_massage_deep_tissue'],
    slot: {
      date: '2026-03-26',
      start: '10:00',
      end: '11:30',
      duration: 90,
    },
    services: [
      {
        serviceId: 'srv_massage_deep_tissue',
        serviceName: 'Deep Tissue Massage',
        price: 3500,
        duration: 90,
        quantity: 1,
      },
    ],
    addons: [],
    pricing: {
      services: 3500,
      addons: 0,
      tax: 630,
      discount: 0,
      platformFee: 175,
      total: 4305,
      currency: 'INR',
    },
    paymentDetails: {
      provider: 'razorpay',
      status: 'pending',
      paymentIntentId: 'pay_00123456792',
      amount: 4305,
      currency: 'INR',
    },
    bookingStatus: 'payment_pending' as BookingStatus,
    statusHistory: [
      {
        status: 'draft' as BookingStatus,
        to: 'draft' as BookingStatus,
        actor: 'customer',
        actorId: 'user_customer_1',
        timestamp: '2026-03-24T09:00:00Z',
      },
      {
        status: 'payment_pending' as BookingStatus,
        from: 'draft' as BookingStatus,
        to: 'payment_pending' as BookingStatus,
        actor: 'customer',
        actorId: 'user_customer_1',
        timestamp: '2026-03-24T09:01:00Z',
      },
    ],
    customer: {
      name: 'Priya Sharma',
      phone: '+91 98765 43210',
    },
    isActive: true,
    createdBy: 'customer' as BookingSource,
    createdAt: '2026-03-24T09:00:00Z',
    updatedAt: '2026-03-24T09:01:00Z',
    scheduledAt: '2026-03-26T10:00:00Z',
  },
  {
    id: 'booking_005',
    userId: 'user_customer_3',
    spaId: 'spa_mumbai_serenity',
    spaName: 'Serenity Spa & Wellness',
    serviceIds: ['srv_wellness_yoga'],
    slot: {
      date: '2026-03-27',
      start: '07:00',
      end: '08:00',
      duration: 60,
    },
    services: [
      {
        serviceId: 'srv_wellness_yoga',
        serviceName: 'Private Yoga Session',
        price: 1500,
        duration: 60,
        quantity: 1,
      },
    ],
    addons: [],
    pricing: {
      services: 1500,
      addons: 0,
      tax: 270,
      discount: 0,
      platformFee: 75,
      total: 1845,
      currency: 'INR',
    },
    paymentDetails: {
      provider: 'razorpay',
      status: 'succeeded',
      paymentIntentId: 'pay_00123456793',
      amount: 1845,
      currency: 'INR',
    },
    bookingStatus: 'cancelled' as BookingStatus,
    statusHistory: [
      {
        status: 'draft' as BookingStatus,
        to: 'draft' as BookingStatus,
        actor: 'customer',
        actorId: 'user_customer_3',
        timestamp: '2026-03-20T16:00:00Z',
      },
      {
        status: 'confirmed' as BookingStatus,
        from: 'draft' as BookingStatus,
        to: 'confirmed' as BookingStatus,
        actor: 'customer',
        actorId: 'user_customer_3',
        timestamp: '2026-03-20T16:05:00Z',
      },
      {
        status: 'cancelled' as BookingStatus,
        from: 'confirmed' as BookingStatus,
        to: 'cancelled' as BookingStatus,
        actor: 'customer',
        actorId: 'user_customer_3',
        timestamp: '2026-03-22T10:00:00Z',
        reason: 'Schedule conflict',
      },
    ],
    customer: {
      name: 'Neha Singh',
      phone: '+91 76543 21098',
    },
    cancellation: {
      reason: 'Schedule conflict',
      cancelledBy: 'user_customer_3',
      cancelledAt: '2026-03-22T10:00:00Z',
      refundedAmount: 1845,
    },
    reminderSent: {
      at_24hr: false,
      at_2hr: false,
    },
    isActive: false,
    createdBy: 'customer' as BookingSource,
    createdAt: '2026-03-20T16:00:00Z',
    updatedAt: '2026-03-22T10:00:00Z',
    scheduledAt: '2026-03-27T07:00:00Z',
  },
];

export const getActiveBookings = (): Booking[] => mockBookings.filter(booking => booking.isActive);
export const getBookingById = (id: string): Booking | undefined => mockBookings.find(booking => booking.id === id);
export const getBookingsByUser = (userId: string): Booking[] =>
  mockBookings.filter(booking => booking.userId === userId);
export const getBookingsBySpa = (spaId: string): Booking[] =>
  mockBookings.filter(booking => booking.spaId === spaId);
export const getBookingsByStatus = (status: BookingStatus): Booking[] =>
  mockBookings.filter(booking => booking.bookingStatus === status);
export const getUpcomingBookings = (): Booking[] =>
  mockBookings.filter(booking =>
    booking.isActive &&
    ['draft', 'payment_pending', 'confirmed'].includes(booking.bookingStatus) &&
    new Date(booking.scheduledAt) > new Date()
  );
