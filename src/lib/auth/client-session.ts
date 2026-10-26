'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/supabase/mock-db';
import { UserProfile } from '@/types/database';
import { safeJsonParse, safeFetchJson } from '@/lib/utils';

function getServerSessionUserId(): string | null {
  if (typeof window === 'undefined') {
    try {
      const nodeRequire = eval('require');
      const { cookies } = nodeRequire('next/headers');
      const cookieStore = cookies();
      const cookieVal = cookieStore.get('tatadana_session')?.value;
      if (cookieVal) {
        const rawVal = cookieVal.trim().replace(/^"|"$/g, '');
        let jsonStr = '';
        try {
          jsonStr = Buffer.from(rawVal, 'base64').toString('utf-8');
        } catch {
          jsonStr = rawVal;
        }
        const decoded = safeJsonParse<{ userId?: string }>(jsonStr);
        if (decoded?.userId && decoded.userId !== '[object Object]') {
          return decoded.userId;
        }
      }
    } catch {
      // Ignore if outside request context
    }
  }
  return null;
}

/**
 * Mendapatkan ID pengguna yang sedang aktif:
 * Prioritas 1: Akun impersonasi (Superadmin melakukan inspect user)
 * Prioritas 2: tatadana_user_id dari LocalStorage (disimpan saat login)
 * Prioritas 3: tatadana_session dari Cookie
 * Fallback: 'admin-owner-talitha' (Mode default akun pemilik aplikasi)
 */
export function getActiveUserId(): string {
  if (typeof window === 'undefined') {
    const serverUserId = getServerSessionUserId();
    if (serverUserId) return serverUserId;
    return 'admin-owner-talitha';
  }

  // Khusus rute Admin Portal (/admin): SELALU gunakan akun Admin yang sebenarnya (jangan pernah gunakan impersonasi)
  const isAdminRoute = window.location.pathname.startsWith('/admin');

  // 1. Mode impersonasi sesi aktif (HANYA berlaku di luar /admin untuk troubleshooting)
  if (!isAdminRoute) {
    try {
      const impersonated = sessionStorage.getItem('tatadana_impersonated_user');
      if (impersonated && impersonated.trim() && impersonated !== '[object Object]') {
        return impersonated.trim();
      }
    } catch {}
  }

  // 2. Cookie sesi login terverifikasi dari backend (Otoritas Utama)
  try {
    const match = document.cookie.match(/tatadana_session=([^;]+)/);
    if (match && match[1]) {
      const rawCookieVal = decodeURIComponent(match[1]).trim().replace(/^"|"$/g, '');
      if (rawCookieVal && rawCookieVal !== '[object Object]') {
        let jsonStr = '';
        try {
          jsonStr = atob(rawCookieVal);
        } catch {
          jsonStr = rawCookieVal;
        }

        const decoded = safeJsonParse<{ userId?: string }>(jsonStr);
        if (decoded && decoded.userId && decoded.userId !== '[object Object]') {
          return decoded.userId;
        }
      }
    }
  } catch {}

  // 3. ID sesi login di localStorage
  try {
    const localId = localStorage.getItem('tatadana_user_id');
    if (localId && localId.trim() && localId !== '[object Object]') {
      return localId.trim();
    }
  } catch {}

  return 'admin-owner-talitha';
}

/**
 * Mendapatkan profil inisial di client tanpa resiko kebocoran identitas Superadmin ke akun USER
 */
