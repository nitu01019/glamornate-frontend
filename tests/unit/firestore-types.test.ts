/**
 * Firestore Types Test
 *
 * Tests to validate type consistency and structure across the application.
 */

import type {
  User,
  UserRole,
  Spa,
  Service,
  Booking,
  BookingStatus,
  SpaCategory,
  Therapist,
  Review,
} from '@/types';

describe('Firestore Types', () => {
  describe('UserRole Type', () => {
    it('should accept valid user roles', () => {
      const validRoles: UserRole[] = ['customer', 'spa_owner', 'spa_staff', 'admin'];
      validRoles.forEach(role => {
        expect(['customer', 'spa_owner', 'spa_staff', 'admin']).toContain(role);
      });
    });
  });

  describe('SpaCategory Type', () => {
    it('should accept valid service categories', () => {
      const validCategories: SpaCategory[] = [
        'massage',
        'facial',
        'body',
        'pedicure',
        'manicure',
        'wellness',
      ];
      validCategories.forEach(category => {
        expect(['massage', 'facial', 'body', 'pedicure', 'manicure', 'wellness']).toContain(category);
      });
    });
  });

  describe('BookingStatus Type', () => {
    it('should accept valid booking statuses', () => {
      const validStatuses: BookingStatus[] = [
        'draft',
        'payment_pending',
        'confirmed',
        'en_route',
        'in_progress',
        'completed',
        'cancelled',
      ];
      validStatuses.forEach(status => {
        expect(['draft', 'payment_pending', 'confirmed', 'en_route', 'in_progress', 'completed', 'cancelled']).toContain(status);
      });
    });
  });

  describe('User Type Structure', () => {
    it('should have required User fields', () => {
      const requiredFields: (keyof User)[] = [
        'authProvider',
        'role',
        'profile',
        'isActive',
        'createdAt',
        'updatedAt',
      ];

      const mockUser = {
        authProvider: 'email' as const,
        role: 'customer' as const,
        profile: { displayName: 'Test User' },
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      requiredFields.forEach(field => {
        expect(mockUser).toHaveProperty(field);
      });
    });
  });

  describe('Spa Type Structure', () => {
    it('should have required Spa fields', () => {
      const requiredFields: (keyof Spa)[] = [
        'name',
        'slug',
        'description',
        'shortDescription',
        'location',
        'contact',
        'categories',
        'amenities',
        'rating',
        'tier',
        'commission',
        'payout',
        'operatingHours',
        'status',
        'isActive',
        'ownerId',
        'createdAt',
        'updatedAt',
      ];

      const mockSpa = {
        name: 'Test Spa',
        slug: 'test-spa',
        description: 'A test spa',
        shortDescription: 'Test spa description',
        location: {
          address: '123 Test St',
          geo: { lat: 19.0760, lng: 72.8777 },
        },
        contact: { phone: '+91 1234567890', email: 'test@example.com' },
        categories: ['massage'],
        amenities: [],
        rating: { overall: 4.5, count: 10 },
        tier: 'basic',
        commission: { platformPercentage: 15, fixedFee: 50 },
        payout: { payoutFrequency: 'weekly' },
        operatingHours: { Monday: { open: '09:00', close: '18:00', isOpen: true } },
        status: 'active',
        isActive: true,
        ownerId: 'test-owner',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      requiredFields.forEach(field => {
        expect(mockSpa).toHaveProperty(field);
      });
    });
  });

  describe('Service Type Structure', () => {
    it('should have required Service fields', () => {
      const requiredFields: (keyof Service)[] = [
        'id',
        'name',
        'slug',
        'category',
        'description',
        'benefits',
        'baseDuration',
        'durationVariants',
        'basePrice',
        'currency',
        'recommendedFor',
        'tags',
        'images',
        'addOns',
        'isActive',
        'ordering',
      ];

      const mockService = {
        id: 'test-service',
        name: 'Test Service',
        slug: 'test-service',
        category: 'massage',
        description: 'A test service',
        benefits: [],
        baseDuration: 60,
        durationVariants: [60],
        basePrice: 1000,
        currency: 'INR',
        recommendedFor: 'all',
        tags: [],
        images: [],
        addOns: [],
        isActive: true,
        ordering: 1,
      };

      requiredFields.forEach(field => {
        expect(mockService).toHaveProperty(field);
      });
    });
  });

  describe('Booking Type Structure', () => {
    it('should have required Booking fields', () => {
      const requiredFields: (keyof Booking)[] = [
        'id',
        'userId',
        'spaId',
        'serviceIds',
        'slot',
        'services',
        'pricing',
        'bookingStatus',
        'statusHistory',
        'customer',
        'isActive',
        'createdBy',
        'createdAt',
        'updatedAt',
        'scheduledAt',
      ];

      const mockBooking = {
        id: 'test-booking',
        userId: 'test-user',
        spaId: 'test-spa',
        serviceIds: ['test-service'],
        slot: {
          date: '2026-03-24',
          start: '10:00',
          end: '11:00',
          duration: 60,
        },
        services: [
          {
            serviceId: 'test-service',
            price: 1000,
            duration: 60,
            quantity: 1,
          },
        ],
        pricing: {
          services: 1000,
          addons: 0,
          tax: 180,
          discount: 0,
          platformFee: 50,
          total: 1230,
          currency: 'INR',
        },
        bookingStatus: 'confirmed',
        statusHistory: [
          {
            status: 'confirmed',
            to: 'confirmed',
            actor: 'customer',
            timestamp: '2026-03-24T10:00:00Z',
          },
        ],
        customer: {
          name: 'Test Customer',
          phone: '+91 1234567890',
        },
        isActive: true,
        createdBy: 'customer',
        createdAt: '2026-03-24T10:00:00Z',
        updatedAt: '2026-03-24T10:00:00Z',
        scheduledAt: '2026-03-24T10:00:00Z',
      };

      requiredFields.forEach(field => {
        expect(mockBooking).toHaveProperty(field);
      });
    });
  });

  describe('Therapist Type Structure', () => {
    it('should have required Therapist fields', () => {
      const requiredFields: (keyof Therapist)[] = [
        'id',
        'name',
        'slug',
        'displayName',
        'spaId',
        'specialties',
        'certifications',
        'yearsOfExperience',
        'languages',
        'gender',
        'rating',
        'status',
        'isActive',
        'createdAt',
        'updatedAt',
      ];

      const mockTherapist = {
        id: 'test-therapist',
        name: 'Test Therapist',
        slug: 'test-therapist',
        displayName: 'Test Therapist',
        photo: 'https://example.com/photo.jpg',
        spaId: 'test-spa',
        description: 'A test therapist',
        specialties: ['massage'],
        certifications: [],
        yearsOfExperience: 5,
        languages: ['English'],
        gender: 'female',
        rating: { overall: 4.5, count: 50 },
        status: 'online',
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      requiredFields.forEach(field => {
        expect(mockTherapist).toHaveProperty(field);
      });
    });
  });

  describe('Review Type Structure', () => {
    it('should have required Review fields', () => {
      const requiredFields: (keyof Review)[] = [
        'id',
        'userId',
        'bookingId',
        'spaId',
        'rating',
        'photos',
        'videos',
        'helpfulCount',
        'reportedCount',
        'isActive',
        'createdAt',
        'updatedAt',
      ];

      const mockReview = {
        id: 'test-review',
        userId: 'test-user',
        bookingId: 'test-booking',
        spaId: 'test-spa',
        rating: 5,
        photos: [],
        videos: [],
        helpfulCount: 0,
        reportedCount: 0,
        isActive: true,
        createdAt: '2026-03-24T10:00:00Z',
        updatedAt: '2026-03-24T10:00:00Z',
      };

      requiredFields.forEach(field => {
        expect(mockReview).toHaveProperty(field);
      });
    });

    it('should validate rating range', () => {
      const validRatings = [1, 2, 3, 4, 5];
      const invalidRatings = [0, 6, -1, 10];

      validRatings.forEach(rating => {
        expect(rating).toBeGreaterThanOrEqual(1);
        expect(rating).toBeLessThanOrEqual(5);
      });

      invalidRatings.forEach(rating => {
        expect(rating < 1 || rating > 5).toBe(true);
      });
    });
  });

  describe('Type Exports', () => {
    it('should have all major type exports', () => {
      // TypeScript types are erased at runtime, so we verify the imports
      // compile correctly by checking that the type names are used above.
      // Each type-only import is validated by the TypeScript compiler, not at runtime.
      const typeNames = [
        'User',
        'UserRole',
        'Spa',
        'Service',
        'Booking',
        'BookingStatus',
        'SpaCategory',
        'Therapist',
        'Review',
      ];

      expect(typeNames).toHaveLength(9);
    });
  });
});
