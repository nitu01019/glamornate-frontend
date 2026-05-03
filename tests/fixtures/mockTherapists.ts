/**
 * Mock Therapists Data
 *
 * Sample therapist data for testing purposes.
 */

import type { Therapist, TherapistStatus } from '@/types';

export const mockTherapists: Therapist[] = [
  {
    id: 'therapist_001',
    name: 'Anjali Patel',
    slug: 'anjali-patel',
    displayName: 'Anjali',
    photo: 'https://example.com/photos/therapists/anjali.jpg',
    coverImage: 'https://example.com/photos/therapists/anjali-cover.jpg',
    spaId: 'spa_mumbai_serenity',
    description: 'Certified massage therapist with 8 years of experience specializing in aromatherapy and deep tissue massage.',
    specialties: ['Aromatherapy', 'Deep Tissue', 'Swedish Massage'],
    certifications: [
      {
        name: 'Certified Massage Therapist (CMT)',
        issuer: 'International Association of Massage Therapists',
        issuedDate: '2018-06-15',
        expiryDate: '2028-06-15',
        documentUrl: 'https://example.com/docs/certs/anjali-cmt.pdf',
      },
      {
        name: 'Ayurvedic Massage Certification',
        issuer: 'Kerala Ayurveda Academy',
        issuedDate: '2019-03-10',
        documentUrl: 'https://example.com/docs/certs/anjali-ayurveda.pdf',
      },
    ],
    yearsOfExperience: 8,
    languages: ['English', 'Hindi', 'Marathi'],
    gender: 'female',
    rating: {
      overall: 4.8,
      count: 142,
    },
    status: 'online' as TherapistStatus,
    availability: {
      Monday: [
        { start: '09:00', end: '13:00' },
        { start: '14:00', end: '18:00' },
      ],
      Tuesday: [
        { start: '09:00', end: '13:00' },
        { start: '14:00', end: '18:00' },
      ],
      Wednesday: [
        { start: '09:00', end: '13:00' },
        { start: '14:00', end: '18:00' },
      ],
      Thursday: [
        { start: '09:00', end: '13:00' },
        { start: '14:00', end: '18:00' },
      ],
      Friday: [
        { start: '09:00', end: '13:00' },
        { start: '14:00', end: '19:00' },
      ],
      Saturday: [
        { start: '08:00', end: '19:00' },
      ],
      Sunday: [
        { start: '08:00', end: '14:00' },
      ],
    },
    commission: {
      percentage: 30,
      flatRate: 200,
    },
    statistics: {
      totalBookings: 523,
      revenue: 1250000,
      avgRating: 4.8,
    },
    isActive: true,
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-03-24T10:00:00Z',
  },
  {
    id: 'therapist_002',
    name: 'Rahul Sharma',
    slug: 'rahul-sharma',
    displayName: 'Rahul',
    photo: 'https://example.com/photos/therapists/rahul.jpg',
    spaId: 'spa_mumbai_serenity',
    description: 'Expert male therapist specializing in sports massage and therapeutic treatments. Former physiotherapy assistant.',
    specialties: ['Sports Massage', 'Therapeutic Massage', 'Deep Tissue'],
    certifications: [
      {
        name: 'Sports Massage Therapist',
        issuer: 'International Sports Massage Association',
        issuedDate: '2017-09-20',
        expiryDate: '2027-09-20',
      },
      {
        name: 'Physiotherapy Assistant Certificate',
        issuer: 'AIIMS Delhi',
        issuedDate: '2016-05-15',
      },
    ],
    yearsOfExperience: 10,
    languages: ['English', 'Hindi', 'Punjabi'],
    gender: 'male',
    rating: {
      overall: 4.6,
      count: 98,
    },
    status: 'online' as TherapistStatus,
    availability: {
      Monday: [
        { start: '10:00', end: '14:00' },
        { start: '15:00', end: '20:00' },
      ],
      Tuesday: [
        { start: '10:00', end: '14:00' },
        { start: '15:00', end: '20:00' },
      ],
      Wednesday: [
        { start: '10:00', end: '14:00' },
        { start: '15:00', end: '20:00' },
      ],
      Thursday: [],
      Friday: [
        { start: '10:00', end: '14:00' },
        { start: '15:00', end: '20:00' },
      ],
      Saturday: [
        { start: '09:00', end: '18:00' },
      ],
      Sunday: [],
    },
    commission: {
      percentage: 28,
      flatRate: 200,
    },
    statistics: {
      totalBookings: 387,
      revenue: 980000,
      avgRating: 4.6,
    },
    isActive: true,
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-03-24T09:00:00Z',
  },
  {
    id: 'therapist_003',
    name: 'Kavitha Rao',
    slug: 'kavitha-rao',
    displayName: 'Kavitha',
    photo: 'https://example.com/photos/therapists/kavitha.jpg',
    spaId: 'spa_bangalore_urban',
    description: 'Specialist in facials and body treatments. Expert in organic skincare products and relaxation therapies.',
    specialties: ['Facials', 'Body Treatments', 'Manicure', 'Pedicure'],
    certifications: [
      {
        name: 'CIDESCO Certification',
        issuer: 'CIDESCO International',
        issuedDate: '2019-01-25',
        expiryDate: '2029-01-25',
      },
      {
        name: 'Organic Skincare Specialist',
        issuer: 'Organic Beauty Academy',
        issuedDate: '2020-04-10',
      },
    ],
    yearsOfExperience: 6,
    languages: ['English', 'Kannada', 'Tamil', 'Telugu'],
    gender: 'female',
    rating: {
      overall: 4.9,
      count: 87,
    },
    status: 'online' as TherapistStatus,
    availability: {
      Monday: [
        { start: '11:00', end: '15:00' },
        { start: '16:00', end: '20:00' },
      ],
      Tuesday: [
        { start: '11:00', end: '15:00' },
        { start: '16:00', end: '20:00' },
      ],
      Wednesday: [
        { start: '11:00', end: '15:00' },
        { start: '16:00', end: '20:00' },
      ],
      Thursday: [
        { start: '11:00', end: '15:00' },
        { start: '16:00', end: '20:00' },
      ],
      Friday: [
        { start: '11:00', end: '21:00' },
      ],
      Saturday: [
        { start: '10:00', end: '21:00' },
      ],
      Sunday: [
        { start: '10:00', end: '17:00' },
      ],
    },
    commission: {
      percentage: 32,
      flatRate: 150,
    },
    statistics: {
      totalBookings: 289,
      revenue: 650000,
      avgRating: 4.9,
    },
    isActive: true,
    createdAt: '2026-02-01T08:00:00Z',
    updatedAt: '2026-03-24T08:00:00Z',
  },
  {
    id: 'therapist_004',
    name: 'Meera Gupta',
    slug: 'meera-gupta',
    displayName: 'Meera',
    photo: 'https://example.com/photos/therapists/meera.jpg',
    spaId: 'spa_delhi_bliss',
    description: 'Ayurveda specialist with training in Kerala. Expert in traditional Indian wellness treatments.',
    specialties: ['Ayurvedic Massage', 'Shirodhara', 'Abhyanga', 'Nasya'],
    certifications: [
      {
        name: 'Ayurvedic Practitioner',
        issuer: 'Kerala Ayurveda Institute',
        issuedDate: '2018-11-15',
        expiryDate: '2028-11-15',
      },
      {
        name: 'Panchkarma Therapy',
        issuer: 'National Institute of Ayurveda',
        issuedDate: '2019-06-20',
      },
    ],
    yearsOfExperience: 12,
    languages: ['English', 'Hindi', 'Sanskrit'],
    gender: 'female',
    rating: {
      overall: 4.9,
      count: 156,
    },
    status: 'offline' as TherapistStatus,
    onLeave: true,
    onLeaveFrom: '2026-03-20',
    onLeaveTo: '2026-03-30',
    commission: {
      percentage: 35,
      flatRate: 250,
    },
    statistics: {
      totalBookings: 721,
      revenue: 2100000,
      avgRating: 4.9,
    },
    isActive: true,
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-03-20T00:00:00Z',
  },
  {
    id: 'therapist_005',
    name: 'Vikram Singh',
    slug: 'vikram-singh',
    displayName: 'Vikram',
    photo: 'https://example.com/photos/therapists/vikram.jpg',
    spaId: 'spa_delhi_bliss',
    description: 'Meditation and yoga instructor. Specializes in stress relief and mindfulness sessions.',
    specialties: ['Yoga', 'Meditation', 'Mental Wellness', 'Breathwork'],
    certifications: [
      {
        name: 'Registered Yoga Teacher (RYT-500)',
        issuer: 'Yoga Alliance',
        issuedDate: '2017-02-28',
        expiryDate: '2027-02-28',
      },
      {
        name: 'Mindfulness Based Stress Reduction (MBSR)',
        issuer: 'Mindfulness Center',
        issuedDate: '2019-08-10',
      },
    ],
    yearsOfExperience: 15,
    languages: ['English', 'Hindi', 'Bengali'],
    gender: 'male',
    rating: {
      overall: 4.7,
      count: 134,
    },
    status: 'online' as TherapistStatus,
    availability: {
      Monday: [
        { start: '06:00', end: '10:00' },
        { start: '17:00', end: '20:00' },
      ],
      Tuesday: [
        { start: '06:00', end: '10:00' },
        { start: '17:00', end: '20:00' },
      ],
      Wednesday: [],
      Thursday: [
        { start: '06:00', end: '10:00' },
        { start: '17:00', end: '20:00' },
      ],
      Friday: [
        { start: '06:00', end: '10:00' },
        { start: '17:00', end: '20:00' },
      ],
      Saturday: [
        { start: '07:00', end: '12:00' },
        { start: '16:00', end: '19:00' },
      ],
      Sunday: [
        { start: '07:00', end: '11:00' },
      ],
    },
    commission: {
      percentage: 25,
      flatRate: 300,
    },
    statistics: {
      totalBookings: 412,
      revenue: 680000,
      avgRating: 4.7,
    },
    isActive: true,
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-03-24T11:00:00Z',
  },
];

export const getActiveTherapists = (): Therapist[] => mockTherapists.filter(t => t.isActive);
export const getTherapistsBySpa = (spaId: string): Therapist[] =>
  mockTherapists.filter(t => t.spaId === spaId);
export const getTherapistsByStatus = (status: TherapistStatus): Therapist[] =>
  mockTherapists.filter(t => t.status === status && !t.onLeave);
export const getAvailableTherapists = (): Therapist[] =>
  mockTherapists.filter(t => t.status === 'online' && !t.onLeave && t.isActive);
export const getTherapistById = (id: string): Therapist | undefined =>
  mockTherapists.find(t => t.id === id);
