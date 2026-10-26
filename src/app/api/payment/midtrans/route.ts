import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase/mock-db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, plan, userId, paymentType, proofImageUrl } = body;
    const targetUserId = userId || 'admin-owner-talitha';
    const user = db.getUser(targetUserId);

    const amount = plan === 'starter' ? 49000 : 99000;
    const orderId = `TD-${plan?.toUpperCase() || 'PRO'}-${Date.now()}`;

    // 1. Action: Inisiasi Transaksi (Midtrans / Manual)
    if (action === 'checkout') {
      const payment = {
        id: 'pay-' + Date.now(),
        order_id: orderId,
        user_id: user.id,
        user_name: user.full_name,
        user_email: user.email,
        plan: (plan || 'pro') as any,
        amount,
        status: paymentType === 'manual_transfer' ? 'pending' : 'settlement',
        payment_type: (paymentType || 'midtrans') as any,
        proof_image_url: proofImageUrl,
        created_at: new Date().toISOString(),
      };

      db.payments.unshift(payment as any);

      // Jika Midtrans simulator di dev, otomatis aktivasi Pro
      if (paymentType !== 'manual_transfer') {
        user.plan = plan || 'pro';
      }

      return NextResponse.json({
        success: true,
        orderId,
        snapToken: `SNAP-TOKEN-SIMULATED-${Date.now()}`,
        status: payment.status,
        message: paymentType === 'manual_transfer' 
          ? 'Bukti transfer berhasil dikirim. Menunggu verifikasi admin.' 
          : 'Pembayaran Midtrans berhasil diproses! Akun Anda kini aktif di paket Pro.',
      });
    }

    // 2. Action: Webhook Callback dari Midtrans
    if (action === 'webhook_notification') {
      const { order_id, transaction_status } = body;
      const payment = db.payments.find((p) => p.order_id === order_id);
      if (payment) {
        if (transaction_status === 'settlement' || transaction_status === 'capture') {
          payment.status = 'settlement';
          const paidUser = db.getUser(payment.user_id);
          if (paidUser) paidUser.plan = payment.plan;
        } else if (transaction_status === 'deny' || transaction_status === 'cancel' || transaction_status === 'expire') {
          payment.status = transaction_status as any;
        }
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ success: false, error: 'Aksi tidak valid' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
