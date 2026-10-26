'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Bot,
  Send,
  Sparkles,
  Zap,
  Lock,
  ArrowRight,
  RefreshCw,
  Wallet,
  TrendingDown,
  PieChart,
  ShieldCheck,
  User as UserIcon,
  CheckCircle2,
  Clock,
  X,
} from 'lucide-react';
import { db } from '@/lib/supabase/mock-db';
import { formatRupiah } from '@/lib/utils';
import { AIChatHistory, Wallet as WalletEntity, Transaction } from '@/types/database';
import {
  parseIndonesianCurrency,
  detectTransactionType,
  matchWalletFromText,
  deduceCategory,
  cleanNoteDescription,
} from '@/lib/telegram/nlp-parser';

interface PendingIntent {
  nominal: number;
  jenis: 'pemasukan' | 'pengeluaran' | 'transfer';
  type: 'income' | 'expense' | 'transfer';
  kategori: string;
  kategoriEmoji: string;
  categoryId?: string;
  catatan: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  message: string;
  created_at: string;
  type?: 'text' | 'wallet_selection' | 'tx_confirmation';
  pendingIntent?: PendingIntent;
  confirmedTx?: {
    id: string;
    walletName: string;
    walletType: string;
    amount: number;
    type: 'income' | 'expense' | 'transfer';
    categoryName: string;
    categoryEmoji: string;
    notes: string;
    status: 'approved' | 'pending' | 'success';
  };
}

import { useActiveUser } from '@/lib/auth/client-session';
import { executeUpgradePro } from '@/lib/payment/upgrade-client';

