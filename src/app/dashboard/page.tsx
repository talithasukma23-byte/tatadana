'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Plus,
  ArrowRight,
  Receipt,
  Sparkles,
  ChevronRight,
  Globe,
  ArrowLeftRight,
} from 'lucide-react';
import { db } from '@/lib/supabase/mock-db';
import { formatRupiah, formatWIB } from '@/lib/utils';
import { useActiveUser } from '@/lib/auth/client-session';
import { calculateDateRange, PeriodFilterType } from '@/lib/date-filters';

export default function DashboardOverviewPage() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [isClient, setIsClient] = useState(false);
  const { user } = useActiveUser();

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Multi-wallet data (stateful)
  const [wallets, setWallets] = useState(() => db.getWallets(user.id));
  const totalBalance = useMemo(() => wallets.reduce((s, w) => s + w.balance, 0), [wallets]);

  // Categories data (stateful)
  const [categories, setCategories] = useState(() => db.getCategories(user.id).filter((c) => c.type === 'expense'));

  // Transactions data (stateful)
  const [allTxs, setAllTxs] = useState(() => db.getTransactions(user.id));
  const recent10 = useMemo(() => allTxs.slice(0, 10), [allTxs]);

  // Sinkronisasi data saat user aktif berubah
  useEffect(() => {
    setWallets(db.getWallets(user.id));
    setCategories(db.getCategories(user.id).filter((c) => c.type === 'expense'));
    setAllTxs(db.getTransactions(user.id));
  }, [user.id]);

  // Real-time sync dengan transaksi & wallet live dari server (3s poll + focus listener)
  useEffect(() => {
    const fetchLiveData = () => {
      fetch(`/api/transactions?userId=${user.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.success) {
            if (Array.isArray(data.transactions)) {
              setAllTxs(data.transactions);
            }
            if (Array.isArray(data.wallets)) {
              setWallets(data.wallets);
            }
            if (Array.isArray(data.categories)) {
              setCategories(data.categories.filter((c: any) => c.type === 'expense'));
            }
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
  }, [user.id]);

  // Map period button to unified PeriodFilterType
  const periodFilterType: PeriodFilterType = useMemo(() => {
    switch (period) {
      case 'daily':
        return 'today';
      case 'weekly':
        return '7days';
      case 'yearly':
        return 'year';
      case 'monthly':
      default:
        return 'month';
    }
  }, [period]);

  const activeDateRange = useMemo(() => {
    return calculateDateRange(periodFilterType);
  }, [periodFilterType]);

  const periodLabel = useMemo(() => {
    switch (period) {
      case 'daily':
        return 'Hari';
      case 'weekly':
        return 'Minggu';
      case 'yearly':
        return 'Tahun';
      case 'monthly':
      default:
        return 'Bulan';
    }
  }, [period]);

  // Filter transactions within the active period
  const periodTxs = useMemo(() => {
    const startMs = activeDateRange.startDate.getTime();
    const endMs = activeDateRange.endDate.getTime();

    return allTxs.filter((t) => {
      if (t.status === 'pending' || t.status === 'rejected') return false;
      const txMs = new Date(t.transaction_date).getTime();
      return txMs >= startMs && txMs <= endMs;
    });
  }, [allTxs, activeDateRange]);

  const periodIncomeTxs = useMemo(() => periodTxs.filter((t) => t.type === 'income'), [periodTxs]);
  const periodExpenseTxs = useMemo(() => periodTxs.filter((t) => t.type === 'expense'), [periodTxs]);

  const periodIncome = useMemo(() => {
    return periodIncomeTxs.reduce((s, t) => s + t.amount, 0);
  }, [periodIncomeTxs]);

  const periodExpense = useMemo(() => {
    return periodExpenseTxs.reduce((s, t) => s + t.amount, 0);
  }, [periodExpenseTxs]);

  // Budget calculations adjusted by period
  const totalBudgetLimit = useMemo(() => categories.reduce((s, c) => s + (c.monthly_budget || 0), 0), [categories]);

  const periodMultiplier = useMemo(() => {
    if (period === 'daily') return 1 / 30;
    if (period === 'weekly') return 7 / 30;
    if (period === 'yearly') return 12;
    return 1;
  }, [period]);

  const periodBudgetLimit = useMemo(() => Math.round(totalBudgetLimit * periodMultiplier), [totalBudgetLimit, periodMultiplier]);
  const remainingBudget = useMemo(() => Math.max(0, periodBudgetLimit - periodExpense), [periodBudgetLimit, periodExpense]);

  // Expense by category breakdown in active period
  const categoryStats = useMemo(() => {
    return categories.map((cat) => {
      const spent = periodExpenseTxs
        .filter((t) => t.category_id === cat.id)
        .reduce((s, t) => s + t.amount, 0);
      const pct = periodExpense > 0 ? Math.round((spent / periodExpense) * 100) : 0;
      return {
        ...cat,
        spent,
        pct,
      };
    }).sort((a, b) => b.spent - a.spent);
  }, [categories, periodExpenseTxs, periodExpense]);

  // 6 Month comparison with live current month
  const monthlyComparison = useMemo(() => [
    { month: 'Mei', income: 7200000, expense: 5800000 },
    { month: 'Jun', income: 8000000, expense: 6200000 },
    { month: 'Jul', income: 7500000, expense: 6900000 },
    { month: 'Agu', income: 8200000, expense: 5400000 },
    { month: 'Sep', income: 8000000, expense: 6100000 },
    { month: 'Okt', income: periodIncome, expense: periodExpense },
  ], [periodIncome, periodExpense]);

  // Daily expense trend (sample days in October)
  const dailyTrend = [
    { day: '01', amount: 0 },
    { day: '02', amount: 45000 },
    { day: '03', amount: 32000 },
    { day: '04', amount: 0 },
    { day: '05', amount: 350000 },
    { day: '06', amount: 0 },
    { day: '07', amount: 285000 },
    { day: '08', amount: 38000 },
    { day: '09', amount: 0 },
    { day: '10', amount: 0 },
  ];
  const maxDaily = Math.max(...dailyTrend.map((d) => d.amount), 1);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Top Welcome & Period Filter (Matches Screenshot 1) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Selamat Datang, {user.full_name.split(' ')[0]}! 👋
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Berikut ringkasan arus kas dan kesehatan keuanganmu {periodLabel.toLowerCase()} ini (WIB).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Filter Pills (Hari, Minggu, Bulan, Tahun) */}
          <div className="flex items-center gap-1 bg-zinc-200/60 dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((p) => {
              const labels = { daily: 'Hari', weekly: 'Minggu', monthly: 'Bulan', yearly: 'Tahun' };
              const active = period === p;
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    active
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}
          </div>

          {/* Quick Action buttons (Screenshot 1) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href="/"
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-rose-500 text-xs font-semibold transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              Fitur Landing Page
            </Link>

            <Link
              href="/dashboard/wallet"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-rose-500 text-xs font-semibold transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Transfer
            </Link>

            <Link
              href="/dashboard/wallet"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-rose-500 text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Dompet
            </Link>

            <Link
              href="/dashboard/transaksi"
              className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Catat Manual
            </Link>
          </div>
        </div>
      </div>

      {/* Onboarding Checklist Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-emerald-500" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Langkah Awal TataDana</h2>
          </div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">2 dari 3 Selesai</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 hover:border-emerald-500/40 transition-colors"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 truncate">1. Hubungkan Telegram</p>
              <p className="text-[11px] text-zinc-400" suppressHydrationWarning>
                {isClient
                  ? (user.telegram_username ? `Terhubung @${user.telegram_username}` : 'Belum Terhubung')
                  : (user.telegram_username ? `Terhubung @${user.telegram_username}` : 'Belum Terhubung')}
              </p>
            </div>
          </Link>

          <Link
            href="/dashboard/wallet"
            className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 hover:border-emerald-500/40 transition-colors"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 truncate">2. Atur Dompet Utama</p>
              <p className="text-[11px] text-zinc-400">Default: Tunai (Cash)</p>
            </div>
          </Link>

          <Link
            href="/dashboard/budget"
            className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 hover:border-teal-500/40 transition-colors group"
          >
            <Circle className="w-5 h-5 text-teal-500 shrink-0 group-hover:scale-110 transition-transform" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 truncate">3. Atur Batas Budget</p>
              <p className="text-[11px] text-zinc-400">Klik untuk atur</p>
            </div>
          </Link>
        </div>
      </div>

      {/* 4 Stats Cards (Matches Screenshot 1 with reactive period) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Card 1: Saldo Total */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#111216] border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Saldo Total
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
              {formatRupiah(totalBalance)}
            </h3>
            <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
              Dari {wallets.length} dompet aktif
            </p>
          </div>
        </div>

        {/* Card 2: Pemasukan Periode Ini */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#111216] border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Pemasukan {periodLabel} Ini
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
              +{formatRupiah(periodIncome)}
            </h3>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1 flex items-center gap-1 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" /> Dari {periodIncomeTxs.length} transaksi masuk
            </p>
          </div>
        </div>

        {/* Card 3: Pengeluaran Periode Ini */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#111216] border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Pengeluaran {periodLabel} Ini
            </span>
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400">
              -{formatRupiah(periodExpense)}
            </h3>
            <p suppressHydrationWarning className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
              <span>{periodExpenseTxs.length}</span> transaksi pengeluaran
            </p>
          </div>
        </div>

        {/* Card 4: Sisa Budget */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#111216] border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Budget Tersisa
            </span>
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-500">
              <PiggyBank className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
              {formatRupiah(remainingBudget)}
            </h3>
            <div className="mt-2 w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${periodBudgetLimit > 0 ? Math.min(100, (periodExpense / periodBudgetLimit) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Bar Chart 6 Bulan & Trend Line Harian */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bar Chart 6 Bulan Cashflow */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#111216] border border-zinc-200/80 dark:border-zinc-800/80">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">Komparasi Cashflow 6 Bulan Terakhir</h3>
                <p className="text-xs text-zinc-400">Perbandingan pemasukan vs pengeluaran</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Pemasukan
                </span>
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" /> Pengeluaran
                </span>
              </div>
            </div>

            {/* Custom Bar Visualization */}
            <div className="h-56 flex items-end justify-between gap-3 pt-6 border-b border-zinc-100 dark:border-zinc-800/60 pb-2">
              {monthlyComparison.map((m) => {
                const maxVal = 10000000;
                const inHeight = Math.min(100, (m.income / maxVal) * 100);
                const outHeight = Math.min(100, (m.expense / maxVal) * 100);
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="w-full flex items-end justify-center gap-1.5 h-44">
                      {/* Income Bar */}
                      <div
                        style={{ height: `${inHeight}%` }}
                        className="w-1/2 max-w-[18px] bg-emerald-500/80 rounded-t-lg transition-all group-hover:bg-emerald-500"
                        title={`Pemasukan: ${formatRupiah(m.income)}`}
                      />
                      {/* Expense Bar */}
                      <div
                        style={{ height: `${outHeight}%` }}
                        className="w-1/2 max-w-[18px] bg-teal-500/80 rounded-t-lg transition-all group-hover:bg-teal-500"
                        title={`Pengeluaran: ${formatRupiah(m.expense)}`}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{m.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Trend Line Bulan Ini */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#111216] border border-zinc-200/80 dark:border-zinc-800/80">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">Tren Pengeluaran Harian Bulan Ini</h3>
                <p className="text-xs text-zinc-400">Lonjakan pengeluaran per hari (WIB)</p>
              </div>
              <span className="text-xs font-semibold text-teal-500">Oktober 2026</span>
            </div>

            <div className="h-32 flex items-end justify-between gap-1 pt-4">
              {dailyTrend.map((d) => {
                const height = d.amount > 0 ? Math.max(12, Math.min(100, (d.amount / maxDaily) * 100)) : 4;
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
                    <div
                      style={{ height: `${height}%` }}
                      className={`w-full max-w-[16px] rounded-t-md transition-all ${
                        d.amount > 0 ? 'bg-teal-500 hover:bg-teal-400' : 'bg-zinc-200 dark:bg-zinc-800'
                      }`}
                      title={`Tgl ${d.day}: ${formatRupiah(d.amount)}`}
                    />
                    <span className="text-[10px] text-zinc-400">{d.day}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right (1 col): Kategori Pengeluaran */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#111216] border border-zinc-200/80 dark:border-zinc-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">Kategori Pengeluaran</h3>
              <Link href="/dashboard/budget" className="text-xs font-bold text-emerald-500 hover:underline">
                Atur Budget →
              </Link>
            </div>
            <p className="text-xs text-zinc-400 mb-6">Persentase pengeluaran {periodLabel.toLowerCase()} ini per kategori</p>

            <div className="space-y-4">
              {categoryStats.slice(0, 6).map((cat) => (
                <div key={cat.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <span>{cat.emoji}</span> {cat.name}
                    </span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                      {formatRupiah(cat.spent)} <span className="text-zinc-400 font-normal">({cat.pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        backgroundColor: cat.color || '#10B981',
                        width: `${cat.pct}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-zinc-100 dark:border-zinc-800/80">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Pencatatan Telegram</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Aktif & Sinkron real-time</p>
              </div>
              <Link
                href="/dashboard/settings"
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Cek Bot
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 10 Transaksi Terbaru */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#111216] border border-zinc-200/80 dark:border-zinc-800/80">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">10 Transaksi Terbaru</h3>
            <p className="text-xs text-zinc-400">Dicatat via Telegram Bot dan Web</p>
          </div>
          <Link
            href="/dashboard/laporan"
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            Lihat Semua Laporan <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {recent10.length === 0 ? (
          <div className="py-12 text-center">
            <Receipt className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-zinc-500">Belum ada transaksi</p>
            <p className="text-xs text-zinc-400 mt-1">Coba ketik "beli kopi 25rb" di bot Telegram kamu!</p>
          </div>
        ) : (
          <div suppressHydrationWarning className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {recent10.map((tx) => {
              const isIncome = tx.type === 'income';
              return (
                <div key={tx.id} className="py-3.5 flex items-center justify-between gap-4 group">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        isIncome ? 'bg-emerald-500/10 text-emerald-500' : 'bg-teal-500/10 text-teal-500'
                      }`}
                    >
                      {isIncome ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {tx.notes || tx.category?.name || 'Transaksi'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                        <span>{tx.category ? `${tx.category.emoji} ${tx.category.name}` : '-'}</span>
                        <span>•</span>
                        <span>{tx.wallet?.name}</span>
                        <span>•</span>
                        <span>{formatWIB(tx.transaction_date, { weekday: undefined, year: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-sm font-bold ${
                        isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-white'
                      }`}
                    >
                      {isIncome ? `+${formatRupiah(tx.amount)}` : `-${formatRupiah(tx.amount)}`}
                    </span>
                    <span className="block text-[10px] capitalize">
                      {tx.status === 'pending' ? (
                        <span className="text-amber-500 font-bold">⏳ Menunggu Persetujuan</span>
                      ) : tx.status === 'rejected' ? (
                        <span className="text-rose-500 font-bold">✕ Ditolak</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Berhasil <span className="text-zinc-400 font-normal">({tx.source.replace('_', ' ')})</span>
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
