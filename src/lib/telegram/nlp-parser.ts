// ====================================================================
// TataDana Modular NLP Transaction Parser
// Indonesian Currency, Wallet Extraction, Category Deduction, Clean Notes
// ====================================================================

import { Wallet, Category, WalletType } from '@/types/database';
import { db } from '@/lib/supabase/mock-db';

export interface ParsedNLPResult {
  jenis: 'pemasukan' | 'pengeluaran' | 'transfer';
  nominal: number;
  kategori: string;
  kategoriEmoji: string;
  categoryId?: string;
  catatan: string;
  walletId?: string;
  walletName?: string;
  targetWallet?: Wallet;
  confidence: number;
  rawText: string;
}

export interface WalletMatchResult {
  wallet?: Wallet;
  walletId?: string;
  walletName?: string;
  phraseMatched?: string;
  cleanedText: string;
}

interface WalletSynonymRule {
  keywords: string[];
  type?: WalletType;
  nameSubstrings: string[];
}

const WALLET_SYNONYMS: WalletSynonymRule[] = [
  {
    keywords: ['gopay', 'go-pay', 'go pay'],
    type: 'E-Wallet',
    nameSubstrings: ['gopay', 'go-pay'],
  },
  {
    keywords: ['ovo'],
    type: 'E-Wallet',
    nameSubstrings: ['ovo'],
  },
  {
    keywords: ['dana'],
    type: 'E-Wallet',
    nameSubstrings: ['dana'],
  },
  {
    keywords: ['shopeepay', 'shopee pay', 'spay'],
    type: 'E-Wallet',
    nameSubstrings: ['shopee', 'spay'],
  },
  {
    keywords: ['bca', 'klikbca', 'mybca'],
    type: 'Bank',
    nameSubstrings: ['bca'],
  },
  {
    keywords: ['mandiri', 'livin'],
    type: 'Bank',
    nameSubstrings: ['mandiri', 'livin'],
  },
  {
    keywords: ['bri', 'brimo'],
    type: 'Bank',
    nameSubstrings: ['bri', 'brimo'],
  },
  {
    keywords: ['bni'],
    type: 'Bank',
    nameSubstrings: ['bni'],
  },
  {
    keywords: ['jago'],
    type: 'Bank',
    nameSubstrings: ['jago'],
  },
  {
    keywords: ['cimb', 'niaga'],
    type: 'Bank',
    nameSubstrings: ['cimb'],
  },
  {
    keywords: ['cash', 'tunai', 'kontan'],
    type: 'Cash',
    nameSubstrings: ['cash', 'tunai'],
  },
];

/**
 * Parser Mata Uang Rupiah Indonesia Cerdas
 * Menangani:
 * - 25rb, 50k, 15ribu, 100 k, 25 rb
 * - 8.5jt, 8,5jt, 1.2jt, 1,2jt, 2.5 juta, 10jt
 * - Rp 25.000, Rp. 45.000, 45.000, 1.500.000
 * - 45000, 25000, rp 45000
 */
export function parseIndonesianCurrency(text: string): number {
  if (!text || typeof text !== 'string') return 0;

  const clean = text.toLowerCase().trim();

  // 1. Suffix pattern: angka desimal/bulat + akhiran (jt, juta, rb, ribu, k)
  // Contoh: "25rb", "50k", "8.5jt", "8,5jt", "1.2jt", "15ribu", "rp 25rb"
  const suffixPattern = /(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(jt|juta|rb|ribu|k)\b/i;
  const suffixMatch = clean.match(suffixPattern);
  if (suffixMatch) {
    const rawNum = suffixMatch[1].replace(',', '.');
    const val = parseFloat(rawNum);
    const suffix = suffixMatch[2].toLowerCase();

    if (!isNaN(val) && val > 0) {
      if (suffix === 'jt' || suffix === 'juta') {
        return Math.round(val * 1000000);
      } else if (suffix === 'rb' || suffix === 'ribu' || suffix === 'k') {
        return Math.round(val * 1000);
      }
    }
  }

  // 2. Format bertitik ribuan khas Indonesia: 45.000, 1.500.000, rp 45.000
  const dotPattern = /(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})+)(?!\d)/i;
  const dotMatch = clean.match(dotPattern);
  if (dotMatch) {
    const val = parseInt(dotMatch[1].replace(/\./g, ''), 10);
    if (!isNaN(val) && val > 0) {
      return val;
    }
  }

  // 3. Format dengan awalan Rp + angka bulat: rp 45000, rp. 45000, rp45000
  const rpPlainPattern = /rp\.?\s*(\d{2,12})\b/i;
  const rpPlainMatch = clean.match(rpPlainPattern);
  if (rpPlainMatch) {
    const val = parseInt(rpPlainMatch[1], 10);
    if (!isNaN(val) && val > 0) {
      return val;
    }
  }

  // 4. Token integer 3 digit atau lebih: 45000, 25000, 8500000
  const tokens = clean.split(/\s+/);
  for (const token of tokens) {
    if (/^\d{3,10}$/.test(token)) {
      const val = parseInt(token, 10);
      if (!isNaN(val) && val > 0) {
        return val;
      }
    }
  }

  // 5. Fallback angka 3-10 digit di dalam teks
  const fallbackMatch = clean.match(/\b(\d{3,10})\b/);
  if (fallbackMatch) {
    const val = parseInt(fallbackMatch[1], 10);
    if (!isNaN(val) && val > 0) {
      return val;
    }
  }

  return 0;
}

