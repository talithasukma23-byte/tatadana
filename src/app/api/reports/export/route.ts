import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase/mock-db';
import { generatePdfReport, generateExcelReport } from '@/lib/reports/export-generator';

export async function POST(req: NextRequest) {
  try {
    const { format, userId, dateRange, filters } = await req.json();
    const targetUserId = userId || 'admin-owner-talitha';
    const user = db.getUser(targetUserId);

    // Plan Restriction check: Starter cannot export PDF/Excel
    if (user.plan === 'starter') {
      return NextResponse.json({
        success: false,
        error: 'Ekspor laporan PDF dan Excel hanya tersedia untuk pengguna paket Pro. Silakan upgrade paket Anda.',
        upgradeRequired: true,
      }, { status: 403 });
    }

    const txs = db.getTransactions(targetUserId, filters);
    const rangeLabel = dateRange || 'Bulan Ini (Oktober 2026)';

    let exportResult: { dataUrl: string; fileName: string };

    if (format === 'xlsx') {
      exportResult = generateExcelReport(txs, rangeLabel, user.full_name);
    } else {
      exportResult = generatePdfReport(txs, rangeLabel, user.full_name);
    }

    return NextResponse.json({
      success: true,
      fileName: exportResult.fileName,
      dataUrl: exportResult.dataUrl,
      downloadUrl: exportResult.dataUrl,
      message: `Laporan ${format.toUpperCase()} berhasil digenerate!`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
