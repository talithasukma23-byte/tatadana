'use client';

import { UserProfile } from '@/types/database';

export interface UpgradeProResult {
  success: boolean;
  isExisting?: boolean;
  orderId?: string;
  waLink?: string;
  message?: string;
  error?: string;
}

export interface RequestUpgradeProOptions {
  user: UserProfile;
  onSuccess?: (result: UpgradeProResult) => void;
  onError?: (error: string) => void;
  onLoadingChange?: (loading: boolean) => void;
}

/**
 * Eksekusi pengajuan upgrade PRO:
 * 1. Validasi kelayakan: Bukan Admin pemilik aplikasi, bukan akun yang sudah PRO.
 * 2. Panggil API POST /api/payment/upgrade untuk menyimpan pengajuan dengan ID unik dan pending status.
 * 3. Langsung buka WhatsApp Admin (088222003880) dengan pesan resmi berformat [PENGAJUAN UPGRADE PRO TATA DANA].
 * 4. TIDAK mengalihkan pengguna ke halaman Pengaturan.
 */
export async function executeUpgradePro({
  user,
  onSuccess,
  onError,
  onLoadingChange,
}: RequestUpgradeProOptions): Promise<UpgradeProResult> {
  // Cek kelayakan akun Admin utama (pemilik aplikasi)
  if (
    user.role === 'admin' ||
    user.role === 'superadmin' ||
    user.id === 'admin-owner-talitha' ||
    user.email === 'talithasukma23@gmail.com'
  ) {
    const errorMsg = 'Akun Admin utama (pemilik aplikasi) memiliki akses penuh dan tidak perlu mengajukan upgrade PRO.';
    if (onError) onError(errorMsg);
    else if (typeof window !== 'undefined') alert(errorMsg);
    return { success: false, error: errorMsg };
  }

  // Cek jika akun sudah berstatus PRO
  if (user.plan === 'pro') {
    const errorMsg = 'Akun Anda sudah berstatus PRO aktif. Tidak perlu mengajukan upgrade lagi.';
    if (onError) onError(errorMsg);
    else if (typeof window !== 'undefined') alert(errorMsg);
    return { success: false, error: errorMsg };
  }

  if (onLoadingChange) onLoadingChange(true);

  try {
    const res = await fetch('/api/payment/upgrade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user.id,
      },
      body: JSON.stringify({
        userId: user.id,
        plan: 'pro',
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      const errorMsg = data?.error || 'Gagal memproses pengajuan upgrade PRO.';
      if (onError) onError(errorMsg);
      else if (typeof window !== 'undefined') alert(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Buka WhatsApp resmi Admin di tab baru
    if (data.waLink && typeof window !== 'undefined') {
      window.open(data.waLink, '_blank');
    }

    const result: UpgradeProResult = {
      success: true,
      isExisting: Boolean(data.isExisting),
      orderId: data.payment?.order_id,
      waLink: data.waLink,
      message: data.message,
    };

    if (onSuccess) {
      onSuccess(result);
    }

    return result;
  } catch (err: any) {
    const errorMsg = err?.message || 'Terjadi kesalahan jaringan saat mengajukan upgrade PRO.';
    if (onError) onError(errorMsg);
    else if (typeof window !== 'undefined') alert(errorMsg);
    return { success: false, error: errorMsg };
  } finally {
    if (onLoadingChange) onLoadingChange(false);
  }
}
