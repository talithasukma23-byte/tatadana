'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  User,
  Bot,
  Bell,
  Tags,
  Check,
  AlertCircle,
  ExternalLink,
  Loader2,
  Copy,
  Sparkles,
  Zap,
  CreditCard,
  Lock,
  Upload,
  CheckCircle2,
  Unlink,
  Radio,
  Globe,
  RefreshCw,
  Camera,
  Trash2,
  X,
} from 'lucide-react';
import { db } from '@/lib/supabase/mock-db';
import { formatRupiah, safeJsonParse, safeFetchJson } from '@/lib/utils';
import { SubscriptionPayment } from '@/types/database';
import { useActiveUser, notifyProfileUpdated } from '@/lib/auth/client-session';
import { UserAvatar } from '@/components/UserAvatar';

export default function SettingsPage() {
  const [isClient, setIsClient] = useState(false);
  const { user: activeUser } = useActiveUser();
  const [currentUser, setCurrentUser] = useState(activeUser);
  const [activeTab, setActiveTab] = useState<'bot' | 'profile' | 'reminder' | 'categories' | 'subscription'>('bot');

  // Tab Profile State
  const [fullName, setFullName] = useState(activeUser.full_name);
  const [phoneNumber, setPhoneNumber] = useState(activeUser.phone_number || '');
  const [currency, setCurrency] = useState(activeUser.currency || 'IDR');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // Avatar Upload & Management State
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state saat activeUser ter-load
  useEffect(() => {
    setCurrentUser(activeUser);
    setFullName(activeUser.full_name);
    setPhoneNumber(activeUser.phone_number || '');
    setCurrency(activeUser.currency || 'IDR');
    setReminderEnabled(activeUser.daily_reminder_enabled);
    setFrequency(activeUser.reminder_frequency || 1);
    setReminderTime1(activeUser.reminder_time_1 || '20:00');
    setReminderTime2(activeUser.reminder_time_2 || '12:00');
    setCategories(db.getCategories(activeUser.id));

    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash === '#upgrade' || hash === '#subscription') {
        setActiveTab('subscription');
      }
    }
  }, [activeUser]);

  // Tab Telegram Bot State
  const [botToken, setBotToken] = useState(() => {
    const initial = currentUser.telegram_bot_token;
    return initial && initial !== 'mock_token' ? initial : '';
  });
  const [isTesting, setIsTesting] = useState(false);
  const [botStatus, setBotStatus] = useState<'connected' | 'disconnected' | 'testing'>(() => {
    return currentUser.telegram_connected && currentUser.telegram_bot_token && currentUser.telegram_bot_token !== 'mock_token'
      ? 'connected'
      : 'disconnected';
  });
  const [botFeedback, setBotFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tunnelInfo, setTunnelInfo] = useState<{ active: boolean; tunnelUrl: string | null; webhookUrl: string | null } | null>(null);

  // Sync state dari localStorage & API saat mount
  useEffect(() => {
    setIsClient(true);
    // 1. Cek penyimpanan lokal
    try {
      const saved = localStorage.getItem('tatadana_connected_bot');
      if (saved && saved !== '[object Object]') {
        const parsed = safeJsonParse<{ connected?: boolean; token?: string; botName?: string }>(saved);
        if (parsed && parsed.connected && parsed.token && parsed.token !== 'mock_token') {
          setBotStatus('connected');
          setBotToken(parsed.token);
          setCurrentUser((prev) => ({
            ...prev,
            telegram_connected: true,
            telegram_bot_token: parsed.token,
            telegram_username: parsed.botName || prev.telegram_username,
          }));
        }
      } else if (saved === '[object Object]') {
        localStorage.removeItem('tatadana_connected_bot');
      }
    } catch (e) {
      // ignore
    }

    // 2. Query status koneksi dan token persisten dari server
    fetch('/api/telegram/test-connection')
      .then((res) => safeFetchJson(res))
      .then((data) => {
        if (data && (data.botToken || data.hasPersistedToken)) {
          const activeToken = data.botToken || '';
          if (activeToken && activeToken !== 'mock_token') {
            setBotToken(activeToken);
          }
          if (data.botConnected) {
            setBotStatus('connected');
            setCurrentUser((prev) => ({
              ...prev,
              telegram_connected: true,
              telegram_bot_token: activeToken || prev.telegram_bot_token,
              telegram_username: data.botName || prev.telegram_username,
            }));

            try {
              localStorage.setItem(
                'tatadana_connected_bot',
                JSON.stringify({
                  token: activeToken || undefined,
                  botName: data.botName,
                  connected: true,
                  connectedAt: data.updatedAt || new Date().toISOString(),
                })
              );
            } catch (e) {}
          }
        } else if (data && !data.botConnected && !data.hasPersistedToken) {
          const savedBot = localStorage.getItem('tatadana_connected_bot');
          if (!savedBot || savedBot === '[object Object]') {
            setBotStatus('disconnected');
          }
        }
      })
      .catch(() => {});

    // 3. Fetch status tunnel dari API
    fetch('/api/telegram/tunnel')
      .then((res) => safeFetchJson(res))
      .then((data) => {
        if (data) setTunnelInfo(data);
      })
      .catch(() => {});
  }, []);

  // Tab Reminder State
  const [reminderEnabled, setReminderEnabled] = useState(currentUser.daily_reminder_enabled);
  const [frequency, setFrequency] = useState<1 | 2>(currentUser.reminder_frequency || 1);
  const [reminderTime1, setReminderTime1] = useState(currentUser.reminder_time_1 || '20:00');
  const [reminderTime2, setReminderTime2] = useState(currentUser.reminder_time_2 || '12:00');
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);

  // Tab Categories State
  const [categories, setCategories] = useState(() => db.getCategories(currentUser.id));
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('🏷️');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');

  // Tab Subscription Upgrade State
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'midtrans_snap'>('bank_transfer');
  const [proofImage, setProofImage] = useState('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500');
  const [isPaymentSubmitted, setIsPaymentSubmitted] = useState(false);
  const [activePendingPayment, setActivePendingPayment] = useState<SubscriptionPayment | null>(null);
  const [proWaLink, setProWaLink] = useState<string | null>(null);
  const [isSubmittingUpgrade, setIsSubmittingUpgrade] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Sync status pengajuan PRO pengguna yang sedang login
  useEffect(() => {
    if (activeTab === 'subscription') {
      fetch('/api/payment/upgrade', {
        headers: { 'x-user-id': currentUser.id },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data && data.success && data.activePending) {
            setActivePendingPayment(data.activePending);
            setIsPaymentSubmitted(true);
          }
        })
        .catch(() => {});
    }
  }, [activeTab, currentUser.id]);

  // Test Koneksi Bot Action
  const handleTestBotConnection = async () => {
    if (!botToken.trim()) {
      setBotFeedback({ type: 'error', text: 'Masukkan token bot terlebih dahulu.' });
      return;
    }

    setIsTesting(true);
    setBotStatus('testing');
    setBotFeedback(null);

    try {
      const res = await fetch('/api/telegram/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: botToken.trim(),
          userId: currentUser.id,
        }),
      });

      const data = await safeFetchJson(res, { success: false, error: 'Respons server tidak valid.' });

      if (!res.ok || !data?.success) {
        setBotStatus('disconnected');
        setBotFeedback({
          type: 'error',
          text: data?.error || 'Token salah atau tidak dapat dihubungi oleh Telegram API.',
        });
      } else {
        setBotStatus('connected');

        // Simpan ke localStorage agar status tidak reset saat reload browser
        try {
          localStorage.setItem(
            'tatadana_connected_bot',
            JSON.stringify({
              token: botToken.trim(),
              botName: data.botName,
              connected: true,
              connectedAt: new Date().toISOString(),
            })
          );
        } catch (e) {}

        // Perbarui data profile pengguna di mock DB dan React state
        const targetUser = db.getUser(currentUser.id);
        if (targetUser) {
          targetUser.telegram_connected = true;
          targetUser.telegram_bot_token = botToken.trim();
          if (data.botName) targetUser.telegram_username = data.botName;
          targetUser.telegram_connected_at = new Date().toISOString();
        }

        currentUser.telegram_connected = true;
        currentUser.telegram_bot_token = botToken.trim();
        if (data.botName) {
          currentUser.telegram_username = data.botName;
        }
        currentUser.telegram_connected_at = new Date().toISOString();
        setCurrentUser({ ...currentUser });

        if (data.tunnelUrl) {
          setTunnelInfo({
            active: true,
            tunnelUrl: data.tunnelUrl,
            webhookUrl: data.webhookUrl || `${data.tunnelUrl}/api/telegram/webhook`,
          });
        }

        const feedbackText = data.message || (
          data.webhookSet
            ? `🟢 Terhubung! Bot @${data.botName} berhasil diverifikasi dan webhook aktif di ${data.webhookUrl}. Pesan Telegram kini otomatis masuk ke TataDana.`
            : `🟢 Terhubung! Bot @${data.botName} berhasil diverifikasi via getMe.`
        );

        setBotFeedback({
          type: 'success',
          text: feedbackText,
        });
      }
    } catch (err: any) {
      setBotStatus('disconnected');
      setBotFeedback({ type: 'error', text: `Gagal menguji koneksi: ${err.message}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnectBot = async () => {
    if (confirm('Yakin ingin memutuskan koneksi Telegram Bot? Kamu tidak akan bisa mencatat keuangan via bot sampai dihubungkan kembali.')) {
      try {
        localStorage.removeItem('tatadana_connected_bot');
      } catch (e) {}

      // Hapus file konfigurasi persisten di sisi server (.bot-config.json) dan mock-db
      try {
        await fetch('/api/telegram/test-connection', {
          method: 'DELETE',
        });
      } catch (e) {
        console.error('Failed to notify server of bot disconnection:', e);
      }

      const targetUser = db.getUser(currentUser.id);
      if (targetUser) {
        targetUser.telegram_connected = false;
        targetUser.telegram_chat_id = undefined;
        targetUser.telegram_bot_token = undefined;
        targetUser.telegram_username = undefined;
        targetUser.telegram_connected_at = undefined;
      }
      currentUser.telegram_connected = false;
      currentUser.telegram_chat_id = undefined;
      currentUser.telegram_bot_token = undefined;
      currentUser.telegram_username = undefined;
      currentUser.telegram_connected_at = undefined;
      setBotToken('');
      setBotStatus('disconnected');
      setCurrentUser({
        ...currentUser,
        telegram_connected: false,
        telegram_chat_id: undefined,
        telegram_bot_token: undefined,
        telegram_username: undefined,
        telegram_connected_at: undefined,
      });
      setBotFeedback({
        type: 'success',
        text: 'Koneksi Telegram Bot berhasil diputuskan.',
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type.toLowerCase())) {
        setAvatarError('Format file tidak didukung. Harap gunakan format JPG, PNG, atau WebP.');
        setAvatarSuccess(null);
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setAvatarError('Ukuran file terlalu besar. Maksimal ukuran foto adalah 2MB.');
        setAvatarSuccess(null);
        return;
      }
      setAvatarError(null);
      setAvatarSuccess(null);
      setAvatarFile(file);

      const reader = new FileReader();
      reader.onload = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCancelPreview = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveAvatar = async () => {
    if (!avatarFile) return;
    setAvatarLoading(true);
    setAvatarError(null);
    setAvatarSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', avatarFile);
      formData.append('userId', activeUser.id);

      const res = await fetch('/api/auth/profile/avatar', {
        method: 'POST',
        body: formData,
      });
      const data = await safeFetchJson(res, { success: false, error: 'Gagal mengunggah foto profil.' });

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Gagal mengunggah foto profil.');
      }

      setCurrentUser((prev) => ({ ...prev, avatar_url: data.avatarUrl }));
      setAvatarFile(null);
      setAvatarPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setAvatarSuccess('✓ Foto profil berhasil disimpan secara persisten!');
      notifyProfileUpdated();
    } catch (err: any) {
      setAvatarError(err.message || 'Gagal menyimpan foto profil.');
    } finally {
      setAvatarLoading(false);
      setTimeout(() => setAvatarSuccess(null), 4000);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!activeUser.avatar_url) return;
    if (typeof window !== 'undefined' && !window.confirm('Apakah Anda yakin ingin menghapus foto profil dan kembali ke avatar default?')) {
      return;
    }
    setAvatarLoading(true);
    setAvatarError(null);
    setAvatarSuccess(null);

    try {
      const res = await fetch('/api/auth/profile/avatar', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeUser.id }),
      });
      const data = await safeFetchJson(res, { success: false, error: 'Gagal menghapus foto profil.' });

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Gagal menghapus foto profil.');
      }

      setCurrentUser((prev) => ({ ...prev, avatar_url: '' }));
      setAvatarFile(null);
      setAvatarPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setAvatarSuccess('✓ Foto profil berhasil dihapus. Avatar default diaktifkan.');
      notifyProfileUpdated();
    } catch (err: any) {
      setAvatarError(err.message || 'Gagal menghapus foto profil.');
    } finally {
      setAvatarLoading(false);
      setTimeout(() => setAvatarSuccess(null), 4000);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeUser.id,
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          currency: currency,
        }),
      });
      const data = await safeFetchJson(res, { success: false, error: 'Gagal memperbarui profil.' });
      if (data?.success && data?.user) {
        setCurrentUser((prev) => ({
          ...prev,
          full_name: data.user.full_name,
          phone_number: data.user.phone_number,
        }));
        if (typeof window !== 'undefined') {
          localStorage.setItem('tatadana_user_name', data.user.full_name);
        }
        notifyProfileUpdated();
        setProfileMsg('✓ Profil berhasil disimpan & disinkronkan!');
      } else {
        setProfileMsg(`✕ Gagal: ${data?.error || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      setProfileMsg(`✕ Error: ${err.message}`);
    }
    setTimeout(() => setProfileMsg(null), 3000);
  };

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          dailyReminderEnabled: reminderEnabled,
          reminderFrequency: frequency,
          reminderTime1: reminderTime1,
          reminderTime2: reminderTime2,
        }),
      });
      currentUser.daily_reminder_enabled = reminderEnabled;
      currentUser.reminder_frequency = frequency;
      currentUser.reminder_time_1 = reminderTime1;
      currentUser.reminder_time_2 = reminderTime2;
      notifyProfileUpdated();
      setReminderMsg('✓ Pengaturan reminder keuangan harian berhasil disimpan!');
    } catch (err: any) {
      setReminderMsg(`✕ Gagal: ${err.message}`);
    }
    setTimeout(() => setReminderMsg(null), 3000);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const newCat = {
      id: `cat-${Date.now()}`,
      user_id: currentUser.id,
      name: newCatName.trim(),
      type: newCatType,
      emoji: newCatEmoji,
      color: '#059669',
      is_custom: true,
      monthly_budget: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.categories.push(newCat);
    setCategories([...db.getCategories(currentUser.id)]);
    setNewCatName('');
  };

  const handleManualPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingUpgrade) return;

    setIsSubmittingUpgrade(true);
    try {
      const res = await fetch('/api/payment/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({
          userId: currentUser.id,
          plan: 'pro',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Gagal membuat pengajuan upgrade PRO.');
        return;
      }

      setActivePendingPayment(data.payment);
      setProWaLink(data.waLink);
      setIsPaymentSubmitted(true);

      // Buka chat WhatsApp resmi Admin secara otomatis di tab baru
      if (data.waLink && typeof window !== 'undefined') {
        window.open(data.waLink, '_blank');
      }

      showToast(
        data.isExisting
          ? `✓ Pengajuan upgrade PRO Anda sebelumnya (${data.payment.order_id}) dibuka kembali di WhatsApp!`
          : `✓ Pengajuan upgrade PRO (${data.payment.order_id}) berhasil dicatat dan WhatsApp dibuka!`
      );
    } catch (err: any) {
      alert('Terjadi kesalahan saat memproses pengajuan: ' + err.message);
    } finally {
      setIsSubmittingUpgrade(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-xl shadow-emerald-600/20 text-sm font-semibold animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-5 h-5" />
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
          ⚙️ Pengaturan Akun & Integrasi
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Kelola profil, integrasi bot Telegram, pengingat harian, kategori keuangan, dan paket langganan.
        </p>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 space-x-6 text-sm overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('bot')}
          className={`pb-3 font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'bot'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Bot className="w-4 h-4" />
          Telegram Bot
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <User className="w-4 h-4" />
          Profil Pengguna
        </button>

        <button
          onClick={() => setActiveTab('reminder')}
          className={`pb-3 font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'reminder'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Bell className="w-4 h-4" />
          Reminder Harian
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-3 font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'categories'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Tags className="w-4 h-4" />
          Kelola Kategori
        </button>

        <button
          id="upgrade"
          onClick={() => setActiveTab('subscription')}
          className={`pb-3 font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'subscription'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Paket & Langganan Pro</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            PRO
          </span>
        </button>
      </div>

      {/* TAB 1: TELEGRAM BOT */}
      {activeTab === 'bot' && (
        <div className="space-y-6 max-w-3xl">
          {/* Status Badge */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Status Koneksi Telegram Bot</h3>
                <p className="text-xs text-zinc-400" suppressHydrationWarning>
                  {isClient
                    ? (currentUser.telegram_username ? `Terhubung ke @${currentUser.telegram_username}` : 'Sinkronisasi pesan chat ke database TataDana')
                    : (currentUser.telegram_username ? `Terhubung ke @${currentUser.telegram_username}` : 'Sinkronisasi pesan chat ke database TataDana')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {botStatus === 'testing' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-500 text-xs font-bold border border-amber-500/30">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> ⏳ Testing...
                </span>
              ) : botStatus === 'connected' ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 text-xs font-bold border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> 🟢 Terhubung
                  </span>
                  <button
                    onClick={handleDisconnectBot}
                    className="p-1.5 text-xs text-zinc-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors"
                    title="Putuskan koneksi bot"
                  >
                    <Unlink className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-bold border border-rose-500/30">
                  🔴 Belum Terhubung
                </span>
              )}
            </div>
          </div>

          {/* Jembatan Tunnel HTTPS Info Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-cyan-500/5 border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-zinc-900 dark:text-white">Jembatan Tunnel HTTPS: </span>
                {tunnelInfo?.active && tunnelInfo.tunnelUrl ? (
                  <code className="ml-1 px-2 py-0.5 rounded font-mono bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold select-all">
                    {tunnelInfo.tunnelUrl}
                  </code>
                ) : (
                  <span className="text-zinc-500 dark:text-zinc-400 ml-1">
                    Aktif di localhost:3000 (Jalankan <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 rounded">npm run tunnel</code> untuk HTTPS publik)
                  </span>
                )}
              </div>
            </div>

            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
              tunnelInfo?.active
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}>
              {tunnelInfo?.active ? '🌐 Tunnel Online' : '⚙️ Localhost Dev'}
            </span>
          </div>

          {/* Inline Step-by-Step Guide */}
          <div className="p-6 rounded-3xl bg-zinc-100/70 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-800/80 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Panduan Menghubungkan Bot dari @BotFather:</h3>
            </div>
            <ol className="text-xs space-y-2 text-zinc-600 dark:text-zinc-300 list-decimal list-inside leading-relaxed">
              <li>
                Buka aplikasi Telegram dan cari bot resmi Telegram{' '}
                <a
                  href="https://t.me/botfather"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                >
                  @BotFather <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                Kirim perintah <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono">/newbot</code> lalu beri nama dan username untuk bot kamu (misal: <em>CatatKeuangan_bot</em>).
              </li>
              <li>
                Salin token API HTTP yang diberikan BotFather (contoh format:{' '}
                <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono">7123456789:AAEjK_xYz...</code>).
              </li>
              <li>Paste token tersebut ke kolom di bawah ini dan klik <strong>Test Koneksi</strong>.</li>
            </ol>
          </div>

          {/* Token Input & Test Connection Form */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 space-y-4 shadow-sm">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Telegram Bot Token
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Paste token dari @BotFather di sini (contoh: 123456:ABC-DEF...)"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-mono outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleTestBotConnection}
                  disabled={isTesting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Menguji...
                    </>
                  ) : (
                    'Test & Hubungkan Bot'
                  )}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2">
                💡 <span className="font-semibold text-zinc-700 dark:text-zinc-300">Simulasi Dev Lokal:</span> Gunakan token berawalan <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono text-emerald-600 dark:text-emerald-400">DEMO_BOT_TOKEN_123</code> untuk menguji koneksi tanpa dependensi ke server eksternal Telegram.
              </p>
            </div>

            {botFeedback && (
              <div
                className={`p-4 rounded-2xl text-xs font-semibold ${
                  botFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400'
                }`}
              >
                {botFeedback.text}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PROFIL PENGGUNA */}
      {activeTab === 'profile' && (
        <div className="space-y-6 max-w-xl">
          {/* Card 1: Area Foto Profil */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 space-y-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Foto Profil Pengguna</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Foto ini akan ditampilkan di Profil, Sidebar, dan Header aplikasi TataDana.
                </p>
              </div>
            </div>

            {avatarSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                {avatarSuccess}
              </div>
            )}

            {avatarError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold">
                {avatarError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              {/* Foto / Pratinjau Avatar */}
              <div className="relative group shrink-0">
                <UserAvatar
                  user={activeUser}
                  previewUrl={avatarPreview}
                  size="2xl"
                  className="shadow-md"
                />
                {avatarPreview && (
                  <span className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-black shadow uppercase tracking-wide">
                    Pratinjau
                  </span>
                )}
              </div>

              {/* Kontrol Aksi & Keterangan */}
              <div className="flex-1 space-y-3 text-center sm:text-left">
                <div>
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                    {activeUser.full_name}
                  </h4>
                  <p className="text-xs text-zinc-400">{activeUser.email}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    Role: {activeUser.role === 'superadmin' ? '👑 SUPERADMIN' : activeUser.role === 'admin' ? '🛡️ ADMIN' : 'USER'}
                  </span>
                </div>

                {/* Input File Tersembunyi */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Tombol Aksi Foto Profil */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  {avatarPreview ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveAvatar}
                        disabled={avatarLoading}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {avatarLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" /> Simpan Foto Profil
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelPreview}
                        disabled={avatarLoading}
                        className="px-3.5 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs transition-all flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" /> Batal
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarLoading}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        {activeUser.avatar_url ? 'Ganti Foto' : 'Unggah Foto'}
                      </button>

                      {activeUser.avatar_url && (
                        <button
                          type="button"
                          onClick={handleDeleteAvatar}
                          disabled={avatarLoading}
                          className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {avatarLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          Hapus Foto
                        </button>
                      )}
                    </>
                  )}
                </div>

                <p className="text-[11px] text-zinc-400">
                  Format yang didukung: <strong>JPG</strong>, <strong>PNG</strong>, atau <strong>WebP</strong>. Maksimal ukuran file <strong>2MB</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Formulir Data Identitas Diri */}
          <form onSubmit={handleSaveProfile} className="space-y-4">
            {profileMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                {profileMsg}
              </div>
            )}

            <div className="p-6 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 space-y-4 text-xs shadow-sm">
              <h4 className="font-bold text-sm text-zinc-900 dark:text-white pb-2 border-b border-zinc-200 dark:border-zinc-800">
                Informasi Akun
              </h4>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Nomor Handphone (WhatsApp)
                </label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Alamat Email</label>
                <input
                  type="text"
                  value={activeUser.email}
                  disabled
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 text-zinc-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Zona Waktu Default</label>
                <input
                  type="text"
                  value="Asia/Jakarta (WIB)"
                  disabled
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 text-zinc-500 cursor-not-allowed"
                />
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-500/20"
              >
                Simpan Perubahan Data Profil
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: REMINDER */}
      {activeTab === 'reminder' && (
        <form onSubmit={handleSaveReminder} className="space-y-6 max-w-xl">
          {reminderMsg && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              {reminderMsg}
            </div>
          )}

          <div className="p-6 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 space-y-4 text-xs shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h4 className="font-bold text-sm text-zinc-900 dark:text-white">Aktifkan Reminder Keuangan Harian</h4>
                <p className="text-zinc-400 text-[11px]">Dikirim otomatis via Telegram bot</p>
              </div>
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
                className="w-5 h-5 accent-emerald-600 rounded"
              />
            </div>

            {reminderEnabled && (
              <>
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Frekuensi Pengingat (Maksimal 2x / Hari)
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(Number(e.target.value) as 1 | 2)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-emerald-500"
                  >
                    <option value={1}>1x Sehari</option>
                    <option value={2}>2x Sehari</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Jam Reminder 1 (WIB)</label>
                    <input
                      type="time"
                      value={reminderTime1}
                      onChange={(e) => setReminderTime1(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                  {frequency === 2 && (
                    <div>
                      <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Jam Reminder 2 (WIB)</label>
                      <input
                        type="time"
                        value={reminderTime2}
                        onChange={(e) => setReminderTime2(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}
                </div>

                {/* Preview Pesan Reminder */}
                <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 space-y-1 font-mono text-[11px] text-zinc-600 dark:text-zinc-300">
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">Preview Pesan di Telegram:</p>
                  <p>⏰ Reminder Keuangan TataDana!</p>
                  <p>Jangan lupa catat pengeluaran hari ini ya 📝</p>
                  <p>Pencatatan rutin = keuangan lebih terkontrol 💪</p>
                </div>
              </>
            )}

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-500/20"
            >
              Simpan Pengaturan Reminder
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: KATEGORI */}
      {activeTab === 'categories' && (
        <div className="space-y-6 max-w-2xl">
          <form onSubmit={handleAddCategory} className="p-6 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 space-y-3 text-xs shadow-sm">
            <h4 className="font-bold text-sm text-zinc-900 dark:text-white">Tambah Kategori Kustom Baru</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Nama kategori..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                required
                className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-emerald-500"
              />
              <select
                value={newCatType}
                onChange={(e) => setNewCatType(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-emerald-500"
              >
                <option value="expense">Pengeluaran</option>
                <option value="income">Pemasukan</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all shadow-md shadow-emerald-500/20"
              >
                + Tambah
              </button>
            </div>
          </form>

          <div className="rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 p-6 shadow-sm">
            <h4 className="font-bold text-sm text-zinc-900 dark:text-white mb-4">Daftar Kategori Aktif</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between"
                >
                  <span className="font-semibold flex items-center gap-1.5">
                    <span>{c.emoji}</span> {c.name}
                  </span>
                  <span className="text-[10px] text-zinc-400 capitalize">{c.type === 'income' ? 'Masuk' : 'Keluar'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SUBSCRIPTION & UPGRADE TO PRO */}
      {activeTab === 'subscription' && (
        <div className="space-y-6 max-w-4xl">
          {/* Current Plan Banner */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-teal-500/20">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">Status Akun Anda</span>
              <h3 className="text-2xl font-black mt-1">
                {activeUser.role === 'admin' || activeUser.role === 'superadmin' || activeUser.id === 'admin-owner-talitha'
                  ? 'AKUN ADMIN (PEMILIK APLIKASI)'
                  : `PAKET ${(activeUser.plan || 'starter').toUpperCase()}`}
              </h3>
              <p className="text-xs text-emerald-100 mt-1">
                {activeUser.role === 'admin' || activeUser.role === 'superadmin' || activeUser.id === 'admin-owner-talitha'
                  ? 'Akun Pemilik Aplikasi memiliki akses tidak terbatas ke seluruh modul dan manajemen sistem.'
                  : activeUser.plan === 'pro'
                  ? 'Selamat! Akunmu sudah aktif sebagai PRO (Sekali Bayar / Lifetime) dengan akses penuh tanpa batas.'
                  : 'Saat ini kamu berada di paket Starter dengan batas 3 dompet dan 5 budget kategori.'}
              </p>
            </div>
            <div className="bg-black/20 backdrop-blur-md px-4 py-2.5 rounded-2xl text-xs font-semibold">
              Biaya Langganan: <strong>{activeUser.plan === 'pro' ? 'Rp99.000 Sekali Bayar (Lifetime)' : 'Gratis (Starter)'}</strong>
            </div>
          </div>

          {/* Kondisi 1: Admin / Superadmin */}
          {(activeUser.role === 'admin' || activeUser.role === 'superadmin' || activeUser.id === 'admin-owner-talitha') ? (
            <div className="p-6 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 space-y-3 shadow-sm">
              <div className="flex items-center gap-3 text-purple-600 dark:text-purple-400 font-bold text-base">
                <span>👑</span>
                <h4>Akses Penuh Pemilik Aplikasi</h4>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Sebagai pemilik utama Tata Dana, akun Anda tidak memerlukan upgrade langganan. Seluruh modul (Dompet Unlimited, AI Vision, Tata AI Advisor, dan Export PDF/Excel) telah aktif secara permanen.
              </p>
            </div>
          ) : activeUser.plan === 'pro' ? (
            /* Kondisi 2: Akun USER yang sudah PRO */
            <div className="p-6 rounded-3xl bg-white dark:bg-[#0c0d10] border border-emerald-500/30 space-y-3 shadow-sm">
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 font-bold text-base">
                <CheckCircle2 className="w-6 h-6" />
                <h4>Akun TataDana PRO Aktif</h4>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Akun Anda telah berstatus <strong>PRO (Lifetime)</strong>. Anda dapat menikmati semua fitur tanpa batasan kuota. Tidak perlu mengajukan upgrade lagi.
              </p>
            </div>
          ) : (
            /* Kondisi 3: Akun USER Starter (Memenuhi syarat upgrade) */
            <div className="p-6 rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 space-y-6 shadow-sm">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  Upgrade ke TataDana Pro — Rp99.000 (Sekali Bayar)
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Nikmati fitur unlimited dompet, AI OCR foto struk, Tata AI Financial Advisor, dan export laporan PDF/Excel.
                </p>
              </div>

            {isPaymentSubmitted && activePendingPayment ? (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-left space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-zinc-900 dark:text-white">
                      Pengajuan Upgrade PRO Tercatat!
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      ID pengajuan resmi telah tersimpan di sistem dan terhubung ke akun Anda.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 dark:text-zinc-400">ID Pengajuan PRO:</span>
                    <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{activePendingPayment.order_id}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 dark:text-zinc-400">ID Akun Pemohon:</span>
                    <strong className="font-mono text-zinc-900 dark:text-white">{currentUser.id}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 dark:text-zinc-400">Target Paket:</span>
                    <span className="font-bold text-zinc-900 dark:text-white">PRO (Sekali Bayar)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 dark:text-zinc-400">Harga:</span>
                    <span className="font-bold text-zinc-900 dark:text-white">Rp99.000 sekali bayar</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 dark:text-zinc-400">Status Pengajuan:</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold uppercase text-[10px]">
                      Menunggu Pembayaran
                    </span>
                  </div>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-300">
                  Silakan lanjutkan pembayaran melalui rekening atau QRIS resmi yang diinformasikan Admin di WhatsApp. Setelah mentransfer, kirimkan bukti transfer melalui chat WhatsApp dengan menyertakan <strong>ID Pengajuan</strong> di atas.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (proWaLink) {
                        window.open(proWaLink, '_blank');
                      } else {
                        const prefilledText = `[PENGAJUAN UPGRADE PRO TATA DANA]\n\nHalo Admin Tata Dana, saya ingin mengajukan upgrade PRO.\n\nNama akun: ${currentUser.full_name}\nEmail akun: ${currentUser.email}\nID Akun: ${currentUser.id}\nID Pengajuan: ${activePendingPayment.order_id}\nPaket: PRO\nHarga: Rp99.000 sekali bayar\nStatus: Menunggu pembayaran\n\nMohon informasi pembayaran melalui bank atau QRIS. Setelah melakukan pembayaran, saya akan mengirimkan bukti pembayaran melalui WhatsApp ini.`;
                        window.open(`https://wa.me/6288222003880?text=${encodeURIComponent(prefilledText)}`, '_blank');
                      }
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all"
                  >
                    💬 Buka Kembali Chat WhatsApp Admin
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleManualPaymentSubmit} className="space-y-5">
                {/* Payment Method Selector */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                    Pilih Metode Pembayaran
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bank_transfer')}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        paymentMethod === 'bank_transfer'
                          ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900'
                      }`}
                    >
                      <p className="font-bold text-zinc-900 dark:text-white">🏦 Transfer Bank &amp; WhatsApp Resmi</p>
                      <p className="text-zinc-400 mt-1">Instruksi rekening BCA/Mandiri &amp; konfirmasi via WhatsApp</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('midtrans_snap')}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        paymentMethod === 'midtrans_snap'
                          ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900'
                      }`}
                    >
                      <p className="font-bold text-zinc-900 dark:text-white">⚡ QRIS / Virtual Account</p>
                      <p className="text-zinc-400 mt-1">Pembayaran otomatis langsung terhubung ke sistem</p>
                    </button>
                  </div>
                </div>

                {/* Bank Account Info */}
                <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
                  <p className="font-bold text-zinc-900 dark:text-white">Rincian Upgrade PRO:</p>
                  <div className="flex items-center justify-between bg-white dark:bg-zinc-800 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <span>Biaya Sekali Bayar (Lifetime Pro):</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Rp99.000</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 pt-1">
                    Setelah tombol di bawah ditekan, sistem otomatis membuat ID Pengajuan unik yang tersimpan di server dan membuka chat WhatsApp resmi Admin dengan template pengajuan terisi otomatis.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingUpgrade}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                >
                  {isSubmittingUpgrade ? 'Membuat Pengajuan...' : '💬 Ajukan Upgrade PRO via WhatsApp Resmi Admin →'}
                </button>
              </form>
            )}
          </div>
          )}
        </div>
      )}
    </div>
  );
}
