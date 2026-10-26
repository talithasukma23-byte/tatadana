// ====================================================================
// TataDana Modular Telegram Command Handler
// Handles /start, /help, /bantuan, /saldo, /laporan, /sheet, /budget, recaps & aliases
// ====================================================================

import { db } from '@/lib/supabase/mock-db';
import { formatRupiah, generateProgressBar } from '@/lib/utils';
import { UserProfile } from '@/types/database';

export interface BotReplyResult {
  chat_id: number;
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
}

function unlinkedResponse(chatId: number): BotReplyResult {
  return {
    chat_id: chatId,
    text: `👋 *Halo! Akun Telegram kamu belum terhubung ke TataDana.*\n\nSilakan buka aplikasi web TataDana di menu *Settings → Telegram Bot* atau hubungkan nomor HP kamu dengan mengetik:\n\`/start [NOMOR_HP]\` (contoh: \`/start 081234567890\`)`,
    parse_mode: 'Markdown',
  };
}

/**
 * Handle and route all Telegram bot commands modularly
 */
export function handleTelegramCommand(
  chatId: number,
  rawText: string,
  message?: any,
  user?: UserProfile
): BotReplyResult | null {
  const trimmed = (rawText || '').trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  const parts = trimmed.split(/\s+/);
  // Bersihkan token command dari suffix @botname
  const baseCmd = parts[0].toLowerCase().replace(/@\w+$/, '');
  const fullLower = trimmed.toLowerCase();

  // Delegasikan perintah konfirmasi & pembatalan ke alur session konfirmasi bot-engine
  if (baseCmd === '/batal' || baseCmd === '/cancel' || baseCmd === '/ya' || baseCmd === '/konfirmasi' || baseCmd === '/ok') {
    return null;
  }

  // 1. Command /start
  if (baseCmd === '/start') {
    // A. Jika user belum terhubung
    if (!user) {
      if (parts.length > 1) {
        const tokenOrPhone = parts[1].trim();
        const matchedUser =
          db.getUserByPhone(tokenOrPhone) ||
          db.getUser(tokenOrPhone) ||
          db.getUser('admin-owner-talitha');

        if (matchedUser) {
          matchedUser.telegram_chat_id = chatId;
          matchedUser.telegram_username = message?.from?.username;
          matchedUser.telegram_connected = true;
          matchedUser.telegram_connected_at = new Date().toISOString();

          return {
            chat_id: chatId,
            text: `🎉 *Selamat datang di TataDana, ${matchedUser.full_name}!*\n\nAkun Telegram kamu berhasil terhubung dengan akun TataDana.\n\nSekarang kamu bisa mencatat pengeluaran semudah kirim chat, contoh:\n👉 \`beli bakso 25rb\`\n👉 \`makan siang 45000 di gopay\`\n👉 \`gajian 8.5jt di mandiri\`\n👉 Kirim voice note atau foto struk belanja (Pro)!\n\nKetik */bantuan* untuk melihat daftar perintah.`,
            parse_mode: 'Markdown',
          };
        }
      }

      return unlinkedResponse(chatId);
    }

    // B. Jika user sudah terhubung (Welcome back & status)
    const wallets = db.getWallets(user.id);
    const total = wallets.reduce((s, w) => s + w.balance, 0);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const txs = db.getTransactions(user.id);
    const monthExpenses = txs
      .filter((t) => t.type === 'expense' && t.transaction_date.startsWith(currentMonth))
      .reduce((s, t) => s + t.amount, 0);

    return {
      chat_id: chatId,
      text: `👋 *Halo kembali, ${user.full_name}!*\n\nAkun Telegram kamu sudah terhubung aktif dengan TataDana.\n\n👛 *Total Saldo:* ${formatRupiah(total)}\n📊 *Pengeluaran Bulan Ini:* ${formatRupiah(monthExpenses)}\n\n💡 *Aksi Cepat:*\n• Ketik transaksi: \`beli kopi 25rb di gopay\`\n• Cek rincian saldo: \`/saldo\`\n• Cek ringkasan laporan: \`/laporan\`\n• Panduan lengkap: \`/help\` atau \`/bantuan\``,
      parse_mode: 'Markdown',
    };
  }

  // 2. Command /saldo
  if (baseCmd === '/saldo') {
    if (!user) return unlinkedResponse(chatId);

    const wallets = db.getWallets(user.id);
    const total = wallets.reduce((s, w) => s + w.balance, 0);
    const list = wallets
      .map((w) => `├ ${w.icon || '👛'} ${w.name}: ${formatRupiah(w.balance)}`)
      .join('\n');

    return {
      chat_id: chatId,
      text: `👛 *Saldo Semua Dompet:*\n${list}\n└ *Total Saldo:* ${formatRupiah(total)}`,
      parse_mode: 'Markdown',
    };
  }

  // 3. Command /laporan dan /sheet
  if (baseCmd === '/laporan' || baseCmd === '/sheet') {
    if (!user) return unlinkedResponse(chatId);

    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const txs = db.getTransactions(user.id);

    // Hari Ini
    const todayTxs = txs.filter((t) => t.transaction_date.slice(0, 10) === today);
    const todayExpense = todayTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const todayIncome = todayTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

    // 7 Hari Terakhir
    const weekTxs = txs.filter((t) => t.transaction_date >= sevenDaysAgo);
    const weekExpense = weekTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const weekIncome = weekTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

    // Bulan Ini
    const monthTxs = txs.filter((t) => t.transaction_date.startsWith(currentMonth));
    const monthExpense = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const monthIncome = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/laporan`;

    return {
      chat_id: chatId,
      text: `📑 *Ringkasan Laporan Keuangan:*

📅 *Hari Ini:*
• Pemasukan: ${formatRupiah(todayIncome)}
• Pengeluaran: ${formatRupiah(todayExpense)}

📊 *7 Hari Terakhir:*
• Pemasukan: ${formatRupiah(weekIncome)}
• Pengeluaran: ${formatRupiah(weekExpense)}
• Net: ${formatRupiah(weekIncome - weekExpense)}

📈 *Bulan Ini:*
• Pemasukan: ${formatRupiah(monthIncome)}
• Pengeluaran: ${formatRupiah(monthExpense)}
• Surplus / Defisit: ${formatRupiah(monthIncome - monthExpense)}

🔗 *Dashboard Laporan Lengkap:*
${dashboardUrl}`,
      parse_mode: 'Markdown',
    };
  }

  // 4. Command /hariini, /hari ini, /hari_ini
  if (baseCmd === '/hariini' || baseCmd === '/hari_ini' || fullLower.startsWith('/hari ini')) {
    if (!user) return unlinkedResponse(chatId);

    const today = new Date().toISOString().slice(0, 10);
    const txs = db.getTransactions(user.id).filter((t) => t.transaction_date.slice(0, 10) === today);
    const inTotal = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const outTotal = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    return {
      chat_id: chatId,
      text: `📅 *Rekap Transaksi Hari Ini:*\n• Pemasukan: ${formatRupiah(inTotal)}\n• Pengeluaran: ${formatRupiah(outTotal)}\n• Net: ${formatRupiah(inTotal - outTotal)}\n• Total transaksi: ${txs.length} transaksi\n\nKetik transaksi baru kapan saja!`,
      parse_mode: 'Markdown',
    };
  }

  // 5. Command /mingguini, /minggu ini, /minggu_ini
  if (baseCmd === '/mingguini' || baseCmd === '/minggu_ini' || fullLower.startsWith('/minggu ini')) {
    if (!user) return unlinkedResponse(chatId);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const txs = db.getTransactions(user.id).filter((t) => t.transaction_date >= sevenDaysAgo);
    const inTotal = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const outTotal = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    return {
      chat_id: chatId,
      text: `📊 *Rekap 7 Hari Terakhir:*\n• Pemasukan: ${formatRupiah(inTotal)}\n• Pengeluaran: ${formatRupiah(outTotal)}\n• Net: ${formatRupiah(inTotal - outTotal)}\n• Jumlah Transaksi: ${txs.length}`,
      parse_mode: 'Markdown',
    };
  }

  // 6. Command /bulanini, /bulan ini, /bulan_ini
  if (baseCmd === '/bulanini' || baseCmd === '/bulan_ini' || fullLower.startsWith('/bulan ini')) {
    if (!user) return unlinkedResponse(chatId);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const categories = db.getCategories(user.id).filter((c) => c.type === 'expense');
    const txs = db.getTransactions(user.id).filter((t) => t.transaction_date.startsWith(currentMonth));
    const inTotal = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const outTotal = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const catBreakdown = categories
      .map((cat) => {
        const spent = txs
          .filter((t) => t.category_id === cat.id && t.type === 'expense')
          .reduce((s, t) => s + t.amount, 0);
        return `• ${cat.emoji} ${cat.name}: ${formatRupiah(spent)}`;
      })
      .join('\n');

    return {
      chat_id: chatId,
      text: `📈 *Rekap Keuangan Bulan Ini:*\n💰 Total Pemasukan: ${formatRupiah(inTotal)}\n💸 Total Pengeluaran: ${formatRupiah(outTotal)}\nNet: ${formatRupiah(inTotal - outTotal)}\n\n*Pengeluaran per Kategori:*\n${catBreakdown}`,
      parse_mode: 'Markdown',
    };
  }

  // 7. Command /budget
  if (baseCmd === '/budget') {
    if (!user) return unlinkedResponse(chatId);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const categories = db.getCategories(user.id).filter((c) => c.type === 'expense');
    const txs = db.getTransactions(user.id).filter((t) => t.transaction_date.startsWith(currentMonth));

    const activeBudgets = categories.filter((c) => (c.monthly_budget || 0) > 0);
    if (activeBudgets.length === 0) {
      return {
        chat_id: chatId,
        text: `🎯 *Status Budget Bulan Ini:*\n\nBelum ada target anggaran yang ditetapkan (Plafon Rp0).\nAnda dapat menentukan batas anggaran per kategori di web TataDana.`,
        parse_mode: 'Markdown',
      };
    }

    const list = activeBudgets
      .map((cat) => {
        const spent = txs
          .filter((t) => t.category_id === cat.id && t.type === 'expense')
          .reduce((s, t) => s + t.amount, 0);
        const budget = cat.monthly_budget || 0;
        const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
        const bar = generateProgressBar(pct, 8);
        return `${cat.emoji} *${cat.name}*\n${bar} ${pct}% (${formatRupiah(spent)} / ${formatRupiah(budget)})`;
      })
      .join('\n\n');

    return {
      chat_id: chatId,
      text: `🎯 *Status Budget Bulan Ini:*\n\n${list}`,
      parse_mode: 'Markdown',
    };
  }

  // 8. Command /help dan /bantuan (Serta fallback command lainnya)
  return {
    chat_id: chatId,
    text: `🤖 *Panduan & Perintah TataDana Bot:*

📊 *Informasi & Laporan:*
• \`/saldo\` — Cek rincian saldo semua dompet & total
• \`/laporan\` — Ringkasan laporan hari ini, minggu ini, bulan ini
• \`/hariini\` — Rekap transaksi hari ini
• \`/mingguini\` — Rekap transaksi 7 hari terakhir
• \`/bulanini\` — Rekap transaksi bulan berjalan
• \`/budget\` — Status penggunaan budget tiap kategori
• \`/sheet\` — Link dashboard laporan web
• \`/bantuan\` atau \`/help\` — Panduan perintah ini

✍️ *Cara Catat Transaksi Alami:*
Ketik langsung di chat tanpa awalan garis miring:
👉 \`beli kopi 25rb\` _(masuk ke dompet default)_
👉 \`makan siang 45000 di gopay\` _(masuk ke GoPay)_
👉 \`bensin 30rb pakai bca\` _(masuk ke BCA)_
👉 \`beli kopi 25rb di cash\` _(masuk ke Tunai)_
👉 \`gajian 8.5jt di mandiri\` _(pemasukan ke Mandiri/Bank)_
👉 \`bayar listrik 150rb via ovo\` _(kategori tagihan)_

📸 *Fitur Pro:*
Kirim foto struk belanja untuk dipindai otomatis oleh AI OCR, atau kirim voice note suara!`,
    parse_mode: 'Markdown',
  };
}
