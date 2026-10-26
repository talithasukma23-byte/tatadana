'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  Users,
  Cpu,
  Receipt,
  FileSpreadsheet,
  Check,
  X,
  Eye,
  Key,
  Layers,
  ArrowLeft,
  AlertCircle,
  ExternalLink,
  Lock,
  Plus,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  LogIn,
} from 'lucide-react';
import { db } from '@/lib/supabase/mock-db';
import { formatRupiah, formatWIB, safeFetchJson } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserProfile, AIProviderConfig, SubscriptionPayment } from '@/types/database';
import { useActiveUser } from '@/lib/auth/client-session';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useActiveUser();

  // Bersihkan mode impersonasi otomatis jika masuk ke Admin Portal
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (sessionStorage.getItem('tatadana_impersonated_user')) {
        sessionStorage.removeItem('tatadana_impersonated_user');
        sessionStorage.removeItem('tatadana_impersonated_name');
      }
    }
  }, []);

  const isSuperOrAdmin =
    currentUser?.role === 'superadmin' ||
    currentUser?.role === 'admin' ||
    (typeof window !== 'undefined' &&
      (localStorage.getItem('tatadana_user_role') === 'superadmin' ||
        localStorage.getItem('tatadana_user_role') === 'admin'));

  // Proteksi rute client-side: Jika role bukan ADMIN, redirect segera ke /dashboard
  useEffect(() => {
    if (authLoading) return;
    if (!isSuperOrAdmin) {
      router.replace('/dashboard');
    }
  }, [isSuperOrAdmin, authLoading, router]);

  const [activeTab, setActiveTab] = useState<'payments' | 'tx_approvals' | 'users' | 'providers' | 'logs' | 'audit'>('payments');
  const [providers, setProviders] = useState<AIProviderConfig[]>(() => db.aiProviders);
  const [users, setUsers] = useState<UserProfile[]>(() => db.profiles);
  const [payments, setPayments] = useState<SubscriptionPayment[]>(() => db.payments);
  const [paymentSearch, setPaymentSearch] = useState('');

  const filteredPayments = useMemo(() => {
    if (!paymentSearch.trim()) return payments;
    const q = paymentSearch.toLowerCase().trim();
    return payments.filter(
      (p) =>
        p.order_id.toLowerCase().includes(q) ||
        (p.user_name || '').toLowerCase().includes(q) ||
        p.user_id.toLowerCase().includes(q) ||
        (p.user_email || '').toLowerCase().includes(q)
    );
  }, [payments, paymentSearch]);
  const [adminTransactions, setAdminTransactions] = useState<any[]>(() => {
    return db.transactions.map((t) => ({
      ...t,
      wallet: db.wallets.find((w) => w.id === t.wallet_id),
      category: db.categories.find((c) => c.id === t.category_id),
      user: db.getUser(t.user_id),
    }));
  });
  const [selectedUserTrx, setSelectedUserTrx] = useState<{ user: UserProfile; txs: any[] } | null>(null);
  const [previewProofPayment, setPreviewProofPayment] = useState<SubscriptionPayment | null>(null);
  const [rejectingPayment, setRejectingPayment] = useState<SubscriptionPayment | null>(null);
  const [rejectReason, setRejectReason] = useState('Bukti transfer tidak valid atau dana belum masuk.');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync admin transactions, users, and payment submissions from server
  useEffect(() => {
    if (!isSuperOrAdmin) return;

    const fetchAdminData = () => {
      fetch('/api/admin?action=payments')
        .then((res) => safeFetchJson(res))
        .then((data) => {
          if (data && Array.isArray(data.payments)) {
            setPayments(data.payments);
          }
        })
        .catch(() => {});

      fetch('/api/admin?action=transactions')
        .then((res) => safeFetchJson(res))
        .then((data) => {
          if (data && Array.isArray(data.transactions)) {
            setAdminTransactions(data.transactions);
          }
        })
        .catch(() => {});

      fetch('/api/admin?action=users')
        .then((res) => safeFetchJson(res))
        .then((data) => {
          if (data && Array.isArray(data.users)) {
            setUsers(data.users);
          }
        })
        .catch(() => {});
    };

    fetchAdminData();
    const interval = setInterval(fetchAdminData, 3000);
    return () => clearInterval(interval);
  }, [isSuperOrAdmin]);

  // Sync payments immediately when switching to Payment Approvals tab
  useEffect(() => {
    if (activeTab === 'payments' && isSuperOrAdmin) {
      fetch('/api/admin?action=payments')
        .then((res) => safeFetchJson(res))
        .then((data) => {
          if (data && Array.isArray(data.payments)) {
            setPayments(data.payments);
          }
        })
        .catch(() => {});
    }
  }, [activeTab, isSuperOrAdmin]);

  const handleApproveTransaction = async (txId: string) => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_transaction',
          transactionId: txId,
          adminId: currentUser?.id || 'admin-owner-talitha',
        }),
      });
      const data = await safeFetchJson(res, { success: false, error: 'Respons server tidak valid' });
      if (data?.success && data?.transaction) {
        setAdminTransactions((prev) =>
          prev.map((t) => (t.id === txId ? { ...t, status: 'approved', approved_at: new Date().toISOString() } : t))
        );
        showToast(`✓ Transaksi ${txId} (${formatRupiah(data.transaction.amount)}) disetujui! Saldo dompet berhasil dimutasi.`);
      } else {
        showToast(`Gagal: ${data?.error || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleRejectTransaction = async (txId: string, reason?: string) => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject_transaction',
          transactionId: txId,
          reason: reason || 'Ditolak oleh admin',
          adminId: currentUser?.id || 'admin-owner-talitha',
        }),
      });
      const data = await safeFetchJson(res, { success: false, error: 'Respons server tidak valid' });
      if (data?.success) {
        setAdminTransactions((prev) =>
          prev.map((t) => (t.id === txId ? { ...t, status: 'rejected' } : t))
        );
        showToast(`✕ Transaksi ${txId} berhasil ditolak.`);
      } else {
        showToast(`Gagal: ${data?.error || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleApproveUser = async (userId: string) => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_user',
          targetUserId: userId,
          adminId: 'admin-owner-talitha',
        }),
      });
      const data = await safeFetchJson(res, { success: false, error: 'Respons server tidak valid' });
      if (data?.success && data?.user) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, account_status: 'approved' } : u))
        );
        showToast(`✓ Akun ${data.user.full_name} (${data.user.email}) disetujui! Pengguna kini dapat login.`);
      } else {
        showToast(`Gagal: ${data?.error || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleRejectUser = async (userId: string) => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject_user',
          targetUserId: userId,
          reason: 'Pendaftaran ditolak oleh Admin Utama.',
          adminId: 'admin-owner-talitha',
        }),
      });
      const data = await safeFetchJson(res, { success: false, error: 'Respons server tidak valid' });
      if (data?.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, account_status: 'rejected' } : u))
        );
        showToast(`✕ Pendaftaran akun berhasil ditolak.`);
      } else {
        showToast(`Gagal: ${data?.error || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  // New Provider Modal State
  const [isAddProviderOpen, setIsAddProviderOpen] = useState(false);
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderModel, setNewProviderModel] = useState('');
  const [newProviderKey, setNewProviderKey] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Toggle Provider Active
  const toggleProviderActive = (providerId: string) => {
    const p = providers.find((item) => item.id === providerId);
    if (p) {
      p.is_active = !p.is_active;
      setProviders([...providers]);
      showToast(`Provider ${p.display_name} berhasil di-${p.is_active ? 'aktifkan' : 'nonaktifkan'}`);
    }
  };

  // Change Provider Mode (Single vs Parallel Failover)
  const toggleProviderMode = (providerId: string) => {
    const p = providers.find((item) => item.id === providerId);
    if (p) {
      p.mode = p.mode === 'single' ? 'parallel_failover' : 'single';
      setProviders([...providers]);
      showToast(`Mode provider ${p.display_name} diubah ke ${p.mode === 'parallel_failover' ? 'Paralel Failover' : 'Single'}`);
    }
  };

  // Add Custom Provider
  const handleAddProviderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProviderName || !newProviderModel) return;

    const newP: AIProviderConfig = {
      id: `prov-${Date.now()}`,
      name: 'custom',
      display_name: newProviderName,
      model_name: newProviderModel,
      api_key: newProviderKey,
      is_active: true,
      mode: 'single',
      priority: providers.length + 1,
    };

    providers.push(newP);
    setProviders([...providers]);
    setIsAddProviderOpen(false);
    setNewProviderName('');
    setNewProviderModel('');
    setNewProviderKey('');
    showToast(`✓ Provider AI "${newProviderName}" berhasil ditambahkan.`);
  };

  // Approve Payment (Upgrades user to Pro immediately with persistence)
  const handleApprovePayment = async (orderId: string) => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_payment',
          orderId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(`❌ Gagal menyetujui pembayaran: ${data.error || 'Terjadi kesalahan'}`);
        return;
      }

      // Sinkronkan state lokal secara responsif
      setPayments((prev) =>
        prev.map((p) =>
          p.order_id === orderId
            ? { ...p, status: 'settlement', approved_by: currentUser.id, approved_at: new Date().toISOString() }
            : p
        )
      );
      setPreviewProofPayment(null);
      showToast(`🎉 Pembayaran ${orderId} disetujui! Pengguna otomatis menjadi PRO.`);

      // Muat ulang daftar users dan payments dari server untuk menjamin konsistensi
      fetch('/api/admin?action=payments')
        .then((res) => safeFetchJson(res))
        .then((d) => {
          if (d && Array.isArray(d.payments)) setPayments(d.payments);
        })
        .catch(() => {});
      fetch('/api/admin?action=users')
        .then((res) => safeFetchJson(res))
        .then((d) => {
          if (d && Array.isArray(d.users)) setUsers(d.users);
        })
        .catch(() => {});
    } catch (err: any) {
      showToast(`❌ Kesalahan jaringan: ${err.message}`);
    }
  };

  // Reject Payment with Reason and persistence
  const handleConfirmReject = async () => {
    if (!rejectingPayment) return;
    const orderId = rejectingPayment.order_id;

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject_payment',
          orderId,
          reason: rejectReason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(`❌ Gagal menolak pembayaran: ${data.error || 'Terjadi kesalahan'}`);
        return;
      }

      // Sinkronkan state lokal secara responsif
      setPayments((prev) =>
        prev.map((p) =>
          p.order_id === orderId
            ? { ...p, status: 'rejected', rejection_reason: rejectReason }
            : p
        )
      );
      setRejectingPayment(null);
      setPreviewProofPayment(null);
      showToast(`❌ Pembayaran ${orderId} ditolak.`);

      // Muat ulang daftar payments dari server
      fetch('/api/admin?action=payments')
        .then((res) => safeFetchJson(res))
        .then((d) => {
          if (d && Array.isArray(d.payments)) setPayments(d.payments);
        })
        .catch(() => {});
    } catch (err: any) {
      showToast(`❌ Kesalahan jaringan: ${err.message}`);
    }
  };

  // Impersonate User with Audit Log
  const handleImpersonateUser = (targetUser: UserProfile) => {
    db.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      admin_id: currentUser?.id || 'admin-owner-talitha',
      admin_name: currentUser?.full_name || 'Talitha Ayu Sukma (Owner & Superadmin)',
      target_user_id: targetUser.id,
      target_user_name: targetUser.full_name,
      action: 'impersonate_user',
      notes: `Superadmin masuk ke sesi impersonasi akun ${targetUser.full_name} (${targetUser.email}) untuk troubleshooting.`,
      created_at: new Date().toISOString(),
    });

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('tatadana_impersonated_user', targetUser.id);
      sessionStorage.setItem('tatadana_impersonated_name', targetUser.full_name);
    }

    router.push('/dashboard');
  };

  // View User Transactions with Audit Logging
  const handleInspectUserTransactions = (userObj: UserProfile) => {
    db.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      admin_id: currentUser?.id || 'admin-owner-talitha',
      admin_name: currentUser?.full_name || 'Talitha Ayu Sukma (Owner & Superadmin)',
      target_user_id: userObj.id,
      target_user_name: userObj.full_name,
      action: 'view_transactions',
      notes: `Superadmin membuka riwayat transaksi lengkap milik pengguna ${userObj.full_name}.`,
      created_at: new Date().toISOString(),
    });

    const txs = db.getTransactions(userObj.id);
    setSelectedUserTrx({ user: userObj, txs });
  };

  const pendingPaymentsCount = payments.filter((p) => p.status === 'pending').length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#070809] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-zinc-400">Memverifikasi otorisasi Admin Utama...</p>
        </div>
      </div>
    );
  }

  if (!isSuperOrAdmin) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#070809] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#0c0d10] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Akses Ditolak</h2>
            <p className="text-xs text-zinc-500 mt-1">Halaman Admin Portal hanya dapat diakses oleh Admin Utama.</p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#070809] text-zinc-900 dark:text-zinc-100 font-sans p-4 sm:p-8">
      {/* Admin Header */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-white transition-colors"
            title="Kembali ke Dashboard User"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/30">
                Superadmin Center
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">
                TataDana Control Hub
              </h1>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Portal internal manajemen persetujuan pembayaran manual, multi-provider AI, audit akses data, & impersonasi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5"
          >
            <span>Tampilan User</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {toastMessage && (
        <div className="max-w-7xl mx-auto mt-4 p-4 rounded-2xl bg-zinc-900 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4" />
          {toastMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto mt-6 flex border-b border-zinc-200 dark:border-zinc-800 space-x-6 text-xs font-semibold overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('payments')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'payments' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Payment Approvals</span>
          {pendingPaymentsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-zinc-900 font-extrabold animate-pulse">
              {pendingPaymentsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('tx_approvals')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'tx_approvals' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Monitoring Mutasi & Transaksi</span>
          {adminTransactions.filter((t) => t.status === 'pending').length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-zinc-900 font-extrabold animate-pulse">
              {adminTransactions.filter((t) => t.status === 'pending').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'users' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Pengguna ({users.length})</span>
          {users.filter((u) => u.account_status === 'pending').length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-zinc-900 font-extrabold animate-pulse">
              {users.filter((u) => u.account_status === 'pending').length} Pending
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('providers')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'providers' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Cpu className="w-4 h-4" /> Multi-Provider AI ({providers.length})
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'logs' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" /> Log Panggilan AI ({db.aiLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'audit' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Lock className="w-4 h-4" /> Audit Log Privasi ({db.auditLogs.length})
        </button>
      </div>

      <div className="max-w-7xl mx-auto mt-6">
        {/* TAB 1: PAYMENT APPROVALS (PRIMARY FEATURE) */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Admin dapat meninjau bukti transfer manual pengguna di sini. Saat disetujui (Approve), status paket user otomatis berubah menjadi <strong>PRO</strong>.
                </span>
              </div>
              <span className="font-bold">{pendingPaymentsCount} Permohonan Menunggu</span>
            </div>

            <div className="rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                    Daftar Permohonan Pembayaran &amp; Upgrade Pro
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Integrasi Midtrans otomatis &amp; Transfer Manual Bank BCA / Mandiri
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    placeholder="Cari ID Pengajuan / Nama / ID Akun..."
                    value={paymentSearch}
                    onChange={(e) => setPaymentSearch(e.target.value)}
                    className="w-full pl-3 pr-8 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:border-emerald-500"
                  />
                  {paymentSearch && (
                    <button
                      onClick={() => setPaymentSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100/70 dark:bg-zinc-900/80 text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="py-3 px-4">Order ID &amp; Waktu</th>
                      <th className="py-3 px-4">Pengguna</th>
                      <th className="py-3 px-4">Target Paket</th>
                      <th className="py-3 px-4">Nominal</th>
                      <th className="py-3 px-4">Metode &amp; Bukti</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Aksi Tindakan Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-zinc-400 text-xs">
                          {paymentSearch
                            ? `Tidak ada pengajuan pembayaran yang sesuai dengan "${paymentSearch}".`
                            : 'Belum ada pengajuan pembayaran upgrade PRO.'}
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40">
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-zinc-900 dark:text-white block">{p.order_id}</span>
                          <span className="text-[10px] text-zinc-400">{formatWIB(p.created_at, { weekday: undefined })}</span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                          {p.user_name}
                          <span className="block text-[11px] font-normal text-zinc-400">ID: {p.user_id}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            ★ {p.plan}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-zinc-900 dark:text-zinc-100">
                          {formatRupiah(p.amount)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="capitalize text-zinc-600 dark:text-zinc-300">
                              {p.payment_type.replace('_', ' ')}
                            </span>
                            {p.proof_url && (
                              <button
                                onClick={() => setPreviewProofPayment(p)}
                                className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 text-[10px] font-semibold flex items-center gap-1"
                              >
                                <ImageIcon className="w-3 h-3" />
                                Bukti
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              p.status === 'settlement'
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : p.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            }`}
                          >
                            {p.status === 'settlement' ? 'Approved (Pro)' : p.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          {p.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleApprovePayment(p.order_id)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm transition-all"
                              >
                                Approve Pro
                              </button>
                              <button
                                onClick={() => setRejectingPayment(p)}
                                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shadow-sm transition-all"
                              >
                                Reject
                              </button>
                            </>
                          ) : p.status === 'settlement' ? (
                            <span className="text-emerald-500 font-semibold text-xs flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Aktif
                            </span>
                          ) : (
                            <span className="text-rose-500 font-semibold text-xs flex items-center justify-end gap-1">
                              <XCircle className="w-3.5 h-3.5" /> Ditolak
                            </span>
                          )}
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1.5: TATA AI TRANSACTION APPROVALS */}
        {activeTab === 'tx_approvals' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>
                  Seluruh transaksi diproses dan dimutasi secara <strong>otomatis & seketika</strong> tanpa kewajiban approval admin. Halaman ini berfungsi sebagai <strong>Audit & Monitoring Feed</strong> mutasi saldo pengguna secara real-time.
                </span>
              </div>
              <span className="font-bold shrink-0 ml-4">
                {adminTransactions.length} Total Transaksi
              </span>
            </div>

            <div className="rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                    Feed Monitoring Mutasi & Transaksi
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Audit real-time pencatatan otomatis, mutasi saldo dompet, kategori, dan kepatuhan transaksi
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100/70 dark:bg-zinc-900/80 text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="py-3 px-4">ID Transaksi & Waktu</th>
                      <th className="py-3 px-4">Pengguna</th>
                      <th className="py-3 px-4">Kategori & Catatan</th>
                      <th className="py-3 px-4">Dompet & Saldo Saat Ini</th>
                      <th className="py-3 px-4">Nominal</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Aksi Tindakan Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {adminTransactions
                      .slice()
                      .sort((a, b) => {
                        // Prioritaskan status pending di paling atas
                        if (a.status === 'pending' && b.status !== 'pending') return -1;
                        if (a.status !== 'pending' && b.status === 'pending') return 1;
                        return new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime();
                      })
                      .map((t) => {
                        const isIncome = t.type === 'income';
                        const isPending = t.status === 'pending';
                        const isRejected = t.status === 'rejected';

                        return (
                          <tr key={t.id} className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 ${isPending ? 'bg-amber-500/[0.03]' : ''}`}>
                            <td className="py-3.5 px-4">
                              <span className="font-mono font-bold text-zinc-900 dark:text-white block">{t.id}</span>
                              <span className="text-[10px] text-zinc-400">{formatWIB(t.transaction_date, { weekday: undefined })}</span>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                              {t.user?.full_name || 'Pengguna TataDana'}
                              <span className="block text-[11px] font-normal text-zinc-400">ID: {t.user_id}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {t.category?.emoji || '🏷️'} {t.notes || t.description || 'Transaksi'}
                              </div>
                              <span className="text-[10px] text-zinc-400 capitalize">
                                {t.category?.name || 'Kategori Umum'} • {isIncome ? 'Pemasukan' : 'Pengeluaran'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-semibold text-zinc-900 dark:text-zinc-200 block">
                                {t.wallet?.name || t.wallet_id}
                              </span>
                              <span className="text-[10px] text-zinc-400">
                                Saldo: {formatRupiah(t.wallet?.balance || 0)}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                              <span className={isIncome ? 'text-emerald-500' : 'text-zinc-900 dark:text-white'}>
                                {isIncome ? `+${formatRupiah(t.amount)}` : `-${formatRupiah(t.amount)}`}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  isPending
                                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                    : isRejected
                                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                    : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                }`}
                              >
                                {isPending ? '⏳ Menunggu Approval' : isRejected ? '❌ Ditolak' : '✓ Berhasil'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                              {isPending ? (
                                <>
                                  <button
                                    onClick={() => handleApproveTransaction(t.id)}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm transition-all"
                                  >
                                    ✓ Setujui & Mutasi Saldo
                                  </button>
                                  <button
                                    onClick={() => handleRejectTransaction(t.id)}
                                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shadow-sm transition-all"
                                  >
                                    Tolak
                                  </button>
                                </>
                              ) : isRejected ? (
                                <span className="text-rose-500 font-semibold text-xs inline-flex items-center gap-1">
                                  <XCircle className="w-3.5 h-3.5" /> Ditolak
                                </span>
                              ) : (
                                <span className="text-emerald-500 font-semibold text-xs inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Berhasil Dimutasi
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USERS LIST & IMPERSONATION */}
        {activeTab === 'users' && (
          <div className="rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Daftar Semua Pengguna TataDana</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Kelola akun, cek status link Telegram, dan impersonasi</p>
              </div>
              <button
                onClick={() => showToast('Ekspor data seluruh user ke CSV berhasil diunduh.')}
                className="px-3 py-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
              >
                Export Semua User (CSV)
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100/70 dark:bg-zinc-900/80 text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">Nama & Email</th>
                    <th className="py-3 px-4">Role & Status Akun</th>
                    <th className="py-3 px-4">Nomor HP</th>
                    <th className="py-3 px-4">Paket</th>
                    <th className="py-3 px-4">Status Telegram</th>
                    <th className="py-3 px-4">Trx Bulan Ini</th>
                    <th className="py-3 px-4 text-right">Aksi Superadmin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {users
                    .slice()
                    .sort((a, b) => {
                      if (a.account_status === 'pending' && b.account_status !== 'pending') return -1;
                      if (a.account_status !== 'pending' && b.account_status === 'pending') return 1;
                      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                    })
                    .map((u) => {
                      const trxCount = db.getMonthlyTransactionCount(u.id);
                      const isPending = u.account_status === 'pending';
                      const isRejected = u.account_status === 'rejected';

                      return (
                        <tr
                          key={u.id}
                          className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 ${
                            isPending ? 'bg-amber-500/[0.04]' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                            {u.full_name}
                            <span className="block text-[11px] font-normal text-zinc-400">{u.email}</span>
                            <span className="inline-flex items-center gap-1 text-[10px] mt-0.5">
                              {u.email_verified ? (
                                <span className="text-emerald-500 font-semibold">✓ Email Terverifikasi</span>
                              ) : (
                                <span className="text-amber-500 font-semibold">⚠️ Belum Verifikasi Email</span>
                              )}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                u.role === 'superadmin'
                                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                  : u.role === 'admin'
                                  ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                              }`}
                            >
                              {u.role === 'superadmin' ? '👑 Owner / Superadmin' : u.role === 'admin' ? '🛡️ Admin' : 'User'}
                            </span>
                            <span className="block mt-1 text-[10px] font-semibold">
                              {isPending ? (
                                <span className="text-amber-500 font-bold inline-flex items-center gap-1">
                                  ⏳ Menunggu Persetujuan
                                </span>
                              ) : isRejected ? (
                                <span className="text-rose-500 font-bold">✕ Ditolak</span>
                              ) : (
                                <span className="text-emerald-500 font-bold">✓ Aktif / Disetujui</span>
                              )}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-300">
                            <div className="flex items-center gap-1.5 font-medium">
                              <span>{u.phone_number || '-'}</span>
                              {u.phone_verified && (
                                <span className="text-emerald-500 font-bold" title="WhatsApp Terverifikasi">✓</span>
                              )}
                            </div>
                            {u.phone_number && (
                              <a
                                href={`https://wa.me/${u.phone_number.replace(/\D/g, '').startsWith('0') ? '62' + u.phone_number.replace(/\D/g, '').slice(1) : u.phone_number.replace(/\D/g, '')}?text=${encodeURIComponent(`Halo ${u.full_name}, saya Talitha Ayu Sukma (Admin Utama Tata Dana) terkait pendaftaran dan verifikasi akun Anda.`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 font-semibold mt-0.5 hover:underline"
                              >
                                💬 Chat WhatsApp
                              </a>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                u.plan === 'pro'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {u.plan}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {u.telegram_connected ? (
                              <span className="text-emerald-500 font-semibold flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" /> @{u.telegram_username || 'linked'}
                              </span>
                            ) : (
                              <span className="text-zinc-400">Belum terhubung</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-semibold">{trxCount} / {u.plan === 'starter' ? '50' : '∞'}</td>
                          <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                            {isPending ? (
                              <>
                                <button
                                  onClick={() => handleApproveUser(u.id)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm transition-all"
                                >
                                  ✓ Setujui Akun
                                </button>
                                <button
                                  onClick={() => handleRejectUser(u.id)}
                                  className="px-2.5 py-1.5 rounded-xl bg-rose-600/10 hover:bg-rose-600 hover:text-white text-rose-500 font-bold text-[11px] transition-all"
                                >
                                  ✕ Tolak
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleInspectUserTransactions(u)}
                                  className="px-2.5 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-emerald-600 hover:text-white text-zinc-700 dark:text-zinc-300 text-[11px] font-bold transition-colors"
                                >
                                  Lihat Transaksi
                                </button>
                                <button
                                  onClick={() => handleImpersonateUser(u)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white text-[11px] font-bold transition-colors inline-flex items-center gap-1"
                                >
                                  <LogIn className="w-3 h-3" /> Impersonate
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: AI MULTI-PROVIDER MANAGEMENT */}
        {activeTab === 'providers' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                  Konfigurasi Multi-Provider AI (Gemini, OpenAI, DeepSeek)
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Dukung mode Failover otomatis untuk menjamin respons bot Telegram 100% tanpa henti
                </p>
              </div>
              <button
                onClick={() => setIsAddProviderOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" />
                Tambah Provider AI
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="p-6 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 flex flex-col justify-between shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-bold text-base text-zinc-900 dark:text-white">{p.display_name}</span>
                      <button
                        onClick={() => toggleProviderActive(p.id)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          p.is_active
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {p.is_active ? '● Aktif' : '○ Nonaktif'}
                      </button>
                    </div>

                    <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-300">
                      <div>
                        <span className="text-zinc-400 block text-[11px]">Model:</span>
                        <span className="font-mono">{p.model_name}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block text-[11px]">API Key Terenkripsi:</span>
                        <span className="font-mono text-[10px] text-zinc-500 truncate block">
                          {p.api_key ? '••••••••••••••••' + p.api_key.slice(-4) : 'Tersimpan aman di Supabase'}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block text-[11px]">Mode Eksekusi:</span>
                        <button
                          onClick={() => toggleProviderMode(p.id)}
                          className="mt-1 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-semibold text-emerald-600 dark:text-emerald-400 hover:border-emerald-500/50"
                        >
                          {p.mode === 'parallel_failover' ? 'Paralel Failover' : 'Single Provider'} (Klik ubah)
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Prioritas Antrean: #{p.priority}</span>
                    <span className="text-emerald-500 font-semibold">Latency ~320ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: AI LOGS */}
        {activeTab === 'logs' && (
          <div className="rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Log Panggilan AI LLM & Vision OCR</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Monitoring latency, token usage, dan failover event</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100/70 dark:bg-zinc-900/80 text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">Waktu (WIB)</th>
                    <th className="py-3 px-4">Fitur</th>
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Latency</th>
                    <th className="py-3 px-4">Prompt Tok</th>
                    <th className="py-3 px-4">Comp Tok</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {db.aiLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40">
                      <td className="py-3 px-4 text-zinc-400">{formatWIB(log.created_at, { weekday: undefined })}</td>
                      <td className="py-3 px-4 font-semibold capitalize">{log.feature.replace('_', ' ')}</td>
                      <td className="py-3 px-4 uppercase font-bold text-emerald-600 dark:text-emerald-400">{log.provider}</td>
                      <td className="py-3 px-4">{log.latency_ms} ms</td>
                      <td className="py-3 px-4">{log.prompt_tokens}</td>
                      <td className="py-3 px-4">{log.completion_tokens}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-emerald-500 font-bold uppercase">{log.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Audit Log Privasi & Keamanan</h3>
              <p className="text-xs text-zinc-400">Setiap akses data transaksi user dan permohonan pembayaran tercatat permanen</p>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs">
              {db.auditLogs.length === 0 ? (
                <div className="p-8 text-center text-zinc-400">Belum ada riwayat audit log.</div>
              ) : (
                db.auditLogs.map((item) => (
                  <div key={item.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-white">
                        {item.admin_name} → <span className="text-emerald-600 dark:text-emerald-400">{item.action}</span> (Target: {item.target_user_name})
                      </p>
                      <p className="text-zinc-400 mt-0.5">{item.notes}</p>
                    </div>
                    <span className="text-[11px] text-zinc-400">{formatWIB(item.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Preview Bukti Transfer */}
      {previewProofPayment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0e0f13] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                Bukti Transfer: {previewProofPayment.order_id}
              </h3>
              <button onClick={() => setPreviewProofPayment(null)} className="p-1 text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4">
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-2 bg-zinc-100 dark:bg-zinc-900 text-center">
                <img
                  src={previewProofPayment.proof_url || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500'}
                  alt="Bukti Transfer"
                  className="rounded-xl max-h-72 w-full object-cover mx-auto"
                />
              </div>

              <div className="mt-4 space-y-1.5 text-xs">
                <p><strong>Pengirim:</strong> {previewProofPayment.user_name}</p>
                <p><strong>Nominal:</strong> {formatRupiah(previewProofPayment.amount)}</p>
                <p><strong>Metode:</strong> {previewProofPayment.payment_type.replace('_', ' ')}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              {previewProofPayment.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleApprovePayment(previewProofPayment.order_id)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                  >
                    Approve Pro
                  </button>
                  <button
                    onClick={() => {
                      setRejectingPayment(previewProofPayment);
                      setPreviewProofPayment(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Alasan Reject Payment */}
      {rejectingPayment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0e0f13] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white mb-2">
              Tolak Pembayaran: {rejectingPayment.order_id}
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Masukkan alasan penolakan pembayaran untuk dicatat pada log audit dan diinformasikan ke user.
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:border-rose-500"
            />

            <div className="flex items-center justify-end gap-2 pt-4">
              <button
                onClick={() => setRejectingPayment(null)}
                className="px-4 py-2 rounded-xl text-zinc-400 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Provider AI */}
      {isAddProviderOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0e0f13] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                Tambah Provider AI Baru
              </h3>
              <button onClick={() => setIsAddProviderOpen(false)} className="p-1 text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProviderSubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nama Tampilan Provider</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: DeepSeek V3 / Claude 3.5 Sonnet"
                  value={newProviderName}
                  onChange={(e) => setNewProviderName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Nama Model Teknis</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: deepseek-chat / claude-3-5-sonnet-20241022"
                  value={newProviderModel}
                  onChange={(e) => setNewProviderModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">API Key (Terenkripsi)</label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={newProviderKey}
                  onChange={(e) => setNewProviderKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddProviderOpen(false)}
                  className="px-4 py-2 text-zinc-400"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-md shadow-emerald-500/20"
                >
                  Simpan Provider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Inspeksi Transaksi User */}
      {selectedUserTrx && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0e0f13] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                  Inspeksi Transaksi: {selectedUserTrx.user.full_name}
                </h3>
                <p className="text-[11px] text-zinc-400">
                  🔒 Akses ini telah dicatat ke dalam Audit Log keamanan.
                </p>
              </div>
              <button
                onClick={() => setSelectedUserTrx(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-2 text-xs">
              {selectedUserTrx.txs.length === 0 ? (
                <p className="text-center text-zinc-400 py-6">Tidak ada transaksi.</p>
              ) : (
                selectedUserTrx.txs.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">{t.notes || t.description || t.category?.name}</p>
                      <p className="text-[10px] text-zinc-400">
                        {formatWIB(t.transaction_date)} • {t.source}
                      </p>
                    </div>
                    <span className={`font-bold ${t.type === 'income' ? 'text-emerald-500' : 'text-zinc-100'}`}>
                      {formatRupiah(t.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
