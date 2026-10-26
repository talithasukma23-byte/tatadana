'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldAlert,
  CheckCircle2,
  Clock,
  RefreshCw,
  LogIn,
  ArrowLeft,
  Mail,
  Phone,
  MessageCircle,
  ExternalLink,
  AlertTriangle,
  User,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { safeFetchJson } from '@/lib/utils';

function PendingApprovalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const nameParam = searchParams.get('name') || '';
  const phoneParam = searchParams.get('phone') || '';

  const [email, setEmail] = useState(emailParam);
  const [fullName, setFullName] = useState(nameParam);
  const [phoneNumber, setPhoneNumber] = useState(phoneParam);
  const [userId, setUserId] = useState<string>('');
  const [checking, setChecking] = useState(false);
  const [accountStatus, setAccountStatus] = useState<'pending' | 'approved' | 'rejected' | 'not_found'>('pending');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Admin WhatsApp contact (Default dari pengaturan aplikasi: Talitha Ayu Sukma)
  const [adminContact, setAdminContact] = useState<{
    fullName: string;
    phoneNumber: string;
    waNumber: string;
    waLink: string;
  }>({
    fullName: 'Talitha Ayu Sukma (Owner & Superadmin)',
    phoneNumber: '088222003880',
    waNumber: '6288222003880',
    waLink: '',
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!email) {
        const storedEmail = localStorage.getItem('tatadana_user_email');
        if (storedEmail) setEmail(storedEmail);
      }
      if (!fullName) {
        const storedName = localStorage.getItem('tatadana_user_name');
        if (storedName) setFullName(storedName);
      }
      if (!userId) {
        const storedId = localStorage.getItem('tatadana_user_id');
        if (storedId) setUserId(storedId);
      }
    }
  }, [email, fullName, userId]);

  const handleCheckStatus = async (targetEmail?: string) => {
    const activeEmail = (targetEmail || email || '').trim().toLowerCase();
    if (!activeEmail) {
      setAccountStatus('not_found');
      setStatusMessage('Silakan masukkan atau pastikan alamat email akun Anda terisi.');
      return;
    }

    setChecking(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', email: activeEmail }),
      });
      const data = await safeFetchJson(res, {
        success: false,
        error: 'Akun tidak ditemukan. Pastikan email sudah terdaftar di sistem.',
      });

      if (!res.ok || !data?.success) {
        setAccountStatus('not_found');
        setStatusMessage(data?.error || 'Akun tidak ditemukan. Pastikan email sudah terdaftar.');
        return;
      }

      if (data.id) setUserId(data.id);
      if (data.full_name && !fullName) setFullName(data.full_name);
      if (data.phone_number && !phoneNumber) setPhoneNumber(data.phone_number);

      if (data.adminContact) {
        setAdminContact(data.adminContact);
      }

      if (data.account_status === 'approved' || data.account_status === 'active') {
        setAccountStatus('approved');
        setStatusMessage('Selamat! Akun Anda telah disetujui dan diaktifkan oleh Admin Utama. Anda dapat langsung masuk ke dashboard sekarang.');
      } else if (data.account_status === 'rejected') {
        setAccountStatus('rejected');
        setRejectionReason(data.rejection_reason || 'Pendaftaran ditolak oleh Admin Utama.');
        setStatusMessage('Mohon maaf, pendaftaran akun Anda ditolak oleh Admin Utama.');
      } else {
        setAccountStatus('pending');
        setStatusMessage('Akun Anda masih dalam antrean persetujuan manual oleh Admin Utama.');
      }
    } catch (err: any) {
      setAccountStatus('not_found');
      setStatusMessage('Gagal menghubungi server. Silakan coba beberapa saat lagi.');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (email) {
      handleCheckStatus(email);
    }
  }, [email]);

  // Update dynamic WhatsApp prefilled link khusus Permintaan Persetujuan Akun (Bagian 3)
  const effectiveWaLink = (() => {
    const adminPhone = adminContact?.phoneNumber || '088222003880';
    const cleanAdminPhone = adminPhone.replace(/\D/g, '');
    const waNumber = cleanAdminPhone.startsWith('0') ? '62' + cleanAdminPhone.slice(1) : cleanAdminPhone;
    const prefilledText = `[PERMINTAAN PERSETUJUAN AKUN TATA DANA]

Halo Admin Tata Dana, saya ingin mengajukan persetujuan akun baru.

Nama akun: ${fullName || 'Pengguna Baru'}
Email akun: ${email || '-'}
Nomor WhatsApp: ${phoneNumber || '-'}
ID Akun: ${userId || '-'}
Tujuan: Permintaan persetujuan akun baru

Mohon kesediaan Admin untuk memverifikasi dan menyetujui akun saya agar dapat masuk ke Tata Dana. Terima kasih!`;
    return `https://wa.me/${waNumber}?text=${encodeURIComponent(prefilledText)}`;
  })();

  return (
    <div className="min-h-screen flex flex-col justify-between bg-zinc-50 dark:bg-[#070809] text-zinc-900 dark:text-zinc-100 font-sans p-4 sm:p-8 lg:p-12">
      {/* Top Navbar */}
      <div className="flex items-center justify-between max-w-2xl w-full mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-extrabold text-lg shadow-lg shadow-emerald-500/20">
            T
          </div>
          <span className="font-extrabold text-xl tracking-tight text-zinc-900 dark:text-white">TataDana</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Main Card */}
      <div className="max-w-xl w-full mx-auto my-auto py-6">
        <div className="rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 p-6 sm:p-10 shadow-xl space-y-6">
          {/* Header Status Icon */}
          <div className="text-center space-y-3">
            {accountStatus === 'approved' ? (
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
            ) : accountStatus === 'rejected' ? (
              <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
                <XCircle className="w-10 h-10" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
                <Clock className="w-10 h-10 animate-pulse" />
              </div>
            )}

            <div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                  accountStatus === 'approved'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : accountStatus === 'rejected'
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                }`}
              >
                {accountStatus === 'approved'
                  ? '✓ STATUS: DISETUJUI (APPROVED)'
                  : accountStatus === 'rejected'
                  ? '✕ STATUS: DITOLAK (REJECTED)'
                  : '⏳ STATUS: MENUNGGU PERSETUJUAN ADMIN (PENDING)'}
              </span>

              <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mt-3">
                {accountStatus === 'approved'
                  ? 'Akun Anda Telah Aktif!'
                  : accountStatus === 'rejected'
                  ? 'Pendaftaran Ditolak'
                  : 'Pendaftaran Akun Berhasil!'}
              </h1>

              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                {accountStatus === 'approved'
                  ? 'Admin Utama telah menyetujui akun Anda. Seluruh fitur pencatatan dan modul keuangan sudah dapat digunakan.'
                  : accountStatus === 'rejected'
                  ? rejectionReason || 'Pendaftaran akun Anda tidak memenuhi kriteria verifikasi Admin Utama.'
                  : 'Akun Anda telah tersimpan dengan role USER dan berstatus PENDING. Silakan hubungi Admin Utama via WhatsApp untuk verifikasi manual dan aktivasi akun.'}
              </p>
            </div>
          </div>

          {/* Ringkasan Data Akun */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5">
            <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 pb-1 border-b border-zinc-200 dark:border-zinc-800">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> Ringkasan Identitas Pendaftar:
            </div>

            {fullName && (
              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-400" /> Nama Lengkap:
                </span>
                <span className="font-semibold text-zinc-900 dark:text-white">{fullName}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-zinc-400" /> Alamat Email:
              </span>
              <span className="font-semibold text-zinc-900 dark:text-white">{email || '-'}</span>
            </div>

            {phoneNumber && (
              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-zinc-400" /> Nomor WhatsApp:
                </span>
                <span className="font-semibold text-zinc-900 dark:text-white">{phoneNumber}</span>
              </div>
            )}

            {userId && (
              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-400" /> ID Akun:
                </span>
                <span className="font-mono font-semibold text-zinc-900 dark:text-white text-[11px]">{userId}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
              <span>Role Pengguna:</span>
              <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-bold text-[10px] uppercase text-zinc-700 dark:text-zinc-300">
                USER
              </span>
            </div>
          </div>

          {/* Kotak Instruksi Kontak WhatsApp Admin (Ketentuan #4) */}
          {accountStatus !== 'approved' && (
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-emerald-900 dark:text-emerald-200">
                    Langkah Verifikasi: Hubungi Admin Utama via WhatsApp
                  </h3>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Kontak resmi Admin: <strong>{adminContact.fullName}</strong> ({adminContact.phoneNumber})
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Klik tombol di bawah ini untuk membuka chat WhatsApp resmi Admin Utama dengan pesan konfirmasi yang sudah disiapkan secara otomatis.
              </p>

              <a
                href={effectiveWaLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                <span>Buka Chat WhatsApp Admin ({adminContact.phoneNumber})</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>
            </div>
          )}

          {/* PENEGASAN PEMERIKSAAN MANUAL SESUAI KETENTUAN #5 */}
          {accountStatus !== 'approved' && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs leading-relaxed space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>PENTING — KETENTUAN PEMERIKSAAN MANUAL:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-700 dark:text-zinc-300">
                <li>
                  Membuka chat WhatsApp atau mengirim pesan <strong>bukan berarti nomor Anda langsung terverifikasi secara otomatis</strong>.
                </li>
                <li>
                  Pemeriksaan identitas dan aktivasi akun dilakukan secara <strong>MANUAL oleh Admin Utama</strong> melalui Admin Portal.
                </li>
                <li>
                  <strong>Sistem Tata Dana tidak menggunakan kode OTP otomatis</strong> atau layanan SMS/WA berbayar.
                </li>
                <li>
                  Setelah Admin menyetujui akun Anda, tombol periksa status di bawah akan mengizinkan Anda masuk ke dashboard.
                </li>
              </ul>
            </div>
          )}

          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs font-semibold ${
                accountStatus === 'approved'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : accountStatus === 'rejected'
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-500'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
              }`}
            >
              {statusMessage}
            </div>
          )}

          {/* Tombol Aksi */}
          <div className="space-y-3 pt-2">
            {accountStatus === 'approved' ? (
              <Link
                href="/login"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all text-center"
              >
                <LogIn className="w-4 h-4" /> Masuk ke Dashboard Sekarang (Login) →
              </Link>
            ) : (
              <button
                onClick={() => handleCheckStatus()}
                disabled={checking}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                {checking ? 'Memeriksa Status Persetujuan...' : 'Periksa Status Persetujuan Akun'}
              </button>
            )}

            <Link
              href="/login"
              className="block w-full py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs transition-all text-center"
            >
              Kembali ke Halaman Masuk (Login)
            </Link>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-xs text-zinc-400 max-w-md mx-auto">
        Aplikasi Tata Dana &bull; Didukung oleh sistem keamanan berlapis &amp; verifikasi manual Admin Utama.
      </div>
    </div>
  );
}

export default function PendingApprovalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-xs text-zinc-500">
          Memuat halaman persetujuan...
        </div>
      }
    >
      <PendingApprovalContent />
    </Suspense>
  );
}
