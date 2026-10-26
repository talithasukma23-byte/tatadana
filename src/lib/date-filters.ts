/**
 * TataDana Unified Date & Transaction Filtering System
 * Mendukung filter periode waktu:
 * - Hari Ini
 * - 7 Hari (Mingguan)
 * - Bulanan (Bulan Kalender vs 30 Hari Terakhir)
 * - Tahunan
 * - Custom Kalender (Rentang Tanggal Mulai - Tanggal Akhir)
 *
 * Serta pencarian multi-dimensi (kata kunci, kategori, dompet, jenis, tanggal, bulan, tahun).
 */

import { Transaction } from '@/types/database';

export type PeriodFilterType = 'today' | '7days' | 'month' | 'month30' | 'year' | 'custom';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
  startStr: string; // YYYY-MM-DD
  endStr: string;   // YYYY-MM-DD
}

export interface TransactionFilterOptions {
  search?: string;
  type?: 'all' | 'income' | 'expense' | 'transfer' | string;
  walletId?: string;
  categoryId?: string;
  period?: PeriodFilterType;
  customStartDate?: string; // YYYY-MM-DD
  customEndDate?: string;   // YYYY-MM-DD
  selectedDate?: string;    // YYYY-MM-DD (untuk klik tanggal pada kalender)
  year?: number;
  month?: number;           // 1-12
}

const INDO_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

const INDO_MONTHS_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Format tanggal ke format YYYY-MM-DD
 */
export function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format tanggal ke format bahasa Indonesia singkat (misal: "17 Okt 2026")
 */
