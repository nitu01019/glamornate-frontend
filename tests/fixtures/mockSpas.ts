/**
 * Mock Spas Data
 *
 * Sample spa data for testing purposes.
 */

import type { Spa, ServiceCategory, SpaStatus, SpaTier } from '@/types';

export const mockSpas: Spa[] = [
  {
    name: 'Serenity Spa & Wellness',
    slug: 'serenity-spa-wellness',
    description: 'A premium wellness destination offering world-class spa treatments in the heart of Mumbai. Our experienced therapists provide personalized services for rejuvenation and relaxation.',
    shortDescription: 'Premium spa in Mumbai offering massage, facial, and wellness treatments.',
    featuredImage: 'https://example.com/images/spas/serenity-featured.jpg',
    gallery: [
      'https://example.com/images/spas/serenity-1.jpg',
      'https://example.com/images/spas/serenity-2.jpg',
      'https://example.com/images/spas/serenity-3.jpg',
      'https://example.com/images/spas/serenity-4.jpg',
    ],
    location: {
      address: '123, Sea View Road, Bandra West',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050',
      geo: { lat: 19.0596, lng: 72.8295 },
      timezone: 'Asia/Kolkata',
    },
    contact: {
      phone: '+91 22 1234 5678',
      email: 'info@serenityspa.com',
      website: 'https://serenityspa.com',
      whatsapp: '+91 98765 12345',
    },
    categories: ['massage', 'facial', 'body', 'pedicure', 'manicure', 'wellness'] as ServiceCategory[],
    amenities: [
      'Free WiFi',
      'Parking Available',
      'Locker Room',
      'Steam Room',
      'Sauna',
      'Jacuzzi',
      'Spa Cuisine',
      'Yoga Sessions',
    ],
    rating: {
      overall: 4.7,
      count: 324,
      breakdown: {
        ambiance: 4.8,
        service: 4.7,
        therapist: 4.6,
        hygiene: 4.9,
      },
    },
    tier: 'premium' as SpaTier,
    commission: {
      platformPercentage: 15,
      fixedFee: 50,
    },
    payout: {
      bankAccount: {
        accountNumber: '123456789012',
        ifscCode: 'SBIN0001234',
        accountHolderName: 'Rahul Verma',
      },
      payoutFrequency: 'weekly',
    },
    operatingHours: {
      Monday: { open: '09:00', close: '21:00', isOpen: true },
      Tuesday: { open: '09:00', close: '21:00', isOpen: true },
      Wednesday: { open: '09:00', close: '21:00', isOpen: true },
      Thursday: { open: '09:00', close: '21:00', isOpen: true },
      Friday: { open: '09:00', close: '22:00', isOpen: true },
      Saturday: { open: '08:00', close: '22:00', isOpen: true },
      Sunday: { open: '08:00', close: '20:00', isOpen: true },
    },
    status: 'active' as SpaStatus,
    verification: {
      submittedAt: '2026-01-10T08:00:00Z',
      approvedAt: '2026-01-12T10:00:00Z',
      documents: [
        { type: 'business_license', url: 'https://example.com/docs/license.pdf', verified: true },
        { type: 'gst_certificate', url: 'https://example.com/docs/gst.pdf', verified: true },
      ],
    },
    statistics: {
      totalBookings: 1250,
      revenue: 2500000,
    },
    seo: {
      metaTitle: 'Serenity Spa Mumbai - Best Spa Massage & Wellness Center',
      metaDescription: 'Experience luxury spa treatments at Serenity Spa in Mumbai. Book massage, facial, body treatments, and wellness packages.',
    },
    isActive: true,
    ownerId: 'user_spa_owner_1',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-03-24T10:00:00Z',
  },
  {
    name: 'Bliss Wellness Center',
    slug: 'bliss-wellness-center',
    description: 'Your haven of tranquility in Delhi. We specialize in Ayurvedic treatments combined with modern spa techniques for complete wellness.',
    shortDescription: 'Ayurvedic and modern spa treatments in Delhi.',
    featuredImage: 'https://example.com/images/spas/bliss-featured.jpg',
    gallery: [
      'https://example.com/images/spas/bliss-1.jpg',
      'https://example.com/images/spas/bliss-2.jpg',
    ],
    location: {
      address: '45, Green Park Extension',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110016',
      geo: { lat: 28.5634, lng: 77.1914 },
      timezone: 'Asia/Kolkata',
    },
    contact: {
      phone: '+91 11 2345 6789',
      email: 'hello@blisswellness.com',
      whatsapp: '+91 98765 54321',
    },
    categories: ['massage', 'facial', 'wellness'] as ServiceCategory[],
    amenities: [
      'Free WiFi',
      'Parking Available',
      'Steam Room',
      'Meditation Room',
    ],
    rating: {
      overall: 4.5,
      count: 189,
      breakdown: {
        ambiance: 4.6,
        service: 4.5,
        therapist: 4.4,
        hygiene: 4.7,
      },
    },
    tier: 'premium' as SpaTier,
    commission: {
      platformPercentage: 15,
      fixedFee: 50,
    },
    payout: {
      bankAccount: {
        accountNumber: '098765432109',
        ifscCode: 'HDFC0009876',
        accountHolderName: 'Meera Gupta',
      },
      payoutFrequency: 'biweekly',
    },
    operatingHours: {
      Monday: { open: '10:00', close: '20:00', isOpen: true },
      Tuesday: { open: '10:00', close: '20:00', isOpen: true },
      Wednesday: { open: '10:00', close: '20:00', isOpen: true },
      Thursday: { open: '10:00', close: '20:00', isOpen: true },
      Friday: { open: '10:00', close: '21:00', isOpen: true },
      Saturday: { open: '09:00', close: '21:00', isOpen: true },
      Sunday: { open: '09:00', close: '19:00', isOpen: true },
    },
    status: 'active' as SpaStatus,
    isActive: true,
    ownerId: 'user_spa_owner_2',
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-03-23T15:00:00Z',
  },
  {
    name: 'Urban Oasis',
    slug: 'urban-oasis',
    description: 'Quick relaxation in the city. Express services for busy professionals who need a quick recharge.',
    shortDescription: 'Express spa services in Bangalore.',
    featuredImage: 'https://example.com/images/spas/urban-featured.jpg',
    gallery: [
      'https://example.com/images/spas/urban-1.jpg',
    ],
    location: {
      address: '78, Indiranagar 100ft Road',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560038',
      geo: { lat: 12.9716, lng: 77.6071 },
      timezone: 'Asia/Kolkata',
    },
    contact: {
      phone: '+91 80 3456 7890',
      email: 'contact@urbanoasis.com',
    },
    categories: ['massage', 'manicure', 'pedicure'] as ServiceCategory[],
    amenities: [
      'Free WiFi',
      'Coffee Bar',
    ],
    rating: {
      overall: 4.2,
      count: 76,
    },
    tier: 'basic' as SpaTier,
    commission: {
      platformPercentage: 20,
      fixedFee: 30,
    },
    payout: {
      bankAccount: {
        accountNumber: '567890123456',
        ifscCode: 'ICIC0005678',
        accountHolderName: 'Karthik Reddy',
      },
      payoutFrequency: 'monthly',
    },
    operatingHours: {
      Monday: { open: '11:00', close: '21:00', isOpen: true },
      Tuesday: { open: '11:00', close: '21:00', isOpen: true },
      Wednesday: { open: '11:00', close: '21:00', isOpen: true },
      Thursday: { open: '11:00', close: '21:00', isOpen: true },
      Friday: { open: '11:00', close: '22:00', isOpen: true },
      Saturday: { open: '10:00', close: '22:00', isOpen: true },
      Sunday: { open: '10:00', close: '18:00', isOpen: true },
    },
    status: 'verified' as SpaStatus,
    isActive: true,
    ownerId: 'user_spa_owner_3',
    createdAt: '2026-02-01T08:00:00Z',
    updatedAt: '2026-03-22T12:00:00Z',
  },
];

export const getActiveSpas = (): Spa[] => mockSpas.filter(spa => spa.isActive);
export const getSpaBySlug = (slug: string): Spa | undefined => mockSpas.find(spa => spa.slug === slug);
export const getSpasByTier = (tier: SpaTier): Spa[] => mockSpas.filter(spa => spa.tier === tier);
export const getSpasByCategory = (category: ServiceCategory): Spa[] =>
  mockSpas.filter(spa => spa.categories.includes(category));
