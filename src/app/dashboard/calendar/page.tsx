'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Clock,
  Tag,
  X,
  CheckCircle2,
  AlertCircle,
  Filter,
  Search,
  RotateCcw,
  Eye,
  Trash2,
  Receipt,
} from 'lucide-react';
import { db } from '@/lib/supabase/mock-db';
import { formatRupiah, formatWIB } from '@/lib/utils';
import { Transaction, Wallet as WalletType, Category } from '@/types/database';
import { useActiveUser } from '@/lib/auth/client-session';
import {
  PeriodFilterType,
  calculateDateRange,
  filterTransactionsList,
  formatIndoDate,
  formatMonthYear,
  toDateInputValue,
} from '@/lib/date-filters';

export default function CalendarPage() {
  const { user } = useActiveUser();
  const [transactions, setTransactions] = useState<Transaction[]>(() => db.getTransactions(user.id));
  const [categories, setCategories] = useState<Category[]>(() => db.getCategories(user.id));
  const [wallets, setWallets] = useState<WalletType[]>(() => db.getWallets(user.id));

  // Sync dengan transaksi live dari server
  useEffect(() => {
    setTransactions(db.getTransactions(user.id));
    setCategories(db.getCategories(user.id));
    setWallets(db.getWallets(user.id));

    const fetchLive = () => {
      fetch(`/api/transactions?userId=${user.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.success) {
            if (Array.isArray(data.transactions)) setTransactions(data.transactions);
            if (Array.isArray(data.wallets)) setWallets(data.wallets);
            if (Array.isArray(data.categories)) setCategories(data.categories);
          }
        })
        .catch(() => {});
    };

    fetchLive();
    const intervalId = setInterval(fetchLive, 3000);
    return () => clearInterval(intervalId);
  }, [user.id]);

  // Calendar Year & Month View (1-indexed for month: 10 = Oktober)
  const [calendarYear, setCalendarYear] = useState(2026);
  const [calendarMonth, setCalendarMonth] = useState(10);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedWallet, setSelectedWallet] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodFilterType>('month');
  const [customStart, setCustomStart] = useState<string>('2026-10-01');
  const [customEnd, setCustomEnd] = useState<string>('2026-10-31');

  // Detail Modal State
  const [selectedTxDetail, setSelectedTxDetail] = useState<Transaction | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Quick Add Transaction Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [trxType, setTrxType] = useState<'expense' | 'income'>('expense');
  const [trxAmount, setTrxAmount] = useState('');
  const [trxCategory, setTrxCategory] = useState(categories[0]?.id || '');
  const [trxWallet, setTrxWallet] = useState(wallets[0]?.id || '');
  const [trxNotes, setTrxNotes] = useState('');

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
      year: !selectedDate ? calendarYear : undefined,
      month: !selectedDate ? calendarMonth : undefined,
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
    calendarYear,
    calendarMonth,
  ]);

  // Daily map for calendar badges
  const calendarDailyMap = useMemo(() => {
    const map: Record<string, { income: number; expense: number; count: number }> = {};

    transactions.forEach((tx) => {
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
        map[dateStr] = { income: 0, expense: 0, count: 0 };
      }
      map[dateStr].count += 1;
      if (tx.type === 'income') map[dateStr].income += tx.amount;
      else if (tx.type === 'expense') map[dateStr].expense += tx.amount;
    });

    return map;
  }, [transactions, selectedWallet, selectedType, selectedCategory, search]);

  // Calendar Days Grid Matrix
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth - 1, 1);
    const lastDay = new Date(calendarYear, calendarMonth, 0);
    const daysInMonth = lastDay.getDate();

    let startingDay = firstDay.getDay() - 1;
    if (startingDay < 0) startingDay = 6;

    const days: Array<{
      dateNumber: number;
      dateStr: string;
      isCurrentMonth: boolean;
      income: number;
      expense: number;
      count: number;
    }> = [];

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

  const handleAddTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(trxAmount.replace(/[^0-9]/g, ''));
    if (!amountNum || amountNum <= 0) {
      alert('Masukkan nominal transaksi yang valid.');
      return;
    }

    const targetDate = selectedDate || `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-01`;

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          walletId: trxWallet || wallets[0]?.id,
          categoryId: trxCategory || categories[0]?.id,
          type: trxType,
          amount: amountNum,
          notes: trxNotes || (trxType === 'income' ? 'Pemasukan Terjadwal' : 'Pengeluaran Terjadwal'),
          description: trxNotes || (trxType === 'income' ? 'Pemasukan Terjadwal' : 'Pengeluaran Terjadwal'),
          transaction_date: `${targetDate}T12:00:00+07:00`,
          source: 'web_manual',
        }),
      });

      const data = await res.json();
      if (data && data.success) {
        const getRes = await fetch(`/api/transactions?userId=${user.id}`);
        const getData = await getRes.json();
        if (getData && getData.success && Array.isArray(getData.transactions)) {
          setTransactions(getData.transactions);
        }
        setIsAddModalOpen(false);
        setTrxAmount('');
        setTrxNotes('');
        setToastMessage(`✓ Transaksi berhasil dicatat pada tanggal ${targetDate}!`);
      }
    } catch (err: any) {
      alert('Gagal mencatat transaksi: ' + err.message);
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (!confirm('Hapus transaksi ini? Saldo dompet akan disesuaikan kembali secara otomatis.')) return;
    try {
      const res = await fetch(`/api/transactions?id=${txId}&userId=${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        const getRes = await fetch(`/api/transactions?userId=${user.id}`);
        const getData = await getRes.json();
        if (getData.success && Array.isArray(getData.transactions)) {
          setTransactions(getData.transactions);
        }
        if (selectedTxDetail?.id === txId) setSelectedTxDetail(null);
        setToastMessage('✓ Transaksi berhasil dihapus.');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setTimeout(() => setToastMessage(null), 3500);
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
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-xl shadow-emerald-600/20 text-sm font-semibold animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-5 h-5" />
          {toastMessage}
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>📅 Kalender Keuangan</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Interactive View
            </span>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Visualisasikan arus kas masuk dan keluar setiap hari secara transparan serta filter berdasarkan kata kunci, tanggal, bulan, atau dompet.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/transaksi"
            className="px-3.5 py-2 text-xs font-bold rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 transition-colors flex items-center gap-1.5"
          >
            <Receipt className="w-3.5 h-3.5" />
            Tabel Transaksi ↗
          </Link>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            Catat di Tanggal Ini
          </button>
        </div>
      </div>

      {/* Integrated Search & Filter Toolbar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari transaksi pada kalender (nama, catatan, kategori, dompet)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:border-emerald-500 font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Jenis */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3.5 py-2.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-medium outline-none focus:border-emerald-500"
          >
            <option value="all">Semua Jenis</option>
            <option value="expense">💸 Pengeluaran</option>
            <option value="income">💰 Pemasukan</option>
            <option value="transfer">🔄 Transfer</option>
          </select>

          {/* Filter Dompet */}
          <select
            value={selectedWallet}
            onChange={(e) => setSelectedWallet(e.target.value)}
            className="px-3.5 py-2.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-medium outline-none focus:border-emerald-500"
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
            className="px-3.5 py-2.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-medium outline-none focus:border-emerald-500"
          >
            <option value="all">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Period Pills & Active Indicator */}
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
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300'
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
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300'
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
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300'
              }`}
            >
              Bulan Kalender
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
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300'
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
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300'
              }`}
            >
              Custom Kalender
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60">
              📅 {selectedDate ? `Tanggal Terpilih: ${formatIndoDate(new Date(selectedDate))}` : activeRange.label}
            </span>

            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        </div>

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
          </div>
        )}
      </div>

      {/* Interactive Calendar Grid Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-5">
        {/* Month Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white min-w-[160px] text-center">
              {formatMonthYear(calendarYear, calendarMonth - 1)}
            </h2>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

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
              className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/20 hover:bg-emerald-500/20"
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

        {/* Calendar Day Cells */}
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
                      isSelected ? 'bg-emerald-600 text-white' : 'text-zinc-700 dark:text-zinc-300'
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

                <div className="space-y-0.5 mt-1">
                  {day.income > 0 && (
                    <div className="text-[9px] sm:text-[10px] font-bold text-emerald-500 truncate">
                      +{formatRupiah(day.income)}
                    </div>
                  )}
                  {day.expense > 0 && (
                    <div className="text-[9px] sm:text-[10px] font-bold text-rose-500 truncate">
                      -{formatRupiah(day.expense)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transaction List for Selected Date or Current Month */}
      <div className="rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
              {selectedDate
                ? `Transaksi pada ${formatIndoDate(new Date(selectedDate))}`
                : `Daftar Transaksi ${formatMonthYear(calendarYear, calendarMonth - 1)}`}
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

      {/* DETAIL TRANSAKSI MODAL */}
      {selectedTxDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111216] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-base text-zinc-900 dark:text-white">Rincian Transaksi</h3>
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
                <span className="text-zinc-400 font-medium">Catatan:</span>
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
                <span className="text-zinc-400 font-medium">Dompet:</span>
                <span className="font-bold text-zinc-900 dark:text-white">
                  {selectedTxDetail.wallet?.name || 'Dompet'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 font-medium">Sumber:</span>
                <span className="font-bold text-zinc-900 dark:text-white capitalize">
                  {selectedTxDetail.source.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleDeleteTransaction(selectedTxDetail.id)}
                className="px-3.5 py-2 rounded-xl bg-rose-500/10 text-rose-500 font-bold text-xs hover:bg-rose-500/20 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus
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

      {/* QUICK ADD MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111216] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 space-y-4">
            <h3 className="font-bold text-base text-zinc-900 dark:text-white">
              Catat Transaksi ({selectedDate ? formatIndoDate(new Date(selectedDate)) : activeRange.label})
            </h3>

            <form onSubmit={handleAddTransactionSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTrxType('expense')}
                  className={`py-2 rounded-lg font-bold ${
                    trxType === 'expense' ? 'bg-rose-500 text-white shadow' : 'text-zinc-500'
                  }`}
                >
                  💸 Pengeluaran
                </button>
                <button
                  type="button"
                  onClick={() => setTrxType('income')}
                  className={`py-2 rounded-lg font-bold ${
                    trxType === 'income' ? 'bg-emerald-500 text-white shadow' : 'text-zinc-500'
                  }`}
                >
                  💰 Pemasukan
                </button>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  placeholder="Contoh: 35000"
                  value={trxAmount}
                  onChange={(e) => setTrxAmount(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Kategori</label>
                <select
                  value={trxCategory}
                  onChange={(e) => setTrxCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                >
                  {categories
                    .filter((c) => c.type === trxType)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Dompet</label>
                <select
                  value={trxWallet}
                  onChange={(e) => setTrxWallet(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.icon} {w.name} ({formatRupiah(w.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Catatan</label>
                <input
                  type="text"
                  placeholder="Keterangan transaksi..."
                  value={trxNotes}
                  onChange={(e) => setTrxNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-zinc-400 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
