import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format number to Indonesian Rupiah (IDR)
 * e.g. 1500000 -> "Rp1.500.000"
 */
export function formatRupiah(amount: number): string {
  if (isNaN(amount)) return 'Rp0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace(/\s/g, '');
}

/**
 * Format ISO date string or Date to WIB (Asia/Jakarta)
 */
export function formatWIB(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: options?.weekday || 'long',
    day: options?.day || 'numeric',
    month: options?.month || 'long',
    year: options?.year || 'numeric',
    hour: options?.hour || '2-digit',
    minute: options?.minute || '2-digit',
    hour12: false,
    ...options,
  }).format(d);
}

/**
 * Generate Visual Progress Bar with █ and ░
 * e.g. 80% with length 10 -> "████████░░"
 */
export function generateProgressBar(percentage: number, length: number = 10): string {
  const clamped = Math.max(0, Math.min(100, percentage));
  const filledCount = Math.round((clamped / 100) * length);
  const emptyCount = Math.max(0, length - filledCount);
  return '█'.repeat(filledCount) + '░'.repeat(emptyCount);
}

/**
 * Parse JSON secara aman dan defensif tanpa melempar SyntaxError
 * Menangani kasus "[object Object]", string non-JSON seperti "ok" atau HTML,
 * input yang sudah berupa objek/array, dan fallback nilai default.
 */
export function safeJsonParse<T = any>(input: unknown, fallback: T | null = null): T | null {
  if (input === null || input === undefined) return fallback;
  if (typeof input === 'object') return input as T;
  if (typeof input !== 'string') return fallback;

  const trimmed = input.trim();
  if (
    !trimmed ||
    trimmed === '[object Object]' ||
    trimmed.startsWith('[object Object]')
  ) {
    return fallback;
  }

  // Validasi awal karakter pertama JSON yang sah: { [ " true false null angka
  const firstChar = trimmed[0];
  if (
    firstChar !== '{' &&
    firstChar !== '[' &&
    firstChar !== '"' &&
    firstChar !== '-' &&
    (firstChar < '0' || firstChar > '9') &&
    trimmed !== 'true' &&
    trimmed !== 'false' &&
    trimmed !== 'null'
  ) {
    return fallback;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return fallback;
  }
}

/**
 * Membaca respons HTTP fetch secara aman sebagai JSON tanpa risiko SyntaxError: Unexpected token
 */
export async function safeFetchJson<T = any>(res: Response, fallback: any = null): Promise<T> {
  try {
    const text = await res.text();
    return (safeJsonParse<T>(text, fallback) as T) ?? (fallback as T);
  } catch {
    return fallback as T;
  }
}

