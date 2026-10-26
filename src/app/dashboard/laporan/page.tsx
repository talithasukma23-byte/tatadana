'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  AlertCircle,
  RotateCcw,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { db } from '@/lib/supabase/mock-db';
import { formatRupiah, formatWIB } from '@/lib/utils';
import { calculateReportSummary } from '@/lib/reports/export-generator';
import { useActiveUser } from '@/lib/auth/client-session';
import { Transaction, Wallet, Category } from '@/types/database';
import {
  PeriodFilterType,
  calculateDateRange,
  filterTransactionsList,
  formatIndoDate,
} from '@/lib/date-filters';

export default function LaporanKeuanganPage() {
  const { user } = useActiveUser();

  // Period Filter State (Hari Ini, Mingguan, Bulanan, Custom Kalender)
  const [period, setPeriod] = useState<PeriodFilterType>('month');
  const [customStart, setCustomStart] = useState<string>('2026-10-01');
  const [customEnd, setCustomEnd] = useState<string>('2026-10-31');

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedWallet, setSelectedWallet] = useState('all');

  // Table Sort State
  const [sortField, setSortField] = useState<'date' | 'amount' | 'category' | 'wallet'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Expanded Receipt Item rows
  const [expandedTxIds, setExpandedTxIds] = useState<Record<string, boolean>>({
    'tx-005': true,
  });

  // Export State
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);
  const [exportAlert, setExportAlert] = useState<string | null>(null);

  // Data fetching
  const [wallets, setWallets] = useState<Wallet[]>(() => db.getWallets(user.id));
  const [categories, setCategories] = useState<Category[]>(() => db.getCategories(user.id));
  const [allTxs, setAllTxs] = useState<Transaction[]>(() => db.getTransactions(user.id));

  // Real-time sync dengan server
  useEffect(() => {
    const fetchLiveData = () => {
      fetch(`/api/transactions?userId=${user.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.success) {
            if (Array.isArray(data.transactions)) setAllTxs(data.transactions);
            if (Array.isArray(data.wallets)) setWallets(data.wallets);
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
  }, [user.id]);

  // Compute Filtered and Sorted Transactions
  const { filtered: filteredTxs, range: activeRange } = useMemo(() => {
    const { filtered, range } = filterTransactionsList(allTxs, {
      search,
      type: selectedType,
      walletId: selectedWallet,
      categoryId: selectedCategory,
      period,
      customStartDate: customStart,
      customEndDate: customEnd,
    });

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime();
      } else if (sortField === 'amount') {
        comparison = a.amount - b.amount;
      } else if (sortField === 'category') {
        comparison = (a.category?.name || '').localeCompare(b.category?.name || '');
      } else if (sortField === 'wallet') {
        comparison = (a.wallet?.name || '').localeCompare(b.wallet?.name || '');
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return { filtered: sorted, range };
  }, [allTxs, search, selectedType, selectedWallet, selectedCategory, period, customStart, customEnd, sortField, sortOrder]);

  // Reactive summary based on active period & filters
  const summary = useMemo(() => calculateReportSummary(filteredTxs), [filteredTxs]);

  const toggleSort = (field: 'date' | 'amount' | 'category' | 'wallet') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const toggleExpand = (txId: string) => {
    setExpandedTxIds((prev) => ({
      ...prev,
      [txId]: !prev[txId],
    }));
  };

  const handleResetFilters = () => {
    setPeriod('month');
    setSearch('');
    setSelectedType('all');
    setSelectedWallet('all');
    setSelectedCategory('all');
  };

  const handleExport = async (format: 'pdf' | 'xlsx') => {
    setExporting(format);
    setExportAlert(null);

    try {
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          userId: user.id,
          dateRange: activeRange.label,
          filters: {
            type: selectedType,
            categoryId: selectedCategory,
            walletId: selectedWallet,
            startDate: activeRange.startStr,
            endDate: activeRange.endStr,
            search,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal membuat laporan');
      }

      const a = document.createElement('a');
      a.href = data.dataUrl;
      a.download = data.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setExportAlert(`✓ Berhasil mengunduh ${data.fileName}`);
    } catch (err: any) {
      setExportAlert(`❌ ${err.message}`);
    } finally {
      setExporting(null);
    }
  };

  const isFilterActive =
    Boolean(search.trim()) ||
    selectedType !== 'all' ||
    selectedWallet !== 'all' ||
    selectedCategory !== 'all' ||
    period !== 'month';

  const expenseCount = filteredTxs.filter((t) => t.type === 'expense').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Export Actions (Sesuai Screenshot 2) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              📊 Laporan Finansial Native
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white mt-1">
            Laporan Keuangan
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Analisis arus kas harian, mingguan, bulanan, breakdown kategori, dan ekspor instan ke PDF / Excel.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-md shadow-rose-600/20 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            {exporting === 'pdf' ? 'Membuat PDF...' : 'Export PDF'}
          </button>

          <button
            onClick={() => handleExport('xlsx')}
            disabled={exporting !== null}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exporting === 'xlsx' ? 'Membuat Excel...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {exportAlert && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
            exportAlert.startsWith('✓')
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {exportAlert}
        </div>
      )}

      {/* Main Filter Section Box (Sesuai Screenshot 2) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          {/* Left: PILIH PERIODE LAPORAN */}
          <div className="space-y-3 flex-1">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              PILIH PERIODE LAPORAN
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPeriod('today')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
                  period === 'today'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Hari Ini
              </button>

              <button
                type="button"
                onClick={() => setPeriod('7days')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
                  period === '7days'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                Mingguan (7 Hari)
              </button>

              <button
                type="button"
                onClick={() => setPeriod('month')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
                  period === 'month'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                Bulanan
              </button>

              <button
                type="button"
                onClick={() => setPeriod('custom')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all ${
                  period === 'custom'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                Custom Kalender
              </button>
            </div>

            {/* Active Range Pill */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-bold px-3 py-1 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
                📅 {period === 'today' ? 'Hari Ini' : period === '7days' ? '7 Hari' : period === 'month' ? 'Bulanan' : 'Rentang Khusus'}: {activeRange.label}
              </span>

              {isFilterActive && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[11px] font-bold text-rose-500 hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>

            {/* Custom Date Picker Inputs */}
            {period === 'custom' && (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-500">Mulai:</span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-500">Sampai:</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right: FILTER DOMPET / REKENING */}
          <div className="space-y-2 lg:w-72 shrink-0">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              FILTER DOMPET / REKENING
            </span>

            <select
              value={selectedWallet}
              onChange={(e) => setSelectedWallet(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-medium outline-none focus:border-emerald-500"
            >
              <option value="all">Semua Dompet & Rekening</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.icon || '💳'} {w.name}
                </option>
              ))}
            </select>

            <p className="text-[11px] text-zinc-400 text-right">
              Ditemukan <strong>{filteredTxs.length}</strong> transaksi pada periode ini
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Strip (Sesuai Screenshot 2) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* TOTAL PEMASUKAN */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 relative shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Pemasukan</span>
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-500 mt-2">
            +{formatRupiah(summary.totalIncome)}
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">
            Periode {activeRange.label}
          </p>
        </div>

        {/* TOTAL PENGELUARAN */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 relative shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Pengeluaran</span>
            <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-rose-500 mt-2">
            -{formatRupiah(summary.totalExpense)}
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">
            Dari {expenseCount} kali pengeluaran periode ini
          </p>
        </div>

        {/* NET CASHFLOW */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 relative shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Net Cashflow</span>
            <span
              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                summary.netCashflow >= 0
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
              }`}
            >
              {summary.netCashflow >= 0 ? 'Surplus' : 'Defisit'}
            </span>
          </div>
          <p
            className={`text-2xl sm:text-3xl font-black mt-2 ${
              summary.netCashflow >= 0 ? 'text-zinc-900 dark:text-white' : 'text-rose-500'
            }`}
          >
            {formatRupiah(summary.netCashflow)}
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">
            {summary.netCashflow >= 0 ? 'Arus kas surplus bersih' : 'Pengeluaran melebihi pemasukan'}
          </p>
        </div>
      </div>

      {/* Top 5 Kategori Pengeluaran Periode Ini (Sesuai Screenshot 2) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Top 5 Kategori Pengeluaran Periode Ini</h3>
            <p className="text-xs text-zinc-400">Porsi pengeluaran berdasarkan rentang waktu terpilih</p>
          </div>
          <span className="text-[11px] font-semibold text-zinc-400">
            {summary.topCategories.length} Kategori Aktif
          </span>
        </div>

        {summary.topCategories.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-4">Belum ada pengeluaran pada periode ini.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {summary.topCategories.map((cat, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🏷️</span>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{cat.name}</span>
                </div>
                <p className="text-sm font-black text-zinc-900 dark:text-white mt-2">{formatRupiah(cat.amount)}</p>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
                  <span>Porsi:</span>
                  <span className="font-bold text-rose-500">{cat.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detailed Transactions List with Search & Sort */}
      <div className="rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-zinc-200/80 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search box inside table header */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari transaksi pada laporan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
            >
              <option value="all">Semua Jenis</option>
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
            >
              <option value="all">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-100/70 dark:bg-zinc-900/80 text-zinc-500 font-semibold border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th onClick={() => toggleSort('date')} className="py-3 px-4 cursor-pointer hover:text-zinc-900">
                  <div className="flex items-center gap-1">
                    Tanggal (WIB)
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Jenis</th>
                <th onClick={() => toggleSort('category')} className="py-3 px-4 cursor-pointer hover:text-zinc-900">
                  <div className="flex items-center gap-1">
                    Kategori
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Keterangan</th>
                <th onClick={() => toggleSort('wallet')} className="py-3 px-4 cursor-pointer hover:text-zinc-900">
                  <div className="flex items-center gap-1">
                    Dompet
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th onClick={() => toggleSort('amount')} className="py-3 px-4 text-right cursor-pointer hover:text-zinc-900">
                  <div className="flex items-center justify-end gap-1">
                    Nominal
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-400">
                    Tidak ada transaksi pada laporan ini.
                  </td>
                </tr>
              ) : (
                filteredTxs.map((tx) => {
                  const isIncome = tx.type === 'income';
                  return (
                    <tr key={tx.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40">
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                        {formatWIB(tx.transaction_date, { weekday: undefined, year: '2-digit' })}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isIncome ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                          }`}
                        >
                          {isIncome ? 'Pemasukan' : 'Pengeluaran'}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-semibold text-zinc-800 dark:text-zinc-200">
                        {tx.category ? `${tx.category.emoji} ${tx.category.name}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-zinc-900 dark:text-zinc-100">{tx.notes || tx.description || '-'}</td>
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-500 dark:text-zinc-400">{tx.wallet?.name}</td>
                      <td className="py-3 px-4 whitespace-nowrap text-right font-black">
                        <span className={isIncome ? 'text-emerald-500' : 'text-zinc-900 dark:text-white'}>
                          {isIncome ? `+${formatRupiah(tx.amount)}` : `-${formatRupiah(tx.amount)}`}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
