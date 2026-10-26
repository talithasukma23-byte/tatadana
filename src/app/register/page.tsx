'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, ShieldCheck, Phone, Mail, Lock, User, Clock, AlertCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { safeFetchJson } from '@/lib/utils';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegisterForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (password.length < 6) {
        throw new Error('Kata sandi minimal 6 karakter.');
      }

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phoneNumber: phoneNumber.trim(),
          password,
        }),
      });

      const data = await safeFetchJson(res, {
        success: false,
        error: 'Gagal menghubungi server pendaftaran.',
      });

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Gagal melakukan pendaftaran akun.');
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('tatadana_user_email', email.trim().toLowerCase());
        localStorage.setItem('tatadana_user_name', fullName.trim());
      }

      // Alihkan langsung ke halaman instruksi verifikasi WhatsApp & menunggu persetujuan
      router.push(
        `/pending-approval?email=${encodeURIComponent(email.trim().toLowerCase())}&name=${encodeURIComponent(
          fullName.trim()
        )}&phone=${encodeURIComponent(phoneNumber.trim())}`
      );
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat mendaftar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white dark:bg-[#070809] text-zinc-900 dark:text-zinc-100 font-sans">
      {/* KIRI (42%): Branding Panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-800 p-12 flex-col justify-between text-white relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white text-emerald-700 flex items-center justify-center font-black text-xl shadow-lg">
              T
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-white">TataDana</span>
          </Link>
        </div>

        <div className="relative z-10 space-y-4">
          <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider">
            Fintech Aman & Terproteksi
          </span>
          <h2 className="text-4xl font-black tracking-tight leading-tight">
            Pencatatan Keuangan<br />Aman & Terpercaya.
          </h2>
          <p className="text-emerald-100 text-sm leading-relaxed max-w-sm">
            Daftarkan diri Anda untuk mulai mencatat keuangan pribadi atau usaha. Demi menjaga integritas data, setiap akun baru ditinjau dan disetujui langsung oleh Admin Utama.
          </p>

          <div className="pt-4 space-y-2 text-xs text-emerald-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>Verifikasi WhatsApp manual oleh Admin Utama</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-300" />
              <span>Persetujuan akun resmi via Admin Portal</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-emerald-200">
          © 2026 PT TataDana Teknologi Indonesia
        </div>
      </div>

      {/* KANAN (58%): Form Pendaftaran */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-12 lg:p-16">
        <div className="flex items-center justify-between">
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold">
              T
            </div>
            <span className="font-extrabold text-lg text-zinc-900 dark:text-white">TataDana</span>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="max-w-md w-full mx-auto my-auto py-8">
          {/* Header Title */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              Daftar Akun Baru
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Lengkapi data di bawah ini untuk membuat akun pengguna TataDana.
            </p>
          </div>

          {/* Info Card Alur Persetujuan Manual */}
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs leading-relaxed space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Proses Persetujuan Pengguna:</span>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
              Akun baru otomatis memiliki role <strong>USER</strong> dengan status <strong>PENDING</strong>. Setelah mendaftar, hubungi Admin Utama via WhatsApp untuk verifikasi manual dan aktivasi akun.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleRegisterForm} className="space-y-4 text-xs">
            {/* Nama Lengkap */}
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-zinc-400" /> Nama Lengkap
              </label>
              <input
                type="text"
                placeholder="Contoh: Budi Santoso"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-zinc-400" /> Alamat Email
              </label>
              <input
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
              />
            </div>

            {/* Nomor WhatsApp */}
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-zinc-400" /> Nomor WhatsApp Aktif
              </label>
              <input
                type="text"
                placeholder="081234567890"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
              />
              <p className="text-[10px] text-zinc-400 mt-1">
                Gunakan nomor yang aktif di WhatsApp untuk verifikasi manual oleh Admin Utama.
              </p>
            </div>

            {/* Kata Sandi */}
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-zinc-400" /> Kata Sandi
              </label>
              <input
                type="password"
                placeholder="Minimal 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
            >
              {loading ? 'Mendaftarkan Akun...' : 'Daftar Akun Baru →'}
            </button>
          </form>

          <p className="text-center text-xs text-zinc-500 mt-6">
            Sudah punya akun yang disetujui?{' '}
            <Link href="/login" className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
              Masuk di sini
            </Link>
          </p>
        </div>

        <div className="text-center text-[11px] text-zinc-400">
          Dengan mendaftar, Anda menyetujui Ketentuan Layanan & Kebijakan Privasi TataDana.
        </div>
      </div>
    </div>
  );
}
