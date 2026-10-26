import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase/mock-db';

export async function POST(req: NextRequest) {
  try {
    const { action, phoneNumber, code } = await req.json();

    if (!phoneNumber) {
      return NextResponse.json({ success: false, error: 'Nomor HP wajib diisi.' }, { status: 400 });
    }

    // 1. Action: REQUEST OTP
    if (action === 'request') {
      const otpCode = db.generateOTP(phoneNumber);
      // In dev mode, return the OTP directly in response for zero-friction testing
      return NextResponse.json({
        success: true,
        message: 'Kode OTP telah dikirimkan.',
        devCode: otpCode, // Memudahkan pengujian langsung tanpa SMS berbayar
      });
    }

    // 2. Action: VERIFY OTP
    if (action === 'verify') {
      if (!code) {
        return NextResponse.json({ success: false, error: 'Kode OTP wajib diisi.' }, { status: 400 });
      }

      const isValid = db.verifyOTP(phoneNumber, code);
      if (!isValid) {
        return NextResponse.json({ success: false, error: 'Kode OTP salah atau telah kadaluarsa.' }, { status: 400 });
      }

      // Mark user phone as verified
      const user = db.getUserByPhone(phoneNumber) || db.getUser('admin-owner-talitha');
      if (user) {
        user.phone_verified = true;
      }

      return NextResponse.json({
        success: true,
        message: 'Nomor HP berhasil diverifikasi!',
        user,
      });
    }

    return NextResponse.json({ success: false, error: 'Aksi tidak valid.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
