import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format as formatDfns, parseISO, isValid } from 'date-fns'
/** Generate a random ID without external dependencies. */
function nanoid(length = 21): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, length);
}
import { logger } from '@/lib/logger'

// Tailwind class merger
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Date formatting
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return ''
  return formatDfns(d, 'MMMM d, yyyy')
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return ''
  return formatDfns(d, 'h:mm a')
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return ''
  return formatDfns(d, 'MMMM d, yyyy h:mm a')
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return ''
  return formatDfns(d, 'MMM d')
}

// Currency formatting
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatCurrencyWithDecimals(
  amount: number,
  currency: string = 'INR'
): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
  }).format(amount)
}

// Slugify
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ID generation
export function generateId(prefix: string = ''): string {
  return prefix ? `${prefix}_${nanoid()}` : nanoid()
}

// Time calculations
export function addMinutes(date: Date | string, minutes: number): Date {
  const d = typeof date === 'string' ? parseISO(date) : date
  return new Date(d.getTime() + minutes * 60000)
}

export function subtractMinutes(date: Date | string, minutes: number): Date {
  const d = typeof date === 'string' ? parseISO(date) : date
  return new Date(d.getTime() - minutes * 60000)
}

export function minutesToHours(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

// Validation
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/
  return phoneRegex.test(phone)
}

export function isValidPincode(pincode: string): boolean {
  const pincodeRegex = /^[1-9][0-9]{5}$/
  return pincodeRegex.test(pincode)
}

// Array utilities
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key])
    if (!result[groupKey]) {
      result[groupKey] = []
    }
    result[groupKey].push(item)
    return result
  }, {} as Record<string, T[]>)
}

export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array))
}

export function sortBy<T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key]
    const bVal = b[key]
    if (order === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
    }
  })
}

// String utilities
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return text.slice(0, length) + '...'
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

export function titleCase(text: string): string {
  return text.replace(/\w\S*/g, (word) => capitalize(word))
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2)
}

// Number utilities
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num)
}

export function formatPercentage(num: number, decimals: number = 1): string {
  return `${num.toFixed(decimals)}%`
}

export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max)
}

// Booking related utilities
export function calculateServicePrice(
  basePrice: number,
  duration: number,
  baseDuration: number
): number {
  if (duration === baseDuration) return basePrice
  return (basePrice / baseDuration) * duration
}

export function calculateTotalPrice(
  services: Array<{ price: number; quantity: number }>,
  addons: Array<{ price: number; quantity: number }> = [],
  discount: number = 0,
  platformFee: number = 0,
  taxRate: number = 0.18
): {
  subtotal: number
  discount: number
  tax: number
  platformFee: number
  total: number
} {
  const servicesTotal = services.reduce(
    (sum, s) => sum + s.price * s.quantity,
    0
  )
  const addonsTotal = addons.reduce((sum, a) => sum + a.price * a.quantity, 0)
  const subtotal = servicesTotal + addonsTotal
  const afterDiscount = subtotal - discount
  const tax = afterDiscount * taxRate
  const total = afterDiscount + tax + platformFee

  return {
    subtotal,
    discount,
    tax,
    platformFee,
    total,
  }
}

export function isSlotAvailable(
  startTime: string,
  endTime: string,
  existingSlots: Array<{ start: string; end: string }>
): boolean {
  for (const slot of existingSlots) {
    if (
      (startTime >= slot.start && startTime < slot.end) ||
      (endTime > slot.start && endTime <= slot.end) ||
      (startTime <= slot.start && endTime >= slot.end)
    ) {
      return false
    }
  }
  return true
}

// Rating utilities
export function getRatingColor(rating: number): string {
  if (rating >= 4.5) return 'text-green-500'
  if (rating >= 3.5) return 'text-blue-500'
  if (rating >= 2.5) return 'text-yellow-500'
  return 'text-red-500'
}

export function getRatingLabel(rating: number): string {
  if (rating >= 4.5) return 'Excellent'
  if (rating >= 3.5) return 'Good'
  if (rating >= 2.5) return 'Average'
  return 'Poor'
}

// Distance utilities
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  unit: 'km' | 'miles' = 'km'
): number {
  const R = unit === 'km' ? 6371 : 3959
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(value: number): number {
  return (value * Math.PI) / 180
}

export function formatDistance(distance: number, unit: 'km' | 'miles' = 'km'): string {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`
  }
  return `${distance.toFixed(1)}${unit}`
}

// Debounce and throttle
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// Storage utilities
export function getStorageItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue
  try {
    const item = window.localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch {
    return defaultValue
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    logger.error(`Error setting storage item ${key}`, error, { component: 'storage' })
  }
}

export function removeStorageItem(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch (error) {
    logger.error(`Error removing storage item ${key}`, error, { component: 'storage' })
  }
}

// URL utilities
export function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value))
    }
  })
  return searchParams.toString()
}

export function parseQueryString(search: string): Record<string, string> {
  const params = new URLSearchParams(search)
  const result: Record<string, string> = {}
  params.forEach((value, key) => {
    result[key] = value
  })
  return result
}

// Error handling
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

// Async utilities
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (i < maxAttempts - 1) {
        await sleep(delay * (i + 1))
      }
    }
  }
  throw lastError || new Error('Retry failed')
}