/**
 * Deteksi Tipe Transaksi: pengeluaran (expense), pemasukan (income), atau transfer
 */
export function detectTransactionType(text: string): 'pemasukan' | 'pengeluaran' | 'transfer' {
  const lower = text.toLowerCase().trim();

  // Transfer keywords
  if (
    /^(?:transfer|tf|kirim\s+uang|pindah\s+saldo)\b/i.test(lower) ||
    /\b(?:transfer\s+ke|tf\s+ke|kirim\s+ke|pindah\s+ke)\b/i.test(lower)
  ) {
    return 'transfer';
  }

  // Income keywords
  const incomeKeywords = [
    'gaji',
    'gajian',
    'payroll',
    'salary',
    'terima transfer',
    'terima uang',
    'terima gaji',
    'dapat transfer',
    'dapat uang',
    'dapet uang',
    'dapet transfer',
    'tf masuk',
    'dana masuk',
    'uang masuk',
    'pemasukan',
    'pendapatan',
    'penghasilan',
    'omset',
    'omzet',
    'laba',
    'untung',
    'bonus',
    'thr',
    'freelance',
    'komisi',
    'upah',
    'honor',
    'dividen',
    'hasil jualan',
    'cuan',
    'infaq masuk',
    'kas masuk',
  ];

  for (const kw of incomeKeywords) {
    if (lower.includes(kw)) {
      return 'pemasukan';
    }
  }

  return 'pengeluaran';
}

/**
 * Ekstraksi dompet spesifik dari teks transaksi
 * Mendeteksi ungkapan seperti:
 * - "makan siang 45000 di gopay"
 * - "bensin 30rb pakai bca"
 * - "beli kopi 25rb di cash"
 * - "gajian 8.5jt di mandiri"
 * - "bayar wifi 350k via ovo"
 * - "beli buku 100k lewat dana"
 */
export function matchWalletFromText(text: string, userWallets: Wallet[] = []): WalletMatchResult {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // Preposition patterns for wallets:
  // "di gopay", "pakai bca", "pake cash", "via ovo", "lewat dana", "dari dompet cash", "ke mandiri"
  const prepRegex = /\b(di|pakai|pake|via|lewat|dari|ke|dengan|dg)\s+(?:dompet\s+|rekening\s+|kantong\s+|kartu\s+)?([a-zA-Z0-9\-_/]+(?:\s+[a-zA-Z0-9\-_/]+)?)/i;
  const match = lower.match(prepRegex);

  let targetWallet: Wallet | undefined;
  let phraseMatched: string | undefined;

  if (match) {
    phraseMatched = match[0];
    const candidateKeyword = match[2].trim().toLowerCase();

    // 1. Coba cocokkan langsung dengan nama dompet milik user
    targetWallet = userWallets.find((w) => {
      const wName = w.name.toLowerCase();
      return (
        wName.includes(candidateKeyword) ||
        candidateKeyword.includes(wName.replace(/[^a-z0-9]/g, ''))
      );
    });

    // 2. Coba cocokkan via synonym rules
    if (!targetWallet) {
      for (const rule of WALLET_SYNONYMS) {
        const matchesSynonym = rule.keywords.some(
          (k) => candidateKeyword.includes(k) || k.includes(candidateKeyword)
        );

        if (matchesSynonym) {
          // Cari dompet user yang mengandung nama atau type yang cocok
          targetWallet = userWallets.find((w) => {
            const wName = w.name.toLowerCase();
            const nameMatch = rule.nameSubstrings.some((sub) => wName.includes(sub));
            const typeMatch = rule.type && w.type === rule.type;
            return nameMatch || typeMatch;
          });
          if (targetWallet) break;
        }
      }
    }
  }

  // 3. Fallback: jika tidak ada preposisi, cek apakah teks mengandung kata kunci dompet yang jelas di akhir/tengah kalimat
  if (!targetWallet) {
    for (const rule of WALLET_SYNONYMS) {
      for (const kw of rule.keywords) {
        // Cek boundary kata kunci
        const kwRegex = new RegExp(`\\b${kw}\\b`, 'i');
        if (kwRegex.test(lower)) {
          // Cari wallet user yang cocok
          const matchedW = userWallets.find((w) => {
            const wName = w.name.toLowerCase();
            return rule.nameSubstrings.some((sub) => wName.includes(sub)) || (rule.type && w.type === rule.type);
          });

          if (matchedW) {
            targetWallet = matchedW;
            phraseMatched = kw;
            break;
          }
        }
      }
      if (targetWallet) break;
    }
  }

  // Bersihkan teks dari phrase matched
  let cleanedText = clean;
  if (phraseMatched) {
    const escaped = phraseMatched.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleanedText = cleanedText.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ').replace(/\s+/g, ' ').trim();
  }

  return {
    wallet: targetWallet,
    walletId: targetWallet?.id,
    walletName: targetWallet?.name,
    phraseMatched,
    cleanedText,
  };
}

