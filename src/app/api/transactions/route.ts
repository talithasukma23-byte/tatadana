import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase/mock-db';

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId') || 'admin-owner-talitha';
    const user = db.getUser(userId);
    if (user && user.role !== 'superadmin' && user.role !== 'admin') {
      if (user.account_status === 'pending') {
        return NextResponse.json({ success: false, error: 'Akses ditolak: Akun Anda masih berstatus PENDING dan menunggu persetujuan Admin Utama.' }, { status: 403 });
      }
      if (user.account_status === 'rejected') {
        return NextResponse.json({ success: false, error: 'Akses ditolak: Akun Anda telah ditolak oleh Admin Utama.' }, { status: 403 });
      }
    }

    const filters = {
      type: req.nextUrl.searchParams.get('type') || undefined,
      categoryId: req.nextUrl.searchParams.get('categoryId') || undefined,
      walletId: req.nextUrl.searchParams.get('walletId') || undefined,
      startDate: req.nextUrl.searchParams.get('startDate') || undefined,
      endDate: req.nextUrl.searchParams.get('endDate') || undefined,
      search: req.nextUrl.searchParams.get('search') || undefined,
      date: req.nextUrl.searchParams.get('date') || undefined,
    };

    const transactions = db.getTransactions(userId, filters);
    const wallets = db.getWallets(userId);
    const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);
    const categories = db.getCategories(userId);
    const budgets = db.getBudgets(userId);

    return NextResponse.json(
      {
        success: true,
        count: transactions.length,
        transactions,
        wallets,
        totalBalance,
        categories,
        budgets,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, walletId, categoryId, type, amount, notes, description, transfer_to_wallet_id } = body;

    const targetUserId = userId || 'admin-owner-talitha';
    const user = db.getUser(targetUserId);
    if (user && user.role !== 'superadmin' && user.role !== 'admin') {
      if (user.account_status === 'pending') {
        return NextResponse.json({ success: false, error: 'Akses ditolak: Akun Anda masih berstatus PENDING dan menunggu persetujuan Admin Utama.' }, { status: 403 });
      }
      if (user.account_status === 'rejected') {
        return NextResponse.json({ success: false, error: 'Akses ditolak: Akun Anda telah ditolak oleh Admin Utama.' }, { status: 403 });
      }
    }

    const numericAmount = Number(amount);
    if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Nominal transaksi harus lebih dari 0' }, { status: 400 });
    }

    if (!walletId || typeof walletId !== 'string' || !walletId.trim()) {
      return NextResponse.json({ success: false, error: 'Metode pembayaran atau dompet wajib dipilih' }, { status: 400 });
    }

    // Validasi kepemilikan dompet pengguna
    const userWallets = db.getWallets(targetUserId);
    const selectedWallet = userWallets.find((w) => w.id === walletId);
    if (!selectedWallet) {
      return NextResponse.json({ success: false, error: 'Metode pembayaran atau dompet tidak valid' }, { status: 400 });
    }

    if (type === 'transfer' && transfer_to_wallet_id && selectedWallet.id === transfer_to_wallet_id) {
      return NextResponse.json({ success: false, error: 'Dompet asal dan tujuan transfer tidak boleh sama' }, { status: 400 });
    }

    // Pencegahan Transaksi Ganda (Debouncing / Deduplication 3 detik)
    const now = Date.now();
    const cleanNotes = notes || description || 'Transaksi Otomatis';
    const effectiveUserId =
      targetUserId === 'user-pro-001' || targetUserId === 'admin-owner-talitha'
        ? 'admin-owner-talitha'
        : targetUserId;

    const recentDuplicate = db.transactions.find((t) => {
      const txTime = new Date(t.created_at).getTime();
      const tUser = t.user_id === 'user-pro-001' ? 'admin-owner-talitha' : t.user_id;
      return (
        tUser === effectiveUserId &&
        t.wallet_id === selectedWallet.id &&
        t.amount === numericAmount &&
        t.type === (type || 'expense') &&
        t.notes === cleanNotes &&
        now - txTime < 3000
      );
    });

    if (recentDuplicate) {
      const wallets = db.getWallets(targetUserId);
      const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);
      return NextResponse.json(
        {
          success: false,
          transaction: recentDuplicate,
          isDuplicatePrevented: true,
          error: 'Transaksi sedang diproses atau baru saja dicatat (duplikasi dicegah).',
          message: 'Transaksi sudah tercatat sebelumnya (duplikasi dicegah).',
          wallets,
          totalBalance,
          categories: db.getCategories(targetUserId),
          budgets: db.getBudgets(targetUserId),
        },
        { status: 429 }
      );
    }

    // Transaksi diproses otomatis tanpa verifikasi admin
    const newTx = db.addTransaction({
      user_id: targetUserId,
      wallet_id: selectedWallet.id,
      category_id: categoryId,
      type: type || 'expense',
      amount: numericAmount,
      status: 'approved', // Status Berhasil / Disetujui Otomatis
      description: cleanNotes,
      notes: cleanNotes,
      transaction_date: body.transaction_date || body.transactionDate || new Date().toISOString(),
      source: body.source || 'web_manual',
      is_receipt: body.is_receipt || false,
      receipt_items: body.receipt_items || [],
      transfer_to_wallet_id: transfer_to_wallet_id,
    });

    const wallets = db.getWallets(targetUserId);
    const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);
    const categories = db.getCategories(targetUserId);
    const budgets = db.getBudgets(targetUserId);

    return NextResponse.json(
      {
        success: true,
        message: 'Transaksi berhasil diproses dan saldo dompet telah diperbarui.',
        transaction: newTx,
        wallets,
        totalBalance,
        categories,
        budgets,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { transactionId, userId, amount, categoryId, walletId, type, notes, description, transaction_date, transfer_to_wallet_id } = body;

    if (!transactionId) {
      return NextResponse.json({ success: false, error: 'transactionId diperlukan' }, { status: 400 });
    }

    const targetUserId = userId || 'admin-owner-talitha';
    const updated = db.updateTransaction(
      transactionId,
      {
        amount: amount !== undefined ? Number(amount) : undefined,
        categoryId,
        walletId,
        type,
        notes,
        description,
        transaction_date,
        transfer_to_wallet_id,
      },
      targetUserId
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Transaksi tidak ditemukan atau bukan milik akun ini' }, { status: 404 });
    }

    const wallets = db.getWallets(targetUserId);
    const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);

    return NextResponse.json(
      {
        success: true,
        message: 'Transaksi berhasil diperbarui dan saldo disesuaikan.',
        transaction: updated,
        wallets,
        totalBalance,
        categories: db.getCategories(targetUserId),
        budgets: db.getBudgets(targetUserId),
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const idParam = req.nextUrl.searchParams.get('transactionId') || req.nextUrl.searchParams.get('id');
    const userParam = req.nextUrl.searchParams.get('userId') || 'admin-owner-talitha';

    let txId = idParam;
    let targetUserId = userParam;

    if (!txId) {
      try {
        const body = await req.json();
        txId = body.transactionId || body.id;
        if (body.userId) targetUserId = body.userId;
      } catch (e) {}
    }

    if (!txId) {
      return NextResponse.json({ success: false, error: 'ID transaksi diperlukan' }, { status: 400 });
    }

    const deleted = db.deleteTransaction(txId, targetUserId);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Transaksi tidak ditemukan atau bukan milik akun ini' }, { status: 404 });
    }

    const wallets = db.getWallets(targetUserId);
    const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);

    return NextResponse.json(
      {
        success: true,
        message: 'Transaksi berhasil dihapus dan saldo dompet telah dikembalikan.',
        wallets,
        totalBalance,
        categories: db.getCategories(targetUserId),
        budgets: db.getBudgets(targetUserId),
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
