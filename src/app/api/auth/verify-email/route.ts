import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase/mock-db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, email, code, userId } = body;

    const cleanEmail = (email || '').trim().toLowerCase();

    // 1. Action: REQUEST OTP EMAIL
    if (action === 'request') {
      if (!cleanEmail) {
        return NextResponse.json(
          { success: false, error: 'Email wajib diisi untuk verifikasi.' },
          { status: 400 }
        );
      }

      // Validasi format email dasar
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return NextResponse.json(
          { success: false, error: 'Format alamat email tidak valid.' },
          { status: 400 }
        );
      }

      const otpCode = db.generateEmailOTP(cleanEmail);

      return NextResponse.json({
        success: true,
        message: `Kode verifikasi email telah dikirimkan ke ${cleanEmail}.`,
        devCode: otpCode, // Memudahkan pengujian lokal tanpa biaya SMTP
      });
    }

    // 2. Action: VERIFY OTP EMAIL
    if (action === 'verify') {
      if (!cleanEmail) {
        return NextResponse.json(
          { success: false, error: 'Email wajib diisi.' },
          { status: 400 }
        );
      }

      if (!code) {
        return NextResponse.json(
          { success: false, error: 'Kode verifikasi 6 digit wajib diisi.' },
          { status: 400 }
        );
      }

      const isValid = db.verifyEmailOTP(cleanEmail, code.trim());
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Kode verifikasi email salah atau telah kadaluarsa.' },
          { status: 400 }
        );
      }

      const user = db.getUserByEmailOrUsername(cleanEmail);

      return NextResponse.json({
        success: true,
        message: 'Email berhasil diverifikasi!',
        email: cleanEmail,
        user: user
          ? {
              id: user.id,
              email: user.email,
              full_name: user.full_name,
              email_verified: user.email_verified,
              account_status: user.account_status,
              role: user.role,
            }
          : undefined,
      });
    }

    // 3. Action: STATUS CHECK
    if (action === 'status') {
      const user = (userId && db.getUser(userId)) || (cleanEmail && db.getUserByEmailOrUsername(cleanEmail));
      if (!user) {
        return NextResponse.json({ success: false, error: 'Pengguna tidak ditemukan.' }, { status: 404 });
      }

      const admin = db.profiles.find((p) => p.role === 'superadmin') || db.getUser('admin-owner-talitha');
      const adminPhone = admin?.phone_number || '088222003880';
      const adminName = admin?.full_name || 'Talitha Ayu Sukma (Owner & Superadmin)';
      const cleanAdminPhone = adminPhone.replace(/\D/g, '');
      const waNumber = cleanAdminPhone.startsWith('0') ? '62' + cleanAdminPhone.slice(1) : cleanAdminPhone;
      const prefilledText = `[PERMINTAAN PERSETUJUAN AKUN TATA DANA]

Halo Admin Tata Dana, saya ingin mengajukan persetujuan akun baru.

Nama akun: ${user.full_name}
Email akun: ${user.email}
Nomor WhatsApp: ${user.phone_number || '-'}
ID Akun: ${user.id}
Tujuan: Permintaan persetujuan akun baru

Mohon kesediaan Admin untuk memverifikasi dan menyetujui akun saya agar dapat masuk ke Tata Dana. Terima kasih!`;
      const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(prefilledText)}`;

      return NextResponse.json({
        success: true,
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone_number: user.phone_number,
        email_verified: !!user.email_verified,
        account_status: user.account_status || 'pending',
        role: user.role,
        rejection_reason: user.rejection_reason,
        adminContact: {
          fullName: adminName,
          phoneNumber: adminPhone,
          waNumber,
          waLink,
          messageTemplate: prefilledText,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Aksi verifikasi email tidak valid.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
