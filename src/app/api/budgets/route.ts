import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase/mock-db';
import { BudgetPeriodType } from '@/types/database';

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

    const categories = db.getCategories(userId);
    const budgets = db.getBudgets(userId);

    return NextResponse.json({
      success: true,
      categories,
      budgets,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, categoryId, amount, period } = body;

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

    if (!categoryId) {
      return NextResponse.json({ success: false, error: 'categoryId harus diisi' }, { status: 400 });
    }

    const numericAmount = parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
    if (isNaN(numericAmount) || numericAmount < 0) {
      return NextResponse.json({ success: false, error: 'Nominal budget tidak valid' }, { status: 400 });
    }

    const periodType: BudgetPeriodType = period === 'daily' || period === 'weekly' ? period : 'monthly';

    const updatedCategory = db.updateCategoryBudget(targetUserId, categoryId, numericAmount, periodType);
    if (!updatedCategory) {
      return NextResponse.json({ success: false, error: 'Kategori tidak ditemukan' }, { status: 404 });
    }

    const categories = db.getCategories(targetUserId);
    const budgets = db.getBudgets(targetUserId);

    return NextResponse.json({
      success: true,
      category: updatedCategory,
      categories,
      budgets,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}
