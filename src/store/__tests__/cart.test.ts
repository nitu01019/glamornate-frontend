import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore } from '../cart'
import type { CartItem } from '@/types'

function makeCartItem(overrides: Partial<CartItem> = {}): Omit<CartItem, 'quantity'> {
  return {
    serviceId: 'svc-1',
    serviceName: 'Swedish Massage',
    categoryName: 'Massage',
    subcategory: 'relaxation',
    price: 2000,
    duration: 60,
    ...overrides,
  }
}

describe('useCartStore', () => {
  beforeEach(() => {
    // Reset store state between tests (localStorage shim installed in setup.ts)
    useCartStore.setState({ items: [] })
  })

  // -------------------------------------------------------------------------
  // addItem
  // -------------------------------------------------------------------------
  describe('addItem', () => {
    it('should add a new item with quantity 1', () => {
      useCartStore.getState().addItem(makeCartItem())
      const items = useCartStore.getState().items

      expect(items).toHaveLength(1)
      expect(items[0]).toEqual(expect.objectContaining({
        serviceId: 'svc-1',
        serviceName: 'Swedish Massage',
        quantity: 1,
        price: 2000,
        duration: 60,
      }))
    })

    it('should increment quantity when adding a duplicate serviceId', () => {
      const store = useCartStore.getState()
      store.addItem(makeCartItem())
      store.addItem(makeCartItem())

      const items = useCartStore.getState().items
      expect(items).toHaveLength(1)
      expect(items[0].quantity).toBe(2)
    })

    it('should add multiple distinct items independently', () => {
      const store = useCartStore.getState()
      store.addItem(makeCartItem({ serviceId: 'svc-1', serviceName: 'Massage' }))
      store.addItem(makeCartItem({ serviceId: 'svc-2', serviceName: 'Facial' }))

      const items = useCartStore.getState().items
      expect(items).toHaveLength(2)
      expect(items[0].serviceId).toBe('svc-1')
      expect(items[1].serviceId).toBe('svc-2')
    })
  })

  // -------------------------------------------------------------------------
  // removeItem
  // -------------------------------------------------------------------------
  describe('removeItem', () => {
    it('should remove an item by serviceId', () => {
      const store = useCartStore.getState()
      store.addItem(makeCartItem({ serviceId: 'svc-1' }))
      store.addItem(makeCartItem({ serviceId: 'svc-2' }))

      store.removeItem('svc-1')
      const items = useCartStore.getState().items

      expect(items).toHaveLength(1)
      expect(items[0].serviceId).toBe('svc-2')
    })

    it('should be a no-op when removing a non-existent item', () => {
      const store = useCartStore.getState()
      store.addItem(makeCartItem({ serviceId: 'svc-1' }))
      store.removeItem('non-existent')

      expect(useCartStore.getState().items).toHaveLength(1)
    })
  })

  // -------------------------------------------------------------------------
  // updateQuantity
  // -------------------------------------------------------------------------
  describe('updateQuantity', () => {
    it('should update the quantity of an existing item', () => {
      const store = useCartStore.getState()
      store.addItem(makeCartItem({ serviceId: 'svc-1' }))
      store.updateQuantity('svc-1', 5)

      expect(useCartStore.getState().items[0].quantity).toBe(5)
    })

    it('should remove the item when quantity is set to 0', () => {
      const store = useCartStore.getState()
      store.addItem(makeCartItem({ serviceId: 'svc-1' }))
      store.updateQuantity('svc-1', 0)

      expect(useCartStore.getState().items).toHaveLength(0)
    })

    it('should remove the item when quantity is negative', () => {
      const store = useCartStore.getState()
      store.addItem(makeCartItem({ serviceId: 'svc-1' }))
      store.updateQuantity('svc-1', -1)

      expect(useCartStore.getState().items).toHaveLength(0)
    })

    it('should not affect other items', () => {
      const store = useCartStore.getState()
      store.addItem(makeCartItem({ serviceId: 'svc-1' }))
      store.addItem(makeCartItem({ serviceId: 'svc-2' }))
      store.updateQuantity('svc-1', 3)

      const items = useCartStore.getState().items
      expect(items[0].quantity).toBe(3)
      expect(items[1].quantity).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  // clearCart
  // -------------------------------------------------------------------------
  describe('clearCart', () => {
    it('should remove all items from the cart', () => {
      const store = useCartStore.getState()
      store.addItem(makeCartItem({ serviceId: 'svc-1' }))
      store.addItem(makeCartItem({ serviceId: 'svc-2' }))
      store.clearCart()

      expect(useCartStore.getState().items).toHaveLength(0)
    })

    it('should be safe to call on an already-empty cart', () => {
      useCartStore.getState().clearCart()
      expect(useCartStore.getState().items).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // getTotal
  // -------------------------------------------------------------------------
  describe('getTotal', () => {
    it('should return 0 for an empty cart', () => {
      expect(useCartStore.getState().getTotal()).toBe(0)
    })

    it('should sum price * quantity for all items', () => {
      const store = useCartStore.getState()
      store.addItem(makeCartItem({ serviceId: 'svc-1', price: 1000 }))
      store.addItem(makeCartItem({ serviceId: 'svc-2', price: 500 }))
      store.updateQuantity('svc-1', 2) // 2 * 1000 = 2000

      // 2000 + 500 = 2500
      expect(useCartStore.getState().getTotal()).toBe(2500)
    })
  })

  // -------------------------------------------------------------------------
  // getTotalDuration
  // -------------------------------------------------------------------------
  describe('getTotalDuration', () => {
    it('should return 0 for an empty cart', () => {
      expect(useCartStore.getState().getTotalDuration()).toBe(0)
    })

    it('should sum duration * quantity for all items', () => {
      const store = useCartStore.getState()
      store.addItem(makeCartItem({ serviceId: 'svc-1', duration: 60 }))
      store.addItem(makeCartItem({ serviceId: 'svc-2', duration: 30 }))
      store.updateQuantity('svc-1', 2) // 2 * 60 = 120

      // 120 + 30 = 150
      expect(useCartStore.getState().getTotalDuration()).toBe(150)
    })
  })

  // -------------------------------------------------------------------------
  // getItemCount
  // -------------------------------------------------------------------------
  describe('getItemCount', () => {
    it('should return 0 for an empty cart', () => {
      expect(useCartStore.getState().getItemCount()).toBe(0)
    })

    it('should return the sum of all item quantities', () => {
      const store = useCartStore.getState()
      store.addItem(makeCartItem({ serviceId: 'svc-1' }))
      store.addItem(makeCartItem({ serviceId: 'svc-2' }))
      store.updateQuantity('svc-2', 3)

      // 1 + 3 = 4
      expect(useCartStore.getState().getItemCount()).toBe(4)
    })
  })
})
