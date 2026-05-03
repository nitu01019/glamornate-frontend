/**
 * Firebase Test Data Mocks for Glamornate
 * These mocks provide realistic test data for all Firebase collections
 */

// ========== USER MOCKS ==========
export const mockUser = {
  id: 'user_test_123',
  authProvider: 'email' as const,
  role: 'customer' as const,
  profile: {
    displayName: 'Test Customer',
    email: 'test@example.com',
    phone: '+1234567890',
    photo: 'https://example.com/photo.jpg',
    gender: 'prefer_not_to_say',
    dob: '1990-01-01',
  },
  emailVerified: true,
  phoneVerified: false,
  preferences: {
    language: 'en',
    notifications: {
      email: true,
      sms: false,
      push: true,
    },
  },
  customerData: {
    favorites: ['service_1', 'service_2'],
    history: ['booking_1', 'booking_2'],
  },
  isActive: true,
  lastLoginAt: new Date().toISOString(),
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: new Date().toISOString(),
}

export const mockSpaOwner = {
  ...mockUser,
  id: 'user_spa_owner_123',
  role: 'spa_owner' as const,
  profile: {
    ...mockUser.profile,
    displayName: 'Spa Owner',
    email: 'owner@spa.com',
    phone: '+1987654321',
  },
  customerData: undefined,
  spaData: {
    spaId: 'spa_test_123',
    permissions: ['full_access'],
    commissionRate: 20,
  },
}

export const mockAdmin = {
  ...mockUser,
  id: 'user_admin_123',
  role: 'admin' as const,
  profile: {
    ...mockUser.profile,
    displayName: 'Admin User',
    email: 'admin@glamornate.com',
  },
}

// ========== SPA MOCKS ==========
export const mockSpa = {
  id: 'spa_test_123',
  name: 'Glamournate Luxury Spa',
  slug: 'glamournate-luxury-spa',
  description: 'Premium spa and wellness center offering massage, facial, and body treatments.',
  shortDescription: 'Luxury spa in downtown',
  featuredImage: 'https://example.com/spa-main.jpg',
  gallery: [
    'https://example.com/gallery1.jpg',
    'https://example.com/gallery2.jpg',
  ],
  videoUrl: 'https://example.com/spa-video.mp4',
  location: {
    address: '123 Spa Street, Downtown',
    geo: { lat: 40.7128, lng: -74.0060 },
    city: 'New York',
    state: 'NY',
    zip: '10001',
    country: 'USA',
    timezone: 'America/New_York',
  },
  contact: {
    phone: '+1234567890',
    email: 'spa@example.com',
    website: 'https://spa.example.com',
    whatsapp: '+1234567890',
  },
  categories: ['massage', 'facial', 'body'],
  amenities: ['parking', 'wifi', 'shower', 'ac'],
  rating: {
    overall: 4.8,
    count: 156,
    breakdown: {
      ambiance: 4.9,
      service: 4.7,
      therapist: 4.8,
      hygiene: 4.9,
    },
  },
  tier: 'premium' as const,
  commission: {
    platformPercentage: 20,
    fixedFee: 0,
  },
  payout: {
    bankAccount: '****1234',
    payoutFrequency: 'weekly',
  },
  operatingHours: {
    mon: { open: '09:00', close: '21:00', closed: false },
    tue: { open: '09:00', close: '21:00', closed: false },
    wed: { open: '09:00', close: '21:00', closed: false },
    thu: { open: '09:00', close: '21:00', closed: false },
    fri: { open: '09:00', close: '22:00', closed: false },
    sat: { open: '10:00', close: '20:00', closed: false },
    sun: { open: '10:00', close: '18:00', closed: false },
  },
  status: 'active' as const,
  verification: {
    submittedAt: '2024-01-01T00:00:00Z',
    approvedAt: '2024-01-05T00:00:00Z',
    documents: [],
  },
  statistics: {
    totalBookings: 500,
    revenue: 75000,
  },
  seo: {
    metaTitle: 'Glamournate Luxury Spa - Best Massage & Wellness in NYC',
    metaDescription: 'Book premium spa treatments at Glamournate Luxury Spa. Massage, facial, body treatments.',
  },
  ownerId: 'user_spa_owner_123',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: new Date().toISOString(),
}

