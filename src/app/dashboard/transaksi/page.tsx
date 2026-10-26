'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Calendar as CalendarIcon,
  Wallet as WalletIcon,
  Tag,
  Check,
  AlertCircle,
  Trash2,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Eye,
  RotateCcw,
  Clock,
  Sparkles,
} from 'lucide-react';
import { db } from '@/lib/supabase/mock-db';
import { formatRupiah, formatWIB } from '@/lib/utils';
import { Transaction, TransactionType, Wallet, Category } from '@/types/database';
import { useActiveUser } from '@/lib/auth/client-session';
import {
  PeriodFilterType,
  calculateDateRange,
  filterTransactionsList,
  formatIndoDate,
  formatMonthYear,
  toDateInputValue,
} from '@/lib/date-filters';

export default function TransaksiDanKalenderPage() {
  const { user } = useActiveUser();

  // Active view tab: 'list' (Tabel & Daftar) vs 'calendar' (Kalender Keuangan Interaktif)
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');

  // Master Data
  const [wallets, setWallets] = useState<Wallet[]>(() => db.getWallets(user.id));
  const [categories, setCategories] = useState<Category[]>(() => db.getCategories(user.id));
  const [transactions, setTransactions] = useState<Transaction[]>(() => db.getTransactions(user.id));

  // Filters State
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedWallet, setSelectedWallet] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodFilterType>('month');
  const [customStart, setCustomStart] = useState<string>('2026-10-01');
  const [customEnd, setCustomEnd] = useState<string>('2026-10-31');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Calendar Navigation State
  const [calendarYear, setCalendarYear] = useState(2026);
  const [calendarMonth, setCalendarMonth] = useState(10); // 1-12 (Oktober)

  // Transaction Detail Modal State
  const [selectedTxDetail, setSelectedTxDetail] = useState<Transaction | null>(null);

  // Create Transaction Form State
  const [modalOpen, setModalOpen] = useState(false);
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [nominalStr, setNominalStr] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState(wallets[0]?.id || 'wallet-001');
  const [transferTargetWalletId, setTransferTargetWalletId] = useState(wallets[1]?.id || 'wallet-002');
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id || '');
  const [txDateStr, setTxDateStr] = useState(toDateInputValue(new Date()));
  const [notes, setNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sinkronisasi data saat user aktif berubah
  useEffect(() => {
    const updatedWallets = db.getWallets(user.id);
    const updatedCats = db.getCategories(user.id);
    setWallets(updatedWallets);
    setCategories(updatedCats);
    setTransactions(db.getTransactions(user.id));
    if (updatedWallets[0]) setSelectedWalletId(updatedWallets[0].id);
    if (updatedCats[0]) setSelectedCategoryId(updatedCats[0].id);
  }, [user.id]);

  // Real-time sync dengan transaksi & wallet live dari server (3s poll + focus listener)
  useEffect(() => {
    const fetchLiveData = () => {
      fetch(`/api/transactions?userId=${user.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.success) {
            if (Array.isArray(data.transactions)) {
              setTransactions(data.transactions);
            }
            if (Array.isArray(data.wallets)) {
              setWallets(data.wallets);
            }
            if (Array.isArray(data.categories)) {
              setCategories(data.categories);
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

  // Computed Filtered Transactions
  const { filtered: filteredTransactions, range: activeRange } = useMemo(() => {
    return filterTransactionsList(transactions, {
      search,
      type: selectedType,
      walletId: selectedWallet,
      categoryId: selectedCategory,
      period: selectedDate ? undefined : period,
      customStartDate: customStart,
      customEndDate: customEnd,
      selectedDate: selectedDate || undefined,
      year: activeTab === 'calendar' && !selectedDate ? calendarYear : undefined,
      month: activeTab === 'calendar' && !selectedDate ? calendarMonth : undefined,
    });
  }, [
    transactions,
    search,
    selectedType,
    selectedWallet,
    selectedCategory,
    period,
    customStart,
    customEnd,
    selectedDate,
    activeTab,
    calendarYear,
    calendarMonth,
  ]);

  // Summary Metrics of filtered data
  const summaryMetrics = useMemo(() => {
    let income = 0;
    let expense = 0;
    let transfer = 0;

    filteredTransactions.forEach((tx) => {
      if (tx.status === 'rejected') return;
      if (tx.type === 'income') income += tx.amount;
      else if (tx.type === 'expense') expense += tx.amount;
      else if (tx.type === 'transfer') transfer += tx.amount;
    });

    return {
      income,
      expense,
      transfer,
      net: income - expense,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  // Daily aggregate map for Calendar view
  const calendarDailyMap = useMemo(() => {
    const map: Record<string, { income: number; expense: number; count: number; items: Transaction[] }> = {};

    transactions.forEach((tx) => {
      // Respect wallet and type filters even in calendar view
      if (selectedWallet !== 'all' && tx.wallet_id !== selectedWallet && tx.transfer_to_wallet_id !== selectedWallet) {
        return;
      }
      if (selectedType !== 'all' && tx.type !== selectedType) {
        return;
      }
      if (selectedCategory !== 'all' && tx.category_id !== selectedCategory) {
        return;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const match =
          (tx.notes || '').toLowerCase().includes(q) ||
          (tx.description || '').toLowerCase().includes(q) ||
          (tx.category?.name || '').toLowerCase().includes(q) ||
          (tx.wallet?.name || '').toLowerCase().includes(q);
        if (!match) return;
      }

      const dateStr = tx.transaction_date.slice(0, 10);
      if (!map[dateStr]) {
        map[dateStr] = { income: 0, expense: 0, count: 0, items: [] };
      }
      map[dateStr].items.push(tx);
      map[dateStr].count += 1;
      if (tx.type === 'income') map[dateStr].income += tx.amount;
      else if (tx.type === 'expense') map[dateStr].expense += tx.amount;
    });

    return map;
  }, [transactions, selectedWallet, selectedType, selectedCategory, search]);

  // Calendar Days Matrix
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(calendarYear, calendarMonth - 1, 1);
    const lastDayOfMonth = new Date(calendarYear, calendarMonth, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    // In Indonesia / ISO: Monday is 0, Sunday is 6
    let startingDay = firstDayOfMonth.getDay() - 1;
    if (startingDay < 0) startingDay = 6;

    const days: Array<{
      dateNumber: number;
      dateStr: string;
      isCurrentMonth: boolean;
      income: number;
      expense: number;
      count: number;
    }> = [];

    // Empty padding slots before the 1st
    for (let i = 0; i < startingDay; i++) {
      days.push({
        dateNumber: 0,
        dateStr: '',
        isCurrentMonth: false,
        income: 0,
        expense: 0,
        count: 0,
      });
    }

    // Days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(calendarMonth).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const fullDateStr = `${calendarYear}-${monthStr}-${dayStr}`;
      const aggregate = calendarDailyMap[fullDateStr] || { income: 0, expense: 0, count: 0 };

      days.push({
        dateNumber: day,
        dateStr: fullDateStr,
        isCurrentMonth: true,
        income: aggregate.income,
        expense: aggregate.expense,
        count: aggregate.count,
      });
    }

    return days;
  }, [calendarYear, calendarMonth, calendarDailyMap]);

  // Handlers for Calendar Navigation
  const handlePrevMonth = () => {
    setSelectedDate(null);
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    setSelectedDate(null);
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const handleGoToOctober2026 = () => {
    setCalendarYear(2026);
    setCalendarMonth(10);
    setSelectedDate(null);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedType('all');
    setSelectedWallet('all');
    setSelectedCategory('all');
    setPeriod('month');
    setSelectedDate(null);
    setCalendarYear(2026);
    setCalendarMonth(10);
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const amount = parseFloat(nominalStr.replace(/[^0-9]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      setStatusMessage('❌ Nominal harus lebih dari 0.');
      return;
    }

    if (txType === 'transfer' && selectedWalletId === transferTargetWalletId) {
      setStatusMessage('❌ Dompet asal dan dompet tujuan transfer tidak boleh sama.');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalIsoDate = txDateStr ? `${txDateStr}T12:00:00+07:00` : new Date().toISOString();
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          walletId: selectedWalletId,
          categoryId: txType === 'transfer' ? undefined : selectedCategoryId,
          type: txType,
          amount,
          notes: notes || (txType === 'transfer' ? 'Transfer Antar Dompet' : 'Transaksi Manual Web'),
          description: notes || (txType === 'transfer' ? 'Transfer Antar Dompet' : 'Transaksi Manual Web'),
          transaction_date: finalIsoDate,
          source: 'web_manual',
          transfer_to_wallet_id: txType === 'transfer' ? transferTargetWalletId : undefined,
        }),
      });

      const data = await res.json();
      if (data && data.success) {
        if (Array.isArray(data.wallets)) setWallets(data.wallets);
        const getRes = await fetch(`/api/transactions?userId=${user.id}`);
        const getData = await getRes.json();
        if (getData && getData.success && Array.isArray(getData.transactions)) {
          setTransactions(getData.transactions);
        }
        setStatusMessage('✓ Transaksi berhasil dicatat dan saldo dompet diperbarui!');
        setModalOpen(false);
        setNominalStr('');
        setNotes('');
      } else {
        setStatusMessage('❌ Gagal: ' + (data?.error || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      setStatusMessage('❌ Gagal menyimpan transaksi: ' + (err.message || 'Error'));
    } finally {
      setIsSubmitting(false);
    }
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (!confirm('Apakah kamu yakin ingin menghapus transaksi ini? Saldo dompet akan disesuaikan kembali secara otomatis.')) return;
    try {
      const res = await fetch(`/api/transactions?id=${txId}&userId=${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.wallets)) setWallets(data.wallets);
        const getRes = await fetch(`/api/transactions?userId=${user.id}`);
        const getData = await getRes.json();
        if (getData.success && Array.isArray(getData.transactions)) {
          setTransactions(getData.transactions);
        }
        if (selectedTxDetail?.id === txId) setSelectedTxDetail(null);
        setStatusMessage('✓ Transaksi berhasil dihapus dan saldo dompet telah dikembalikan.');
      } else {
        setStatusMessage('❌ Gagal menghapus: ' + (data.error || 'Error'));
      }
    } catch (err: any) {
      setStatusMessage('❌ Error: ' + err.message);
    }
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const isFilterActive =
    Boolean(search.trim()) ||
    selectedType !== 'all' ||
    selectedWallet !== 'all' ||
    selectedCategory !== 'all' ||
    period !== 'month' ||
    selectedDate !== null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
              <span>💳 Manajemen & Kalender Transaksi</span>
            </h1>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
              WIB
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Pantau dan catat transaksi pemasukan & pengeluaranmu lewat tabel terperinci maupun visual kalender harian.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-500/20 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Catat Transaksi Baru</span>
        </button>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          {statusMessage}
        </div>
      )}

      {/* Tabs View Switcher (Sesuai Screenshot 3) */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            activeTab === 'list'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Tabel & Daftar</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-700 dark:bg-zinc-300 text-white dark:text-zinc-900 font-bold">
            {filteredTransactions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            activeTab === 'calendar'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
          }`}
        >
          <CalendarIcon className="w-4 h-4 text-amber-500" />
          <span>Kalender Keuangan</span>
          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
            Interaktif
          </span>
        </button>
      </div>

      {/* Unified Filter & Search Toolbar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 space-y-4 shadow-sm">
        {/* Row 1: Search Bar & Quick Dropdowns */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari transaksi, catatan, kategori, dompet, atau nominal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:border-emerald-500 transition-colors font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
                title="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Jenis */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3.5 py-2.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-medium outline-none focus:border-emerald-500 shrink-0"
          >
            <option value="all">Semua Jenis Transaksi</option>
            <option value="expense">💸 Pengeluaran</option>
            <option value="income">💰 Pemasukan</option>
            <option value="transfer">🔄 Transfer Saldo</option>
          </select>

          {/* Filter Dompet */}
          <select
            value={selectedWallet}
            onChange={(e) => setSelectedWallet(e.target.value)}
            className="px-3.5 py-2.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-medium outline-none focus:border-emerald-500 shrink-0"
          >
            <option value="all">Semua Dompet & Rekening</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.icon || '💳'} {w.name}
              </option>
            ))}
          </select>

          {/* Filter Kategori */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3.5 py-2.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-medium outline-none focus:border-emerald-500 shrink-0"
          >
            <option value="all">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Row 2: Period Filter Pills (Hari Ini, 7 Hari, Bulanan, Tahunan, Custom Kalender) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/60">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-zinc-400 mr-1 uppercase tracking-wider">Periode:</span>

            <button
              type="button"
              onClick={() => {
                setPeriod('today');
                setSelectedDate(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                period === 'today' && !selectedDate
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              Hari Ini
            </button>

            <button
              type="button"
              onClick={() => {
                setPeriod('7days');
                setSelectedDate(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                period === '7days' && !selectedDate
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              7 Hari
            </button>

            <button
              type="button"
              onClick={() => {
                setPeriod('month');
                setSelectedDate(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                period === 'month' && !selectedDate
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              Bulanan (Bulan Kalender)
            </button>

            <button
              type="button"
              onClick={() => {
                setPeriod('year');
                setSelectedDate(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                period === 'year' && !selectedDate
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              Tahunan
            </button>

            <button
              type="button"
              onClick={() => {
                setPeriod('custom');
                setSelectedDate(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                period === 'custom' && !selectedDate
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              Custom Kalender
            </button>
          </div>

          {/* Active Period Indicator Badge & Reset Button */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60">
              📅 {selectedDate ? `Tanggal Terpilih: ${formatIndoDate(new Date(selectedDate))}` : activeRange.label}
            </span>

            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                title="Reset seluruh filter pencarian dan periode"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Row 3: Custom Date Pickers (Muncul saat Custom Kalender dipilih) */}
        {period === 'custom' && !selectedDate && (
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Mulai:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Sampai:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white"
              />
            </div>
            <span className="text-[11px] text-zinc-400">
              Menampilkan transaksi yang terjadi antara kedua tanggal tersebut (inklusif).
            </span>
          </div>
        )}
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Transaksi</p>
          <p className="text-lg font-black text-zinc-900 dark:text-white mt-0.5">{summaryMetrics.count} Transaksi</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800">
          <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider">Pemasukan Periode</p>
          <p className="text-lg font-black text-emerald-500 mt-0.5">+{formatRupiah(summaryMetrics.income)}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800">
          <p className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">Pengeluaran Periode</p>
          <p className="text-lg font-black text-rose-500 mt-0.5">-{formatRupiah(summaryMetrics.expense)}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800">
          <p className="text-[11px] font-bold text-teal-500 uppercase tracking-wider">Net Cashflow</p>
          <p className={`text-lg font-black mt-0.5 ${summaryMetrics.net >= 0 ? 'text-teal-500' : 'text-rose-500'}`}>
            {summaryMetrics.net >= 0 ? '+' : ''}{formatRupiah(summaryMetrics.net)}
          </p>
        </div>
      </div>

      {/* VIEW TAB 1: TABEL & DAFTAR TRANSAKSI (Sesuai Screenshot 3) */}
      {activeTab === 'list' && (
        <div className="rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-zinc-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-1.5">
                <span>Daftar Transaksi</span>
                <span className="font-semibold text-zinc-400">({filteredTransactions.length})</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                {selectedDate
                  ? `Menampilkan transaksi pada tanggal ${formatIndoDate(new Date(selectedDate))}`
                  : `Periode: ${activeRange.label}`}
              </p>
            </div>
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="text-xs text-emerald-500 font-bold hover:underline"
              >
                ← Tampilkan Semua Transaksi Periode Ini
              </button>
            )}
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt className="w-10 h-10 mx-auto text-zinc-400 mb-2 opacity-50" />
              <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Tidak ada transaksi ditemukan</h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                Tidak ada transaksi yang cocok dengan periode waktu atau kata kunci pencarian yang dipilih.
              </p>
              {isFilterActive && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-3 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-200 transition-colors"
                >
                  Reset Filter Pencarian
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {filteredTransactions.map((tx) => {
                const isIncome = tx.type === 'income';
                const isTransfer = tx.type === 'transfer';

                return (
                  <div
                    key={tx.id}
                    className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 transition-colors group cursor-pointer"
                    onClick={() => setSelectedTxDetail(tx)}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Category Emoji Badge */}
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg shrink-0 ${
                          isIncome
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : isTransfer
                            ? 'bg-teal-500/10 text-teal-600'
                            : 'bg-rose-500/10 text-rose-600'
                        }`}
                      >
                        {tx.category?.emoji || (isTransfer ? '🔄' : '💸')}
                      </div>

                      {/* Detail Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                            {tx.notes || tx.description || 'Transaksi'}
                          </p>
                          <span
                            className={`hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isIncome
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : isTransfer
                                ? 'bg-teal-500/10 text-teal-600'
                                : 'bg-rose-500/10 text-rose-600'
                            }`}
                          >
                            {isIncome ? 'Income' : isTransfer ? 'Transfer' : 'Expense'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400 mt-1">
                          <span>{formatWIB(tx.transaction_date, { weekday: 'long', year: 'numeric' })}</span>
                          <span>•</span>
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                            {tx.wallet?.name || 'Dompet'}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{tx.source.replace('_', ' ')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Amount & Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p
                          className={`font-black text-sm sm:text-base ${
                            isIncome ? 'text-emerald-500' : isTransfer ? 'text-teal-500' : 'text-zinc-900 dark:text-white'
                          }`}
                        >
                          {isIncome ? `+${formatRupiah(tx.amount)}` : isTransfer ? formatRupiah(tx.amount) : `-${formatRupiah(tx.amount)}`}
                        </p>
                        <p className="text-[10px] text-zinc-400 capitalize">{tx.type}</p>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedTxDetail(tx)}
                          className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Lihat Detail Transaksi"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                          title="Hapus Transaksi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW TAB 2: KALENDER KEUANGAN INTERAKTIF */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-5">
            {/* Calendar Month Navigation Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                  title="Bulan sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white min-w-[160px] text-center">
                  {formatMonthYear(calendarYear, calendarMonth - 1)}
                </h2>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                  title="Bulan berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Month & Year Selectors & Shortcut */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={calendarMonth}
                  onChange={(e) => {
                    setCalendarMonth(Number(e.target.value));
                    setSelectedDate(null);
                  }}
                  className="px-3 py-1.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-bold"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {formatMonthYear(2026, i).split(' ')[0]}
                    </option>
                  ))}
                </select>

                <select
                  value={calendarYear}
                  onChange={(e) => {
                    setCalendarYear(Number(e.target.value));
                    setSelectedDate(null);
                  }}
                  className="px-3 py-1.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-bold"
                >
                  {[2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleGoToOctober2026}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                >
                  Oktober 2026
                </button>
              </div>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-zinc-400 uppercase tracking-wider py-1">
              <div>Sen</div>
              <div>Sel</div>
              <div>Rab</div>
              <div>Kam</div>
              <div>Jum</div>
              <div className="text-emerald-500">Sab</div>
              <div className="text-rose-500">Min</div>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {calendarGrid.map((day, idx) => {
                if (!day.isCurrentMonth) {
                  return <div key={idx} className="min-h-[70px] sm:min-h-[85px] rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/20" />;
                }

                const isSelected = selectedDate === day.dateStr;
                const hasTransactions = day.count > 0;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedDate(null);
                      } else {
                        setSelectedDate(day.dateStr);
                      }
                    }}
                    className={`min-h-[70px] sm:min-h-[85px] p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-md ring-2 ring-emerald-500/30'
                        : hasTransactions
                        ? 'border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50 bg-white dark:bg-zinc-900/60'
                        : 'border-zinc-100 dark:border-zinc-800/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {day.dateNumber}
                      </span>

                      {hasTransactions && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                          {day.count}
                        </span>
                      )}
                    </div>

                    {/* Daily aggregate pills */}
                    <div className="space-y-0.5 mt-1">
                      {day.income > 0 && (
                        <div className="text-[9px] sm:text-[10px] font-bold text-emerald-500 truncate" title={`Pemasukan: ${formatRupiah(day.income)}`}>
                          +{formatRupiah(day.income)}
                        </div>
                      )}
                      {day.expense > 0 && (
                        <div className="text-[9px] sm:text-[10px] font-bold text-rose-500 truncate" title={`Pengeluaran: ${formatRupiah(day.expense)}`}>
                          -{formatRupiah(day.expense)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transactions List below calendar */}
          <div className="rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                  {selectedDate
                    ? `Transaksi pada ${formatIndoDate(new Date(selectedDate))}`
                    : `Seluruh Transaksi di Bulan ${formatMonthYear(calendarYear, calendarMonth - 1)}`}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">Ditemukan {filteredTransactions.length} transaksi</p>
              </div>

              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-200"
                >
                  Tampilkan Semua Hari
                </button>
              )}
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                Tidak ada transaksi pada tanggal atau filter yang dipilih.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedTxDetail(tx)}
                    className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/40 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-base shrink-0">
                        {tx.category?.emoji || '💸'}
                      </div>
                      <div>
                        <p className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">
                          {tx.notes || tx.description || 'Transaksi'}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          {formatWIB(tx.transaction_date, { weekday: 'short' })} • {tx.wallet?.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-black text-xs sm:text-sm ${
                          tx.type === 'income'
                            ? 'text-emerald-500'
                            : tx.type === 'transfer'
                            ? 'text-teal-500'
                            : 'text-zinc-900 dark:text-white'
                        }`}
                      >
                        {tx.type === 'income'
                          ? `+${formatRupiah(tx.amount)}`
                          : tx.type === 'transfer'
                          ? formatRupiah(tx.amount)
                          : `-${formatRupiah(tx.amount)}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DETAIL TRANSAKSI MODAL */}
      {selectedTxDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111216] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                <span>Rincian Transaksi</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedTxDetail(null)}
                className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center py-3">
              <div
                className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-2 ${
                  selectedTxDetail.type === 'income'
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : selectedTxDetail.type === 'transfer'
                    ? 'bg-teal-500/10 text-teal-600'
                    : 'bg-rose-500/10 text-rose-600'
                }`}
              >
                {selectedTxDetail.category?.emoji || (selectedTxDetail.type === 'transfer' ? '🔄' : '💸')}
              </div>
              <h4 className="font-black text-2xl text-zinc-900 dark:text-white">
                {selectedTxDetail.type === 'income' ? '+' : selectedTxDetail.type === 'expense' ? '-' : ''}
                {formatRupiah(selectedTxDetail.amount)}
              </h4>
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mt-1 capitalize">
                {selectedTxDetail.type === 'income'
                  ? 'Pemasukan Kas'
                  : selectedTxDetail.type === 'expense'
                  ? 'Pengeluaran Kas'
                  : 'Transfer Saldo Antar Dompet'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400 font-medium">Catatan / Keterangan:</span>
                <span className="font-bold text-zinc-900 dark:text-white text-right max-w-[200px]">
                  {selectedTxDetail.notes || selectedTxDetail.description || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 font-medium">Tanggal & Waktu:</span>
                <span className="font-bold text-zinc-900 dark:text-white">
                  {formatWIB(selectedTxDetail.transaction_date, { weekday: 'long', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 font-medium">Kategori:</span>
                <span className="font-bold text-zinc-900 dark:text-white">
                  {selectedTxDetail.category ? `${selectedTxDetail.category.emoji} ${selectedTxDetail.category.name}` : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 font-medium">Dompet / Rekening:</span>
                <span className="font-bold text-zinc-900 dark:text-white">
                  {selectedTxDetail.wallet?.name || 'Dompet'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 font-medium">Kanal Pencatatan:</span>
                <span className="font-bold text-zinc-900 dark:text-white capitalize">
                  {selectedTxDetail.source.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 font-medium">Status Verifikasi:</span>
                <span className="font-bold text-emerald-500">✓ Berhasil / Approved</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleDeleteTransaction(selectedTxDetail.id)}
                className="px-3.5 py-2 rounded-xl bg-rose-500/10 text-rose-500 font-bold text-xs hover:bg-rose-500/20 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Transaksi
              </button>
              <button
                type="button"
                onClick={() => setSelectedTxDetail(null)}
                className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CATAT TRANSAKSI BARU */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111216] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Catat Transaksi Baru</h2>

            <form onSubmit={handleCreateTransaction} className="space-y-4 text-xs">
              {/* Type Switcher */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setTxType('expense')}
                  className={`py-2 rounded-xl font-bold transition-all ${
                    txType === 'expense'
                      ? 'bg-rose-500 text-white shadow'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-white'
                  }`}
                >
                  💸 Pengeluaran
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('income')}
                  className={`py-2 rounded-xl font-bold transition-all ${
                    txType === 'income'
                      ? 'bg-emerald-500 text-white shadow'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-white'
                  }`}
                >
                  💰 Pemasukan
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('transfer')}
                  className={`py-2 rounded-xl font-bold transition-all ${
                    txType === 'transfer'
                      ? 'bg-teal-600 text-white shadow'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-white'
                  }`}
                >
                  🔄 Transfer
                </button>
              </div>

              {/* Nominal */}
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  placeholder="Contoh: 50000"
                  value={nominalStr}
                  onChange={(e) => setNominalStr(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-bold"
                />
              </div>

              {/* Tanggal Transaksi */}
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Tanggal Transaksi</label>
                <input
                  type="date"
                  value={txDateStr}
                  onChange={(e) => setTxDateStr(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              {/* Dompet Asal */}
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {txType === 'transfer' ? 'Dari Dompet (Sumber)' : 'Dompet'}
                </label>
                <select
                  value={selectedWalletId}
                  onChange={(e) => setSelectedWalletId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} (Saldo: {formatRupiah(w.balance)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dompet Tujuan if Transfer */}
              {txType === 'transfer' && (
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Ke Dompet (Tujuan)
                  </label>
                  <select
                    value={transferTargetWalletId}
                    onChange={(e) => setTransferTargetWalletId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} (Saldo: {formatRupiah(w.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Kategori if not transfer */}
              {txType !== 'transfer' && (
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Kategori</label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                  >
                    {categories
                      .filter((c) => c.type === (txType === 'income' ? 'income' : 'expense'))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.emoji} {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Catatan */}
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Catatan</label>
                <input
                  type="text"
                  placeholder="Keterangan transaksi (misal: Beli Kopi, Makan Siang)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
