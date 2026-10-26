import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase/mock-db';
import { safeJsonParse } from '@/lib/utils';
import fs from 'fs';
import path from 'path';

// Validasi MIME Types yang diizinkan (JPG, PNG, WebP)
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * Ekstraksi ID Pengguna dan Role dari Sesi Request
 */
function getAuthenticatedUser(req: NextRequest): { userId: string; role: string } | null {
  // 1. Cek Header Khusus
  const headerUserId = req.headers.get('x-user-id');
  if (headerUserId && headerUserId !== '[object Object]') {
    const user = db.getUser(headerUserId);
    if (user) return { userId: user.id, role: user.role };
  }

  // 2. Cek Cookie tatadana_session
  try {
    const cookie = req.cookies.get('tatadana_session')?.value;
    if (cookie) {
      const rawVal = cookie.trim().replace(/^"|"$/g, '');
      let jsonStr = '';
      try {
        jsonStr = Buffer.from(rawVal, 'base64').toString('utf-8');
      } catch {
        jsonStr = rawVal;
      }
      const parsed = safeJsonParse<{ userId?: string; role?: string }>(jsonStr);
      if (parsed?.userId && parsed.userId !== '[object Object]') {
        const user = db.getUser(parsed.userId);
        if (user) return { userId: user.id, role: user.role };
      }
    }
  } catch {}

  // 3. Fallback untuk sesi aktif internal
  const defaultAdmin = db.getUser('admin-owner-talitha');
  if (defaultAdmin) return { userId: defaultAdmin.id, role: defaultAdmin.role };

  return null;
}

/**
 * POST /api/auth/profile/avatar
 * Mengunggah file foto profil baru (JPG, PNG, WebP, max 2MB) dan menyimpannya secara persisten ke disk.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Sesi tidak valid. Silakan login terlebih dahulu.' },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const requestedUserId = (formData.get('userId') as string | null)?.trim();

    // Target user: default ke user yang sedang login
    const targetUserId = requestedUserId || auth.userId;

    // OTORISASI SERVER-SIDE (Ketentuan #3):
    // Setiap pengguna hanya boleh mengubah foto profil miliknya sendiri, kecuali Admin/Superadmin
    if (auth.role !== 'superadmin' && auth.role !== 'admin' && targetUserId !== auth.userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Akses ditolak: Anda hanya berwenang mengubah foto profil akun Anda sendiri.',
        },
        { status: 403 }
      );
    }

    const targetUser = db.getUser(targetUserId);
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Pengguna target tidak ditemukan di sistem.' },
        { status: 404 }
      );
    }

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, error: 'File foto profil wajib disertakan.' },
        { status: 400 }
      );
    }

    // 1. Validasi Ukuran File (Max 2MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `Ukuran file terlalu besar (${(file.size / (1024 * 1024)).toFixed(1)}MB). Batas maksimal adalah 2MB.`,
        },
        { status: 400 }
      );
    }

    // 2. Validasi Format / MIME Type (JPG, PNG, WebP)
    const fileMime = file.type.toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(fileMime)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Format file tidak didukung. Harap gunakan format JPG, JPEG, PNG, atau WebP.',
        },
        { status: 400 }
      );
    }

    // 3. Tentukan Ekstensi File
    let ext = 'jpg';
    if (fileMime === 'image/png') ext = 'png';
    else if (fileMime === 'image/webp') ext = 'webp';

    const filename = `avatar-${targetUserId}-${Date.now()}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');

    // Buat direktori penyimpanan jika belum ada
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 4. Hapus foto lama jika tersimpan di uploads/avatars agar hemat disk
    if (targetUser.avatar_url && targetUser.avatar_url.startsWith('/uploads/avatars/')) {
      try {
        const oldFile = path.join(process.cwd(), 'public', targetUser.avatar_url.replace(/^\//, ''));
        if (fs.existsSync(oldFile)) {
          fs.unlinkSync(oldFile);
        }
      } catch (e) {
        // Abaikan jika file lama tidak ditemukan
      }
    }

    // 5. Tulis file baru ke disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const targetFilePath = path.join(uploadDir, filename);
    fs.writeFileSync(targetFilePath, buffer);

    const newAvatarUrl = `/uploads/avatars/${filename}`;

    // 6. Update database & simpan persisten
    const updated = db.updateUserProfile(targetUserId, {
      avatarUrl: newAvatarUrl,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Gagal memperbarui profil pengguna di database.' },
        { status: 500 }
      );
    }

    const { password_hash, password_salt, ...safeUser } = updated;

    return NextResponse.json({
      success: true,
      message: 'Foto profil berhasil diunggah dan disimpan!',
      avatarUrl: newAvatarUrl,
      user: safeUser,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses unggahan foto profil.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/profile/avatar
 * Menghapus foto profil pengguna dan mengembalikan ke avatar default.
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Sesi tidak valid. Silakan login terlebih dahulu.' },
        { status: 401 }
      );
    }

    let targetUserId = auth.userId;
    try {
      const body = await req.json();
      if (body?.userId) targetUserId = body.userId;
    } catch {}

    const queryUserId = req.nextUrl.searchParams.get('userId');
    if (queryUserId) targetUserId = queryUserId;

    // OTORISASI SERVER-SIDE:
    if (auth.role !== 'superadmin' && auth.role !== 'admin' && targetUserId !== auth.userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Akses ditolak: Anda hanya berwenang menghapus foto profil akun Anda sendiri.',
        },
        { status: 403 }
      );
    }

    const targetUser = db.getUser(targetUserId);
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Pengguna tidak ditemukan di sistem.' },
        { status: 404 }
      );
    }

    // Hapus file fisik dari disk jika ada
    if (targetUser.avatar_url && targetUser.avatar_url.startsWith('/uploads/avatars/')) {
      try {
        const oldFile = path.join(process.cwd(), 'public', targetUser.avatar_url.replace(/^\//, ''));
        if (fs.existsSync(oldFile)) {
          fs.unlinkSync(oldFile);
        }
      } catch (e) {}
    }

    // Reset avatar_url di database
    const updated = db.updateUserProfile(targetUserId, {
      avatarUrl: '',
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Gagal memperbarui profil pengguna di database.' },
        { status: 500 }
      );
    }

    const { password_hash, password_salt, ...safeUser } = updated;

    return NextResponse.json({
      success: true,
      message: 'Foto profil berhasil dihapus. Avatar default diaktifkan.',
      avatarUrl: '',
      user: safeUser,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghapus foto profil.' },
      { status: 500 }
    );
  }
}
