/**
 * Mock Vouchers Data
 *
 * Sample voucher/discount code data for testing purposes.
 */

import type { Voucher, UserVoucher } from '@/types';

export const mockVouchers: Voucher[] = [
  {
    id: 'voucher_welcome',
    code: 'WELCOME20',
    type: 'discount',
    discountType: 'percentage',
    discountValue: 20,
    usageLimit: 10000,
    usedCount: 2341,
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z',
    applicableServices: [],
    applicableSpas: [],
    minOrderAmount: 500,
    maxDiscountAmount: 500,
    terms: 'Valid for first-time users only. Minimum order value ₹500. Maximum discount ₹500.',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-03-24T10:00:00Z',
  },
  {
    id: 'voucher_weekend',
    code: 'WEEKEND15',
    type: 'discount',
    discountType: 'percentage',
    discountValue: 15,
    usageLimit: 5000,
    usedCount: 1234,
    validFrom: '2026-02-01T00:00:00Z',
    validUntil: '2026-06-30T23:59:59Z',
    applicableServices: [],
    applicableSpas: [],
    minOrderAmount: 1000,
    maxDiscountAmount: 300,
    terms: 'Valid only on Saturday and Sunday bookings. Minimum order value ₹1000.',
    isActive: true,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-03-24T10:00:00Z',
  },
  {
    id: 'voucher_massage',
    code: 'RELAX300',
    type: 'discount',
    discountType: 'fixed',
    discountValue: 300,
    usageLimit: 3000,
    usedCount: 856,
    validFrom: '2026-01-15T00:00:00Z',
    validUntil: '2026-04-30T23:59:59Z',
    applicableServices: ['srv_massage_aromatherapy', 'srv_massage_deep_tissue'],
    applicableSpas: [],
    minOrderAmount: 0,
    maxDiscountAmount: 300,
    terms: 'Valid on massage services only. Cannot be combined with other offers.',
    isActive: true,
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-03-24T10:00:00Z',
  },
  {
    id: 'voucher_facial',
    code: 'GLOW20',
    type: 'discount',
    discountType: 'percentage',
    discountValue: 20,
    usageLimit: 2000,
    usedCount: 445,
    validFrom: '2026-03-01T00:00:00Z',
    validUntil: '2026-05-31T23:59:59Z',
    applicableServices: ['srv_facial_gold', 'srv_facial_diamond'],
    applicableSpas: [],
    minOrderAmount: 2000,
    maxDiscountAmount: 800,
    terms: 'Valid on premium facial treatments. Glow this summer with our special offer!',
    isActive: true,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-24T10:00:00Z',
  },
  {
    id: 'voucher_serenity',
    code: 'SERENITY10',
    type: 'discount',
    discountType: 'percentage',
    discountValue: 10,
    usageLimit: 1000,
    usedCount: 312,
    validFrom: '2026-02-15T00:00:00Z',
    validUntil: '2026-04-15T23:59:59Z',
    applicableServices: [],
    applicableSpas: ['spa_mumbai_serenity'],
    minOrderAmount: 0,
    maxDiscountAmount: 200,
    terms: 'Exclusive offer for Serenity Spa & Wellness customers only.',
    isActive: true,
    createdAt: '2026-02-15T00:00:00Z',
    updatedAt: '2026-03-24T10:00:00Z',
  },
  {
    id: 'voucher_referral',
    code: 'REFER500',
    type: 'referral',
    discountType: 'fixed',
    discountValue: 500,
    usageLimit: 10000,
    usedCount: 2341,
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2027-12-31T23:59:59Z',
    applicableServices: [],
    applicableSpas: [],
    minOrderAmount: 1500,
    maxDiscountAmount: 500,
    terms: 'Earn ₹500 for every friend you refer. Friend also gets ₹500 off their first booking.',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-03-24T10:00:00Z',
  },
  {
    id: 'voucher_gift_card',
    code: 'GIFT1000',
    type: 'gift_card',
    discountType: 'fixed',
    discountValue: 1000,
    usageLimit: 1,
    usedCount: 0,
    validFrom: '2026-03-01T00:00:00Z',
    validUntil: '2027-02-28T23:59:59Z',
    applicableServices: [],
    applicableSpas: [],
    minOrderAmount: 0,
    maxDiscountAmount: 1000,
    terms: 'Redeemable at any Glamornate partner spa. Non-transferable.',
    isActive: true,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'voucher_expired',
    code: 'EXPIRED50',
    type: 'discount',
    discountType: 'percentage',
    discountValue: 50,
    usageLimit: 500,
    usedCount: 500,
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2026-02-28T23:59:59Z',
    applicableServices: [],
    applicableSpas: [],
    minOrderAmount: 0,
    maxDiscountAmount: 0,
    terms: 'Expired promotion.',
    isActive: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
];

export const mockUserVouchers: UserVoucher[] = [
  {
    compositeId: 'user_customer_1_voucher_welcome',
    userId: 'user_customer_1',
    voucherId: 'voucher_welcome',
    remainingUses: 0,
    maxUses: 1,
    usedAt: ['2026-02-15T10:00:00Z'],
  },
  {
    compositeId: 'user_customer_1_voucher_massage',
    userId: 'user_customer_1',
    voucherId: 'voucher_massage',
    remainingUses: 1,
    maxUses: 2,
    usedAt: ['2026-03-24T10:30:00Z'],
  },
  {
    compositeId: 'user_customer_2_voucher_welcome',
    userId: 'user_customer_2',
    voucherId: 'voucher_welcome',
    remainingUses: 1,
    maxUses: 1,
    usedAt: [],
  },
  {
    compositeId: 'user_customer_3_voucher_referral',
    userId: 'user_customer_3',
    voucherId: 'voucher_referral',
    remainingUses: 3,
    maxUses: 5,
    usedAt: ['2026-03-10T14:00:00Z', '2026-03-18T16:00:00Z'],
  },
];

export const getActiveVouchers = (): Voucher[] => mockVouchers.filter(v => v.isActive);
export const getVoucherByCode = (code: string): Voucher | undefined =>
  mockVouchers.find(v => v.code.toUpperCase() === code.toUpperCase());
export const getApplicableVouchers = (serviceId?: string, spaId?: string, amount = 0): Voucher[] =>
  mockVouchers.filter(v => {
    if (!v.isActive) return false;
    // Check validity period
    const now = new Date().toISOString();
    if (now < v.validFrom || now > v.validUntil) return false;
    // Check usage limit
    if (v.usedCount >= v.usageLimit) return false;
    // Check minimum order amount
    if (amount < v.minOrderAmount) return false;
    // Check service filter
    if (serviceId && v.applicableServices.length > 0 && !v.applicableServices.includes(serviceId)) {
      return false;
    }
    // Check spa filter
    if (spaId && v.applicableSpas.length > 0 && !v.applicableSpas.includes(spaId)) {
      return false;
    }
    return true;
  });
export const getUserVouchers = (userId: string): UserVoucher[] =>
  mockUserVouchers.filter(uv => uv.userId === userId);
export const getUserAvailableVouchers = (userId: string): UserVoucher[] =>
  mockUserVouchers.filter(uv => uv.userId === userId && uv.remainingUses > 0);
