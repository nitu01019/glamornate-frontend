import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, DiscountType } from '@/types';

const STORAGE_KEY = 'glamornate-cart';
const STORE_VERSION = 1;

interface ApplyVoucherData {
  code: string;
  discount: number;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number;
  minOrder?: number;
  name?: string;
}

const VOUCHER_DEFAULTS = {
  voucherCode: null as string | null,
  voucherDiscount: 0,
  voucherName: null as string | null,
  voucherDiscountType: null as DiscountType | null,
  voucherDiscountValue: 0,
  voucherMaxDiscount: null as number | null,
  voucherMinOrder: 0,
} as const;

interface CartState {
  _hasHydrated: boolean;
  items: CartItem[];

  // Drawer visibility (session-only, not persisted) — drives the global
  // CartDrawer mounted from `<GlobalWidgets />`. Phase 6 globalised the
  // cart sheet so it can open from any page without a route change.
  isOpen: boolean;

  // Voucher state (session-only, not persisted)
  voucherCode: string | null;
  voucherDiscount: number;
  voucherName: string | null;
  voucherDiscountType: DiscountType | null;
  voucherDiscountValue: number;
  voucherMaxDiscount: number | null;
  voucherMinOrder: number;

  setHasHydrated: (value: boolean) => void;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, 'quantity'>, options?: { openDrawer?: boolean }) => void;
  removeItem: (serviceId: string) => void;
  updateQuantity: (serviceId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getTotalDuration: () => number;
  getItemCount: () => number;
  applyVoucher: (data: ApplyVoucherData) => void;
  removeVoucher: () => void;
  getDiscountedTotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      items: [],
      isOpen: false,
      ...VOUCHER_DEFAULTS,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      addItem: (item, options) => {
        const openDrawer = options?.openDrawer ?? true;
        set((state) => {
          const existing = state.items.find((i) => i.serviceId === item.serviceId);
          const nextItems = existing
            ? state.items.map((i) =>
                i.serviceId === item.serviceId ? { ...i, quantity: i.quantity + 1 } : i,
              )
            : [...state.items, { ...item, quantity: 1 }];
          return openDrawer ? { items: nextItems, isOpen: true } : { items: nextItems };
        });
      },

      removeItem: (serviceId) => {
        set((state) => ({
          items: state.items.filter((i) => i.serviceId !== serviceId),
        }));
      },

      updateQuantity: (serviceId, quantity) => {
        if (quantity <= 0) {
          set((state) => ({
            items: state.items.filter((i) => i.serviceId !== serviceId),
          }));
          return;
        }
        set((state) => ({
          items: state.items.map((i) => (i.serviceId === serviceId ? { ...i, quantity } : i)),
        }));
      },

      clearCart: () => set({ items: [], ...VOUCHER_DEFAULTS }),

      getTotal: () => {
        return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      },

      getTotalDuration: () => {
        return get().items.reduce((sum, item) => sum + item.duration * item.quantity, 0);
      },

      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      applyVoucher: (data) =>
        set({
          voucherCode: data.code,
          voucherDiscount: data.discount,
          voucherName: data.name ?? data.code,
          voucherDiscountType: data.discountType,
          voucherDiscountValue: data.discountValue,
          voucherMaxDiscount: data.maxDiscount ?? null,
          voucherMinOrder: data.minOrder ?? 0,
        }),

      removeVoucher: () => set({ ...VOUCHER_DEFAULTS }),

      getDiscountedTotal: () => {
        const total = get().getTotal();
        const discount = get().voucherDiscount;
        return Math.max(0, total - discount);
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORE_VERSION,
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          // Hydration failed (e.g. corrupted localStorage) — start with empty cart
          useCartStore.setState({ items: [], _hasHydrated: true });
          return;
        }
        state?.setHasHydrated(true);
      },
      storage: {
        getItem: (name: string) => {
          try {
            const value = localStorage.getItem(name);
            return value ? JSON.parse(value) : null;
          } catch {
            return null;
          }
        },
        setItem: (name: string, value: unknown) => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch {
            // localStorage full or unavailable — silently skip persistence
          }
        },
        removeItem: (name: string) => {
          try {
            localStorage.removeItem(name);
          } catch {
            // ignore
          }
        },
      },
    },
  ),
);

// ---------------------------------------------------------------------------
// useHasHydrated hook
// ---------------------------------------------------------------------------
// Subscribes to zustand `persist` middleware's own hydration signals so
// consumers can avoid SSR/CSR mismatch without relying on a brittle
// setTimeout fallback. The hook combines:
//   * `persist.hasHydrated()` — synchronous snapshot at mount time
//   * `persist.onFinishHydration(cb)` — async subscription for later rehydration
//
// The 2s `setTimeout` safety net was removed in favour of this deterministic
// API, which matches the recommended pattern from
// https://docs.pmnd.rs/zustand/integrations/persisting-store-data#how-can-i-check-if-my-store-has-been-hydrated
export function useHasHydrated(): boolean {
  const [hydrated, setHydrated] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : useCartStore.persist.hasHydrated(),
  );

  useEffect(() => {
    // Flip the flag as soon as mount happens in case hydration already
    // completed before the effect ran.
    const snapshot = useCartStore.persist.hasHydrated();
    if (snapshot) {
      setHydrated(true);
    }
    const unsub = useCartStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return unsub;
  }, []);

  return hydrated;
}