export function formatIndoDate(d: Date): string {
  const day = d.getDate();
  const month = INDO_MONTHS_SHORT[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format tanggal ke format bahasa Indonesia panjang (misal: "Oktober 2026")
 */
export function formatMonthYear(year: number, monthIndex: number): string {
  return `${INDO_MONTHS_LONG[monthIndex]} ${year}`;
}

/**
 * Awal hari (00:00:00.000)
 */
export function startOfDay(d: Date): Date {
  const res = new Date(d);
  res.setHours(0, 0, 0, 0);
  return res;
}

/**
 * Akhir hari (23:59:59.999)
 */
export function endOfDay(d: Date): Date {
  const res = new Date(d);
  res.setHours(23, 59, 59, 999);
  return res;
}

/**
 * Menghitung batas rentang tanggal berdasarkan tipe periode
 */
export function calculateDateRange(
  period: PeriodFilterType,
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date()
): DateRange {
  const ref = new Date(referenceDate);

  let start: Date;
  let end: Date;

  switch (period) {
    case 'today': {
      start = startOfDay(ref);
      end = endOfDay(ref);
      break;
    }
    case '7days': {
      // 7 hari terakhir (6 hari lalu s/d hari ini)
      start = startOfDay(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 6));
      end = endOfDay(ref);
      break;
    }
    case 'month': {
      // Bulan Kalender penuh (misal: 1 Okt 2026 s/d 31 Okt 2026)
      start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    case 'month30': {
      // 30 hari rolling
      start = startOfDay(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 29));
      end = endOfDay(ref);
      break;
    }
    case 'year': {
      // Tahun Kalender (1 Jan s/d 31 Des)
      start = new Date(ref.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(ref.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    }
    case 'custom': {
      if (customStart && customEnd) {
        const [sy, sm, sd] = customStart.split('-').map(Number);
        const [ey, em, ed] = customEnd.split('-').map(Number);
        start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
      } else if (customStart) {
        const [sy, sm, sd] = customStart.split('-').map(Number);
        start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        end = endOfDay(ref);
      } else {
        // Fallback default bulan kalender
        start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
        end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
      }
      break;
    }
    default: {
      start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    }
  }

  const startStr = toDateInputValue(start);
  const endStr = toDateInputValue(end);

  let label = '';
  if (startStr === endStr) {
    label = formatIndoDate(start);
  } else {
    label = `${formatIndoDate(start)} – ${formatIndoDate(end)}`;
  }

  return {
    startDate: start,
    endDate: end,
    label,
    startStr,
    endStr,
  };
}

/**
 * Filter list transaksi dengan dukungan multi-parameter
 */
export function filterTransactionsList(
  transactions: Transaction[],
  options: TransactionFilterOptions
): { filtered: Transaction[]; range: DateRange } {
  const {
    search,
    type,
    walletId,
    categoryId,
    period = 'month',
    customStartDate,
    customEndDate,
    selectedDate,
    year,
    month,
  } = options;

  let range = calculateDateRange(period, customStartDate, customEndDate);

  // Jika ada bulan/tahun spesifik kalender
  if (year !== undefined && month !== undefined) {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    range = {
      startDate: start,
      endDate: end,
      label: `${formatMonthYear(year, month - 1)}`,
      startStr: toDateInputValue(start),
      endStr: toDateInputValue(end),
    };
  }

  // Jika ada tanggal tunggal dipilih dari Kalender (e.g. 2026-10-17)
  if (selectedDate) {
    const [sy, sm, sd] = selectedDate.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
    const end = new Date(sy, sm - 1, sd, 23, 59, 59, 999);
    range = {
      startDate: start,
      endDate: end,
      label: formatIndoDate(start),
      startStr: selectedDate,
      endStr: selectedDate,
    };
  }

  const startTime = range.startDate.getTime();
  const endTime = range.endDate.getTime();

  const searchKeyword = (search || '').trim().toLowerCase();

  const filtered = transactions.filter((tx) => {
    // 1. Filter Rentang Waktu (Inklusif awal dan akhir hari)
    const txTime = new Date(tx.transaction_date).getTime();
    if (txTime < startTime || txTime > endTime) {
      return false;
    }

    // 2. Filter Jenis Transaksi
    if (type && type !== 'all') {
      if (tx.type !== type) return false;
    }

    // 3. Filter Dompet
    if (walletId && walletId !== 'all') {
      if (tx.wallet_id !== walletId && tx.transfer_to_wallet_id !== walletId) {
        return false;
      }
    }

    // 4. Filter Kategori
    if (categoryId && categoryId !== 'all') {
      if (tx.category_id !== categoryId) return false;
    }

    // 5. Pencarian Kata Kunci (Komprehensif)
    if (searchKeyword) {
      const notes = (tx.notes || '').toLowerCase();
      const desc = (tx.description || '').toLowerCase();
      const catName = (tx.category?.name || '').toLowerCase();
      const walletName = (tx.wallet?.name || '').toLowerCase();
      const amountStr = String(tx.amount);
      const typeStr = tx.type === 'income' ? 'pemasukan' : tx.type === 'expense' ? 'pengeluaran' : 'transfer';

      // Pencarian tanggal string: "17 okt", "oktober", "2026", "2026-10-17"
      const txDateObj = new Date(tx.transaction_date);
      const fullDateStr = formatIndoDate(txDateObj).toLowerCase();
      const rawDateStr = tx.transaction_date.slice(0, 10).toLowerCase();
      const monthNameLong = INDO_MONTHS_LONG[txDateObj.getMonth()].toLowerCase();
      const yearStr = String(txDateObj.getFullYear());

      const match =
        notes.includes(searchKeyword) ||
        desc.includes(searchKeyword) ||
        catName.includes(searchKeyword) ||
        walletName.includes(searchKeyword) ||
        amountStr.includes(searchKeyword) ||
        typeStr.includes(searchKeyword) ||
        fullDateStr.includes(searchKeyword) ||
        rawDateStr.includes(searchKeyword) ||
        monthNameLong.includes(searchKeyword) ||
        yearStr.includes(searchKeyword);

      if (!match) return false;
    }

    return true;
  });

  return { filtered, range };
}