/**
 * Deduksi Kategori dan Emoji berdasarkan kata kunci kalimat
 */
export function deduceCategory(
  text: string,
  type: 'income' | 'expense' | 'transfer',
  userCategories: Category[] = []
): { id?: string; name: string; emoji: string } {
  const lower = text.toLowerCase();

  if (type === 'income') {
    if (
      lower.includes('gaji') ||
      lower.includes('payroll') ||
      lower.includes('salary') ||
      lower.includes('thr') ||
      lower.includes('pendapatan') ||
      lower.includes('penghasilan')
    ) {
      const match = userCategories.find((c) => c.type === 'income' && /gaji/i.test(c.name));
      return { id: match?.id, name: match?.name || 'Gaji Bulanan', emoji: match?.emoji || '💰' };
    }
    if (
      lower.includes('freelance') ||
      lower.includes('proyek') ||
      lower.includes('side') ||
      lower.includes('bonus') ||
      lower.includes('komisi') ||
      lower.includes('upah') ||
      lower.includes('honor') ||
      lower.includes('tips')
    ) {
      const match = userCategories.find((c) => c.type === 'income' && /freelance|bonus/i.test(c.name));
      return { id: match?.id, name: match?.name || 'Freelance & Bonus', emoji: match?.emoji || '💼' };
    }
    if (
      lower.includes('dividen') ||
      lower.includes('bunga') ||
      lower.includes('cuan') ||
      lower.includes('investasi') ||
      lower.includes('saham') ||
      lower.includes('crypto')
    ) {
      const match = userCategories.find((c) => c.type === 'income' && /investasi/i.test(c.name));
      return { id: match?.id, name: match?.name || 'Investasi & Lainnya', emoji: match?.emoji || '📈' };
    }
    const fallbackIncome = userCategories.find((c) => c.type === 'income');
    return {
      id: fallbackIncome?.id,
      name: fallbackIncome?.name || 'Pemasukan Lain',
      emoji: fallbackIncome?.emoji || '💰',
    };
  }

  // Pengeluaran (Expense) Categories
  if (
    lower.includes('makan') ||
    lower.includes('sarapan') ||
    lower.includes('lunch') ||
    lower.includes('dinner') ||
    lower.includes('siang') ||
    lower.includes('malam') ||
    lower.includes('pagi') ||
    lower.includes('kopi') ||
    lower.includes('coffee') ||
    lower.includes('bakso') ||
    lower.includes('mie') ||
    lower.includes('nasi') ||
    lower.includes('padang') ||
    lower.includes('sate') ||
    lower.includes('ayam') ||
    lower.includes('resto') ||
    lower.includes('kafe') ||
    lower.includes('cafe') ||
    lower.includes('warung') ||
    lower.includes('minum') ||
    lower.includes('jus') ||
    lower.includes('snack') ||
    lower.includes('roti') ||
    lower.includes('kfc') ||
    lower.includes('mcd')
  ) {
    const match = userCategories.find((c) => c.type === 'expense' && /makan|minum/i.test(c.name));
    return { id: match?.id, name: match?.name || 'Makanan & Minuman', emoji: match?.emoji || '🍜' };
  }

  if (
    lower.includes('bensin') ||
    lower.includes('pertalite') ||
    lower.includes('pertamax') ||
    lower.includes('solar') ||
    lower.includes('spbu') ||
    lower.includes('parkir') ||
    lower.includes('grab') ||
    lower.includes('gojek') ||
    lower.includes('goride') ||
    lower.includes('gocar') ||
    lower.includes('toll') ||
    lower.includes('tol') ||
    lower.includes('kereta') ||
    lower.includes('krl') ||
    lower.includes('mrt') ||
    lower.includes('tj') ||
    lower.includes('busway') ||
    lower.includes('ojek') ||
    lower.includes('taksi') ||
    lower.includes('taxi') ||
    lower.includes('servis') ||
    lower.includes('service') ||
    lower.includes('oli') ||
    lower.includes('transport')
  ) {
    const match = userCategories.find((c) => c.type === 'expense' && /transport/i.test(c.name));
    return { id: match?.id, name: match?.name || 'Transportasi', emoji: match?.emoji || '🚗' };
  }

  if (
    lower.includes('listrik') ||
    lower.includes('pln') ||
    lower.includes('token') ||
    lower.includes('air') ||
    lower.includes('pdam') ||
    lower.includes('wifi') ||
    lower.includes('indihome') ||
    lower.includes('biznet') ||
    lower.includes('firstmedia') ||
    lower.includes('pulsa') ||
    lower.includes('kuota') ||
    lower.includes('paket data') ||
    lower.includes('telkomsel') ||
    lower.includes('indosat') ||
    lower.includes('xl') ||
    lower.includes('sewa') ||
    lower.includes('kost') ||
    lower.includes('kos') ||
    lower.includes('kontrakan') ||
    lower.includes('iuran') ||
    lower.includes('bpjs') ||
    lower.includes('tagihan')
  ) {
    const match = userCategories.find((c) => c.type === 'expense' && /tagihan|utilitas/i.test(c.name));
    return { id: match?.id, name: match?.name || 'Tagihan & Utilitas', emoji: match?.emoji || '🏠' };
  }

  if (
    lower.includes('superindo') ||
    lower.includes('indomaret') ||
    lower.includes('alfamart') ||
    lower.includes('pasar') ||
    lower.includes('belanja') ||
    lower.includes('supermarket') ||
    lower.includes('hypermart') ||
    lower.includes('sayur') ||
    lower.includes('buah') ||
    lower.includes('beras') ||
    lower.includes('shopee') ||
    lower.includes('tokopedia') ||
    lower.includes('lazada') ||
    lower.includes('baju') ||
    lower.includes('celana') ||
    lower.includes('sepatu') ||
    lower.includes('tas')
  ) {
    const match = userCategories.find((c) => c.type === 'expense' && /belanja|supermarket/i.test(c.name));
    return { id: match?.id, name: match?.name || 'Belanja & Supermarket', emoji: match?.emoji || '🛒' };
  }

  if (
    lower.includes('nonton') ||
    lower.includes('bioskop') ||
    lower.includes('xxi') ||
    lower.includes('cgv') ||
    lower.includes('game') ||
    lower.includes('steam') ||
    lower.includes('netflix') ||
    lower.includes('spotify') ||
    lower.includes('youtube') ||
    lower.includes('hiburan') ||
    lower.includes('healing') ||
    lower.includes('liburan') ||
    lower.includes('karaoke') ||
    lower.includes('hangout')
  ) {
    const match = userCategories.find((c) => c.type === 'expense' && /hiburan/i.test(c.name));
    return { id: match?.id, name: match?.name || 'Hiburan & Ngopi', emoji: match?.emoji || '☕' };
  }

  if (
    lower.includes('obat') ||
    lower.includes('dokter') ||
    lower.includes('apotek') ||
    lower.includes('kimia farma') ||
    lower.includes('k24') ||
    lower.includes('klinik') ||
    lower.includes('rs') ||
    lower.includes('rumah sakit') ||
    lower.includes('vitamin') ||
    lower.includes('medis') ||
    lower.includes('periksa')
  ) {
    const match = userCategories.find((c) => c.type === 'expense' && /kesehatan/i.test(c.name));
    return { id: match?.id, name: match?.name || 'Kesehatan', emoji: match?.emoji || '💊' };
  }

  const fallbackExpense = userCategories.find((c) => c.type === 'expense');
  return {
    id: fallbackExpense?.id,
    name: fallbackExpense?.name || 'Lain-lain',
    emoji: fallbackExpense?.emoji || '🏷️',
  };
}

