/**
 * Mock Users Data
 *
 * Sample user data for testing purposes.
 */

import type { User, UserRole, AuthProvider } from '@/types';

export const mockUsers: User[] = [
  {
    authProvider: 'email' as AuthProvider,
    role: 'customer' as UserRole,
    profile: {
      displayName: 'Priya Sharma',
      email: 'priya.sharma@example.com',
      phone: '+91 90000 00000',
      photo: 'https://example.com/photos/priya.jpg',
      gender: 'female',
      dob: '1990-05-15',
    },
    emailVerified: true,
    phoneVerified: true,
    preferences: {
      language: 'en',
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
    },
    customerData: {
      favorites: ['spa_mumbai_serenity', 'spa_delhi_bliss'],
      history: ['booking_001', 'booking_002'],
    },
 isActive: true,
    lastLoginAt: '2026-03-24T10:30:00Z',
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-03-24T10:30:00Z',
  },
  {
    authProvider: 'google' as AuthProvider,
    role: 'spa_owner' as UserRole,
    profile: {
      displayName: 'Rahul Verma',
      email: 'rahul.verma@serenityspa.com',
      phone: '+91 90000 00003',
      photo: 'https://example.com/photos/rahul.jpg',
      gender: 'male',
    },
    emailVerified: true,
    phoneVerified: true,
    preferences: {
      language: 'en',
      notifications: {
        email: true,
        push: true,
        sms: true,
      },
    },
    spaData: {
      spaId: 'spa_mumbai_serenity',
      permissions: ['manage_services', 'manage_therapists', 'view_bookings'],
      commissionRate: 15,
    },
    isActive: true,
    lastLoginAt: '2026-03-24T09:15:00Z',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-03-24T09:15:00Z',
  },
  {
    authProvider: 'email' as AuthProvider,
    role: 'spa_staff' as UserRole,
    profile: {
      displayName: 'Anjali Patel',
      email: 'anjali@serenityspa.com',
      phone: '+91 90000 00005',
      photo: 'https://example.com/photos/anjali.jpg',
      gender: 'female',
    },
    emailVerified: true,
    phoneVerified: false,
    preferences: {
      language: 'en',
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
    },
    spaData: {
      spaId: 'spa_mumbai_serenity',
      permissions: ['view_bookings', 'manage_inventory'],
    },
    isActive: true,
    lastLoginAt: '2026-03-24T08:00:00Z',
    createdAt: '2026-02-01T08:00:00Z',
    updatedAt: '2026-03-24T08:00:00Z',
  },
  {
    authProvider: 'email' as AuthProvider,
    role: 'admin' as UserRole,
    profile: {
      displayName: 'Admin User',
      email: 'admin@glamornate.test',
      phone: '+91 90000 00002',
    },
    emailVerified: true,
    phoneVerified: true,
    preferences: {
      language: 'en',
      notifications: {
        email: true,
        push: true,
        sms: true,
      },
    },
    isActive: true,
    lastLoginAt: '2026-03-24T11:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-03-24T11:00:00Z',
  },
  {
    authProvider: 'phone' as AuthProvider,
    role: 'customer' as UserRole,
    profile: {
      displayName: 'Amit Kumar',
      phone: '+91 90000 00001',
      gender: 'male',
    },
    emailVerified: false,
    phoneVerified: true,
    customerData: {
      history: ['booking_003'],
    },
    isActive: true,
    lastLoginAt: '2026-03-23T16:45:00Z',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-03-23T16:45:00Z',
  },
];

export const mockCustomers = mockUsers.filter(u => u.role === 'customer');
export const mockSpaOwners = mockUsers.filter(u => u.role === 'spa_owner');
export const mockSpaStaff = mockUsers.filter(u => u.role === 'spa_staff');
export const mockAdmins = mockUsers.filter(u => u.role === 'admin');
