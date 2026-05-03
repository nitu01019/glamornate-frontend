/**
 * Utility helper functions for common operations
 */
import { logger } from '@/lib/logger';

// ============ String Helpers ============

/**
 * Truncate string to max length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter of string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert string to title case
 */
export function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => capitalize(txt));
}

/**
 * Generate slug from string
 */
export function generateSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

/**
 * Generate random ID
 */
export function generateId(prefix: string = ''): string {
  const random = Math.random().toString(36).substring(2, 11);
  return prefix ? `${prefix}_${random}` : random;
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============ Array Helpers ============

/**
 * Check if array is empty
 */
export function isEmptyArray<T>(arr: T[] | null | undefined): boolean {
  return !arr || arr.length === 0;
}

/**
 * Remove duplicates from array
 */
export function uniqueArray<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Group array by key
 */
export function groupBy<T extends Record<string, unknown>>(
  arr: T[],
  key: string,
): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const groupKey = String(item[key]);
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(item);
      return acc;
    },
    {} as Record<string, T[]>,
  );
}

/**
 * Chunk array into smaller arrays
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Shuffle array
 */
export function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Find item by ID in array
 */
export function findById<T extends { id: string }>(arr: T[], id: string): T | undefined {
  return arr.find((item) => item.id === id);
}

/**
 * Sort array of objects by key
 */
export function sortByKey<T extends Record<string, unknown>>(
  arr: T[],
  key: string,
  order: 'asc' | 'desc' = 'asc',
): T[] {
  return [...arr].sort((a, b) => {
    const aVal = a[key] as string | number;
    const bVal = b[key] as string | number;

    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

// ============ Object Helpers ============

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Merge objects deeply
 */
export function deepMerge<T extends Record<string, unknown>>(...objs: T[]): T {
  const result: Record<string, unknown> = {};

  for (const obj of objs) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          result[key] = deepMerge(
            (result[key] || {}) as Record<string, unknown>,
            obj[key] as Record<string, unknown>,
          );
        } else {
          result[key] = obj[key];
        }
      }
    }
  }

  return result as T;
}

/**
 * Pick specific keys from object
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specific keys from object
 */
export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

/**
 * Get nested value from object by path
 */
export function getNestedValue(
  obj: Record<string, unknown>,
  path: string,
  defaultValue?: unknown,
): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current !== undefined ? current : defaultValue;
}

/**
 * Set nested value in object by path
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const keys = path.split('.');
  const result = { ...obj };
  let current: Record<string, unknown> = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const nested = current[keys[i]];
    if (typeof nested !== 'object' || nested === null) {
      current[keys[i]] = {};
    } else {
      current[keys[i]] = { ...(nested as Record<string, unknown>) };
    }
    current = current[keys[i]] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
  return result;
}

// ============ Number Helpers ============

/**
 * Clamp number between min and max
 */
export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

/**
 * Round number to decimal places
 */
export function roundTo(num: number, decimals: number): number {
  return Number(num.toFixed(decimals));
}

/**
 * Check if number is between two values
 */
export function isBetween(
  num: number,
  min: number,
  max: number,
  inclusive: boolean = true,
): boolean {
  if (inclusive) {
    return num >= min && num <= max;
  }
  return num > min && num < max;
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

/**
 * Generate random number between min and max
 */
export function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Generate random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

// ============ Color Helpers ============

/**
 * Convert hex to RGB
 */
export function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : null;
}

/**
 * Lighten or darken a hex color
 */
export function adjustColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const [r, g, b] = rgb.map((val) => clamp(val + amount, 0, 255));

  return '#' + [r, g, b].map((val) => val.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if color is light
 */
export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;

  // Calculate luminance
  const [r, g, b] = rgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5;
}

// ============ Debounce & Throttle ============

/**
 * Debounce function
 */
export function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: never[]) => unknown>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// ============ Local Storage Helpers ============

/**
 * Get item from localStorage with JSON parsing
 */
export function getStorageItem<T>(key: string, defaultValue?: T): T | null {
  if (typeof window === 'undefined') return defaultValue ?? null;

  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : (defaultValue ?? null);
  } catch {
    return defaultValue ?? null;
  }
}

/**
 * Set item in localStorage with JSON stringifying
 */
export function setStorageItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    logger.error('Error saving to localStorage', error, { component: 'storage' });
  }
}

/**
 * Remove item from localStorage
 */
export function removeStorageItem(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(key);
  } catch (error) {
    logger.error('Error removing from localStorage', error, { component: 'storage' });
  }
}

/**
 * Clear all items from localStorage
 */
export function clearStorage(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.clear();
  } catch (error) {
    logger.error('Error clearing localStorage', error, { component: 'storage' });
  }
}

// ============ Promise Helpers ============

/**
 * Delay execution
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry async function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        await delay(delayMs * Math.pow(2, attempt - 1));
      }
    }
  }

  throw lastError;
}

/**
 * Execute promises in parallel with concurrency limit
 */
export async function concurrent<T>(tasks: (() => Promise<T>)[], limit: number = 5): Promise<T[]> {
  const results: Promise<T>[] = [];
  const executing: Promise<unknown>[] = [];

  for (const task of tasks) {
    const promise = task().then((result) => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });

    results.push(promise);
    executing.push(promise);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}