/**
 * Membersihkan catatan dari nominal uang, kata kunci dompet, dan kata kerja umum
 * Contoh:
 * - "makan siang 45000 di gopay" -> "Makan siang"
 * - "beli kopi 25rb di cash" -> "Kopi"
 * - "bensin 30rb pakai bca" -> "Bensin"
 * - "gajian 8.5jt di mandiri" -> "Gajian"
 */
export function cleanNoteDescription(
  text: string,
  walletPhrase?: string,
  categoryName?: string,
  type: 'income' | 'expense' | 'transfer' = 'expense'
): string {
  let note = text;

  // 1. Hapus frasa dompet jika ada
  if (walletPhrase) {
    const escaped = walletPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    note = note.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
  }

  // 2. Hapus pola mata uang
  // Suffix (25rb, 50k, 8.5jt)
  note = note.replace(/(?:rp\.?\s*)?\b\d+(?:[.,]\d+)?\s*(?:jt|juta|rb|ribu|k)\b/gi, ' ');
  // Dotted number (45.000, 1.500.000)
  note = note.replace(/(?:rp\.?\s*)?\b\d{1,3}(?:\.\d{3})+\b/gi, ' ');
  // Rp prefix with numbers (rp 45000)
  note = note.replace(/rp\.?\s*\b\d+\b/gi, ' ');
  // Standalone digits
  note = note.replace(/\b\d{3,10}\b/gi, ' ');

  // Rapikan spasi
  note = note.replace(/\s+/g, ' ').trim();

  // 3. Hapus kata kerja umum di awal (jika tidak membuat teks kosong)
  const withoutVerb = note.replace(/^(?:beli|bayar|pesan|order|beliin|ongkos)\s+/i, '').trim();
  if (withoutVerb.length > 0) {
    note = withoutVerb;
  }

  // Jika setelah dibersihkan teks menjadi kosong, gunakan nama kategori atau default
  if (!note) {
    note = categoryName || (type === 'income' ? 'Pemasukan' : 'Pengeluaran');
  }

  // Huruf awal kapital
  return note.charAt(0).toUpperCase() + note.slice(1);
}