// ========== SERVICE MOCKS ==========
export const mockServices = [
  {
    id: 'service_massage_1',
    name: 'Swedish Massage',
    slug: 'swedish-massage',
    category: 'massage' as const,
    description: 'Relaxing full-body massage with Swedish techniques',
    benefits: ['Stress relief', 'Muscle relaxation', 'Improved circulation'],
    baseDuration: 60,
    durationVariants: [30, 45, 60, 90],
    basePrice: 80,
    currency: 'USD',
    recommendedFor: 'all' as const,
    tags: ['relaxing', 'therapeutic'],
    icon: '🧖',
    images: ['https://example.com/massage.jpg'],
    video: undefined,
    addOns: [],
    isActive: true,
    ordering: 1,
  },
  {
    id: 'service_massage_2',
    name: 'Deep Tissue Massage',
    slug: 'deep-tissue-massage',
    category: 'massage' as const,
    description: 'Intensive massage targeting deep muscle layers',
    benefits: ['Pain relief', 'Muscle recovery', 'Sports recovery'],
    baseDuration: 60,
    durationVariants: [60, 90],
    basePrice: 100,
    currency: 'USD',
    recommendedFor: 'all' as const,
    tags: ['therapeutic', 'sports'],
    icon: '💪',
    images: [],
    video: undefined,
    addOns: [],
    isActive: true,
    ordering: 2,
  },
  {
    id: 'service_facial_1',
    name: 'Hydrating Facial',
    slug: 'hydrating-facial',
    category: 'facial' as const,
    description: 'Rejuvenating facial treatment with hydrating products',
    benefits: ['Skin hydration', 'Glow', 'Anti-aging'],
    baseDuration: 45,
    durationVariants: [30, 45, 60],
    basePrice: 65,
    currency: 'USD',
    recommendedFor: 'women' as const,
    tags: ['skincare', 'relaxing'],
    icon: '✨',
    images: [],
    video: undefined,
    addOns: [],
    isActive: true,
    ordering: 3,
  },
]

// ========== THERAPIST MOCKS ==========
export const mockTherapist = {
  id: 'therapist_1',
  name: 'Sarah Johnson',
  slug: 'sarah-johnson',
  displayName: 'Sarah J.',
  photo: 'https://example.com/therapist.jpg',
  coverImage: 'https://example.com/therapist-cover.jpg',
  spaId: 'spa_test_123',
  description: 'Certified massage therapist with 5+ years experience',
  specialties: ['service_massage_1', 'service_massage_2'],
  certifications: [
    {
      name: 'Licensed Massage Therapist',
      issuer: 'National Certification Board',
      issuedDate: '2019-01-01',
      expiryDate: '2025-01-01',
      documentUrl: 'https://example.com/cert.pdf',
    },
  ],
  yearsOfExperience: 5,
  languages: ['en', 'es'],
  gender: 'female',
  rating: {
    overall: 4.9,
    count: 89,
  },
  status: 'online' as const,
  onLeave: false,
  availability: {
    mon: ['09:00-12:00', '14:00-18:00'],
    tue: ['09:00-12:00', '14:00-18:00'],
    wed: ['09:00-12:00', '14:00-18:00'],
    thu: ['09:00-12:00', '14:00-18:00'],
    fri: ['09:00-12:00', '14:00-18:00'],
    sat: ['10:00-14:00'],
    sun: [],
  },
  commission: {
    percentage: 30,
    flatRate: 0,
  },
  statistics: {
    totalBookings: 200,
    revenue: 15000,
    avgRating: 4.9,
  },
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: new Date().toISOString(),
}

