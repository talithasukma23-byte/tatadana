import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase/mock-db';
import { safeJsonParse } from '@/lib/utils';

function verifyAdminRole(req: NextRequest, bodyAdminId?: string): { authorized: boolean; adminUser?: any; error?: string } {
  const cookie = req.cookies.get('tatadana_session');
  let cookieUserId: string | undefined;
  if (cookie?.value) {
    try {
      const rawVal = cookie.value.trim().replace(/^"|"$/g, '');
      let jsonStr = '';
      try {
        jsonStr = Buffer.from(rawVal, 'base64').toString('utf-8');
      } catch {
        jsonStr = rawVal;
      }
      const parsed = safeJsonParse<{ userId?: string }>(jsonStr);
      if (parsed?.userId && parsed.userId !== '[object Object]') {
        cookieUserId = parsed.userId;
      }
    } catch {}
  }

  // 1. Prioritas Utama: Jika request memiliki session cookie aktif, periksa akun pengguna sesi tersebut
  if (cookieUserId) {
    const sessionUser = db.getUser(cookieUserId);
    if (!sessionUser) {
      return {
        authorized: false,
        error: 'Akses ditolak: Akun sesi tidak ditemukan di database.',
      };
    }
    if (sessionUser.role !== 'superadmin' && sessionUser.role !== 'admin') {
      return {
        authorized: false,
        error: `Akses ditolak: Akun ${sessionUser.full_name} memiliki role '${sessionUser.role}'. Hanya Admin Utama yang berwenang mengakses Admin Portal atau API Admin.`,
      };
    }
    return { authorized: true, adminUser: sessionUser };
  }

  // 2. Fallback untuk script internal / tes server-to-server tanpa cookie
  const headerUserId = req.headers.get('x-user-id');
  const queryAdminId = req.nextUrl.searchParams.get('adminId');
  const candidateId = headerUserId || queryAdminId || bodyAdminId;

  if (candidateId) {
    const user = db.getUser(candidateId);
    if (user) {
      if (user.role === 'superadmin' || user.role === 'admin') {
        return { authorized: true, adminUser: user };
      }
      return {
        authorized: false,
        error: `Akses ditolak: Akun ${user.full_name} memiliki role '${user.role}'. Hanya Admin Utama yang berwenang melakukan tindakan ini.`,
      };
    }
    return {
      authorized: false,
      error: `Akses ditolak: Identitas '${candidateId}' tidak valid atau tidak memiliki hak akses Admin.`,
    };
  }

  // Jika tidak ada session / identitas sama sekali, tolak akses
  return {
    authorized: false,
    error: 'Akses ditolak: Kredensial Admin tidak ditemukan. Silakan login sebagai Admin Utama.',
  };
}