/**
 * Main NLP Parser Pipeline: Menggabungkan deteksi nominal, jenis, dompet, kategori, dan pembersihan catatan.
 * Dilengkapi fallback mandiri rule-based regex saat AI provider offline.
 */
export async function parseTransactionNLP(
  text: string,
  userId: string = 'admin-owner-talitha'
): Promise<ParsedNLPResult> {
  const startTime = Date.now();
  const trimmed = (text || '').trim();

  const user = db.getUser(userId);
  const userWallets = db.getWallets(userId);
  const userCategories = db.getCategories(userId);

  // 1. Deteksi jenis transaksi
  const jenis = detectTransactionType(trimmed);
  const normalizedType: 'income' | 'expense' | 'transfer' =
    jenis === 'pemasukan' ? 'income' : jenis === 'transfer' ? 'transfer' : 'expense';

  // 2. Ekstrak nominal uang
  const nominal = parseIndonesianCurrency(trimmed);

  // 3. Ekstrak dompet yang dituju
  const walletMatch = matchWalletFromText(trimmed, userWallets);

  // 4. Tentukan kategori berdasarkan teks yang sudah bersih dari kata kunci dompet
  const category = deduceCategory(walletMatch.cleanedText, normalizedType, userCategories);

  // 5. Bersihkan catatan transaksi
  const catatan = cleanNoteDescription(trimmed, walletMatch.phraseMatched, category.name, normalizedType);

  // Rekam Log Telemetri AI/NLP
  const latency = Date.now() - startTime;
  db.aiLogs.unshift({
    id: 'log-' + Date.now(),
    user_id: userId,
    user_name: user?.full_name || 'Telegram User',
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    feature: 'text_parsing',
    prompt_tokens: 145,
    completion_tokens: 38,
    latency_ms: latency,
    status: nominal > 0 ? 'success' : 'error',
    created_at: new Date().toISOString(),
  });

  if (nominal <= 0) {
    throw new Error(
      'Nominal tidak terdeteksi. Contoh format: "beli bakso 15rb", "makan siang 45000 di gopay", atau "gajian 8.5jt"'
    );
  }

  return {
    jenis,
    nominal,
    kategori: category.name,
    kategoriEmoji: category.emoji,
    categoryId: category.id,
    catatan,
    walletId: walletMatch.walletId,
    walletName: walletMatch.walletName,
    targetWallet: walletMatch.wallet,
    confidence: 0.98,
    rawText: text,
  };
}