function getInitialClientUser(activeId: string): UserProfile {
  const localUser = db.getUser(activeId);
  if (typeof window !== 'undefined') {
    const storedName = localStorage.getItem('tatadana_user_name');
    const storedEmail = localStorage.getItem('tatadana_user_email');
    const storedRole = localStorage.getItem('tatadana_user_role') as 'superadmin' | 'admin' | 'user' | undefined;

    // Periksa apakah ini akun Admin Utama / Superadmin
    const isAdminAccount =
      activeId === 'admin-owner-talitha' ||
      activeId === 'admin-super-999' ||
      activeId.toLowerCase() === 'talithasukma23@gmail.com' ||
      localUser.id === 'admin-owner-talitha' ||
      localUser.email?.toLowerCase() === 'talithasukma23@gmail.com' ||
      localUser.role === 'superadmin' ||
      localUser.role === 'admin' ||
      storedRole === 'superadmin' ||
      storedRole === 'admin';

    if (isAdminAccount) {
      return {
        ...localUser,
        role: (localUser.role === 'superadmin' || localUser.role === 'admin') ? localUser.role : (storedRole || 'superadmin'),
        account_status: 'approved',
      };
    }

    // Untuk akun USER biasa: pastikan identitas profil sesuai akun yang login
    if (localUser.id !== activeId || storedRole === 'user') {
      return {
        id: activeId,
        email: storedEmail || (activeId.includes('@') ? activeId : `${activeId}@tatadana.local`),
        full_name: storedName || 'Pengguna',
        phone_number: localUser.phone_number || '',
        phone_verified: true,
        email_verified: true,
        plan: 'starter',
        role: 'user',
        account_status: 'approved',
        timezone: 'Asia/Jakarta',
        currency: 'IDR',
        telegram_connected: false,
        daily_reminder_enabled: false,
        reminder_frequency: 1,
        reminder_time_1: '20:00:00',
        reminder_time_2: '12:00:00',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  }
  return localUser;
}

/**
 * Mendapatkan objek UserProfile aktif secara sinkron (in-memory / mock-db).
 */
export function getActiveUserProfile(): UserProfile {
  const activeId = getActiveUserId();
  return getInitialClientUser(activeId);
}

/**
 * Hook React untuk sinkronisasi identitas akun aktif dengan sidebar dan seluruh modul dashboard.
 */
export function useActiveUser() {
  const [userId, setUserId] = useState<string>(() => {
    if (typeof window !== 'undefined') return getActiveUserId();
    return getServerSessionUserId() || 'admin-owner-talitha';
  });
  const [user, setUser] = useState<UserProfile>(() => {
    if (typeof window !== 'undefined') {
      return getInitialClientUser(getActiveUserId());
    }
    const sId = getServerSessionUserId() || 'admin-owner-talitha';
    return db.getUser(sId);
  });
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    const activeId = getActiveUserId();
    setUserId(activeId);

    // Ambil instan dari mock-db lokal / cache
    const localUser = getInitialClientUser(activeId);
    if (localUser) {
      setUser(localUser);
    }

    // Sinkronisasi data server/API
    try {
      const res = await fetch(`/api/auth/profile?userId=${encodeURIComponent(activeId)}`);
      if (res.ok) {
        const data = await safeFetchJson(res);
        if (data && data.success && data.user) {
          setUser(data.user);
          // Sinkronisasi ke profiles in-memory client
          const existingIdx = db.profiles.findIndex(
            (p) => p.id === data.user.id || (p.email && p.email.toLowerCase() === data.user.email?.toLowerCase())
          );
          if (existingIdx >= 0) {
            db.profiles[existingIdx] = { ...db.profiles[existingIdx], ...data.user };
          } else {
            db.profiles.push(data.user);
          }
        }
      }
    } catch {
      // Menggunakan localUser jika offline/error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();

    const handleProfileUpdate = () => {
      fetchProfile();
    };

    window.addEventListener('tatadana_profile_updated', handleProfileUpdate);
    window.addEventListener('storage', handleProfileUpdate);

    return () => {
      window.removeEventListener('tatadana_profile_updated', handleProfileUpdate);
      window.removeEventListener('storage', handleProfileUpdate);
    };
  }, [fetchProfile]);

  return { userId, user, loading, refreshProfile: fetchProfile, setUser };
}

/**
 * Dispatch event pembaruan profil agar seluruh halaman dan sidebar merender ulang seketika.
 */
export function notifyProfileUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tatadana_profile_updated'));
  }
}