export async function GET(req: NextRequest) {
  const auth = verifyAdminRole(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'users') {
    return NextResponse.json({
      users: db.profiles.map((p) => ({
        ...p,
        monthlyTransactions: db.getMonthlyTransactionCount(p.id),
      })),
    });
  }

  if (action === 'ai_providers') {
    return NextResponse.json({ providers: db.aiProviders });
  }

  if (action === 'ai_logs') {
    return NextResponse.json({ logs: db.aiLogs });
  }

  if (action === 'payments') {
    return NextResponse.json({ payments: db.getPayments() });
  }

  if (action === 'transactions' || action === 'pending_transactions') {
    const userId = searchParams.get('userId');
    let txs = db.transactions.map((t) => ({
      ...t,
      wallet: db.wallets.find((w) => w.id === t.wallet_id),
      category: db.categories.find((c) => c.id === t.category_id),
      user: db.getUser(t.user_id),
    }));
    if (userId) txs = txs.filter((t) => t.user_id === userId);
    if (action === 'pending_transactions') {
      txs = txs.filter((t) => t.status === 'pending');
    }
    return NextResponse.json({ transactions: txs });
  }

  if (action === 'audit_logs') {
    return NextResponse.json({ auditLogs: db.auditLogs });
  }

  if (action === 'financial_status') {
    return NextResponse.json({
      zeroStateApplied: db.zeroStateApplied,
      walletsCount: db.wallets.length,
      transactionsCount: db.transactions.length,
      budgetsCount: db.budgets.length,
    });
  }

  const allPayments = db.getPayments();
  return NextResponse.json({
    usersCount: db.profiles.length,
    activeProviders: db.aiProviders.filter((p) => p.is_active).length,
    totalLogs: db.aiLogs.length,
    pendingPayments: allPayments.filter((p) => p.status === 'pending').length,
    pendingTransactions: db.transactions.filter((t) => t.status === 'pending').length,
    payments: allPayments,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, providerId, isActive, mode, apiKey, orderId, adminId, reason, targetUserId } = body;

    const auth = verifyAdminRole(req, adminId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
    }
    const currentAdminId = auth.adminUser?.id || adminId || 'admin-owner-talitha';

    // 1. Update AI Provider
    if (action === 'update_provider') {
      const provider = db.aiProviders.find((p) => p.id === providerId || p.name === providerId);
      if (!provider) {
        return NextResponse.json({ success: false, error: 'Provider tidak ditemukan' }, { status: 404 });
      }
      if (typeof isActive === 'boolean') provider.is_active = isActive;
      if (mode) provider.mode = mode;
      if (apiKey) provider.api_key = apiKey;
      provider.updated_at = new Date().toISOString();

      return NextResponse.json({ success: true, provider });
    }

    // 2. Approve Payment
    if (action === 'approve_payment') {
      if (!orderId) return NextResponse.json({ success: false, error: 'orderId harus diisi' }, { status: 400 });
      const result = db.approvePayment(orderId, currentAdminId);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.message }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: result.message, payment: result.payment });
    }

    // 3. Reject Payment
    if (action === 'reject_payment') {
      if (!orderId) return NextResponse.json({ success: false, error: 'orderId harus diisi' }, { status: 400 });
      const result = db.rejectPayment(orderId, reason || 'Bukti transfer tidak valid', currentAdminId);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.message }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: result.message, payment: result.payment });
    }

    // 4. View User Transactions (Troubleshooting with Audit Log)
    if (action === 'view_user_transactions') {
      const user = db.getUser(targetUserId);
      if (!user) return NextResponse.json({ success: false, error: 'User tidak ditemukan' }, { status: 404 });

      // Catat Audit Log demi transparansi privasi pengguna
      db.auditLogs.unshift({
        id: 'audit-' + Date.now(),
        admin_id: currentAdminId,
        admin_name: 'Super Admin',
        target_user_id: user.id,
        target_user_name: user.full_name,
        action: 'view_transactions',
        notes: `Admin mengakses data transaksi untuk keperluan troubleshooting support.`,
        created_at: new Date().toISOString(),
      });

      const txs = db.getTransactions(user.id);
      return NextResponse.json({ success: true, user, transactions: txs });
    }

    // 5. Approve Transaction
    if (action === 'approve_transaction') {
      const { transactionId } = body;
      if (!transactionId) return NextResponse.json({ success: false, error: 'transactionId diperlukan' }, { status: 400 });
      const approved = db.approveTransaction(transactionId, currentAdminId);
      if (!approved) return NextResponse.json({ success: false, error: 'Transaksi tidak ditemukan' }, { status: 404 });
      return NextResponse.json({ success: true, message: `Transaksi ${transactionId} berhasil disetujui!`, transaction: approved });
    }

    // 6. Reject Transaction
    if (action === 'reject_transaction') {
      const { transactionId, reason } = body;
      if (!transactionId) return NextResponse.json({ success: false, error: 'transactionId diperlukan' }, { status: 400 });
      const rejected = db.rejectTransaction(transactionId, reason || 'Ditolak oleh admin', currentAdminId);
      if (!rejected) return NextResponse.json({ success: false, error: 'Transaksi tidak ditemukan' }, { status: 404 });
      return NextResponse.json({ success: true, message: `Transaksi ${transactionId} ditolak.`, transaction: rejected });
    }

    // 7. Approve User Registration
    if (action === 'approve_user') {
      const { targetUserId } = body;
      if (!targetUserId) {
        return NextResponse.json({ success: false, error: 'targetUserId diperlukan' }, { status: 400 });
      }
      const approved = db.approveUser(targetUserId, currentAdminId);
      if (!approved) {
        return NextResponse.json({ success: false, error: 'Pengguna tidak ditemukan' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: `Akun pengguna ${approved.full_name} (${approved.email}) berhasil disetujui dan diaktifkan.`,
        user: approved,
      });
    }

    // 8. Reject User Registration
    if (action === 'reject_user') {
      const { targetUserId, reason: rejectReason } = body;
      if (!targetUserId) {
        return NextResponse.json({ success: false, error: 'targetUserId diperlukan' }, { status: 400 });
      }
      if (targetUserId === 'admin-owner-talitha') {
        return NextResponse.json({ success: false, error: 'Akun Superadmin Utama Pemilik tidak dapat ditolak.' }, { status: 400 });
      }
      const rejected = db.rejectUser(targetUserId, rejectReason || 'Ditolak oleh admin', currentAdminId);
      if (!rejected) {
        return NextResponse.json({ success: false, error: 'Pengguna tidak ditemukan' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: `Akun pengguna ${rejected.full_name} ditolak.`,
        user: rejected,
      });
    }

    // 9. Apply One-Time Zero State for Financial Data
    if (action === 'apply_zero_state') {
      const result = db.applyOneTimeZeroState();
      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: 'Aksi admin tidak valid' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
