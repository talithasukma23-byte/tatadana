// ====================================================================
// Test Suite: Zero-State Financial Initialization & Persistence
// ====================================================================

import http from 'http';
import fs from 'fs';
import path from 'path';

function makeRequest(url, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    if (postData) {
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json || data,
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('====================================================================');
  console.log('🧪 VERIFIKASI KONDISI AWAL NOL & SISTEM PENYIMPANAN PERMANEN');
  console.log('====================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} ${details ? '— ' + details : ''}`);
      failed++;
    }
  }

  // ------------------------------------------------------------------
  // Tahap 1: Eksekusi Pengosongan Satu Kali (apply_zero_state)
  // ------------------------------------------------------------------
  console.log('--- Tahap 1: Eksekusi Pengosongan Satu Kali ---');
  const applyRes = await makeRequest('http://localhost:3000/api/admin', {
    method: 'POST',
    headers: { 'x-user-id': 'admin-owner-talitha' },
  }, JSON.stringify({ action: 'apply_zero_state' }));

  assert(applyRes.status === 200 && applyRes.data?.success === true, 'Eksekusi apply_zero_state berhasil', JSON.stringify(applyRes.data));
  console.log('');

  // ------------------------------------------------------------------
  // Tahap 2: Verifikasi Kondisi Awal Nol (Zero State)
  // ------------------------------------------------------------------
  console.log('--- Tahap 2: Verifikasi Kondisi Awal Nol ---');
  
  // A. Admin Wallets
  const adminWalletsRes = await makeRequest('http://localhost:3000/api/wallets?userId=admin-owner-talitha');
  const adminWallets = adminWalletsRes.data?.wallets || [];
  const adminTotalBalance = adminWalletsRes.data?.totalBalance;
  assert(adminWallets.length === 4, `Jumlah dompet Admin tetap 4 (ditemukan: ${adminWallets.length})`);
  assert(adminTotalBalance === 0, `Total saldo Admin adalah Rp0 (ditemukan: Rp${adminTotalBalance})`);
  const allAdminZero = adminWallets.every(w => w.balance === 0);
  assert(allAdminZero, 'Setiap dompet Admin (Tunai, BCA, GoPay, Kas Operasional) memiliki saldo tepat Rp0');

  // B. Admin Transactions
  const adminTxRes = await makeRequest('http://localhost:3000/api/transactions?userId=admin-owner-talitha');
  const adminTx = adminTxRes.data?.transactions || [];
  assert(adminTx.length === 0, `Jumlah transaksi Admin adalah 0 (ditemukan: ${adminTx.length})`);

  // C. Admin Budgets
  const adminBudgetsRes = await makeRequest('http://localhost:3000/api/budgets?userId=admin-owner-talitha');
  const adminBudgets = adminBudgetsRes.data?.budgets || [];
  assert(adminBudgets.length === 0, `Jumlah budget Admin adalah 0 (ditemukan: ${adminBudgets.length})`);

  // D. Regular User Starter
  const starterWalletsRes = await makeRequest('http://localhost:3000/api/wallets?userId=user-starter-002');
  const starterWallets = starterWalletsRes.data?.wallets || [];
  const starterTotal = starterWalletsRes.data?.totalBalance;
  assert(starterTotal === 0, `Total saldo User Starter adalah Rp0 (ditemukan: Rp${starterTotal})`);
  assert(starterWallets.every(w => w.balance === 0), 'Seluruh dompet User Starter memiliki saldo Rp0');

  const starterTxRes = await makeRequest('http://localhost:3000/api/transactions?userId=user-starter-002');
  assert((starterTxRes.data?.transactions || []).length === 0, 'Transaksi User Starter adalah 0');

  // E. Keutuhan Akun & Profil
  const usersRes = await makeRequest('http://localhost:3000/api/admin?action=users', {
    headers: { 'x-user-id': 'admin-owner-talitha' },
  });
  const usersList = usersRes.data?.users || [];
  assert(usersList.length >= 10, `Seluruh akun pengguna tetap utuh (${usersList.length} akun terdaftar)`);
  const adminUser = usersList.find(u => u.email === 'talithasukma23@gmail.com' || u.id === 'admin-owner-talitha');
  assert(adminUser && adminUser.role === 'superadmin', 'Akun Admin Utama tetap superadmin');

  // F. Keutuhan File Backup
  const backupLatestPath = path.join(process.cwd(), 'backup', 'pre-reset-financial-backup-latest.json');
  assert(fs.existsSync(backupLatestPath), 'File backup pre-reset tetap aman di disk');
  const backupData = JSON.parse(fs.readFileSync(backupLatestPath, 'utf-8'));
  assert(backupData.transactions.length === 10, 'Backup data lama menyimpan 10 transaksi asli dengan utuh');
  console.log('');

  // ------------------------------------------------------------------
  // Tahap 3: Uji Alur Transaksi Positif & Bebas Saldo Negatif
  // ------------------------------------------------------------------
  console.log('--- Tahap 3: Uji Transaksi & Bebas Saldo Negatif ---');

  // 1. Catat Pemasukan Awal (Setoran Modal Rp1.000.000)
  const cashWallet = adminWallets.find(w => w.name.includes('Tunai')) || adminWallets[0];
  const incomeRes = await makeRequest('http://localhost:3000/api/transactions', {
    method: 'POST',
  }, JSON.stringify({
    userId: 'admin-owner-talitha',
    walletId: cashWallet.id,
    amount: 1000000,
    type: 'income',
    notes: 'Setoran Modal Usaha Awal',
    categoryId: 'cat-007',
  }));

  assert(incomeRes.status === 200 && incomeRes.data?.success === true, 'Pencatatan pemasukan Rp1.000.000 berhasil');
  
  const walletsAfterIncome = (await makeRequest('http://localhost:3000/api/wallets?userId=admin-owner-talitha')).data?.wallets || [];
  const cashAfterIncome = walletsAfterIncome.find(w => w.id === cashWallet.id);
  assert(cashAfterIncome.balance === 1000000, `Saldo dompet Tunai bertambah menjadi Rp1.000.000 (ditemukan: Rp${cashAfterIncome.balance.toLocaleString('id-ID')})`);

  // 2. Catat Pengeluaran (Beli Bahan Operasional Rp200.000)
  const expenseRes = await makeRequest('http://localhost:3000/api/transactions', {
    method: 'POST',
  }, JSON.stringify({
    userId: 'admin-owner-talitha',
    walletId: cashWallet.id,
    amount: 200000,
    type: 'expense',
    notes: 'Pembelian Bahan Makanan',
    categoryId: 'cat-001',
  }));

  assert(expenseRes.status === 200 && expenseRes.data?.success === true, 'Pencatatan pengeluaran Rp200.000 berhasil');

  const walletsAfterExpense = (await makeRequest('http://localhost:3000/api/wallets?userId=admin-owner-talitha')).data?.wallets || [];
  const cashAfterExpense = walletsAfterExpense.find(w => w.id === cashWallet.id);
  assert(cashAfterExpense.balance === 800000, `Saldo dompet Tunai berkurang tepat menjadi Rp800.000 (ditemukan: Rp${cashAfterExpense.balance.toLocaleString('id-ID')})`);
  assert(cashAfterExpense.balance > 0, 'Saldo tetap positif (tidak negatif)');

  // 3. Verifikasi Isolasi Akun: User Starter tidak boleh melihat transaksi Admin
  const starterTxCheck = (await makeRequest('http://localhost:3000/api/transactions?userId=user-starter-002')).data?.transactions || [];
  assert(starterTxCheck.length === 0, 'Isolasi akun terbukti: User Starter tetap memiliki 0 transaksi (tidak melihat data Admin)');
  console.log('');

  // ------------------------------------------------------------------
  // Tahap 4: Uji Sinkronisasi Budget Kategori
  // ------------------------------------------------------------------
  console.log('--- Tahap 4: Uji Sinkronisasi Budget Kategori ---');
  const setBudgetRes = await makeRequest('http://localhost:3000/api/budgets', {
    method: 'POST',
  }, JSON.stringify({
    userId: 'admin-owner-talitha',
    categoryId: 'cat-001',
    amount: 500000,
    period: 'monthly',
  }));

  assert(setBudgetRes.status === 200 && setBudgetRes.data?.success === true, 'Penyetelan target budget Rp500.000 berhasil');
  const adminBudgetsAfter = (await makeRequest('http://localhost:3000/api/budgets?userId=admin-owner-talitha')).data?.budgets || [];
  const cat001Budget = adminBudgetsAfter.find(b => b.category_id === 'cat-001');
  assert(cat001Budget && cat001Budget.amount === 500000, 'Budget kategori Makanan tersimpan Rp500.000');
  console.log('');

  // ------------------------------------------------------------------
  // Tahap 5: Uji Persistensi File Disk (.data-financial.json)
  // ------------------------------------------------------------------
  console.log('--- Tahap 5: Uji Persistensi File Disk (.data-financial.json) ---');
  const financialPath = path.join(process.cwd(), '.data-financial.json');
  assert(fs.existsSync(financialPath), 'File .data-financial.json terbuat dan persisten di disk');

  const diskData = JSON.parse(fs.readFileSync(financialPath, 'utf-8'));
  assert(diskData.zeroStateApplied === true, 'Penanda zeroStateApplied tercatat true di disk');
  assert(diskData.transactions.length === 2, `Data transaksi tersimpan permanen di disk (2 transaksi)`);
  assert(diskData.budgets.length === 1, `Data budget tersimpan permanen di disk (1 budget)`);
  const diskCashWallet = diskData.wallets.find(w => w.id === cashWallet.id);
  assert(diskCashWallet && diskCashWallet.balance === 800000, `Saldo disk dompet Tunai adalah Rp800.000`);
  console.log('');

  // ------------------------------------------------------------------
  // Tahap 6: Cleanup Data Uji agar Bersih Sempurna untuk Pengguna
  // ------------------------------------------------------------------
  console.log('--- Tahap 6: Pembersihan Data Uji (Fresh Zero State untuk User) ---');
  // Hapus 2 transaksi uji
  for (const t of diskData.transactions) {
    await makeRequest(`http://localhost:3000/api/transactions?id=${t.id}&userId=admin-owner-talitha`, {
      method: 'DELETE',
    });
  }
  // Reset saldo dan budget kembali ke 0
  const finalCleanRes = await makeRequest('http://localhost:3000/api/admin', {
    method: 'POST',
    headers: { 'x-user-id': 'admin-owner-talitha' },
  }, JSON.stringify({ action: 'apply_zero_state' }));

  assert(finalCleanRes.status === 200, 'Sistem dikembalikan ke kondisi awal nol bersih');
  const finalWallets = (await makeRequest('http://localhost:3000/api/wallets?userId=admin-owner-talitha')).data?.wallets || [];
  const finalTx = (await makeRequest('http://localhost:3000/api/transactions?userId=admin-owner-talitha')).data?.transactions || [];
  const finalBudgets = (await makeRequest('http://localhost:3000/api/budgets?userId=admin-owner-talitha')).data?.budgets || [];

  assert(finalWallets.every(w => w.balance === 0), 'Kondisi Akhir: Seluruh saldo dompet Rp0');
  assert(finalTx.length === 0, 'Kondisi Akhir: 0 transaksi');
  assert(finalBudgets.length === 0, 'Kondisi Akhir: 0 budget');
  console.log('');

  // ------------------------------------------------------------------
  // Ringkasan
  // ------------------------------------------------------------------
  console.log('====================================================================');
  console.log(`HASIL AKHIR: ${passed} PASS, ${failed} FAIL`);
  console.log('====================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
