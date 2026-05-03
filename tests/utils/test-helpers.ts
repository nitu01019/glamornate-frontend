/**
 * Test Helper Functions for Glamornate
 * Common utilities for unit, integration, and E2E tests
 */

import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'

// Custom render function
export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, options)
}

// Wait for async operations
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Mock Firebase timestamp
export function mockTimestamp(date: Date = new Date()) {
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  }
}

// Generate test IDs
export function generateTestId(prefix: string, suffix?: string): string {
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}_${suffix || random}`
}

// Format currency for tests
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

// Validate email format
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Validate phone format
export function isValidPhone(phone: string): boolean {
  return /^\+?[\d\s-()]+$/.test(phone)
}

// Calculate booking duration
export function calculateBookingDuration(
  services: Array<{ duration: number }>
): number {
  return services.reduce((total, service) => total + service.duration, 0)
}

// Calculate booking total with platform fee
export function calculateBookingTotal(
  servicesTotal: number,
  platformFeePercentage: number
): number {
  const platformFee = servicesTotal * (platformFeePercentage / 100)
  return servicesTotal + platformFee
}

// Generate mock availability slots for a date
export function generateAvailabilitySlots(
  startTime: string,
  endTime: string,
  intervalMinutes: number = 60
): Array<{ start: string; end: string; available: boolean; bookingId: string | null }> {
  const slots = []
  let current = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)

  while (current + intervalMinutes <= end) {
    slots.push({
      start: minutesToTime(current),
      end: minutesToTime(current + intervalMinutes),
      available: true,
      bookingId: null,
    })
    current += intervalMinutes
  }

  return slots
}

// Convert time string to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Convert minutes to time string
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

// Mock storage for localStorage tests
export class MockStorage implements Storage {
  private store: Record<string, string> = {}

  get length(): number {
    return Object.keys(this.store).length
  }

  clear(): void {
    this.store = {}
  }

  getItem(key: string): string | null {
    return this.store[key] ?? null
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value)
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store)
    return keys[index] ?? null
  }

  removeItem(key: string): void {
    delete this.store[key]
  }
}

// Mock IntersectionObserver
export class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    // Mock implementation
  }

  disconnect() {}
  observe(target: Element) {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
  unobserve(target: Element) {}
}

// Setup test environment
export function setupTestEnvironment() {
  // Mock IntersectionObserver
  global.IntersectionObserver = MockIntersectionObserver as any

  // Mock localStorage
  const mockStorage = new MockStorage()
  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true,
  })

  // Mock sessionStorage
  const mockSessionStorage = new MockStorage()
  Object.defineProperty(window, 'sessionStorage', {
    value: mockSessionStorage,
    writable: true,
  })

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Cleanup test environment
export function cleanupTestEnvironment() {
  jest.clearAllMocks()
  jest.clearAllTimers()
}
