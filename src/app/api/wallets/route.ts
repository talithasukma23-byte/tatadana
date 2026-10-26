import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase/mock-db';

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId') || 'admin-owner-talitha';
    const user = db.getUser(userId);
    if (user && user.role !== 'superadmin' && user.role !== 'admin') {
      if (user.account_status === 'pending') {
        return NextResponse.json({ success: false, error: 'Akses ditolak: Akun Anda masih berstatus PENDING.' }, { status: 403 });
      }
      if (user.account_status === 'rejected') {
        return NextResponse.json({ success: false, error: 'Akses ditolak: Akun Anda telah ditolak oleh Admin.' }, { status: 403 });
      }
    }

    const wallets = db.getWallets(userId);
    const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);

    return NextResponse.json({
      success: true,
      wallets,
      totalBalance,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, name, type, balance, icon, color, is_default } = body;

    const targetUserId = userId || 'admin-owner-talitha';
    const user = db.getUser(targetUserId);
    if (user && user.role !== 'superadmin' && user.role !== 'admin') {
      if (user.account_status === 'pending') {
        return NextResponse.json({ success: false, error: 'Akses ditolak: Akun Anda masih berstatus PENDING.' }, { status: 403 });
      }
      if (user.account_status === 'rejected') {
        return NextResponse.json({ success: false, error: 'Akses ditolak: Akun Anda telah ditolak oleh Admin.' }, { status: 403 });
      }
    }

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ success: false, error: 'Nama dompet harus diisi' }, { status: 400 });
    }
    const numericBalance = parseFloat(String(balance).replace(/[^0-9.-]/g, '')) || 0;

    const newWallet = db.addWallet({
      user_id: targetUserId,
      name: name.trim(),
      type: type || 'Bank',
      balance: numericBalance,
      icon: icon || '👛',
      color: color || '#3B82F6',
      is_default: Boolean(is_default),
    });

    const wallets = db.getWallets(targetUserId);
    const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);

    return NextResponse.json(
      {
        success: true,
        wallet: newWallet,
        wallets,
        totalBalance,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, walletId, userId, name, type, balance, icon, color, is_default } = body;

    const targetUserId = userId || 'admin-owner-talitha';

    if (action === 'setDefault' && walletId) {
      db.setDefaultWallet(targetUserId, walletId);
      const wallets = db.getWallets(targetUserId);
      const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);
      return NextResponse.json({
        success: true,
        message: 'Default wallet updated',
        wallets,
        totalBalance,
      });
    }

    if (!walletId) {
      return NextResponse.json({ success: false, error: 'walletId diperlukan' }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (balance !== undefined) {
      updateData.balance = parseFloat(String(balance).replace(/[^0-9.-]/g, '')) || 0;
    }
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (is_default !== undefined) updateData.is_default = Boolean(is_default);

    const updated = db.updateWallet(walletId, updateData);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Dompet tidak ditemukan' }, { status: 404 });
    }

    const wallets = db.getWallets(targetUserId);
    const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);

    return NextResponse.json({
      success: true,
      wallet: updated,
      wallets,
      totalBalance,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const walletId = req.nextUrl.searchParams.get('id');
    const userId = req.nextUrl.searchParams.get('userId') || 'admin-owner-talitha';

    if (!walletId) {
      return NextResponse.json({ success: false, error: 'id parameter is required' }, { status: 400 });
    }

    const deleted = db.deleteWallet(walletId);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Dompet tidak ditemukan' }, { status: 404 });
    }

    const wallets = db.getWallets(userId);
    const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);

    return NextResponse.json({
      success: true,
      message: 'Dompet berhasil dihapus',
      wallets,
      totalBalance,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