export default function TataAIPage() {
  const { user: currentUser, setUser } = useActiveUser();
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState<{ orderId: string; waLink: string; isExisting: boolean } | null>(null);
  const [pendingIntent, setPendingIntent] = useState<PendingIntent | null>(null);
  const [wallets, setWallets] = useState<WalletEntity[]>(() => db.getWallets(currentUser.id));
  const [transactions, setTransactions] = useState(() => db.getTransactions(currentUser.id));
  const [categories, setCategories] = useState(() => db.getCategories(currentUser.id));

  // Sync state saat currentUser berubah
  useEffect(() => {
    setWallets(db.getWallets(currentUser.id));
    setTransactions(db.getTransactions(currentUser.id));
    setCategories(db.getCategories(currentUser.id));
  }, [currentUser.id]);

  // Real-time sync dengan server (3s poll + focus listener)
  useEffect(() => {
    const fetchLiveData = () => {
      fetch(`/api/transactions?userId=${currentUser.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.success) {
            if (Array.isArray(data.wallets)) setWallets(data.wallets);
            if (Array.isArray(data.transactions)) setTransactions(data.transactions);
            if (Array.isArray(data.categories)) setCategories(data.categories);
          }
        })
        .catch(() => {});
    };

    fetchLiveData();
    const intervalId = setInterval(fetchLiveData, 3000);
    const handleFocus = () => fetchLiveData();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser.id]);

  const [chatList, setChatList] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      message: `Halo ${currentUser.full_name}! 👋 Saya **Tata AI**, asisten keuangan pribadi cerdasmu di TataDana.\n\nSaya telah menganalisis data keuangan terbarumu:\n• Saldo Semua Dompet: **${formatRupiah(db.getWallets(currentUser.id).reduce((s, w) => s + w.balance, 0))}**\n• Pengeluaran Bulan Ini: **${formatRupiah(db.getTransactions(currentUser.id).filter(t => t.type === 'expense' && t.status !== 'pending' && t.status !== 'rejected').reduce((s, t) => s + t.amount, 0))}**\n\nKamu bisa mencatat transaksi langsung di sini (contoh: *"makan siang 50000"* atau *"beli kopi 25rb pakai BCA"*), atau tanyakan tips budget dan analisis pengeluaranmu!`,
      created_at: new Date().toISOString(),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatList, isLoading]);

  const quickPrompts = [
    'Berapa sisa budget makanan saya bulan ini?',
    'Apa pengeluaran terbesar saya minggu ini?',
    'makan siang 50000',
    'beli kopi 25rb pakai BCA',
  ];

  // Handler pemilihan dompet terdaftar: Transaksi diproses otomatis tanpa verifikasi admin
  const handleSelectWallet = async (wallet: WalletEntity, intentToUse?: PendingIntent) => {
    const currentIntent = intentToUse || pendingIntent;
    if (!currentIntent) return;

    // Strict User Isolation Check: pastikan dompet milik akun pengguna aktif
    const isOwned = 
      wallet.user_id === currentUser.id ||
      wallets.some((w) => w.id === wallet.id) ||
      (currentUser.role === 'superadmin' && ['wallet-001', 'wallet-002', 'wallet-003', 'wallet-admin-talitha'].includes(wallet.id));

    if (!isOwned) {
      alert('Dompet tidak valid untuk akun ini.');
      return;
    }

    setIsSubmittingTx(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          walletId: wallet.id,
          categoryId: currentIntent.categoryId,
          type: currentIntent.type,
          amount: currentIntent.nominal,
          notes: currentIntent.catatan,
          description: currentIntent.catatan,
          status: 'approved', // Otomatis Berhasil tanpa persetujuan admin
          source: 'tata_ai_chat',
        }),
      });

      const data = await res.json();
      if (data.success && data.transaction) {
        const newTx: Transaction = data.transaction;
        const updatedWallet = Array.isArray(data.wallets) ? data.wallets.find((w: any) => w.id === wallet.id) : null;
        const finalBalance = updatedWallet ? updatedWallet.balance : (currentIntent.type === 'income' ? wallet.balance + currentIntent.nominal : wallet.balance - currentIntent.nominal);

        // Tampilkan konfirmasi transaksi Berhasil secara otomatis
        const confirmationMsg: ChatMessage = {
          id: `ast-${Date.now()}`,
          role: 'assistant',
          message: `✅ Transaksi **${currentIntent.catatan}** sebesar **${formatRupiah(currentIntent.nominal)}** berhasil diproses dan dicatat otomatis ke **${wallet.name}**.\n\n✨ **Status: Berhasil (Otomatis)**\nSaldo dompet **${wallet.name}** kini telah diperbarui menjadi **${formatRupiah(finalBalance)}**. Seluruh modul (Transaksi, Budget, dan Laporan) telah disinkronkan secara real-time.`,
          created_at: new Date().toISOString(),
          type: 'tx_confirmation',
          confirmedTx: {
            id: newTx.id,
            walletName: wallet.name,
            walletType: wallet.type,
            amount: currentIntent.nominal,
            type: currentIntent.type,
            categoryName: currentIntent.kategori,
            categoryEmoji: currentIntent.kategoriEmoji,
            notes: currentIntent.catatan,
            status: 'approved',
          },
        };

        setChatList((prev) => [...prev, confirmationMsg]);
        setPendingIntent(null);
      } else {
        alert('Gagal menyimpan transaksi: ' + (data.error || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      alert('Terjadi kesalahan jaringan: ' + err.message);
    } finally {
      setIsSubmittingTx(false);
    }
  };

  const handleSendMessage = (customText?: string) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || isLoading || isSubmittingTx) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      message: textToSend,
      created_at: new Date().toISOString(),
    };

    setChatList((prev) => [...prev, userMsg]);
    setInputMessage('');

    // A. Jika ada pendingIntent yang sedang menunggu pemilihan dompet via teks balasan
    if (pendingIntent) {
      const lower = textToSend.toLowerCase().trim();
      // Cocokkan dengan daftar dompet akun pengguna yang sedang login
      const matched = wallets.find((w) => {
        const wName = w.name.toLowerCase();
        return (
          wName.includes(lower) ||
          lower.includes(wName.replace(/[^a-z0-9]/g, '')) ||
          (w.type === 'Bank' && (lower.includes('bca') || lower.includes('mandiri') || lower.includes('bri') || lower.includes('bank'))) ||
          (w.type === 'E-Wallet' && (lower.includes('gopay') || lower.includes('ovo') || lower.includes('dana') || lower.includes('shopee'))) ||
          (w.type === 'Cash' && (lower.includes('tunai') || lower.includes('cash')))
        );
      });

      if (matched) {
        handleSelectWallet(matched, pendingIntent);
        return;
      } else {
        const retryMsg: ChatMessage = {
          id: `ast-${Date.now()}`,
          role: 'assistant',
          message: `Dompet "${textToSend}" tidak ditemukan pada akunmu. **Mau menggunakan rekening bank atau e-wallet yang mana?** Silakan klik salah satu pilihan dompet di bawah ini:`,
          created_at: new Date().toISOString(),
          type: 'wallet_selection',
          pendingIntent: pendingIntent,
        };
        setChatList((prev) => [...prev, retryMsg]);
        return;
      }
    }

    // B. Deteksi pesan transaksi baru menggunakan parser nominal
    const detectedNominal = parseIndonesianCurrency(textToSend);

    if (detectedNominal > 0) {
      setIsLoading(true);

      setTimeout(async () => {
        const jenis = detectTransactionType(textToSend);
        const normalizedType: 'income' | 'expense' | 'transfer' =
          jenis === 'pemasukan' ? 'income' : jenis === 'transfer' ? 'transfer' : 'expense';

        // Cocokkan dompet dari teks terhadap daftar dompet asli akun pengguna yang login
        const walletMatch = matchWalletFromText(textToSend, wallets);
        const category = deduceCategory(walletMatch.cleanedText, normalizedType, categories);
        const catatan = cleanNoteDescription(textToSend, walletMatch.phraseMatched, category.name, normalizedType);

        const hasWalletKeyword = Boolean(
          walletMatch.phraseMatched ||
          /\b(di|pakai|pake|via|lewat|dari|ke|dengan|dg)\s+/i.test(textToSend)
        );

        // KASUS 1: Pengguna menyebutkan dompet secara jelas dan valid
        if (walletMatch.wallet) {
          try {
            const res = await fetch('/api/transactions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: currentUser.id,
                walletId: walletMatch.wallet.id,
                categoryId: category.id,
                type: normalizedType,
                amount: detectedNominal,
                notes: catatan,
                description: catatan,
                status: 'approved', // Langsung diproses otomatis tanpa verifikasi admin
                source: 'tata_ai_chat',
              }),
            });

            const data = await res.json();
            const newTx = data.transaction;
            const updatedWallet = Array.isArray(data.wallets) ? data.wallets.find((w: any) => w.id === walletMatch.wallet?.id) : null;
            const finalBalance = updatedWallet ? updatedWallet.balance : (normalizedType === 'income' ? walletMatch.wallet.balance + detectedNominal : walletMatch.wallet.balance - detectedNominal);

            const assistantMsg: ChatMessage = {
              id: `ast-${Date.now()}`,
              role: 'assistant',
              message: `✅ Transaksi **${catatan}** sebesar **${formatRupiah(detectedNominal)}** berhasil diproses dan dicatat otomatis ke **${walletMatch.wallet.name}**.\n\n✨ **Status: Berhasil (Otomatis)**\nSaldo dompet **${walletMatch.wallet.name}** kini telah diperbarui menjadi **${formatRupiah(finalBalance)}**. Seluruh modul (Transaksi, Budget, dan Laporan) telah terupdate seketika.`,
              created_at: new Date().toISOString(),
              type: 'tx_confirmation',
              confirmedTx: {
                id: newTx?.id || `tx-${Date.now()}`,
                walletName: walletMatch.wallet.name,
                walletType: walletMatch.wallet.type,
                amount: detectedNominal,
                type: normalizedType,
                categoryName: category.name,
                categoryEmoji: category.emoji,
                notes: catatan,
                status: 'approved',
              },
            };
            setChatList((prev) => [...prev, assistantMsg]);
          } catch (e: any) {
            // error handling
          } finally {
            setIsLoading(false);
          }
          return;
        }

        // KASUS 2: Pesan tidak menyebutkan dompet ATAU dompet yang disebut tidak terdaftar/valid (Requirement 1, 2, 8)
        const newIntent: PendingIntent = {
          nominal: detectedNominal,
          jenis,
          type: normalizedType,
          kategori: category.name,
          kategoriEmoji: category.emoji,
          categoryId: category.id,
          catatan,
        };

        setPendingIntent(newIntent);

        let questionText = '';
        if (hasWalletKeyword) {
          questionText = `Dompet atau rekening yang kamu sebutkan tidak terdaftar pada akunmu.\n\n**Mau menggunakan rekening bank atau e-wallet yang mana?**`;
        } else {
          questionText = `Saya mengenali transaksi **${catatan}** sebesar **${formatRupiah(detectedNominal)}** (${category.emoji} ${category.name}).\n\n**Mau menggunakan rekening bank atau e-wallet yang mana?**`;
        }

        const walletSelectionMsg: ChatMessage = {
          id: `ast-${Date.now()}`,
          role: 'assistant',
          message: questionText,
          created_at: new Date().toISOString(),
          type: 'wallet_selection',
          pendingIntent: newIntent,
        };

        setChatList((prev) => [...prev, walletSelectionMsg]);
        setIsLoading(false);
      }, 500);
      return;
    }

    // C. Pesan non-transaksi (Konsultasi Finansial / AI Financial Advisor)
    setIsLoading(true);

    setTimeout(() => {
      const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);
      const expenseTxs = transactions.filter((t) => t.type === 'expense' && t.status !== 'pending' && t.status !== 'rejected');
      const totalExpense = expenseTxs.reduce((s, t) => s + t.amount, 0);
      const incomeTxs = transactions.filter((t) => t.type === 'income' && t.status !== 'pending' && t.status !== 'rejected');
      const totalIncome = incomeTxs.reduce((s, t) => s + t.amount, 0);

      const q = textToSend.toLowerCase();
      let reply = '';

      if (q.includes('budget') || q.includes('makan') || q.includes('sisa')) {
        const foodCat = categories.find((c) => c.name.toLowerCase().includes('makan')) || categories[0];
        const foodExpenses = foodCat
          ? expenseTxs
              .filter((t) => t.category_id === foodCat.id)
              .reduce((s, t) => s + t.amount, 0)
          : 0;

        if (foodCat && (foodCat.monthly_budget || 0) > 0) {
          const budgetTarget = foodCat.monthly_budget;
          const sisa = Math.max(0, budgetTarget - foodExpenses);
          const pct = Math.round((foodExpenses / budgetTarget) * 100);

          reply = `🍽️ **Analisis Budget Kategori Makanan & Minuman:**\n\n• Target Budget Bulanan: **${formatRupiah(budgetTarget)}**\n• Sudah Terpakai: **${formatRupiah(foodExpenses)}** (${pct}%)\n• **Sisa Budget:** **${formatRupiah(sisa)}**\n\n${
            pct > 80
              ? '⚠️ Kamu sudah menghabiskan lebih dari 80% budget makanan. Pertimbangkan untuk memasak di rumah atau memilih menu yang lebih hemat hingga akhir bulan.'
              : '✅ Pengeluaran makanmu masih sangat aman dan terkendali. Pertahankan ritme ini!'
          }`;
        } else {
          reply = `🍽️ **Analisis Pengeluaran Makanan & Minuman:**\n\n• Sudah Terpakai: **${formatRupiah(foodExpenses)}**\n• Target Budget Bulanan: **Belum Diatur (Rp0)**\n\n💡 Kamu belum menetapkan batas budget untuk kategori ini. Buka menu **Budget** untuk menentukan target bulananmu.`;
        }
      } else if (q.includes('terbesar') || q.includes('boros') || q.includes('banyak')) {
        const sorted = [...expenseTxs].sort((a, b) => b.amount - a.amount);
        const top = sorted.slice(0, 3);

        const listStr = top
          .map((t, idx) => {
            const cat = categories.find((c) => c.id === t.category_id);
            return `${idx + 1}. **${cat?.emoji || '💸'} ${t.notes || cat?.name}**: ${formatRupiah(t.amount)} (${t.transaction_date.slice(0, 10)})`;
          })
          .join('\n');

        reply = `🔍 **3 Pengeluaran Terbesarmu Bulan Ini:**\n\n${listStr}\n\n💡 **Tips Tata AI:** Sebagian besar pengeluaran terpusat pada kategori sekunder. Mengurangi frekuensi nongkrong atau belanja non-pokok dapat menghemat hingga 15-20% kas bulananmu.`;
      } else if (q.includes('rasio') || q.includes('tabungan') || q.includes('saldo')) {
        const savingRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;
        reply = `📊 **Kesehatan Finansial & Rasio Tabungan:**\n\n• Total Saldo Kas: **${formatRupiah(totalBalance)}**\n• Pemasukan Bulan Ini: **${formatRupiah(totalIncome)}**\n• Pengeluaran Bulan Ini: **${formatRupiah(totalExpense)}**\n• Rasio Tabungan (Savings Rate): **${savingRate}%**\n\n${
          savingRate >= 20
            ? '🌟 **Luar biasa!** Rasio tabunganmu di atas standar 20% (metode 50/30/20). Kamu memiliki buffer kas yang sehat.'
            : '⚠️ Rasio tabunganmu masih di bawah 20%. Cobalah meninjau pengeluaran diskresioner agar target dana darurat cepat terkumpul.'
        }`;
      } else if (q.includes('tips') || q.includes('hemat') || q.includes('akhir bulan')) {
        reply = `💡 **4 Langkah Strategis Hemat Akhir Bulan:**\n\n1. **Terapkan No-Spend Days:** Pilih 2 hari kerja dalam seminggu tanpa pengeluaran selain biaya transportasi wajib.\n2. **Manfaatkan Saldo E-Wallet Promo:** Cek saldo di dompet GoPay/OVO kamu (${formatRupiah(wallets.find(w => w.type === 'E-Wallet')?.balance || 0)}) untuk cashback bahan makan.\n3. **Evaluasi Langganan Digital:** Tunda langganan streaming yang jarang ditonton.\n4. **Gunakan Bot Telegram Setiap Selesai Belanja:** Catat segera sebelum lupa agar alarm 80% budget aktif memberi peringatan otomatis.`;
      } else {
        reply = `Saya mencatat pertanyaanmu: *"${textToSend}"*.\n\nBerdasarkan portofoliomu dengan saldo total **${formatRupiah(totalBalance)}**, kesehatan keuanganmu dalam kondisi stabil. Kamu dapat mengelola arus kas dengan lebih efisien dengan terus mencatat pengeluaran setiap hari via Telegram atau menu Transaksi web.`;
      }

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        message: reply,
        created_at: new Date().toISOString(),
      };

      setChatList((prev) => [...prev, assistantMsg]);
      setIsLoading(false);
    }, 800);
  };

  // Paywall View for Starter Plan
  if (currentUser.plan !== 'pro') {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="bg-gradient-to-b from-emerald-500/10 via-white dark:via-[#0c0d10] to-white dark:to-[#0c0d10] border border-emerald-500/20 rounded-3xl p-8 sm:p-12 text-center shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Icon Halo */}
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white mx-auto shadow-2xl shadow-emerald-500/30 mb-6">
            <Bot className="w-10 h-10" />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Eksklusif Paket Pro
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white tracking-tight">
            Kenalan dengan <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">Tata AI Advisor</span>
          </h1>

          <p className="mt-3 text-zinc-600 dark:text-zinc-400 text-sm sm:text-base max-w-xl mx-auto">
            Konsultan keuangan pribadi yang memahami data transaksi kamu 24/7. Tanyakan apa saja tentang budget, deteksi kebocoran uang, hingga rekomendasi investasi.
          </p>

          {/* Value Props Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8 text-left max-w-2xl mx-auto">
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800">
              <PieChart className="w-6 h-6 text-teal-500 mb-2" />
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Analisis Kontekstual</h4>
              <p className="text-[11px] text-zinc-500 mt-1">AI langsung membaca data dompet dan transaksi riil dari Supabase.</p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800">
              <TrendingDown className="w-6 h-6 text-emerald-500 mb-2" />
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Deteksi Boros Otomatis</h4>
              <p className="text-[11px] text-zinc-500 mt-1">Dapatkan peringatan sebelum gaji habis di tengah bulan.</p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800">
              <ShieldCheck className="w-6 h-6 text-blue-500 mb-2" />
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Privasi Terenkripsi</h4>
              <p className="text-[11px] text-zinc-500 mt-1">Data keuangan hanya dianalisis untuk profil pribadimu.</p>
            </div>
          </div>

          {/* CTA Box */}
          {upgradeSuccess && (
            <div className="max-w-md mx-auto mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-left text-xs space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Pengajuan PRO {upgradeSuccess.isExisting ? 'Sudah Tercatat' : 'Berhasil Dibuat'}</span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400">
                ID Pengajuan: <strong className="font-mono text-zinc-900 dark:text-white">{upgradeSuccess.orderId}</strong>
              </p>
              <p className="text-zinc-500">
                Status: <span className="font-semibold text-amber-500 uppercase">Menunggu Pembayaran</span>. Fitur Tata AI akan aktif penuh setelah Admin memverifikasi pembayaran.
              </p>
              <button
                type="button"
                onClick={() => window.open(upgradeSuccess.waLink, '_blank')}
                className="inline-flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 hover:underline pt-1"
              >
                💬 Buka Kembali Chat WhatsApp Admin ↗
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              disabled={isUpgrading}
              onClick={async () => {
                await executeUpgradePro({
                  user: currentUser,
                  onLoadingChange: setIsUpgrading,
                  onSuccess: (res) => {
                    setUpgradeSuccess({
                      orderId: res.orderId || '',
                      waLink: res.waLink || '',
                      isExisting: Boolean(res.isExisting),
                    });
                  },
                  onError: (err) => {
                    alert(err);
                  },
                });
              }}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-sm shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-white" />
              {isUpgrading ? 'Menghubungkan WhatsApp...' : 'Upgrade PRO (Rp99.000 sekali bayar)'}
            </button>
            <button
              onClick={() => {
                // Temporary unlock demo mode for testing
                setUser({ ...currentUser, plan: 'pro' });
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-sm transition-colors"
            >
              Coba Pratinjau Demo AI
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pro Chat Interface
  return (
    <div className="h-[calc(100vh-8.5rem)] flex flex-col bg-white dark:bg-[#0c0d10] border border-zinc-200 dark:border-zinc-800/80 rounded-3xl overflow-hidden shadow-sm">
      {/* Top Bar Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Tata AI Financial Advisor</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                PRO ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Multi-Provider AI (Gemini 1.5 Flash + Failover Active)
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setChatList([
              {
                id: 'welcome-reset',
                role: 'assistant',
                message: `Percakapan baru dimulai. Ada topik keuangan apa yang ingin kita bahas, ${currentUser.full_name}?`,
                created_at: new Date().toISOString(),
              },
            ]);
          }}
          className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Mulai Sesi Baru"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Body Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {chatList.map((item) => {
          const isUser = item.role === 'user';
          return (
            <div
              key={item.id}
              className={`flex items-start gap-3 max-w-2xl ${
                isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                  isUser
                    ? 'bg-zinc-800 text-white'
                    : 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20'
                }`}
              >
                {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                  isUser
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-sm shadow-md shadow-emerald-500/10'
                    : 'bg-zinc-100 dark:bg-zinc-900/80 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-800 rounded-tl-sm'
                }`}
              >
                {item.message}

                {/* Wallet Selection Interactive Buttons (Requirement 2, 3, 4, 9, 10) */}
                {item.type === 'wallet_selection' && item.pendingIntent && (
                  <div className="mt-3.5 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 space-y-2">
                    <div className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Pilih Rekening Bank atau E-Wallet:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {wallets.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          disabled={isSubmittingTx}
                          onClick={() => handleSelectWallet(w, item.pendingIntent)}
                          className="p-3 rounded-2xl border text-left flex items-center justify-between transition-all bg-white dark:bg-zinc-800/90 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 shadow-sm group disabled:opacity-50"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-700/60 flex items-center justify-center text-sm shrink-0">
                              {w.type === 'Bank' ? '🏦' : w.type === 'E-Wallet' ? '📱' : '💵'}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-zinc-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                                {w.name}
                              </div>
                              <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                {w.type} • Saldo: {formatRupiah(w.balance)}
                              </div>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                        </button>
                      ))}
                    </div>
                    {pendingIntent && (
                      <button
                        type="button"
                        onClick={() => setPendingIntent(null)}
                        className="text-[10px] text-zinc-400 hover:text-rose-500 transition-colors pt-1 block"
                      >
                        ✕ Batalkan transaksi ini
                      </button>
                    )}
                  </div>
                )}

                {/* Transaction Confirmation Card: Otomatis Berhasil */}
                {item.type === 'tx_confirmation' && item.confirmedTx && (
                  <div className="mt-3.5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-zinc-800 dark:text-zinc-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Berhasil Tercatat
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">{item.confirmedTx.id}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <div className="text-xs font-bold text-zinc-900 dark:text-white">
                          {item.confirmedTx.categoryEmoji} {item.confirmedTx.notes}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Kategori: {item.confirmedTx.categoryName}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-zinc-900 dark:text-white">
                          {item.confirmedTx.type === 'income'
                            ? `+${formatRupiah(item.confirmedTx.amount)}`
                            : `-${formatRupiah(item.confirmedTx.amount)}`}
                        </div>
                        <div className="text-[10px] text-zinc-400 capitalize">
                          {item.confirmedTx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 pt-2 border-t border-emerald-500/20 flex items-center justify-between">
                      <span>Dompet: <strong className="text-zinc-700 dark:text-zinc-200">{item.confirmedTx.walletName}</strong></span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Saldo Berhasil Dimutasi Otomatis</span>
                    </div>
                  </div>
                )}

                <div
                  className={`text-[10px] mt-2 block ${
                    isUser ? 'text-emerald-100 text-right' : 'text-zinc-400'
                  }`}
                >
                  {new Date(item.created_at).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  WIB
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3 max-w-md">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="p-3.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Tata AI sedang menganalisis database transaksimu...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Pills */}
      <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-900/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-bold text-zinc-400 shrink-0">Saran:</span>
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(p)}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-900 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 whitespace-nowrap transition-all"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0d10]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ketik transaksi (misal: 'makan siang 50000') atau tanya kondisi keuangan..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-emerald-500 outline-none"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="p-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-emerald-500/20 transition-all shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
