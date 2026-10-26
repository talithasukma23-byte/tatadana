import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase/mock-db';

export async function GET() {
  const isLocked = db.isBootstrapLocked();
  return NextResponse.json({
    isLocked,
    message: isLocked
      ? 'Mekanisme bootstrap admin telah dikunci secara permanen. Akun Admin Utama sudah aktif.'
      : 'Sistem siap untuk inisialisasi akun Admin Utama pertama kali.',
  });
}

export async function POST(req: NextRequest) {
  try {
    // 1. Cek apakah bootstrap sudah pernah dijalankan
    if (db.isBootstrapLocked()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Mekanisme bootstrap telah dikunci secara permanen. Akun Admin Utama sudah terdaftar dan tidak dapat dibuat ulang.',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, password, fullName, phone, telegramUsername } = body;

    // 2. Validasi identitas email pemilik
    const targetEmail = (email || 'talithaayusukm').trim();
    if (!targetEmail) {
      return NextResponse.json(
        { success: false, error: 'Email atau username admin wajib diisi.' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Kata sandi minimal 6 karakter demi keamanan akun Admin.' },
        { status: 400 }
      );
    }

    // 3. Eksekusi bootstrap di backend
    const adminUser = db.bootstrapPrimaryAdmin({
      email: targetEmail,
      password,
      fullName: fullName || 'Talitha Ayu Sukma (Owner & Superadmin)',
      phone: phone || '088222003880',
      telegramUsername: telegramUsername || 'talithaayusukm',
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Akun Admin Utama pemilik aplikasi berhasil dibuat dan diaktivasi (Role: superadmin, Status: approved).',
        user: adminUser,
        bootstrapLocked: true,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Gagal memproses inisialisasi akun Admin.',
      },
      { status: 500 }
    );
  }
}
