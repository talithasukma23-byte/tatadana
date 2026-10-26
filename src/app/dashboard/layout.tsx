'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  CreditCard,
  BarChart3,
  Calendar,
  Bot,
  Target,
  Wallet,
  Settings,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  Sparkles,
  Zap,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { db } from '@/lib/supabase/mock-db';
import { useActiveUser } from '@/lib/auth/client-session';
import { UserAvatar } from '@/components/UserAvatar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [impersonatedName, setImpersonatedName] = useState<string | null>(null);
  const { user } = useActiveUser();

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tatadana_user_id');
      localStorage.removeItem('tatadana_user_role');
      localStorage.removeItem('tatadana_user_email');
      localStorage.removeItem('tatadana_user_name');
      sessionStorage.removeItem('tatadana_impersonated_user');
      sessionStorage.removeItem('tatadana_impersonated_name');
      document.cookie = 'tatadana_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    }
  };

  useEffect(() => {
    if (!user) return;
    // Jangan batasi admin atau superadmin
    if (user.role === 'superadmin' || user.role === 'admin') return;

    if (user.email_verified === false) {
      router.push(`/verify-email?email=${encodeURIComponent(user.email || '')}`);
      return;
    }

    if (user.account_status === 'pending') {
      router.push(`/pending-approval?email=${encodeURIComponent(user.email || '')}`);
      return;
    }

    if (user.account_status === 'rejected') {
      handleLogout();
      router.push('/login');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const imp = sessionStorage.getItem('tatadana_impersonated_name');
      if (imp) setImpersonatedName(imp);
    }
  }, []);

  const navItems = [
    { name: 'Beranda', href: '/dashboard', icon: Home },
    { name: 'Transaksi & Kalender', href: '/dashboard/transaksi', icon: CreditCard },
    { name: 'Laporan', href: '/dashboard/laporan', icon: BarChart3 },
    { name: 'Tata AI Bot', href: '/dashboard/tata-ai', icon: Bot, isPro: true },
    { name: 'Budget', href: '/dashboard/budget', icon: Target },
    { name: 'Dompet', href: '/dashboard/wallet', icon: Wallet },
    { name: 'Pengaturan', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-[#070809] text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Impersonation Banner */}
      {impersonatedName && (
        <div className="bg-amber-500 text-zinc-950 px-4 py-2 text-xs font-bold flex items-center justify-between sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <span>⚠️ Mode Impersonasi Aktif: Anda sedang melihat akun <strong>{impersonatedName}</strong> (Troubleshooting)</span>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem('tatadana_impersonated_user');
              sessionStorage.removeItem('tatadana_impersonated_name');
              window.location.href = '/admin';
            }}
            className="px-2.5 py-1 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 text-[11px] font-semibold"
          >
            Kembali ke Admin Center ↗
          </button>
        </div>
      )}
      <div className="flex flex-1 min-h-0">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-[#0d0e11]/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/80 z-40 px-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-black text-lg">
            T
          </div>
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
            TataDana
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 z-30 bg-white dark:bg-[#0c0d10] border-r border-zinc-200 dark:border-zinc-800/80">
        {/* Brand */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/60">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25 text-white font-extrabold text-lg">
              T
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-zinc-900 dark:text-white">Tata</span>
              <span className="font-extrabold text-lg tracking-tight text-emerald-500">Dana</span>
            </div>
          </Link>
          <ThemeToggle />
        </div>

        {/* User Card */}
        <div className="p-4 mx-3 my-3 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/60">
          <div className="flex items-center gap-3">
            <UserAvatar user={user} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-zinc-900 dark:text-zinc-100" suppressHydrationWarning>{user.full_name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {user.role === 'superadmin' ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                    👑 SUPERADMIN
                  </span>
                ) : user.role === 'admin' ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30">
                    🛡️ ADMIN
                  </span>
                ) : (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    user.plan === 'pro' 
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' 
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}>
                    {user.plan === 'pro' ? '★ PRO' : 'STARTER'}
                  </span>
                )}
                <span className="text-[11px] text-zinc-400">
                  {user.timezone === 'Asia/Makassar' ? 'WITA' : user.timezone === 'Asia/Jayapura' ? 'WIT' : 'WIB'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto pt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href)) ||
              (item.href === '/dashboard/transaksi' && pathname.startsWith('/dashboard/calendar'));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'}`} />
                  <span>{item.name}</span>
                </div>
                {item.isPro && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    isActive ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}>
                    PRO
                  </span>
                )}
              </Link>
            );
          })}

          {/* Bagian SUPERADMIN & Admin Portal HANYA muncul untuk role superadmin / admin */}
          {(user?.role === 'superadmin' || user?.role === 'admin') && (
            <>
              <div className="pt-4 pb-2">
                <div className="border-t border-zinc-200 dark:border-zinc-800/80 my-2" />
                <p className="px-3 text-[11px] font-bold tracking-wider text-zinc-400 uppercase">Superadmin</p>
              </div>

              <Link
                href="/admin"
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-teal-600 dark:text-teal-400 hover:bg-teal-500/10 transition-colors"
              >
                <ShieldAlert className="w-4 h-4 text-teal-500" />
                Admin Portal
              </Link>
            </>
          )}
        </nav>

        {/* Telegram Connect Pill & Bottom Info */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800/80">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-500 fill-emerald-500" />
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Telegram Bot</span>
            </div>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500 animate-pulse" />
          </div>
          <Link
            href="/login"
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-500 hover:text-rose-500 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Keluar Akun
          </Link>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
          <div className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-[#0c0d10] p-6 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-extrabold text-lg">
                    T
                  </div>
                  <span className="font-extrabold text-lg text-zinc-900 dark:text-white">
                    Tata<span className="text-emerald-500">Dana</span>
                  </span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-zinc-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Mobile User Card */}
              <div className="p-3 my-4 rounded-xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/60">
                <div className="flex items-center gap-3">
                  <UserAvatar user={user} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate text-zinc-900 dark:text-zinc-100" suppressHydrationWarning>{user.full_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {user.role === 'superadmin' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                          👑 SUPERADMIN
                        </span>
                      ) : (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          user.plan === 'pro' 
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' 
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}>
                          {user.plan === 'pro' ? '★ PRO' : 'STARTER'}
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-400">
                        {user.timezone === 'Asia/Makassar' ? 'WITA' : user.timezone === 'Asia/Jayapura' ? 'WIT' : 'WIB'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <nav className="mt-2 space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium ${
                        isActive
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-md shadow-emerald-500/20'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5" />
                        <span>{item.name}</span>
                      </div>
                      {item.isPro && (
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          isActive ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        }`}>
                          PRO
                        </span>
                      )}
                    </Link>
                  );
                })}
                {(user?.role === 'superadmin' || user?.role === 'admin') && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-teal-500"
                  >
                    <ShieldAlert className="w-5 h-5" />
                    Admin Portal
                  </Link>
                )}
              </nav>
            </div>

            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
              <Link
                href="/login"
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-rose-500"
              >
                <LogOut className="w-4 h-4" />
                Keluar
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 lg:pl-64 flex flex-col min-w-0 pt-16 lg:pt-0">
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
      </div>
    </div>
  );
}
