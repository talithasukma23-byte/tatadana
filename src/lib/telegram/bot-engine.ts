// ====================================================================
// TataDana Telegram Bot Engine
// Webhook Processing, Natural Language Parsing, Reply Formatter, & Commands
// ====================================================================

import { db } from '@/lib/supabase/mock-db';
import { formatRupiah, formatWIB, generateProgressBar } from '@/lib/utils';
import {
  parseTransactionWithAI,
  parseReceiptPhotoAI,
  transcribeVoiceNoteAI,
  checkFinancialAdvisorTriggers,
} from '@/lib/ai/multi-provider';
import {
  parseTransactionNLP,
  matchWalletFromText,
  parseIndonesianCurrency,
  cleanNoteDescription,
  ParsedNLPResult,
} from './nlp-parser';
import { handleTelegramCommand } from './command-handler';
import { Wallet, Category, UserProfile } from '@/types/database';

export type TelegramSessionState = 'IDLE' | 'AWAITING_WALLET' | 'AWAITING_CONFIRMATION';

export interface TelegramPendingDraft {
  userId: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  notes: string;
  categoryId?: string;
  categoryName: string;
  categoryEmoji?: string;
  walletId?: string;
  walletName?: string;
  paymentMethod?: string;
  transactionDate?: string;
  source: 'telegram_text' | 'telegram_photo' | 'telegram_voice';
  rawReceiptUrl?: string;
  items?: Array<{ item_name: string; price: number; quantity: number; category_name: string }>;
}

export interface TelegramSession {
  chatId: number;
  state: TelegramSessionState;
  draft: TelegramPendingDraft;
  availableWallets?: Wallet[];
  createdAt: number;
  updatedAt: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      first_name?: string;
      username?: string;
      type: string;
    };
    date: number;
    text?: string;
    photo?: Array<{ file_id: string; file_unique_id: string; file_size: number }>;
    voice?: { file_id: string; duration: number };
    audio?: { file_id: string; duration: number };
    caption?: string;
  };
}

export interface BotReplyResult {
  chat_id: number;
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
}

import { getActiveTunnelUrl, getEffectiveWebhookBaseUrl } from '@/lib/tunnel-manager';
import { getActiveBotToken } from '@/lib/telegram/bot-config';

export interface BotSetupResult {
  success: boolean;
  botName?: string;
  isLocalDev?: boolean;
  webhookSet?: boolean;
  webhookUrl?: string;
  message?: string;
  error?: string;
}

/**
 * Membersihkan format token Telegram yang diinput pengguna (menghapus spasi, quote, atau prefix 'bot')
 */
