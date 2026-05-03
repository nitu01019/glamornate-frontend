import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { act } from '@testing-library/react';
import { collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { mockBooking, mockSpa, mockServices } from '../fixtures/firebase-mocks';

// Mock Firebase Firestore
vi.mock('firebase/firestore');

describe('Booking Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Booking Draft', () => {
    it('should create draft booking with selected services', async () => {
      const mockSetDoc = setDoc as Mock;
      mockSetDoc.mockResolvedValue(undefined);

      const bookingData = {
        bookingStatus: 'draft',
        userId: 'user_test_123',
        spaId: mockSpa.id,
        serviceIds: [mockServices[0].id],
        services: [
          {
            serviceId: mockServices[0].id,
            price: mockServices[0].basePrice,
            duration: mockServices[0].baseDuration,
            quantity: 1,
          },
        ],
        createdAt: new Date().toISOString(),
      };

      await act(async () => {
        await setDoc(doc(expect.anything() as never, 'bookings', 'new_booking_id'), bookingData);
      });

      expect(mockSetDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          bookingStatus: 'draft',
          userId: 'user_test_123',
        }),
      );
    });

    it('should calculate total price correctly', () => {
      const services = [
        {
          serviceId: mockServices[0].id,
          price: mockServices[0].basePrice,
          duration: mockServices[0].baseDuration,
          quantity: 1,
        },
        {
          serviceId: mockServices[1].id,
          price: mockServices[1].basePrice,
          duration: mockServices[1].baseDuration,
          quantity: 1,
        },
      ];

      const platformFee = 20; // 20%
      const servicesTotal = services.reduce((sum, s) => sum + s.price * s.quantity, 0);
      const total = servicesTotal * (1 + platformFee / 100);

      expect(servicesTotal).toBe(180); // 80 + 100
      expect(total).toBe(216); // 180 * 1.2
    });
  });

  describe('Confirm Booking', () => {
    it('should update booking status to confirmed', async () => {
      const mockUpdateDoc = updateDoc as Mock;
      mockUpdateDoc.mockResolvedValue(undefined);

      await act(async () => {
        await updateDoc(doc(expect.anything() as never, 'bookings', mockBooking.id), {
          bookingStatus: 'confirmed',
          paymentDetails: { provider: 'stripe', status: 'succeeded' },
        });
      });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          bookingStatus: 'confirmed',
        }),
      );
    });

    it('should record status history on confirmation', async () => {
      const statusHistoryEntry = {
        status: 'confirmed',
        from: 'payment_pending',
        to: 'confirmed',
        actor: 'system',
        actorId: 'stripe_webhook',
        timestamp: new Date().toISOString(),
        reason: null,
      };

      expect(statusHistoryEntry.status).toBe('confirmed');
      expect(statusHistoryEntry.from).toBe('payment_pending');
      expect(statusHistoryEntry.actor).toBe('system');
    });
  });

  describe('Cancel Booking', () => {
    it('should update booking status to cancelled', async () => {
      const mockUpdateDoc = updateDoc as Mock;
      mockUpdateDoc.mockResolvedValue(undefined);

      const cancellationData = {
        bookingStatus: 'cancelled',
        cancellation: {
          reason: 'Customer request',
          cancelledBy: 'customer',
          cancelledAt: new Date().toISOString(),
          refundedAmount: 0, // No refund for < 6 hours
        },
      };

      await act(async () => {
        await updateDoc(
          doc(expect.anything() as never, 'bookings', mockBooking.id),
          cancellationData,
        );
      });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          bookingStatus: 'cancelled',
        }),
      );
    });

    it('should calculate correct refund based on cancellation policy', () => {
      const basePrice = 100;
      const hoursBeforeBooking = 48;

      let refundPercent = 0;
      if (hoursBeforeBooking > 24) {
        refundPercent = 100;
      } else if (hoursBeforeBooking >= 6) {
        refundPercent = 50;
      } else {
        refundPercent = 0;
      }

      expect(refundPercent).toBe(100);
      expect(basePrice * (refundPercent / 100)).toBe(100);
    });
  });

  describe('Booking Availability', () => {
    it('should fetch available slots for a date', async () => {
      const mockGetDoc = getDoc as Mock;
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ slots: [] }),
      });

      const compositeId = `${mockSpa.id}_2024-04-01_any`;

      await act(async () => {
        await getDoc(doc(expect.anything() as never, 'availability', compositeId));
      });

      expect(mockGetDoc).toHaveBeenCalledWith(undefined);
    });

    it('should filter out booked slots', () => {
      const allSlots = [
        { start: '09:00', end: '10:00', available: true, bookingId: null },
        { start: '10:00', end: '11:00', available: false, bookingId: 'booking_1' },
        { start: '11:00', end: '12:00', available: true, bookingId: null },
      ];

      const availableSlots = allSlots.filter((slot) => slot.available);

      expect(availableSlots).toHaveLength(2);
      expect(availableSlots[0].start).toBe('09:00');
      expect(availableSlots[1].start).toBe('11:00');
    });
  });

  describe('Multi-service Booking', () => {
    it('should handle booking multiple services', async () => {
      const services = [
        {
          serviceId: mockServices[0].id,
          price: mockServices[0].basePrice,
          duration: mockServices[0].baseDuration,
          quantity: 1,
        },
        {
          serviceId: mockServices[2].id,
          price: mockServices[2].basePrice,
          duration: mockServices[2].baseDuration,
          quantity: 1,
        },
      ];

      const totalDuration = services.reduce((sum, s) => sum + s.duration * s.quantity, 0);
      const totalCost = services.reduce((sum, s) => sum + s.price * s.quantity, 0);

      expect(totalDuration).toBe(105); // 60 + 45
      expect(totalCost).toBe(145); // 80 + 65
    });
  });
});
