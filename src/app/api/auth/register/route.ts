import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase/mock-db';

export async function GET() {
  try {
    const admin = db.profiles.find((p) => p.role === 'superadmin') || db.getUser('admin-owner-talitha');
    const adminPhone = admin?.phone_number || '088222003880';
    const adminName = admin?.full_name || 'Talitha Ayu Sukma (Owner & Superadmin)';
    const cleanAdminPhone = adminPhone.replace(/\D/g, '');
    const waNumber = cleanAdminPhone.startsWith('0') ? '62' + cleanAdminPhone.slice(1) : cleanAdminPhone;

    return NextResponse.json({
      success: true,
      adminContact: {
        fullName: adminName,
        phoneNumber: adminPhone,
        waNumber,
        waLinkPrefix: `https://wa.me/${waNumber}`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, fullName, phoneNumber, password } = body;

    if (!email || !fullName || !phoneNumber || !password) {
      return NextResponse.json(
        { success: false, error: 'Nama lengkap, email, nomor WhatsApp, dan kata sandi wajib diisi.' },
        { status: 400 }
      );
    }

    if (typeof password === 'string' && password.trim().length < 6) {
      return NextResponse.json(
        { success: false, error: 'Kata sandi minimal 6 karakter.' },
        { status: 400 }
      );
    }

    // Cek format email
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: 'Format alamat email tidak valid.' },
        { status: 400 }
      );
    }

    // Cek duplikasi email
    const existingEmail = db.getUserByEmailOrUsername(cleanEmail);
    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: 'Email tersebut sudah terdaftar di sistem. Silakan login atau gunakan email lain.' },
        { status: 400 }
      );
    }

    // Cek duplikasi nomor WhatsApp
    const cleanPhone = phoneNumber.trim().replace(/\s+/g, '');
    const existingPhone = db.getUserByPhone(cleanPhone);
    if (existingPhone) {
      return NextResponse.json(
        { success: false, error: 'Nomor WhatsApp tersebut sudah terdaftar di sistem Tata Dana.' },
        { status: 400 }
      );
    }

    // STRICT ROLE & STATUS SECURITY:
    // Pengguna publik WAJIB mendapatkan role 'user' dan status 'pending'.
    // Parameter role dari client diabaikan sepenuhnya agar tidak dapat memilih role admin sendiri.
    const newUserId = 'user-' + Date.now();
    
    // Hash password jika diberikan
    let passwordHash: string | undefined;
    let passwordSalt: string | undefined;
    if (password) {
      const crypto = require('crypto');
      passwordSalt = crypto.randomBytes(16).toString('hex');
      passwordHash = crypto.pbkdf2Sync(password, passwordSalt, 10000, 64, 'sha512').toString('hex');
    }

    const newUser = {
      id: newUserId,
      email: cleanEmail,
      full_name: fullName.trim(),
      phone_number: cleanPhone,
      phone_verified: false, // Verifikasi manual via WhatsApp oleh Admin Utama (bukan OTP otomatis)
      email_verified: true,
      plan: 'starter' as const,
      role: 'user' as const, // Strict non-admin role
      account_status: 'pending' as const, // Strict pending status awaiting admin manual approval
      password_hash: passwordHash,
      password_salt: passwordSalt,
      timezone: 'Asia/Jakarta',
      currency: 'IDR',
      telegram_connected: false,
      daily_reminder_enabled: false,
      reminder_frequency: 1 as const,
      reminder_time_1: '20:00:00',
      reminder_time_2: '12:00:00',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.profiles.push(newUser);

    // Dompet default pengguna baru
    db.wallets.push({
      id: 'wallet-' + Date.now(),
      user_id: newUserId,
      name: '💵 Tunai (Cash)',
      balance: 0,
      icon: '💵',
      is_default: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Simpan pendaftaran baru ke disk persisten seketika
    db.persistRegisteredUsers();
    db.persistFinancialData();

    // Catat log pendaftaran
    db.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      admin_id: 'system',
      admin_name: 'Registrasi Publik',
      target_user_id: newUserId,
      target_user_name: newUser.full_name,
      action: 'public_register',
      notes: `Pengguna baru mendaftar (${newUser.email}, WA: ${newUser.phone_number}). Role: USER, Status: PENDING (menunggu verifikasi WhatsApp manual dan persetujuan Admin Utama).`,
      created_at: new Date().toISOString(),
    });

    // Ambil nomor kontak Admin tersimpan (Talitha Ayu Sukma)
    const admin = db.profiles.find((p) => p.role === 'superadmin') || db.getUser('admin-owner-talitha');
    const adminPhone = admin?.phone_number || '088222003880';
    const adminName = admin?.full_name || 'Talitha Ayu Sukma (Owner & Superadmin)';
    const cleanAdminPhone = adminPhone.replace(/\D/g, '');
    const waNumber = cleanAdminPhone.startsWith('0') ? '62' + cleanAdminPhone.slice(1) : cleanAdminPhone;
    const prefilledText = `[PERMINTAAN PERSETUJUAN AKUN TATA DANA]

Halo Admin Tata Dana, saya ingin mengajukan persetujuan akun baru.

Nama akun: ${newUser.full_name}
Email akun: ${newUser.email}
Nomor WhatsApp: ${newUser.phone_number}
ID Akun: ${newUser.id}
Tujuan: Permintaan persetujuan akun baru

Mohon kesediaan Admin untuk memverifikasi dan menyetujui akun saya agar dapat masuk ke Tata Dana. Terima kasih!`;
    const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(prefilledText)}`;

    const { password_hash, password_salt, ...safeUser } = newUser;

    return NextResponse.json(
      {
        success: true,
        message: 'Pendaftaran berhasil! Akun Anda berstatus PENDING dan menunggu verifikasi WhatsApp serta persetujuan dari Admin Utama.',
        user: safeUser,
        accountStatus: 'pending',
        adminContact: {
          fullName: adminName,
          phoneNumber: adminPhone,
          waNumber,
          waLink,
          messageTemplate: prefilledText,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses pendaftaran.' },
      { status: 500 }
    );
  }
}
