'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Wallet,
  Plus,
  CheckCircle2,
  Star,
  Banknote,
  Smartphone,
  Building,
  Check,
  Zap,
  Lock,
  Trash2,
  Edit2,
  X,
  CreditCard,
  TrendingUp,
} from 'lucide-react';
import { db } from '@/lib/supabase/mock-db';
import { formatRupiah } from '@/lib/utils';
import { Wallet as WalletType, WalletType as CategoryWalletType } from '@/types/database';
import { useActiveUser } from '@/lib/auth/client-session';
import { executeUpgradePro } from '@/lib/payment/upgrade-client';

export default function WalletPage() {
  const { user: currentUser } = useActiveUser();
  const [wallets, setWallets] = useState(() => db.getWallets(currentUser.id));

  useEffect(() => {
    setWallets(db.getWallets(currentUser.id));
  }, [currentUser.id]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState<{ orderId: string; waLink: string; isExisting: boolean } | null>(null);
  const [editingWallet, setEditingWallet] = useState<WalletType | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryWalletType>('Bank');
  const [balance, setBalance] = useState('');
  const [icon, setIcon] = useState('🏦');
  const [color, setColor] = useState('#3B82F6');
  const [isDefault, setIsDefault] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const totalBalance = useMemo(() => wallets.reduce((s, w) => s + w.balance, 0), [wallets]);

  // Real-time sync dengan server (3s poll + focus listener)
  useEffect(() => {
    const fetchWallets = () => {
      fetch(`/api/transactions?userId=${currentUser.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.success && Array.isArray(data.wallets)) {
            setWallets(data.wallets);
          }
        })
        .catch(() => {});
    };

    fetchWallets();
    const intervalId = setInterval(fetchWallets, 3000);
    const handleFocus = () => fetchWallets();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser.id]);

  // Quick Preset Templates
  const presets = [
    { name: 'BCA Prioritas', type: 'Bank' as const, icon: '🏦', color: '#3B82F6' },
    { name: 'Mandiri Livin', type: 'Bank' as const, icon: '🏦', color: '#0284C7' },
    { name: 'GoPay', type: 'E-Wallet' as const, icon: '📱', color: '#06B6D4' },
    { name: 'OVO Premier', type: 'E-Wallet' as const, icon: '📱', color: '#8B5CF6' },
    { name: 'DANA Dompet', type: 'E-Wallet' as const, icon: '📱', color: '#3B82F6' },
    { name: 'Kas Tunai Dompet', type: 'Cash' as const, icon: '💵', color: '#10B981' },
    { name: 'Bibit Investasi', type: 'Investasi' as const, icon: '📈', color: '#10B981' },
  ];

  const colorPalette = ['#059669', '#0D9488', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#10B981', '#64748B'];
  const iconOptions = ['💵', '🏦', '📱', '💳', '📈', '🪙', '💼', '🐖'];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenCreateModal = () => {
    // Check Starter plan limitation (max 3 wallets)
    if (currentUser.plan === 'starter' && wallets.length >= 3) {
      setIsUpgradeModalOpen(true);
      return;
    }

    setEditingWallet(null);
    setName('');
    setType('Bank');
    setBalance('');
    setIcon('🏦');
    setColor('#3B82F6');
    setIsDefault(wallets.length === 0);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (wallet: WalletType) => {
    setEditingWallet(wallet);
    setName(wallet.name);
    setType(wallet.type || 'Bank');
    setBalance(wallet.balance.toString());
    setIcon(wallet.icon || '👛');
    setColor(wallet.color || '#059669');
    setIsDefault(wallet.is_default);
    setIsModalOpen(true);
  };

  const handleSetDefault = (walletId: string) => {
    wallets.forEach((w) => {
      w.is_default = w.id === walletId;
    });
    setWallets([...wallets]);
    showToast('✓ Dompet utama untuk Telegram bot berhasil dialihkan!');

    fetch('/api/wallets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'setDefault',
        walletId,
        userId: currentUser.id,
      }),
    }).catch(() => {});
  };

  const handleDeleteWallet = (wallet: WalletType) => {
    if (wallets.length <= 1) {
      alert('Kamu harus memiliki setidaknya 1 dompet aktif.');
      return;
    }
    if (wallet.is_default) {
      alert('Dompet default tidak dapat dihapus. Silakan alihkan default ke dompet lain terlebih dahulu.');
      return;
    }
    if (confirm(`Hapus dompet "${wallet.name}"? Transaksi yang terkait akan tetap tersimpan.`)) {
      const updated = wallets.filter((w) => w.id !== wallet.id);
      db.wallets = db.wallets.filter((w) => w.id !== wallet.id);
      setWallets(updated);
      showToast('✓ Dompet berhasil dihapus.');

      fetch(`/api/wallets?id=${wallet.id}&userId=${currentUser.id}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
  };

  const handleSubmitWallet = (e: React.FormEvent) => {
    e.preventDefault();
    const balanceNum = parseFloat(balance.replace(/[^0-9]/g, '')) || 0;

    if (editingWallet) {
      // Update existing
      editingWallet.name = name;
      editingWallet.type = type;
      editingWallet.balance = balanceNum;
      editingWallet.icon = icon;
      editingWallet.color = color;
      if (isDefault) {
        wallets.forEach((w) => {
          w.is_default = w.id === editingWallet.id;
        });
      }
      setWallets([...wallets]);
      showToast(`✓ Dompet "${name}" berhasil diperbarui!`);

      fetch('/api/wallets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: editingWallet.id,
          userId: currentUser.id,
          name,
          type,
          balance: balanceNum,
          icon,
          color,
          is_default: isDefault,
        }),
      }).catch(() => {});
    } else {
      // Create new
      const newWallet: WalletType = {
        id: `wallet-${Date.now()}`,
        user_id: currentUser.id,
        name,
        type,
        balance: balanceNum,
        icon,
        color,
        is_default: isDefault,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (isDefault) {
        wallets.forEach((w) => {
          w.is_default = false;
        });
      }

      db.wallets.push(newWallet);
      setWallets([...db.getWallets(currentUser.id)]);
      showToast(`✓ Dompet "${name}" berhasil dibuat!`);

      fetch('/api/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          name,
          type,
          balance: balanceNum,
          icon,
          color,
          is_default: isDefault,
        }),
      }).catch(() => {});
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-xl shadow-emerald-600/20 text-sm font-semibold animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-5 h-5" />
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
              <span>👛 Multi-Dompet & Saldo</span>
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {currentUser.plan === 'pro' ? 'Unlimited Dompet' : 'Starter: Max 3 Dompet'}
            </span>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Kelola rekening bank, e-wallet, dan uang tunai. Tentukan 1 dompet default untuk pencatatan instan via Telegram Bot.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          + Tambah Dompet Baru
        </button>
      </div>

      {/* Total Balance Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-tr from-emerald-700 via-teal-600 to-cyan-600 text-white shadow-xl shadow-teal-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-100/90 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Total Saldo Terkumpul
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-1">{formatRupiah(totalBalance)}</h2>
          <p className="text-xs text-emerald-100/80 mt-2">
            Tersebar di {wallets.length} dompet aktif ({wallets.filter((w) => w.type === 'Bank').length} Bank,{' '}
            {wallets.filter((w) => w.type === 'E-Wallet').length} E-Wallet,{' '}
            {wallets.filter((w) => w.type === 'Cash').length} Tunai)
          </p>
        </div>

        <div className="bg-black/20 backdrop-blur-md border border-white/20 p-4 rounded-2xl text-xs text-emerald-100 sm:max-w-xs">
          <p className="font-semibold text-white">Default Bot Telegram:</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-bold text-white">
            <span>{wallets.find((w) => w.is_default)?.icon || '👛'}</span>
            <span>{wallets.find((w) => w.is_default)?.name || 'Belum dipilih'}</span>
          </p>
        </div>
      </div>

      {/* Wallets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {wallets.map((wallet) => (
          <div
            key={wallet.id}
            className={`p-6 rounded-3xl bg-white dark:bg-[#0c0d10] border transition-all relative overflow-hidden flex flex-col justify-between group ${
              wallet.is_default
                ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg shadow-emerald-500/5'
                : 'border-zinc-200/80 dark:border-zinc-800 hover:border-emerald-500/40'
            }`}
          >
            {/* Top Bar with Icon & Actions */}
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm"
                    style={{ backgroundColor: `${wallet.color || '#059669'}15`, color: wallet.color || '#059669' }}
                  >
                    {wallet.icon || '👛'}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-zinc-900 dark:text-white">{wallet.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded uppercase">
                        {wallet.type || 'Bank'}
                      </span>
                      {wallet.is_default && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          <Star className="w-2.5 h-2.5 fill-emerald-500" /> Default Telegram
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Edit & Delete */}
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleOpenEditModal(wallet)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    title="Edit dompet"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {!wallet.is_default && (
                    <button
                      onClick={() => handleDeleteWallet(wallet)}
                      className="p-1.5 text-zinc-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10"
                      title="Hapus dompet"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Balance */}
              <div className="my-5">
                <span className="text-xs text-zinc-400">Saldo Tersedia:</span>
                <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
                  {formatRupiah(wallet.balance)}
                </p>
              </div>
            </div>

            {/* Bottom: Set Default Status */}
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
              {wallet.is_default ? (
                <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Dompet Aktif Telegram Bot
                </span>
              ) : (
                <button
                  onClick={() => handleSetDefault(wallet.id)}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 hover:underline flex items-center gap-1"
                >
                  Jadikan Default Bot →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Wallet Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0e0f13] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                {editingWallet ? 'Edit Dompet' : 'Tambah Dompet Baru'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitWallet} className="mt-4 space-y-4 text-xs">
              {/* Presets (Only when creating new) */}
              {!editingWallet && (
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Pilih Template Cepat:
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {presets.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setName(p.name);
                          setType(p.type);
                          setIcon(p.icon);
                          setColor(p.color);
                        }}
                        className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/40 bg-zinc-50 dark:bg-zinc-900 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 whitespace-nowrap transition-colors"
                      >
                        {p.icon} {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Name & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Nama Dompet
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: BCA Prioritas"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-medium outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Jenis Dompet
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as CategoryWalletType)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-medium outline-none focus:border-emerald-500"
                  >
                    <option value="Bank">🏦 Rekening Bank</option>
                    <option value="E-Wallet">📱 E-Wallet</option>
                    <option value="Cash">💵 Kas Tunai</option>
                    <option value="Investasi">📈 Investasi / Tabungan</option>
                  </select>
                </div>
              </div>

              {/* Balance */}
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Saldo Awal (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-zinc-400">Rp</span>
                  <input
                    type="number"
                    required
                    placeholder="Contoh: 1500000"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-bold text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Icon & Color */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Pilih Ikon Emoji
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {iconOptions.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setIcon(ic)}
                        className={`text-lg p-1.5 rounded-xl border ${
                          icon === ic
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900'
                        }`}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Warna Aksen
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {colorPalette.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-7 h-7 rounded-full border-2 transition-transform ${
                          color === c ? 'scale-110 border-white ring-2 ring-emerald-500' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Checkbox: Make Default Telegram */}
              <label className="flex items-center gap-2.5 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                />
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Jadikan dompet default untuk pencatatan otomatis bot Telegram
                </span>
              </label>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-zinc-500 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-md shadow-emerald-500/20"
                >
                  {editingWallet ? 'Simpan Perubahan' : 'Buat Dompet Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Starter Limit Modal */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0e0f13] border border-emerald-500/30 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
              Batas 3 Dompet Tercapai!
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
              Pengguna paket <strong>Starter</strong> dapat mengelola maksimal 3 dompet aktif. Upgrade ke <strong>TataDana Pro</strong> untuk menikmati <strong>Unlimited Dompet</strong> tanpa batas.
            </p>

            <div className="my-6 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-left text-xs space-y-1.5">
              <p className="font-bold text-zinc-900 dark:text-white">Fitur Paket Pro:</p>
              <p className="text-zinc-600 dark:text-zinc-400">✓ Unlimited Rekening Bank, E-Wallet & Kas</p>
              <p className="text-zinc-600 dark:text-zinc-400">✓ AI Vision Scan Struk Belanja Otomatis</p>
              <p className="text-zinc-600 dark:text-zinc-400">✓ Tata AI Financial Advisor 24/7</p>
              <p className="text-zinc-600 dark:text-zinc-400">✓ Export PDF & Excel Tanpa Batas</p>
            </div>

            {upgradeSuccess && (
              <div className="mb-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-left text-xs space-y-2">
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

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsUpgradeModalOpen(false);
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
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5"
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