export function cleanTelegramToken(rawToken: string): string {
  let token = (rawToken || '').trim().replace(/^['"]+|['"]+$/g, '');
  if (/^bot\d+:/i.test(token)) {
    token = token.slice(3);
  }
  const urlMatch = token.match(/api\.telegram\.org\/bot([^/?#]+)/i);
  if (urlMatch && urlMatch[1]) {
    token = urlMatch[1];
  }
  return token.trim();
}

/**
 * Deteksi apakah URL mengarah ke localhost / private IP / non-HTTPS
 */
export function isLocalOrPrivateUrl(urlStr?: string | null): boolean {
  if (!urlStr || typeof urlStr !== 'string') return true;
  const clean = urlStr.trim().toLowerCase();
  if (!clean) return true;

  let parsed: URL;
  try {
    parsed = new URL(clean.includes('://') ? clean : `http://${clean}`);
  } catch {
    return true;
  }

  // Telegram webhook membutuhkan protokol HTTPS
  if (parsed.protocol !== 'https:') {
    return true;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('169.254.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
  ) {
    return true;
  }

  return false;
}

/**
 * Verifikasi & Test Koneksi Bot Token via Telegram API dengan penanganan graceful localhost dan auto-tunnel
 */
export async function testAndSetupBotToken(
  token: string,
  webhookBaseUrl?: string
): Promise<BotSetupResult> {
  const cleanToken = cleanTelegramToken(token);
  if (!cleanToken) {
    return {
      success: false,
      error: 'Token bot tidak boleh kosong.',
    };
  }

  // 1. Dukungan test token lokal (simulasi)
  const upperToken = cleanToken.toUpperCase();
  if (upperToken.startsWith('DEMO_') || upperToken.startsWith('TEST_')) {
    return {
      success: true,
      botName: 'TataDanaBot_Simulated',
      isLocalDev: true,
      webhookSet: false,
      message: 'Bot simulasi aktif (mode development lokal).',
    };
  }

  // 2. Validasi token bot via Telegram API getMe
  let botName = 'TataDanaBot';
  try {
    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`, {
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();

    if (!data.ok) {
      return {
        success: false,
        error: data.description || 'Token bot tidak valid menurut Telegram API.',
      };
    }

    botName = data.result?.username || data.result?.first_name || 'TataDanaBot';
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Gagal menghubungi Telegram API server.',
    };
  }

  // 3. Deteksi URL Webhook Publik (cek Tunnel aktif terlebih dahulu)
  const tunnelUrl = getActiveTunnelUrl();
  const candidateUrl = tunnelUrl || webhookBaseUrl;
  const isLocal = isLocalOrPrivateUrl(candidateUrl);

  if (isLocal || !candidateUrl) {
    // Mode localhost tanpa tunnel publik aktif: getMe sukses, lewati setWebhook
    return {
      success: true,
      botName,
      isLocalDev: true,
      webhookSet: false,
      message: `Bot @${botName} berhasil diverifikasi via getMe! (Jembatan tunnel publik belum aktif, webhook dilewati).`,
    };
  }

  // 4. Setup Webhook jika URL adalah publik HTTPS (Tunnel ngrok/localtunnel atau Vercel/Railway)
  try {
    const cleanBase = candidateUrl.replace(/\/+$/, '');
    const webhookUrl = `${cleanBase}/api/telegram/webhook`;
    const setWebhookUrl = new URL(`https://api.telegram.org/bot${cleanToken}/setWebhook`);
    setWebhookUrl.searchParams.set('url', webhookUrl);

    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
      setWebhookUrl.searchParams.set('secret_token', webhookSecret.trim());
    }

    const whRes = await fetch(setWebhookUrl.toString(), {
      signal: AbortSignal.timeout(15000),
    });
    const whData = await whRes.json();

    if (!whData.ok) {
      const desc = whData.description || '';
      const descLower = desc.toLowerCase();
      if (
        descLower.includes('ip address reserved') ||
        descLower.includes('failed to resolve host') ||
        descLower.includes('bad webhook') ||
        descLower.includes('https url must be provided') ||
        descLower.includes('wrong remote host')
      ) {
        return {
          success: true,
          botName,
          isLocalDev: true,
          webhookSet: false,
          message: `Bot @${botName} valid. Peringatan webhook: ${desc}`,
        };
      }

      return {
        success: true,
        botName,
        isLocalDev: false,
        webhookSet: false,
        message: `Bot @${botName} valid (getMe sukses), namun webhook gagal diset: ${desc}`,
      };
    }

    return {
      success: true,
      botName,
      isLocalDev: false,
      webhookSet: true,
      webhookUrl,
      message: `Bot @${botName} berhasil terhubung! Webhook aktif di ${webhookUrl}.`,
    };
  } catch (whErr: any) {
    return {
      success: true,
      botName,
      isLocalDev: true,
      webhookSet: false,
      message: `Bot @${botName} valid via getMe. Catatan webhook: ${whErr.message}`,
    };
  }
}

export interface TelegramWebhookInfoData {
  url: string;
  hasCustomCertificate: boolean;
  pendingUpdateCount: number;
  lastErrorDate?: string;
  lastErrorMessage?: string;
  maxConnections?: number;
  ipAddress?: string;
  isHealthy: boolean;
}

export interface TelegramWebhookInfoResult {
  ok: boolean;
  info?: TelegramWebhookInfoData;
  error?: string;
}

/**
 * Memeriksa status kesehatan webhook dari Telegram API (getWebhookInfo)
 */
export async function getTelegramWebhookInfo(
  botToken?: string
): Promise<TelegramWebhookInfoResult> {
  const token = botToken || getActiveBotToken() || process.env.TELEGRAM_BOT_TOKEN;
  const cleanToken = token ? cleanTelegramToken(token) : '';

  if (!cleanToken) {
    return {
      ok: false,
      error: 'Token bot belum dikonfigurasi.',
    };
  }

  const upper = cleanToken.toUpperCase();
  if (upper.startsWith('DEMO_') || upper.startsWith('TEST_') || cleanToken === 'mock_token') {
    return {
      ok: true,
      info: {
        url: '',
        hasCustomCertificate: false,
        pendingUpdateCount: 0,
        isHealthy: true,
      },
    };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/getWebhookInfo`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();

    if (!data.ok || !data.result) {
      return {
        ok: false,
        error: data.description || 'Gagal mengambil informasi webhook dari Telegram API.',
      };
    }

    const r = data.result;
    const hasError = !!r.last_error_message;
    const isHealthy = !hasError && (r.pending_update_count || 0) < 10;

    const info: TelegramWebhookInfoData = {
      url: r.url || '',
      hasCustomCertificate: !!r.has_custom_certificate,
      pendingUpdateCount: r.pending_update_count || 0,
      lastErrorDate: r.last_error_date ? new Date(r.last_error_date * 1000).toISOString() : undefined,
      lastErrorMessage: r.last_error_message || undefined,
      maxConnections: r.max_connections,
      ipAddress: r.ip_address,
      isHealthy,
    };

    return {
      ok: true,
      info,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || 'Gagal menghubungi Telegram API untuk getWebhookInfo.',
    };
  }
}

// ====================================================================
// Telegram Pending Transaction Session Management (Confirmation & Wallet Selection)
// ====================================================================

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 menit

const sessionStore: Map<number, TelegramSession> =
  (globalThis as any).__tatadana_telegram_sessions ||
  ((globalThis as any).__tatadana_telegram_sessions = new Map<number, TelegramSession>());

export function getPendingTelegramSession(chatId: number): TelegramSession | null {
  const session = sessionStore.get(chatId);
  if (!session) return null;
  if (Date.now() - session.updatedAt > SESSION_TIMEOUT_MS) {
    sessionStore.delete(chatId);
    return null;
  }
  return session;
}

export function setPendingTelegramSession(chatId: number, session: TelegramSession): void {
  session.updatedAt = Date.now();
  sessionStore.set(chatId, session);
}

export function clearPendingTelegramSession(chatId: number): void {
  sessionStore.delete(chatId);
}

export function isConfirmationText(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase().replace(/^[\/!]/, '');
  return /^(?:ya|iya|y|yes|ok|oke|okee|sip|siap|setuju|simpan|konfirmasi|deal|lanjut|benar|betul)$/i.test(clean);
}

export function isCancellationText(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase().replace(/^[\/!]/, '');
  return /^(?:batal|cancel|tidak|ga|gak|ngga|nggak|gajadi|engga|enggak|batalin|abort|stop)$/i.test(clean);
}

export function deducePaymentMethod(wallet: Wallet): string {
  if (wallet.type === 'Cash') return 'Tunai / Cash';
  if (wallet.type === 'Bank') return `Transfer Bank / Debit (${wallet.name.replace(/[^a-zA-Z0-9\s]/g, '').trim()})`;
  if (wallet.type === 'E-Wallet') return `E-Wallet (${wallet.name.replace(/[^a-zA-Z0-9\s]/g, '').trim()})`;
  if (wallet.type === 'Investasi') return 'Investasi';
  return wallet.name;
}

export function resolveWalletChoice(input: string, wallets: Wallet[] = []): Wallet | undefined {
  if (!input || wallets.length === 0) return undefined;
  const trimmed = input.trim().toLowerCase();

  // 1. By index number (1, 2, 3...)
  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && num >= 1 && num <= wallets.length) {
    return wallets[num - 1];
  }

  // 2. By matching wallet text
  const matchResult = matchWalletFromText(trimmed, wallets);
  if (matchResult.wallet) {
    return matchResult.wallet;
  }

  // 3. Substring match
  const found = wallets.find((w) => {
    const nameLower = w.name.toLowerCase();
    return nameLower.includes(trimmed) || trimmed.includes(nameLower.replace(/[^a-z0-9]/g, ''));
  });
  if (found) return found;

  return undefined;
}

export function formatConfirmationPrompt(
  draft: TelegramPendingDraft,
  wallet: Wallet,
  isReminder: boolean = false
): string {
  const isIncome = draft.type === 'income';
  const typeLabel = isIncome ? '💰 Pemasukan' : '💸 Pengeluaran';
  const dateFormatted = formatWIB(new Date(draft.transactionDate || Date.now()));
  const currentBalance = wallet.balance;
  const estimatedBalance = isIncome ? currentBalance + draft.amount : currentBalance - draft.amount;
  const paymentMethod = draft.paymentMethod || deducePaymentMethod(wallet);

  let header = '';
  if (isReminder) {
    header = `⚠️ *Transaksi Belum Dikonfirmasi*\nMohon konfirmasi atau batalkan transaksi berikut:`;
  } else {
    header = `📝 *Konfirmasi Transaksi*\nMohon periksa ringkasan transaksi sebelum disimpan:`;
  }

  return `${header}

├ *Jenis* : ${typeLabel}
├ *Transaksi* : ${draft.notes}
├ *Nominal* : ${formatRupiah(draft.amount)}
├ *Kategori* : ${draft.categoryEmoji || '🏷️'} ${draft.categoryName}
├ *Dompet* : 👛 ${wallet.name}
├ *Metode* : ${paymentMethod}
├ *Tanggal* : ${dateFormatted}
├ *Saldo Saat Ini* : ${formatRupiah(currentBalance)}
└ *Estimasi Saldo* : ${formatRupiah(estimatedBalance)}

👉 Ketik *YA* untuk konfirmasi & simpan
👉 Ketik *BATAL* untuk membatalkan`;
}

export function formatWalletSelectionPrompt(
  draft: TelegramPendingDraft,
  wallets: Wallet[],
  isRetry: boolean = false
): string {
  const isIncome = draft.type === 'income';
  const typeLabel = isIncome ? 'Pemasukan' : 'Pengeluaran';

  const listText = wallets
    .map((w, idx) => `${idx + 1}. ${w.name} — Saldo: ${formatRupiah(w.balance)}`)
    .join('\n');

  let prefix = '';
  if (isRetry) {
    prefix = `⚠️ *Pilihan dompet tidak valid.*\nSilakan pilih salah satu dompet dari daftar berikut:`;
  } else {
    prefix = `👛 *Pilih Dompet Sumber Dana*\n\nTransaksi: *${draft.notes}* (${formatRupiah(draft.amount)})\nKategori: ${draft.categoryEmoji || '🏷️'} *${draft.categoryName}*\nJenis: *${typeLabel}*`;
  }

  return `${prefix}

${listText}

_Balas dengan mengetik nomor dompet (contoh: *1*) atau sebutkan nama dompet._
_Ketik *BATAL* untuk membatalkan transaksi._`;
}

/**
 * Handle incoming Telegram Update payload (Idempotent & Confirmation-Aware)
 */
export async function handleTelegramWebhook(
  update: TelegramUpdate,
  alreadyMarkedProcessed: boolean = false
): Promise<BotReplyResult | null> {
  // 1. Idempotency Check
  if (!alreadyMarkedProcessed) {
    if (db.isTelegramUpdateProcessed(update.update_id)) {
      console.log(`[Telegram] Skipping duplicate update_id: ${update.update_id}`);
      return null;
    }
    db.markTelegramUpdateProcessed(update.update_id);
  }

  const message = update.message;
  if (!message || !message.chat) return null;

  const chatId = message.chat.id;

  // 2. Identify User from database (by chatId, or username, with fallback)
  let user = db.getUserByTelegramId(chatId);
  if (!user && message?.from?.username) {
    user = db.getUserByEmailOrUsername(message.from.username);
  }
  if (!user) {
    user = db.getUser('admin-owner-talitha');
  }
  if (user) {
    user.telegram_chat_id = chatId;
    user.telegram_connected = true;
    user.telegram_connected_at = user.telegram_connected_at || new Date().toISOString();
    if (message?.from?.username) {
      user.telegram_username = message.from.username;
    }
  }

  const text = message.text?.trim() || '';

  // 3. Handle Commands (e.g. /start, /help, /bantuan, /saldo, /laporan, /sheet, /budget, recaps)
  if (text.startsWith('/')) {
    const cmdResult = handleTelegramCommand(chatId, text, message, user);
    if (cmdResult) {
      return cmdResult;
    }
  }

  if (!user) {
    return {
      chat_id: chatId,
      text: `👋 Halo! Akun Telegram kamu belum terhubung ke TataDana.\n\nKetik \`/start [NOMOR_HP]\` untuk menghubungkan akun kamu.`,
      parse_mode: 'Markdown',
    };
  }

  // Check pending session for this chat
  const activeSession = getPendingTelegramSession(chatId);

  // 4. Handle Cancellation (BATAL / CANCEL / /batal)
  if (isCancellationText(text)) {
    if (activeSession) {
      clearPendingTelegramSession(chatId);
      return {
        chat_id: chatId,
        text: `❌ *Pencatatan transaksi dibatalkan.*\n\nTidak ada perubahan saldo atau data yang disimpan. Kamu bisa mulai pencatatan baru kapan saja.`,
        parse_mode: 'Markdown',
      };
    } else {
      return {
        chat_id: chatId,
        text: `ℹ️ Tidak ada transaksi yang sedang menunggu konfirmasi.`,
        parse_mode: 'Markdown',
      };
    }
  }

  // 5. Handle Active Session: AWAITING_WALLET
  if (activeSession && activeSession.state === 'AWAITING_WALLET') {
    const userWallets = activeSession.availableWallets || db.getWallets(user.id);
    const chosenWallet = resolveWalletChoice(text, userWallets);
    if (chosenWallet) {
      activeSession.draft.walletId = chosenWallet.id;
      activeSession.draft.walletName = chosenWallet.name;
      activeSession.draft.paymentMethod = deducePaymentMethod(chosenWallet);
      activeSession.state = 'AWAITING_CONFIRMATION';
      activeSession.updatedAt = Date.now();
      setPendingTelegramSession(chatId, activeSession);

      const confirmPrompt = formatConfirmationPrompt(activeSession.draft, chosenWallet);
      return {
        chat_id: chatId,
        text: confirmPrompt,
        parse_mode: 'Markdown',
      };
    } else {
      const retryPrompt = formatWalletSelectionPrompt(activeSession.draft, userWallets, true);
      return {
        chat_id: chatId,
        text: retryPrompt,
        parse_mode: 'Markdown',
      };
    }
  }

  // 6. Handle Active Session: AWAITING_CONFIRMATION
  if (activeSession && activeSession.state === 'AWAITING_CONFIRMATION') {
    if (isConfirmationText(text)) {
      // User explicitly confirmed: persist and deduct balance now!
      const draft = activeSession.draft;
      const userWallets = db.getWallets(draft.userId);
      const targetWallet =
        userWallets.find((w) => w.id === draft.walletId) || db.getDefaultWallet(draft.userId);
      const userCategories = db.getCategories(draft.userId);
      let cat = draft.categoryId
        ? userCategories.find((c) => c.id === draft.categoryId)
        : userCategories.find((c) => c.name.toLowerCase() === draft.categoryName.toLowerCase());
      if (!cat) {
        cat =
          userCategories.find((c) => c.type === (draft.type === 'income' ? 'income' : 'expense')) ||
          userCategories[0];
      }

      // Strictly persist via db.addTransaction
      db.addTransaction(
        {
          user_id: draft.userId,
          wallet_id: targetWallet.id,
          category_id: cat?.id,
          type: draft.type,
          amount: draft.amount,
          notes: draft.notes,
          transaction_date: draft.transactionDate || new Date().toISOString(),
          source: draft.source,
          raw_receipt_url: draft.rawReceiptUrl,
        },
        draft.items
      );

      // Clear session after persisting
      clearPendingTelegramSession(chatId);

      const parsedForReply = {
        nominal: draft.amount,
        catatan: draft.notes,
        kategori: cat?.name || draft.categoryName,
        kategoriEmoji: cat?.emoji || draft.categoryEmoji,
        jenis: draft.type === 'income' ? 'pemasukan' : 'pengeluaran',
        items: draft.items,
      };

      if (draft.type === 'income') {
        const replyText = formatIncomeReply(parsedForReply, targetWallet, cat);
        return {
          chat_id: chatId,
          text: replyText,
          parse_mode: 'Markdown',
        };
      } else {
        const replyText = formatExpenseReply(parsedForReply, targetWallet, cat, user);
        return {
          chat_id: chatId,
          text:
            draft.source === 'telegram_photo'
              ? `🧾 *Foto struk berhasil disimpan (${draft.items?.length || 0} item)!*\n\n${replyText}`
              : replyText,
          parse_mode: 'Markdown',
        };
      }
    } else {
      // User sent non-confirmation input while awaiting confirmation
      const userWallets = db.getWallets(activeSession.draft.userId);
      const targetWallet =
        userWallets.find((w) => w.id === activeSession.draft.walletId) ||
        db.getDefaultWallet(activeSession.draft.userId);
      const reminderPrompt = formatConfirmationPrompt(activeSession.draft, targetWallet, true);
      return {
        chat_id: chatId,
        text: reminderPrompt,
        parse_mode: 'Markdown',
      };
    }
  }

  // 7. If user sent a confirmation word while IDLE (no pending session)
  if (isConfirmationText(text)) {
    return {
      chat_id: chatId,
      text: `ℹ️ Tidak ada transaksi yang sedang menunggu konfirmasi.\n\nSilakan ketik transaksi baru, contoh:\n👉 \`beli kopi 25rb cash\`\n👉 \`makan siang 45rb di gopay\``,
      parse_mode: 'Markdown',
    };
  }

  // 8. Check Plan Limit (Starter: 50 trx / month)
  const monthlyTrx = db.getMonthlyTransactionCount(user.id);
  if (user.plan === 'starter' && monthlyTrx >= 50) {
    return {
      chat_id: chatId,
      text: `⚠️ *Batas Transaksi Bulanan Tercapai!*\n\nKamu sudah mencatat *${monthlyTrx} transaksi* bulan ini di paket *Starter* (maksimal 50 transaksi/bulan).\n\n🚀 *Upgrade ke TataDana Pro* untuk:\n• Unlimited transaksi, wallet, & kategori\n• Input struk belanja otomatis via foto AI OCR\n• AI Financial Advisor aktif otomatis\n• Export unlimited ke PDF & Excel\n\nUpgrade sekarang di aplikasi web TataDana seharga *Rp99.000 (Sekali Bayar)!*`,
      parse_mode: 'Markdown',
    };
  }

  // 9. Case 1: Photo Message (Struk Belanja)
  if (message.photo && message.photo.length > 0) {
    if (user.plan !== 'pro') {
      return {
        chat_id: chatId,
        text: `📸 *Fitur Foto Struk Khusus Pengguna Pro*\n\nFitur AI OCR untuk membaca struk belanja otomatis hanya tersedia di paket *Pro*.\n\nKetik transaksi kamu secara manual lewat teks (contoh: \`belanja bulanan 285rb\`) atau upgrade ke *Pro* hanya Rp99.000 sekali bayar untuk menikmati fitur ini!`,
        parse_mode: 'Markdown',
      };
    }

    try {
      const bestPhoto = message.photo[message.photo.length - 1];
      const parsed = await parseReceiptPhotoAI(bestPhoto.file_id, user.id);

      const userWallets = db.getWallets(user.id);
      let targetWallet: Wallet | undefined;
      if (message.caption) {
        const walletMatch = matchWalletFromText(message.caption, userWallets);
        targetWallet = walletMatch.wallet;
      }

      const cat = db.categories.find((c) => c.name === parsed.kategori) || db.categories[0];

      const draft: TelegramPendingDraft = {
        userId: user.id,
        type: 'expense',
        amount: parsed.nominal,
        notes: parsed.catatan || `Struk Belanja (${parsed.items?.length || 0} item)`,
        categoryId: cat?.id,
        categoryName: cat?.name || 'Belanja',
        categoryEmoji: cat?.emoji || '🛒',
        walletId: targetWallet?.id,
        walletName: targetWallet?.name,
        paymentMethod: targetWallet ? deducePaymentMethod(targetWallet) : undefined,
        transactionDate: new Date().toISOString(),
        source: 'telegram_photo',
        rawReceiptUrl: `https://api.telegram.org/file/bot-placeholder/${bestPhoto.file_id}`,
        items: parsed.items,
      };

      if (!targetWallet) {
        if (userWallets.length === 1) {
          targetWallet = userWallets[0];
          draft.walletId = targetWallet.id;
          draft.walletName = targetWallet.name;
          draft.paymentMethod = deducePaymentMethod(targetWallet);
          setPendingTelegramSession(chatId, {
            chatId,
            state: 'AWAITING_CONFIRMATION',
            draft,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          return {
            chat_id: chatId,
            text: `📸 *Struk berhasil dipindai (${parsed.items?.length || 0} item)!*\n\n${formatConfirmationPrompt(draft, targetWallet)}`,
            parse_mode: 'Markdown',
          };
        } else {
          setPendingTelegramSession(chatId, {
            chatId,
            state: 'AWAITING_WALLET',
            draft,
            availableWallets: userWallets,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          return {
            chat_id: chatId,
            text: `📸 *Struk berhasil dipindai (${parsed.items?.length || 0} item)!*\n\n${formatWalletSelectionPrompt(draft, userWallets)}`,
            parse_mode: 'Markdown',
          };
        }
      } else {
        setPendingTelegramSession(chatId, {
          chatId,
          state: 'AWAITING_CONFIRMATION',
          draft,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        return {
          chat_id: chatId,
          text: `📸 *Struk berhasil dipindai (${parsed.items?.length || 0} item)!*\n\n${formatConfirmationPrompt(draft, targetWallet)}`,
          parse_mode: 'Markdown',
        };
      }
    } catch (err: any) {
      return {
        chat_id: chatId,
        text: `❌ Gagal memproses foto struk: ${err.message}\nPastikan gambar struk cukup terang dan terbaca jelas.`,
      };
    }
  }

  // 10. Case 2: Voice Note / Audio Message
  const voice = message.voice || message.audio;
  if (voice) {
    try {
      const { transcript, parsed } = await transcribeVoiceNoteAI(voice.duration, undefined, user.id);
      const userWallets = db.getWallets(user.id);
      const walletMatch = matchWalletFromText(transcript, userWallets);
      let targetWallet: Wallet | undefined = walletMatch.wallet;
      const cat = db.categories.find((c) => c.name === parsed.kategori) || db.categories[0];

      const draft: TelegramPendingDraft = {
        userId: user.id,
        type: parsed.jenis === 'pemasukan' ? 'income' : 'expense',
        amount: parsed.nominal,
        notes: parsed.catatan || transcript,
        categoryId: cat?.id,
        categoryName: cat?.name || parsed.kategori,
        categoryEmoji: cat?.emoji || (parsed.jenis === 'pemasukan' ? '💰' : '🏷️'),
        walletId: targetWallet?.id,
        walletName: targetWallet?.name,
        paymentMethod: targetWallet ? deducePaymentMethod(targetWallet) : undefined,
        transactionDate: new Date().toISOString(),
        source: 'telegram_voice',
      };

      if (!targetWallet) {
        if (userWallets.length === 1) {
          targetWallet = userWallets[0];
          draft.walletId = targetWallet.id;
          draft.walletName = targetWallet.name;
          draft.paymentMethod = deducePaymentMethod(targetWallet);
          setPendingTelegramSession(chatId, {
            chatId,
            state: 'AWAITING_CONFIRMATION',
            draft,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          return {
            chat_id: chatId,
            text: `🎙️ Transkrip: "${transcript}"\n\n${formatConfirmationPrompt(draft, targetWallet)}`,
            parse_mode: 'Markdown',
          };
        } else {
          setPendingTelegramSession(chatId, {
            chatId,
            state: 'AWAITING_WALLET',
            draft,
            availableWallets: userWallets,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          return {
            chat_id: chatId,
            text: `🎙️ Transkrip: "${transcript}"\n\n${formatWalletSelectionPrompt(draft, userWallets)}`,
            parse_mode: 'Markdown',
          };
        }
      } else {
        setPendingTelegramSession(chatId, {
          chatId,
          state: 'AWAITING_CONFIRMATION',
          draft,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        return {
          chat_id: chatId,
          text: `🎙️ Transkrip: "${transcript}"\n\n${formatConfirmationPrompt(draft, targetWallet)}`,
          parse_mode: 'Markdown',
        };
      }
    } catch (err: any) {
      return {
        chat_id: chatId,
        text: `❌ ${err.message}`,
      };
    }
  }

  // 11. Case 3: Text Input
  if (text) {
    try {
      // Check if nominal is present in text
      const nominalCheck = parseIndonesianCurrency(text);
      if (nominalCheck <= 0) {
        const candidateNote = cleanNoteDescription(text);
        return {
          chat_id: chatId,
          text: `❓ *Berapa nominal transaksi kamu?*\n\nInformasi nominal belum terdeteksi pada pesan: _"${text}"_\n\nSilakan ketik ulang secara lengkap beserta nominalnya, contoh:\n👉 \`beli kopi 25rb\`\n👉 \`${candidateNote || 'kopi'} 25000 cash\`\n👉 \`makan siang 45rb di gopay\`\n👉 \`gajian 8.5jt di bca\``,
          parse_mode: 'Markdown',
        };
      }

      const parsed = await parseTransactionNLP(text, user.id);
      const userWallets = db.getWallets(user.id);
      let targetWallet = parsed.walletId
        ? userWallets.find((w) => w.id === parsed.walletId)
        : undefined;

      const userCategories = db.getCategories(user.id);
      let cat = parsed.categoryId
        ? userCategories.find((c) => c.id === parsed.categoryId)
        : userCategories.find((c) => c.name.toLowerCase() === parsed.kategori.toLowerCase());

      if (!cat) {
        cat =
          userCategories.find((c) => c.type === (parsed.jenis === 'pemasukan' ? 'income' : 'expense')) ||
          userCategories[0];
      }

      const draft: TelegramPendingDraft = {
        userId: user.id,
        type: parsed.jenis === 'pemasukan' ? 'income' : 'expense',
        amount: parsed.nominal,
        notes: parsed.catatan,
        categoryId: cat?.id,
        categoryName: cat?.name || parsed.kategori,
        categoryEmoji: cat?.emoji || parsed.kategoriEmoji,
        walletId: targetWallet?.id,
        walletName: targetWallet?.name,
        paymentMethod: targetWallet ? deducePaymentMethod(targetWallet) : undefined,
        transactionDate: new Date().toISOString(),
        source: 'telegram_text',
      };

      // If wallet is not identified
      if (!targetWallet) {
        if (userWallets.length === 1) {
          // If user only has 1 wallet total, auto-assign it and ask confirmation
          targetWallet = userWallets[0];
          draft.walletId = targetWallet.id;
          draft.walletName = targetWallet.name;
          draft.paymentMethod = deducePaymentMethod(targetWallet);

          setPendingTelegramSession(chatId, {
            chatId,
            state: 'AWAITING_CONFIRMATION',
            draft,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });

          return {
            chat_id: chatId,
            text: formatConfirmationPrompt(draft, targetWallet),
            parse_mode: 'Markdown',
          };
        } else {
          // Ambiguous wallet: prompt user to pick from list of their wallets
          setPendingTelegramSession(chatId, {
            chatId,
            state: 'AWAITING_WALLET',
            draft,
            availableWallets: userWallets,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });

          return {
            chat_id: chatId,
            text: formatWalletSelectionPrompt(draft, userWallets),
            parse_mode: 'Markdown',
          };
        }
      } else {
        // Wallet clearly identified (e.g. "cash", "bca", "gopay"): enter AWAITING_CONFIRMATION
        setPendingTelegramSession(chatId, {
          chatId,
          state: 'AWAITING_CONFIRMATION',
          draft,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        return {
          chat_id: chatId,
          text: formatConfirmationPrompt(draft, targetWallet),
          parse_mode: 'Markdown',
        };
      }
    } catch (err: any) {
      return {
        chat_id: chatId,
        text: `⚠️ *TataDana belum memahami kalimatmu.*\n\n${err.message || ''}\n\n*Contoh format yang didukung:*\n• \`beli kopi 25rb\`\n• \`makan siang 45000 di gopay\`\n• \`bensin 30rb pakai bca\`\n• \`gajian 8.5jt di mandiri\`\n• \`bayar listrik 150ribu\``,
        parse_mode: 'Markdown',
      };
    }
  }

  return null;
}

/**
 * Format Reply Pengeluaran (Part 4.4)
 */
export function formatExpenseReply(parsed: any, wallet: any, category: any, user: any): string {
  const now = new Date();
  const dateFormatted = formatWIB(now);

  // Hitung penggunaan budget kategori bulan ini
  const allTx = db.getTransactions(user.id);
  const currentMonthExpenses = allTx
    .filter((t) => t.category_id === category.id && t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  let text = `📅 ${dateFormatted}
💸 *Pengeluaran tercatat!*
├ Nominal : ${formatRupiah(parsed.nominal)}
├ Kategori : ${category.emoji || '🏷️'} ${category.name}
├ Dompet : 👛 ${wallet.name}
├ Catatan : ${parsed.catatan}
└ Saldo : ${formatRupiah(wallet.balance)}`;

  if (category.monthly_budget && category.monthly_budget > 0) {
    const budget = category.monthly_budget;
    const pct = Math.min(100, Math.round((currentMonthExpenses / budget) * 100));
    const remainingBudget = Math.max(0, budget - currentMonthExpenses);
    const progressBar = generateProgressBar(pct, 10);

    let motivation = '👍 Pengeluaran terkendali, pertahankan!';
    if (pct >= 100) {
      motivation = '🚨 Budget kategori ini sudah melebihi 100%! Rem pengeluaranmu ya.';
    } else if (pct >= 80) {
      motivation = '⚠️ Perhatian: Budget kategori ini sudah mencapai 80%. Hemat-hemat ya!';
    }

    text += `\n\n📊 *Budget ${category.name} bulan ini:*\n${progressBar} ${pct}% — sisa ${formatRupiah(remainingBudget)}\n_${motivation}_`;
  }

  // Cek AI Financial Advisor
  const advisorNote = checkFinancialAdvisorTriggers(user.id, parsed.nominal, category.id);
  if (advisorNote) {
    text += `\n\n${advisorNote}`;
  }

  return text;
}

/**
 * Format Reply Pemasukan (Part 4.5)
 */
export function formatIncomeReply(parsed: any, wallet: any, category?: any): string {
  const now = new Date();
  const dateFormatted = formatWIB(now);
  const catEmoji = category?.emoji || parsed.kategoriEmoji || '💰';
  const catName = category?.name || parsed.kategori || 'Pemasukan';

  return `📅 ${dateFormatted}
💰 *Pemasukan tercatat!*
├ Nominal : ${formatRupiah(parsed.nominal)}
├ Kategori : ${catEmoji} ${catName}
├ Dompet : 👛 ${wallet.name}
${parsed.catatan ? `├ Catatan : ${parsed.catatan}\n` : ''}└ Saldo baru : ${formatRupiah(wallet.balance)}

💪 Semangat terus! Jangan lupa sisihkan untuk tabungan ya.`;
}

/**
 * Handle Command /saldo, /hari ini, /minggu ini, /bulan ini, /budget, /bantuan (Delegates to modular command handler)
 */
export function handleBotCommands(chatId: number, cmd: string, user: any): BotReplyResult {
  const result = handleTelegramCommand(chatId, cmd, undefined, user);
  if (result) {
    return result;
  }
  return {
    chat_id: chatId,
    text: `Ketik /bantuan untuk melihat daftar perintah.`,
    parse_mode: 'Markdown',
  };
}
