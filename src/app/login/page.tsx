'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, ShieldCheck, Phone, Mail, Lock, Check } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { safeFetchJson } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<'password' | 'phone'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password }),
      });
      const data = await safeFetchJson(res, { success: false, error: 'Gagal memproses login.' });

      if (!res.ok || !data?.success) {
        if (data?.accountStatus === 'pending') {
          router.push(`/pending-approval?email=${encodeURIComponent(email)}`);
          return;
        }
        if (data?.accountStatus === 'unverified_email') {
          router.push(`/verify-email?email=${encodeURIComponent(email)}`);
          return;
        }
        throw new Error(data?.error || 'Gagal masuk.');
      }

      if (typeof window !== 'undefined' && data.user) {
        sessionStorage.removeItem('tatadana_impersonated_user');
        sessionStorage.removeItem('tatadana_impersonated_name');
        localStorage.setItem('tatadana_user_id', data.user.id);
        localStorage.setItem('tatadana_user_role', data.user.role);
        localStorage.setItem('tatadana_user_email', data.user.email);
        localStorage.setItem('tatadana_user_name', data.user.full_name);
        window.dispatchEvent(new CustomEvent('tatadana_profile_updated'));
      }

      router.push(data.redirectTo || (data.isAdmin ? '/admin' : '/dashboard'));
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat masuk.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', phoneNumber: phone }),
      });
      const data = await safeFetchJson(res, { success: false, error: 'Gagal mengirim OTP' });
      if (!data?.success) throw new Error(data?.error || 'Gagal mengirim OTP');

      setOtpSent(true);
      if (data.devCode) setDevCode(data.devCode);
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', phoneNumber: phone, code: otpCode }),
      });
      const data = await safeFetchJson(res, { success: false, error: 'Kode OTP salah' });
      if (!data?.success) throw new Error(data?.error || 'Kode OTP salah');

      if (data.user?.account_status === 'pending') {
        router.push(`/pending-approval?phone=${encodeURIComponent(phone)}`);
        return;
      }

      if (typeof window !== 'undefined' && data.user) {
        localStorage.setItem('tatadana_user_id', data.user.id);
        localStorage.setItem('tatadana_user_role', data.user.role);
        localStorage.setItem('tatadana_user_name', data.user.full_name);
      }

      const isAdmin = data.user?.role === 'superadmin' || data.user?.role === 'admin';
      router.push(isAdmin ? '/admin' : '/dashboard');
    } catch (err: any) {
      setError(err.message || 'Kode OTP salah');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white dark:bg-[#070809] text-zinc-900 dark:text-zinc-100 font-sans">
      {/* KIRI (40%): Branding Panel (Hidden on Mobile) */}
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
            SaaS Fintech Indonesia
          </span>
          <h2 className="text-4xl font-black tracking-tight leading-tight">
            Keuanganmu.<br />Terkontrol.
          </h2>
          <p className="text-emerald-100 text-sm leading-relaxed max-w-sm">
            Catat pemasukan dan pengeluaran semudah kirim chat Telegram. Tanpa ribet, otomatis tersinkron ke dashboard.
          </p>
        </div>

        <div className="relative z-10 text-xs text-emerald-200">
          © 2026 PT TataDana Teknologi Indonesia
        </div>
      </div>

      {/* KANAN (60% Desktop, 100% Mobile): Form */}
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
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              Selamat Datang Kembali
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Masuk ke akun TataDana untuk memantau transaksi keuanganmu.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Tab Metode Login */}
          <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl mb-6 text-xs font-bold">
            <button
              onClick={() => { setMethod('password'); setError(null); }}
              className={`flex-1 py-2 rounded-xl transition-all ${
                method === 'password'
                  ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-zinc-500'
              }`}
            >
              Email & Sandi
            </button>
            <button
              onClick={() => { setMethod('phone'); setError(null); }}
              className={`flex-1 py-2 rounded-xl transition-all ${
                method === 'phone'
                  ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-zinc-500'
              }`}
            >
              Nomor HP (OTP)
            </button>
          </div>

          {/* METHOD 1: PASSWORD */}
          {method === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300">Kata Sandi</label>
                  <a href="#" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">Lupa sandi?</a>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 mt-2"
              >
                {loading ? 'Masuk...' : 'Masuk ke Dashboard'}
              </button>
            </form>
          )}

          {/* METHOD 2: PHONE OTP */}
          {method === 'phone' && (
            <div className="space-y-4 text-xs">
              {!otpSent ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Nomor Handphone (Terhubung Telegram)
                    </label>
                    <input
                      type="text"
                      placeholder="081234567890"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                  >
                    {loading ? 'Mengirim...' : 'Kirim Kode OTP'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  {devCode && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                      💡 Kode OTP Dev Simulator: <strong>{devCode}</strong> (atau gunakan 123456)
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Masukkan 6 Digit Kode OTP
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-center text-lg font-mono font-bold tracking-widest focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                  >
                    {loading ? 'Memverifikasi...' : 'Verifikasi & Masuk'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Social OAuth Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
            </div>
            <span className="relative bg-white dark:bg-[#070809] px-3 text-[11px] text-zinc-400 font-semibold">
              atau lanjutkan dengan
            </span>
          </div>

          {/* Google OAuth Button */}
          <button
            onClick={() => router.push('/dashboard')}
            type="button"
            className="w-full py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            Masuk dengan Google
          </button>

          <p className="text-center text-xs text-zinc-500 mt-6">
            Belum punya akun TataDana?{' '}
            <Link href="/register" className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
              Daftar sekarang
            </Link>
          </p>
        </div>

        <div className="text-center text-[11px] text-zinc-400">
          Dengan masuk, kamu menyetujui Ketentuan Layanan & Kebijakan Privasi TataDana.
        </div>
      </div>
    </div>
  );
}
