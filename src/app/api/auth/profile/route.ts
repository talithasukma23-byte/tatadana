import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase/mock-db';
import { safeJsonParse } from '@/lib/utils';

function extractUserId(req: NextRequest): string {
  // 1. Session cookie (otoritas utama sesi terautentikasi)
  try {
    const sessionCookie = req.cookies.get('tatadana_session')?.value;
    if (sessionCookie) {
      const rawVal = sessionCookie.trim().replace(/^"|"$/g, '');
      let jsonStr = '';
      try {
        jsonStr = Buffer.from(rawVal, 'base64').toString('utf-8');
      } catch {
        jsonStr = rawVal;
      }
      const decoded = safeJsonParse<{ userId?: string; role?: string }>(jsonStr);
      if (decoded && decoded.userId && decoded.userId !== '[object Object]') {
        const queryUserId = req.nextUrl.searchParams.get('userId');
        // Admin berwenang menginspeksi profil pengguna lain; USER publik selalu terikat pada akun miliknya sendiri
        if (queryUserId && queryUserId !== '[object Object]' && (decoded.role === 'superadmin' || decoded.role === 'admin')) {
          return queryUserId;
        }
        return decoded.userId;
      }
    }
  } catch {}

  // 2. Query parameter
  const queryUserId = req.nextUrl.searchParams.get('userId');
  if (queryUserId && queryUserId !== '[object Object]') return queryUserId;

  // 3. Custom header
  const headerUserId = req.headers.get('x-user-id');
  if (headerUserId && headerUserId !== '[object Object]') return headerUserId;

  // 4. Default fallback
  return 'admin-owner-talitha';
}

export async function GET(req: NextRequest) {
  try {
    const userId = extractUserId(req);
    const user = db.getUser(userId);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Pengguna tidak ditemukan' },
        { status: 404 }
      );
    }

    const { password_hash, password_salt, ...safeUser } = user;
    return NextResponse.json({
      success: true,
      user: safeUser,
      walletsCount: db.getWallets(user.id).length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat profil' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    // Verifikasi identitas dari session cookie terautentikasi
    const sessionCookie = req.cookies.get('tatadana_session')?.value;
    let authUser: { id: string; role: string } | null = null;
    if (sessionCookie) {
      try {
        const rawVal = sessionCookie.trim().replace(/^"|"$/g, '');
        let jsonStr = '';
        try {
          jsonStr = Buffer.from(rawVal, 'base64').toString('utf-8');
        } catch {
          jsonStr = rawVal;
        }
        const parsed = safeJsonParse<{ userId?: string; role?: string }>(jsonStr);
        if (parsed?.userId) {
          const u = db.getUser(parsed.userId);
          if (u) authUser = { id: u.id, role: u.role };
        }
      } catch {}
    }

    const targetUserId = body.userId || authUser?.id || extractUserId(req);

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'User ID tidak valid' },
        { status: 400 }
      );
    }

    // OTORISASI: User hanya boleh memperbarui profil miliknya sendiri
    if (authUser && authUser.role !== 'superadmin' && authUser.role !== 'admin' && targetUserId !== authUser.id) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Anda hanya berwenang memperbarui profil akun Anda sendiri.' },
        { status: 403 }
      );
    }

    // STRICT ROLE PROTECTION:
    // User profile update is restricted to personal profile data.
    // 'role' and 'account_status' cannot be modified via profile endpoints.
    const updated = db.updateUserProfile(targetUserId, {
      fullName: body.fullName,
      phoneNumber: body.phoneNumber,
      avatarUrl: body.avatarUrl,
      timezone: body.timezone,
      currency: body.currency,
      dailyReminderEnabled: body.dailyReminderEnabled,
      reminderFrequency: body.reminderFrequency,
      reminderTime1: body.reminderTime1,
      reminderTime2: body.reminderTime2,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Pengguna tidak ditemukan' },
        { status: 404 }
      );
    }

    const { password_hash, password_salt, ...safeUser } = updated;
    return NextResponse.json({
      success: true,
      message: 'Profil berhasil diperbarui.',
      user: safeUser,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memperbarui profil' },
      { status: 500 }
    );
  }
}
