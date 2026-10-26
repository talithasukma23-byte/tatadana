import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase/mock-db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const identifier = (body.identifier || body.email || '').trim();
    const password = body.password || '';

    if (!identifier) {
      return NextResponse.json(
        { success: false, error: 'Email atau nama pengguna wajib diisi.' },
        { status: 400 }
      );
    }

    // 1. Cari pengguna berdasarkan email, username telegram, atau nomor HP
    const user =
      db.getUserByEmailOrUsername(identifier) ||
      db.getUserByPhone(identifier);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Akun dengan identitas tersebut belum terdaftar.' },
        { status: 401 }
      );
    }

    // 2. Verifikasi status akun (Role ADMIN langsung APPROVED, User publik bisa PENDING / REJECTED)
    const status = user.account_status || 'approved';
    if (status === 'pending') {
      return NextResponse.json(
        {
          success: false,
          error: 'Akun Anda sedang dalam status PENDING menunggu persetujuan dari Admin Utama. Silakan hubungi admin aplikasi.',
          accountStatus: 'pending',
        },
        { status: 403 }
      );
    }

    if (status === 'rejected') {
      return NextResponse.json(
        {
          success: false,
          error: `Akun Anda telah ditolak oleh Admin. ${user.rejection_reason ? 'Alasan: ' + user.rejection_reason : ''}`,
          accountStatus: 'rejected',
        },
        { status: 403 }
      );
    }

    // 3. Verifikasi kata sandi
    const isPasswordValid = db.verifyUserPassword(user, password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Kata sandi tidak sesuai.' },
        { status: 401 }
      );
    }

    // 4. Verifikasi status email
    if (user.email_verified === false) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email Anda belum diverifikasi. Silakan lakukan verifikasi email terlebih dahulu.',
          accountStatus: 'unverified_email',
          email: user.email,
        },
        { status: 403 }
      );
    }

    // 4. Siapkan payload pengguna yang aman (tanpa password/salt)
    const { password_hash, password_salt, ...safeUser } = user;

    const isAdmin = user.role === 'superadmin' || user.role === 'admin';
    const redirectTo = isAdmin ? '/admin' : '/dashboard';

    const response = NextResponse.json({
      success: true,
      message: `Selamat datang kembali, ${user.full_name}!`,
      user: safeUser,
      role: user.role,
      isAdmin,
      redirectTo,
    });

    // Simpan session cookie terproteksi
    const sessionToken = Buffer.from(
      JSON.stringify({
        userId: user.id,
        role: user.role,
        email: user.email,
        timestamp: Date.now(),
      })
    ).toString('base64');

    response.cookies.set('tatadana_session', sessionToken, {
      path: '/',
      httpOnly: false, // Memungkinkan client sync
      maxAge: 7 * 24 * 3600,
      sameSite: 'lax',
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan sistem login.' },
      { status: 500 }
    );
  }
}
