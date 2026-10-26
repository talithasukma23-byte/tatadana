import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase/mock-db';
import { safeJsonParse } from '@/lib/utils';

function getAuthenticatedUserId(req: NextRequest): string | null {
  // 1. Sesi cookie resmi
  const cookieVal = req.cookies.get('tatadana_session')?.value;
  if (cookieVal) {
    try {
      const rawVal = cookieVal.trim().replace(/^"|"$/g, '');
      let jsonStr = '';
      try {
        jsonStr = Buffer.from(rawVal, 'base64').toString('utf-8');
      } catch {
        jsonStr = rawVal;
      }
      const decoded = safeJsonParse<{ userId?: string }>(jsonStr);
      if (decoded?.userId) return decoded.userId;
    } catch {}
  }

  // 2. Fallback header untuk tes script / internal
  const headerUserId = req.headers.get('x-user-id');
  if (headerUserId) return headerUserId;

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Sesi login tidak valid. Silakan login kembali.' }, { status: 401 });
    }

    const user = db.getUser(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Akun pengguna tidak ditemukan.' }, { status: 404 });
    }

    // USER hanya boleh melihat pengajuan miliknya sendiri
    const userPayments = db.getPayments().filter((p) => p.user_id === user.id);
    const activePending = userPayments.find((p) => p.status === 'pending');

    return NextResponse.json({
      success: true,
      payments: userPayments,
      activePending: activePending || null,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        plan: user.plan,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const authUserId = getAuthenticatedUserId(req);
    const targetUserId = authUserId || body.userId;

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'Sesi login tidak valid. Silakan login terlebih dahulu.' },
        { status: 401 }
      );
    }

    const user = db.getUser(targetUserId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Akun pengguna tidak ditemukan di sistem.' },
        { status: 404 }
      );
    }

    if (user.account_status === 'pending') {
      return NextResponse.json(
        { success: false, error: 'Akun Anda masih berstatus PENDING menunggu persetujuan akun dari Admin.' },
        { status: 403 }
      );
    }

    if (user.account_status === 'rejected') {
      return NextResponse.json(
        { success: false, error: 'Akun Anda telah ditolak oleh Admin.' },
        { status: 403 }
      );
    }

    // 1. Admin utama (pemilik aplikasi) tidak perlu mengajukan upgrade PRO
    if (
      user.role === 'admin' ||
      user.role === 'superadmin' ||
      user.id === 'admin-owner-talitha' ||
      user.email === 'talithasukma23@gmail.com'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Akun Admin utama (pemilik aplikasi) memiliki akses penuh dan tidak perlu mengajukan upgrade PRO.',
        },
        { status: 400 }
      );
    }

    // 2. Akun yang sudah PRO tidak perlu mengajukan upgrade lagi
    if (user.plan === 'pro') {
      return NextResponse.json(
        {
          success: false,
          error: 'Akun Anda sudah berstatus PRO aktif. Tidak perlu mengajukan upgrade lagi.',
        },
        { status: 400 }
      );
    }

    const plan = (body.plan || 'pro') as 'pro';
    const amount = 99000;
    const paymentType = 'manual_transfer';

    // 1. Simpan ID pengajuan otomatis dan unik bersama data pengajuan (atau ambil pending yang sudah ada)
    const { payment, isExisting } = db.createPaymentSubmission(user.id, plan, amount, paymentType);

    // 2. Kontak resmi WhatsApp Admin Utama Tata Dana (Talitha Ayu Sukma: 088222003880)
    const admin = db.getUser('admin-owner-talitha') || db.profiles.find((p) => p.email === 'talithasukma23@gmail.com');
    const adminPhone = '088222003880';
    const waNumber = '6288222003880';

    // 3. Format pesan WhatsApp resmi untuk Upgrade PRO (Bagian 4)
    const prefilledText = `[PENGAJUAN UPGRADE PRO TATA DANA]

Halo Admin Tata Dana, saya ingin mengajukan upgrade PRO.

Nama akun: ${user.full_name}
Email akun: ${user.email}
ID Akun: ${user.id}
ID Pengajuan: ${payment.order_id}
Paket: PRO
Harga: Rp99.000 sekali bayar
Status: Menunggu pembayaran

Mohon informasi pembayaran melalui bank atau QRIS. Setelah melakukan pembayaran, saya akan mengirimkan bukti pembayaran melalui WhatsApp ini.`;

    const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(prefilledText)}`;

    return NextResponse.json({
      success: true,
      isExisting,
      message: isExisting
        ? 'Pengajuan upgrade PRO Anda sudah tercatat dan sedang menunggu verifikasi pembayaran.'
        : 'Pengajuan upgrade PRO berhasil dibuat dan tersimpan di sistem.',
      payment,
      waLink,
      messageTemplate: prefilledText,
      adminContact: {
        fullName: admin?.full_name || 'Admin Utama',
        phoneNumber: adminPhone,
        waNumber,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
