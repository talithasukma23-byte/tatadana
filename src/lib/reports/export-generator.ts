// ====================================================================
// TataDana Native Report & Export Generator (PDF & Excel)
// ====================================================================

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction } from '@/types/database';
import { formatRupiah, formatWIB } from '@/lib/utils';
import { db } from '@/lib/supabase/mock-db';

export interface ReportSummary {
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  transactionCount: number;
  topCategories: Array<{ name: string; amount: number; percentage: number }>;
}

export function calculateReportSummary(transactions: Transaction[]): ReportSummary {
  let totalIncome = 0;
  let totalExpense = 0;
  const categoryExpenses: Record<string, number> = {};

  transactions.forEach((tx) => {
    // Transaksi yang tercatat otomatis langsung diperhitungkan dalam laporan keuangan
    if (tx.status === 'rejected') return;

    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else if (tx.type === 'expense') {
      totalExpense += tx.amount;
      const catName = tx.category?.name || 'Lain-lain';
      categoryExpenses[catName] = (categoryExpenses[catName] || 0) + tx.amount;
    }
  });

  const netCashflow = totalIncome - totalExpense;
  const topCategories = Object.entries(categoryExpenses)
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    totalIncome,
    totalExpense,
    netCashflow,
    transactionCount: transactions.length,
    topCategories,
  };
}

/**
 * Generate Excel (.xlsx) file as Buffer / Base64 Data URL
 */
export function generateExcelReport(transactions: Transaction[], dateRange: string, userName: string): { dataUrl: string; fileName: string } {
  const summary = calculateReportSummary(transactions);

  // Sheet 1: Rincian Transaksi
  const rows = transactions.map((t, idx) => ({
    'No': idx + 1,
    'Tanggal (WIB)': formatWIB(t.transaction_date),
    'Tipe': t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer',
    'Kategori': t.category ? `${t.category.emoji} ${t.category.name}` : '-',
    'Dompet': t.wallet?.name || '-',
    'Nominal (Rp)': t.amount,
    'Catatan': t.notes || '-',
    'Sumber': t.source,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 5 },
    { wch: 25 },
    { wch: 15 },
    { wch: 25 },
    { wch: 20 },
    { wch: 18 },
    { wch: 35 },
    { wch: 15 },
  ];

  // Sheet 2: Ringkasan
  const summaryRows = [
    { 'Metrik': 'Nama Pengguna', 'Nilai': userName },
    { 'Metrik': 'Periode Laporan', 'Nilai': dateRange },
    { 'Metrik': 'Total Pemasukan', 'Nilai': formatRupiah(summary.totalIncome) },
    { 'Metrik': 'Total Pengeluaran', 'Nilai': formatRupiah(summary.totalExpense) },
    { 'Metrik': 'Net Cashflow', 'Nilai': formatRupiah(summary.netCashflow) },
    { 'Metrik': 'Jumlah Transaksi', 'Nilai': summary.transactionCount },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rincian Transaksi');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Ringkasan Eksekutif');

  const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
  const fileName = `Laporan_TataDana_${dateRange.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
  const dataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;

  return { dataUrl, fileName };
}

/**
 * Generate PDF file as Data URL
 */
export function generatePdfReport(transactions: Transaction[], dateRange: string, userName: string): { dataUrl: string; fileName: string } {
  const summary = calculateReportSummary(transactions);
  const doc = new jsPDF();

  // 1. Header TataDana
  doc.setFillColor(5, 150, 105); // Emerald Green #059669
  doc.rect(0, 0, 210, 26, 'F');

  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('TataDana — Laporan Keuangan Pribadi', 14, 16);

  // 2. Info Periode & User
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.text(`Pengguna : ${userName}`, 14, 34);
  doc.text(`Periode   : ${dateRange}`, 14, 40);
  doc.text(`Tanggal Cetak: ${formatWIB(new Date())}`, 14, 46);

  // 3. Ringkasan Kotak
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, 52, 182, 22, 2, 2, 'F');

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('TOTAL PEMASUKAN', 20, 60);
  doc.text('TOTAL PENGELUARAN', 80, 60);
  doc.text('NET CASHFLOW', 145, 60);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129); // Green
  doc.text(formatRupiah(summary.totalIncome), 20, 68);

  doc.setTextColor(239, 68, 68); // Red
  doc.text(formatRupiah(summary.totalExpense), 80, 68);

  doc.setTextColor(summary.netCashflow >= 0 ? 16 : 239, summary.netCashflow >= 0 ? 185 : 68, summary.netCashflow >= 0 ? 129 : 68);
  doc.text(formatRupiah(summary.netCashflow), 145, 68);

  // 4. Tabel Transaksi
  const tableData = transactions.map((t, idx) => [
    idx + 1,
    formatWIB(t.transaction_date, { weekday: undefined, year: '2-digit' }),
    t.category ? `${t.category.emoji} ${t.category.name}` : '-',
    t.notes || '-',
    t.wallet?.name || '-',
    t.type === 'income' ? `+${formatRupiah(t.amount)}` : `-${formatRupiah(t.amount)}`,
  ]);

  autoTable(doc, {
    startY: 80,
    head: [['No', 'Tanggal', 'Kategori', 'Catatan', 'Dompet', 'Nominal']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [249, 115, 22],
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 35 },
      2: { cellWidth: 35 },
      3: { cellWidth: 50 },
      4: { cellWidth: 25 },
      5: { cellWidth: 27, halign: 'right', fontStyle: 'bold' },
    },
  });

  const fileName = `Laporan_TataDana_${dateRange.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  const dataUrl = doc.output('datauristring');

  return { dataUrl, fileName };
}