// ========== BOOKING MOCKS ==========
export const mockBooking = {
  id: 'booking_test_123',
  userId: 'user_test_123',
  spaId: 'spa_test_123',
  therapistId: 'therapist_1',
  serviceIds: ['service_massage_1'],
  slot: {
    date: '2024-04-01',
    start: '14:00',
    end: '15:00',
    duration: 60,
  },
  services: [
    {
      serviceId: 'service_massage_1',
      price: 80,
      duration: 60,
      quantity: 1,
    },
  ],
  addons: [],
  pricing: {
    services: 80,
    addons: 0,
    tax: 8,
    discount: 0,
    platformFee: 16,
    total: 104,
  },
  paymentDetails: {
    provider: 'stripe',
    status: 'succeeded',
    paymentIntentId: 'pi_test_123',
    paymentMethodId: 'pm_test_123',
  },
  bookingStatus: 'confirmed' as const,
  statusHistory: [
    {
      status: 'draft',
      from: null,
      to: 'draft',
      actor: 'customer',
      actorId: 'user_test_123',
      timestamp: '2024-03-24T10:00:00Z',
      reason: null,
    },
    {
      status: 'confirmed',
      from: 'draft',
      to: 'confirmed',
      actor: 'customer',
      actorId: 'user_test_123',
      timestamp: '2024-03-24T10:05:00Z',
      reason: null,
    },
  ],
  customer: {
    name: 'Test Customer',
    phone: '+1234567890',
    notes: 'Prefers light pressure',
    preferences: {},
  },
  notes: '',
  specialRequests: '',
  cancellation: null,
  reminderSent: {
    at_24hr: true,
    at_2hr: false,
  },
  checkIn: null,
  checkOut: null,
  reviewId: null,
  isActive: true,
  createdBy: 'customer',
  createdAt: '2024-03-24T10:00:00Z',
  updatedAt: '2024-03-24T10:05:00Z',
  scheduledAt: '2024-04-01T14:00:00Z',
}

// ========== REVIEW MOCKS ==========
export const mockReview = {
  id: 'review_1',
  userId: 'user_test_123',
  bookingId: 'booking_test_123',
  spaId: 'spa_test_123',
  therapistId: 'therapist_1',
  rating: 5,
  aspects: {
    ambiance: 5,
    service: 5,
    therapist: 5,
    hygiene: 5,
  },
  comment: 'Amazing experience! Sarah was excellent and the spa had a relaxing atmosphere.',
  title: 'Best massage ever',
  photos: [],
  videos: [],
  helpfulCount: 12,
  reportedCount: 0,
  moderation: {
    status: 'approved',
    moderatedBy: null,
  },
  reportedBy: [],
  createdAt: '2024-03-25T00:00:00Z',
}

// ========== VOUCHER MOCKS ==========
export const mockVoucher = {
  id: 'voucher_first20',
  code: 'FIRST20',
  type: 'discount' as const,
  discountType: 'percentage',
  discountValue: 20,
  usageLimit: 1000,
  usedCount: 250,
  validFrom: '2024-01-01T00:00:00Z',
  validUntil: '2024-12-31T23:59:59Z',
  applicableServices: [],
  applicableSpas: [],
  minOrderAmount: 50,
  maxDiscountAmount: 50,
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
}

// ========== AVAILABILITY MOCKS ==========
export const mockAvailability = {
  compositeId: 'spa_test_123_2024-04-01_any',
  date: '2024-04-01',
  spaId: 'spa_test_123',
  therapistId: 'any',
  slots: [
    { start: '09:00', end: '10:00', available: true, bookingId: null },
    { start: '10:00', end: '11:00', available: true, bookingId: null },
    { start: '11:00', end: '12:00', available: false, bookingId: 'booking_1' },
    { start: '12:00', end: '13:00', available: false, bookingId: 'booking_2' },
    { start: '13:00', end: '14:00', available: true, bookingId: null },
    { start: '14:00', end: '15:00', available: true, bookingId: null },
    { start: '15:00', end: '16:00', available: false, bookingId: 'booking_test_123' },
    { start: '16:00', end: '17:00', available: true, bookingId: null },
    { start: '17:00', end: '18:00', available: true, bookingId: null },
    { start: '18:00', end: '19:00', available: true, bookingId: null },
    { start: '19:00', end: '20:00', available: false, bookingId: 'booking_3' },
    { start: '20:00', end: '21:00', available: true, bookingId: null },
  ],
  lastCalculatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
}

// Export all mocks as a collection
export const mockData = {
  users: [mockUser, mockSpaOwner, mockAdmin],
  spas: [mockSpa],
  services: mockServices,
  therapists: [mockTherapist],
  bookings: [mockBooking],
  reviews: [mockReview],
  vouchers: [mockVoucher],
  availability: [mockAvailability],
}
