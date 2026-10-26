'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Target,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  Edit2,
  Sparkles,
  Zap,
  Plus,
  Lock,
  X,
  Calendar as CalendarIcon,
  CheckCircle2,
  Wallet as WalletIcon,
} from 'lucide-react';
import { db } from '@/lib/supabase/mock-db';
import { formatRupiah, generateProgressBar } from '@/lib/utils';
import { Category, Wallet as WalletType } from '@/types/database';
import { useActiveUser } from '@/lib/auth/client-session';
import { executeUpgradePro } from '@/lib/payment/upgrade-client';
import {
  calculateDateRange,
  formatIndoDate,
  toDateInputValue,
  PeriodFilterType,
} from '@/lib/date-filters';

export default function BudgetPage() {
  const { user: currentUser } = useActiveUser();

  // Categories & Transactions from DB / API
  const [categories, setCategories] = useState<Category[]>(() =>
    db.getCategories(currentUser.id).filter((c) => c.type === 'expense')
  );
  const [allTxs, setAllTxs] = useState(() => db.getTransactions(currentUser.id));
  const [wallets, setWallets] = useState<WalletType[]>(() => db.getWallets(currentUser.id));

  // Period filter: 'today' | '7days' | 'month30' | 'custom'
  const [periodFilter, setPeriodFilter] = useState<'today' | '7days' | 'month30' | 'custom'>('month30');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return toDateInputValue(d);
  });
  const [customEnd, setCustomEnd] = useState(() => toDateInputValue(new Date()));

  // Wallet filter
  const [selectedWalletId, setSelectedWalletId] = useState<string>('all');

  // Edit & Add Budget modals
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editBudgetInput, setEditBudgetInput] = useState('');
  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState<{ orderId: string; waLink: string; isExisting: boolean } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New budget form state
  const [selectedCatId, setSelectedCatId] = useState(categories[0]?.id || '');
  const [newBudgetAmount, setNewBudgetAmount] = useState('');

  // Sync on user change
  useEffect(() => {
    setCategories(db.getCategories(currentUser.id).filter((c) => c.type === 'expense'));
    setAllTxs(db.getTransactions(currentUser.id));
    setWallets(db.getWallets(currentUser.id));
  }, [currentUser.id]);

  // Real-time polling sync with server
  useEffect(() => {
    const fetchLiveData = () => {
      fetch(`/api/transactions?userId=${currentUser.id}`)
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
              const expenseCats = data.categories.filter((c: Category) => c.type === 'expense');
              setCategories(expenseCats);
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
  }, [currentUser.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Calculate current date range bounds
  const activeDateRange = useMemo(() => {
    return calculateDateRange(
      periodFilter as PeriodFilterType,
      periodFilter === 'custom' ? customStart : undefined,
      periodFilter === 'custom' ? customEnd : undefined
    );
  }, [periodFilter, customStart, customEnd]);

  // Period label for display
  const periodDisplayLabel = useMemo(() => {
    switch (periodFilter) {
      case 'today':
        return 'Hari Ini';
      case '7days':
        return '7 Hari';
      case 'month30':
        return 'Bulanan (30 Hari)';
      case 'custom':
        return `Custom Kalender (${activeDateRange.label})`;
      default:
        return 'Bulanan (30 Hari)';
    }
  }, [periodFilter, activeDateRange]);

  // Filtered expense transactions based on active date range & selected wallet
  const filteredExpenseTxs = useMemo(() => {
    const startMs = activeDateRange.startDate.getTime();
    const endMs = activeDateRange.endDate.getTime();

    return allTxs.filter((t) => {
      if (t.type !== 'expense') return false;
      if (t.status === 'pending' || t.status === 'rejected') return false;

      const txMs = new Date(t.transaction_date).getTime();
      if (txMs < startMs || txMs > endMs) return false;

      if (selectedWalletId !== 'all') {
        if (t.wallet_id !== selectedWalletId) return false;
      }

      return true;
    });
  }, [allTxs, activeDateRange, selectedWalletId]);

  // Period multiplier / divider for budget target
  const periodMultiplier = useMemo(() => {
    if (periodFilter === 'today') return 1 / 30;
    if (periodFilter === '7days') return 7 / 30;
    if (periodFilter === 'month30') return 1;
    if (periodFilter === 'custom') {
      const msDiff = activeDateRange.endDate.getTime() - activeDateRange.startDate.getTime();
      const days = Math.max(1, Math.round(msDiff / (1000 * 60 * 60 * 24)));
      return days / 30;
    }
    return 1;
  }, [periodFilter, activeDateRange]);

  // Category statistics adjusted by period & wallet (hanya kategori dengan budget aktif > 0)
  const categoryStats = useMemo(() => {
    return categories
      .filter((cat) => (cat.monthly_budget || 0) > 0)
      .map((cat) => {
        const baseMonthly = cat.monthly_budget || 0;
        const budgetTarget = Math.round(baseMonthly * periodMultiplier);

        const spent = filteredExpenseTxs
          .filter((t) => t.category_id === cat.id)
          .reduce((sum, t) => sum + t.amount, 0);

        const pct = budgetTarget > 0 ? Math.round((spent / budgetTarget) * 100) : 0;
        const remaining = budgetTarget - spent;
        const isOver100 = pct >= 100;
        const isOver80 = pct >= 80 && pct < 100;

        return {
          ...cat,
          baseMonthly,
          budgetTarget,
          spent,
          pct,
          remaining,
          isOver100,
          isOver80,
        };
      });
  }, [categories, periodMultiplier, filteredExpenseTxs]);

  // Overall totals
  const totalPlafon = useMemo(() => {
    return categoryStats.reduce((sum, c) => sum + c.budgetTarget, 0);
  }, [categoryStats]);

  const totalSpent = useMemo(() => {
    return categoryStats.reduce((sum, c) => sum + c.spent, 0);
  }, [categoryStats]);

  const totalRemaining = totalPlafon - totalSpent;
  const totalPct = totalPlafon > 0 ? Math.round((totalSpent / totalPlafon) * 100) : 0;

  // Selected wallet name label
  const activeWalletLabel = useMemo(() => {
    if (selectedWalletId === 'all') return 'Semua Dompet';
    const w = wallets.find((wal) => wal.id === selectedWalletId);
    return w ? w.name : 'Dompet Terpilih';
  }, [selectedWalletId, wallets]);

  // Handlers for Edit
  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setEditBudgetInput(cat.monthly_budget.toString());
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    const newBudget = parseFloat(editBudgetInput.replace(/[^0-9]/g, '')) || 0;
    editingCategory.monthly_budget = newBudget;

    setCategories([...categories]);
    showToast(
      newBudget > 0
        ? `✓ Batas anggaran bulanan ${editingCategory.name} berhasil diperbarui!`
        : `✓ Anggaran untuk ${editingCategory.name} dinonaktifkan.`
    );

    // Persist to server store via API
    fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        categoryId: editingCategory.id,
        amount: newBudget,
        period: 'monthly',
      }),
    }).catch(() => {});

    setEditingCategory(null);
  };

  const handleOpenAddBudget = () => {
    const activeBudgetCount = categories.filter((c) => (c.monthly_budget || 0) > 0).length;
    if (currentUser.plan === 'starter' && activeBudgetCount >= 5) {
      setIsLimitModalOpen(true);
      return;
    }
    if (!selectedCatId && categories.length > 0) {
      setSelectedCatId(categories[0].id);
    }
    setNewBudgetAmount('');
    setIsAddBudgetOpen(true);
  };

  const handleCreateBudgetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(newBudgetAmount.replace(/[^0-9]/g, ''));
    if (!amountNum || amountNum <= 0) {
      alert('Masukkan nominal budget yang valid.');
      return;
    }

    const targetCat = categories.find((c) => c.id === selectedCatId);
    if (targetCat) {
      targetCat.monthly_budget = amountNum;
      setCategories([...categories]);
      showToast(`✓ Budget baru untuk ${targetCat.name} berhasil diterapkan!`);

      fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          categoryId: targetCat.id,
          amount: amountNum,
          period: 'monthly',
        }),
      }).catch(() => {});
    }

    setIsAddBudgetOpen(false);
  };

  const triggerTelegramAlertSimulation = (catName: string, pct: number) => {
    showToast(`🔔 [Simulasi Telegram] Alert terkirim ke Telegram: "Budget ${catName} telah mencapai ${pct}%!"`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-xl shadow-emerald-600/20 text-sm font-semibold animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-5 h-5" />
          {toastMessage}
        </div>
      )}

      {/* Header (Screenshot 4) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
              <span>🎯 Manajemen Budget Fleksibel</span>
            </h1>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 fill-amber-500" />
              Real-time Alert
            </span>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Kendalikan pengeluaran dengan batas anggaran Hari Ini, 7 Hari, Bulanan (30 Hari), atau Custom Kalender — lengkap dengan filter per dompet.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleOpenAddBudget}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold text-xs transition-all shadow-lg shadow-rose-500/20"
          >
            <Plus className="w-4 h-4" />
            + Set Budget Baru
          </button>
        </div>
      </div>

      {/* Filter Section Card (Matches Screenshot 4) */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200 dark:border-zinc-800/80 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: PILIH PERIODE WAKTU */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
              PILIH PERIODE WAKTU
            </span>
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setPeriodFilter('today')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  periodFilter === 'today'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter('7days')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  periodFilter === '7days'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                7 Hari
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter('month30')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  periodFilter === 'month30'
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Bulanan (30 Hari)
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter('custom')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  periodFilter === 'custom'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                Custom Kalender
              </button>
            </div>
          </div>

          {/* Right: FILTER DOMPET / REKENING */}
          <div className="space-y-2 lg:min-w-[280px]">
            <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
              FILTER DOMPET / REKENING
            </span>
            <div className="relative">
              <select
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                className="w-full pl-3.5 pr-8 py-2 text-xs font-semibold rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-rose-500 appearance-none cursor-pointer"
              >
                <option value="all">Semua Dompet &amp; Rekening</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.icon || '💳'} {w.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
                ▼
              </div>
            </div>
          </div>
        </div>

        {/* Custom Date Pickers when 'custom' is active */}
        {periodFilter === 'custom' && (
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-zinc-500">Rentang Tanggal:</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-medium outline-none focus:border-rose-500"
              />
              <span className="text-xs text-zinc-400">s/d</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-medium outline-none focus:border-rose-500"
              />
            </div>
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              📅 {activeDateRange.label}
            </span>
          </div>
        )}
      </div>

      {/* Summary Card (Matches Screenshot 4) */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200 dark:border-zinc-800/80 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          {/* Left: Total Plafon */}
          <div className="space-y-2 flex-1">
            <div className="text-[11px] font-bold tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
              TOTAL PLAFON ANGGARAN ({periodDisplayLabel.toUpperCase()})
            </div>
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
              {formatRupiah(totalPlafon)}
            </div>

            {/* Orange/Red Progress Bar matching Screenshot 4 */}
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden mt-3 max-w-md">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-red-500 to-rose-500"
                style={{ width: `${Math.min(100, totalPct)}%` }}
              />
            </div>

            <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 pt-1">
              Sisa Plafon Anggaran:{' '}
              <strong className={totalRemaining < 0 ? 'text-rose-500' : 'text-zinc-800 dark:text-zinc-200'}>
                {totalRemaining < 0 ? `Defisit ${formatRupiah(Math.abs(totalRemaining))}` : formatRupiah(totalRemaining)}
              </strong>
            </div>
          </div>

          {/* Right: Terpakai & Mini Progress */}
          <div className="text-left md:text-right space-y-1.5 shrink-0">
            <div className="text-[11px] font-bold tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
              TERPAKAI ({totalPct}%)
            </div>
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-rose-500 dark:text-rose-400">
              {formatRupiah(totalSpent)}
            </div>

            <div className="flex items-center md:justify-end gap-2 pt-1">
              <div className="w-24 bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-rose-500"
                  style={{ width: `${Math.min(100, totalPct)}%` }}
                />
              </div>
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{totalPct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
        <h2 className="text-base font-bold text-zinc-900 dark:text-white">
          Anggaran per Kategori ({categoryStats.length} Kategori Dikonfigurasi)
        </h2>
        <span className="text-xs text-zinc-400">
          Periode: <strong className="text-zinc-700 dark:text-zinc-300">{periodDisplayLabel}</strong> •{' '}
          <strong className="text-zinc-700 dark:text-zinc-300">{activeWalletLabel}</strong>
        </span>
      </div>

      {/* Category Budgets Grid */}
      {categoryStats.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-3xl bg-white dark:bg-[#0c0d10] border border-dashed border-zinc-200 dark:border-zinc-800">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-3 text-2xl">
            🎯
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-1">
            Belum Ada Anggaran yang Ditetapkan
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mb-4">
            Anda memulai dari plafon anggaran Rp0. Klik tombol di bawah untuk menentukan target batas belanja kategori Anda.
          </p>
          <button
            onClick={handleOpenAddBudget}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold text-xs transition-all shadow-lg shadow-rose-500/20"
          >
            <Plus className="w-4 h-4" />
            + Set Budget Baru
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {categoryStats.map((cat) => {
            return (
              <div
                key={cat.id}
                className={`p-5 rounded-3xl bg-white dark:bg-[#0c0d10] border shadow-sm flex flex-col justify-between transition-all group ${
                  cat.isOver100
                    ? 'border-rose-500/50 ring-2 ring-rose-500/20'
                    : cat.isOver80
                    ? 'border-amber-500/50 ring-2 ring-amber-500/20'
                    : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div>
                  {/* Top: Category & Badge */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl p-2 rounded-2xl bg-zinc-100 dark:bg-zinc-900">{cat.emoji}</span>
                      <div>
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white">{cat.name}</h3>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                          {periodFilter === 'today'
                            ? 'HARIAN'
                            : periodFilter === '7days'
                            ? '7 HARI'
                            : periodFilter === 'custom'
                            ? 'CUSTOM KALENDER'
                            : 'BULANAN (30 HARI)'}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {cat.isOver100 ? (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/30">
                          Over Budget
                        </span>
                      ) : cat.isOver80 ? (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30">
                          Peringatan (80%+)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Aman
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Plafon and Percentage */}
                  <div className="flex items-center justify-between text-xs mt-3">
                    <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                      Plafon: <strong className="text-zinc-800 dark:text-zinc-200">{formatRupiah(cat.budgetTarget)}</strong>
                    </span>
                    <span className={`font-bold ${cat.isOver100 ? 'text-rose-500' : 'text-zinc-600 dark:text-zinc-400'}`}>
                      {cat.pct}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        cat.isOver100 ? 'bg-rose-500' : cat.isOver80 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, cat.pct)}%` }}
                    />
                  </div>

                  {/* Terpakai Row */}
                  <div className="flex items-center justify-between text-xs mt-3">
                    <span className="text-zinc-400">Terpakai:</span>
                    <span className="font-bold text-zinc-900 dark:text-white">
                      {formatRupiah(cat.spent)}
                    </span>
                  </div>
                </div>

                {/* Bottom: Sisa Alokasi + Edit Button */}
                <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[11px] text-zinc-400">Sisa Alokasi: </span>
                    <strong className={cat.remaining < 0 ? 'text-rose-500' : 'text-zinc-800 dark:text-zinc-200'}>
                      {cat.remaining < 0 ? `Defisit ${formatRupiah(Math.abs(cat.remaining))}` : formatRupiah(cat.remaining)}
                    </strong>
                  </div>

                  <button
                    onClick={() => handleOpenEdit(cat)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    title="Ubah batas anggaran"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Budget Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0e0f13] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white mb-2">
              Atur Budget Bulanan: {editingCategory.emoji} {editingCategory.name}
            </h2>
            <p className="text-xs text-zinc-400 mb-4">
              Batas anggaran bulanan standar ini akan otomatis dihitung ulang proporsional saat Anda memilih filter Harian, 7 Hari, atau Custom Kalender.
            </p>

            <form onSubmit={handleSaveBudget} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Batas Bulanan Nominal (Rp)
                </label>
                <input
                  type="number"
                  value={editBudgetInput}
                  onChange={(e) => setEditBudgetInput(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-bold outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 text-xs rounded-xl text-zinc-500 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold transition-all shadow-md shadow-rose-500/20"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Budget Modal */}
      {isAddBudgetOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0e0f13] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                + Tambah / Atur Budget Kategori
              </h2>
              <button
                onClick={() => setIsAddBudgetOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBudgetSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Pilih Kategori Pengeluaran
                </label>
                <select
                  value={selectedCatId}
                  onChange={(e) => setSelectedCatId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-medium outline-none focus:border-rose-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Batas Bulanan Standar (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-zinc-400">Rp</span>
                  <input
                    type="number"
                    required
                    placeholder="Contoh: 1500000"
                    value={newBudgetAmount}
                    onChange={(e) => setNewBudgetAmount(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 text-sm rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-bold outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddBudgetOpen(false)}
                  className="px-4 py-2 text-xs rounded-xl text-zinc-500 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold shadow-md shadow-rose-500/20"
                >
                  Terapkan Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Starter Limit Modal */}
      {isLimitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0e0f13] border border-rose-500/30 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
              Batas 5 Budget Starter Tercapai!
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
              Pengguna paket <strong>Starter</strong> dibatasi maksimal 5 budget kategori. Upgrade ke <strong>TataDana Pro</strong> untuk membuat <strong>Unlimited Budget</strong> harian, mingguan, dan bulanan.
            </p>

            {upgradeSuccess && (
              <div className="mt-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-left text-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Pengajuan PRO {upgradeSuccess.isExisting ? 'Sudah Tercatat' : 'Berhasil Dibuat'}</span>
                </div>
                <p className="text-zinc-600 dark:text-zinc-400">
                  ID Pengajuan: <strong className="font-mono text-zinc-900 dark:text-white">{upgradeSuccess.orderId}</strong>
                </p>
                <p className="text-zinc-500">
                  Status: <span className="font-semibold text-amber-500 uppercase">Menunggu Pembayaran</span>. Akun akan aktif sebagai PRO setelah verifikasi oleh Admin.
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

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setIsLimitModalOpen(false);
                  setUpgradeSuccess(null);
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Tutup
              </button>
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
                      setToastMessage(
                        res.isExisting
                          ? `✓ Pengajuan PRO (${res.orderId}) dibuka kembali di WhatsApp!`
                          : `✓ Pengajuan PRO (${res.orderId}) berhasil dicatat & WhatsApp dibuka!`
                      );
                    },
                    onError: (err) => {
                      alert(err);
                    },
                  });
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-rose-500/20 flex items-center justify-center gap-1.5"
              >
                {isUpgrading ? (
                  <span>Menghubungkan WhatsApp...</span>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Upgrade PRO (Rp99.000 sekali bayar)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
