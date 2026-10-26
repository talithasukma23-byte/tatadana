'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, CheckCircle2, ShieldAlert, ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { safeFetchJson } from '@/lib/utils';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!email && typeof window !== 'undefined') {
      const stored = localStorage.getItem('tatadana_user_email');
      if (stored) setEmail(stored);
    }
  }, [email]);

  const handleRequestCode = async () => {
    if (!email) {
      setError('Masukkan alamat email Anda terlebih dahulu.');
      return;
    }
    setResending(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email: email.trim().toLowerCase() }),
      });
      const data = await safeFetchJson(res, { success: false, error: 'Gagal mengirim kode.' });
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Gagal mengirim kode.');

      if (data.devCode) setDevCode(data.devCode);
      setSuccessMsg(`Kode verifikasi baru telah dikirimkan ke ${email}.`);
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim kode verifikasi.');
    } finally {
      setResending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !code) {
      setError('Email dan kode verifikasi 6 digit wajib diisi.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', email: email.trim().toLowerCase(), code: code.trim() }),
      });
      const data = await safeFetchJson(res, { success: false, error: 'Kode verifikasi salah.' });
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Kode verifikasi salah.');

      setSuccessMsg('Email berhasil diverifikasi!');
      setTimeout(() => {
        router.push(`/pending-approval?email=${encodeURIComponent(email)}`);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Kode verifikasi tidak sesuai.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-zinc-50 dark:bg-[#070809] text-zinc-900 dark:text-zinc-100 font-sans p-6 sm:p-12">
      <div className="flex items-center justify-between max-w-xl w-full mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-extrabold text-lg shadow-lg shadow-emerald-500/20">
            T
          </div>
          <span className="font-extrabold text-xl tracking-tight text-zinc-900 dark:text-white">TataDana</span>
        </Link>
        <ThemeToggle />
      </div>

      <div className="max-w-md w-full mx-auto my-auto py-8">
        <div className="rounded-3xl bg-white dark:bg-[#0c0d10] border border-zinc-200/80 dark:border-zinc-800 p-8 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
            <Mail className="w-8 h-8" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
              Verifikasi Email Akun
            </span>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight mt-3">
              Masukkan Kode Verifikasi
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
              Kami telah mengirimkan 6 digit kode verifikasi ke email Anda. Masukkan kode tersebut di bawah ini.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold text-left">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold text-left">
              {successMsg}
            </div>
          )}

          {devCode && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-mono font-bold">
              💡 Kode Verifikasi Dev Simulator: <strong>{devCode}</strong> (atau gunakan universal 123456)
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4 text-xs text-left">
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Alamat Email</label>
              <input
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-zinc-700 dark:text-zinc-300">Kode Verifikasi (6 Digit)</label>
                <button
                  type="button"
                  onClick={handleRequestCode}
                  disabled={resending}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold text-[11px]"
                >
                  {resending ? 'Mengirim...' : 'Kirim Ulang Kode'}
                </button>
              </div>
              <input
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                maxLength={6}
                className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-center text-lg font-mono font-bold tracking-widest focus:border-emerald-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 text-center"
            >
              {loading ? 'Memverifikasi...' : 'Verifikasi Email Sekarang →'}
            </button>
          </form>

          <p className="text-center text-xs text-zinc-400">
            Kembali ke{' '}
            <Link href="/login" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
              Halaman Masuk (Login)
            </Link>
          </p>
        </div>
      </div>

      <div className="text-center text-xs text-zinc-400">
        © 2026 PT TataDana Teknologi Indonesia
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs">Memuat...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
