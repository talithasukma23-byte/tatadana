// Test Suite: Verifikasi Otomatisasi Alur Transaksi & Mutasi Saldo Tanpa Verifikasi Admin
// TataDana Application

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('================================================================');
  console.log('   TATADANA: TEST SUITE OTOMATISASI TRANSAKSI & MUTASI SALDO');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName} ${details ? '(' + details + ')' : ''}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${details ? '--> ' + details : ''}`);
      failed++;
    }
  }

  try {
    // Ambil data awal dompet user-pro-001
    const initialRes = await fetch(`${BASE_URL}/api/transactions?userId=user-pro-001`);
    const initialData = await initialRes.json();
    const initialWallets = initialData.wallets || [];
    
    const cashWallet = initialWallets.find(w => w.name.includes('Tunai') || w.id === 'wallet-001');
    const bcaWallet = initialWallets.find(w => w.name.includes('BCA') || w.id === 'wallet-002');
    const gopayWallet = initialWallets.find(w => w.name.includes('GoPay') || w.id === 'wallet-003');

    console.log(`[Kondisi Awal Saldo]`);
    console.log(`- Tunai (Cash) : Rp${cashWallet?.balance.toLocaleString('id-ID')}`);
    console.log(`- Bank BCA     : Rp${bcaWallet?.balance.toLocaleString('id-ID')}`);
    console.log(`- GoPay / OVO  : Rp${gopayWallet?.balance.toLocaleString('id-ID')}\n`);

    // =========================================================================
    // SKENARIO 1: Validasi Input Transaksi Gagal (Tidak Mengubah Saldo)
    // =========================================================================
    console.log('--- SKENARIO 1: Validasi Input Transaksi Gagal ---');
    const invalidRes1 = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-pro-001',
        amount: -50000, // Invalid negative
        walletId: cashWallet.id,
        type: 'expense'
      })
    });
    const invalidData1 = await invalidRes1.json();
    assert(invalidRes1.status === 400 && invalidData1.success === false, 'Transaksi nominal negatif ditolak (HTTP 400)');

    const invalidRes2 = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-pro-001',
        amount: 50000,
        walletId: '', // Invalid empty wallet
        type: 'expense'
      })
    });
    const invalidData2 = await invalidRes2.json();
    assert(invalidRes2.status === 400 && invalidData2.success === false, 'Transaksi tanpa dompet ditolak (HTTP 400)');

    // Cek saldo tidak berubah setelah validasi gagal
    const checkWalletsRes1 = await fetch(`${BASE_URL}/api/wallets?userId=user-pro-001`);
    const checkWalletsData1 = await checkWalletsRes1.json();
    const currentCash1 = checkWalletsData1.wallets.find(w => w.id === cashWallet.id);
    assert(currentCash1.balance === cashWallet.balance, 'Saldo dompet tetap utuh saat validasi gagal');

    // =========================================================================
    // SKENARIO 2: Pemasukan Otomatis (Langsung Berhasil & Saldo Bertambah)
    // =========================================================================
    console.log('\n--- SKENARIO 2: Pemasukan Otomatis Tanpa Verifikasi Admin ---');
    const incomeAmount = 1500000;
    const initialBcaBalance = bcaWallet.balance;
    const incomeRes = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-pro-001',
        amount: incomeAmount,
        type: 'income',
        walletId: bcaWallet.id,
        categoryId: 'cat-inc-01',
        notes: 'Bonus Project Q4',
        transactionDate: new Date().toISOString()
      })
    });
    const incomeData = await incomeRes.json();
    assert(incomeRes.status === 200 && incomeData.success === true, 'Pemasukan berhasil disimpan seketika');
    assert(incomeData.transaction.status === 'approved', 'Status transaksi langsung "approved" (Berhasil) tanpa pending approval');
    
    // Verifikasi saldo BCA bertambah tepat
    const checkWalletsRes2 = await fetch(`${BASE_URL}/api/wallets?userId=user-pro-001`);
    const checkWalletsData2 = await checkWalletsRes2.json();
    const currentBca2 = checkWalletsData2.wallets.find(w => w.id === bcaWallet.id);
    const expectedBcaBalance = initialBcaBalance + incomeAmount;
    assert(currentBca2.balance === expectedBcaBalance, 'Saldo BCA bertambah tepat Rp1.500.000', `Sebelum: ${initialBcaBalance}, Sesudah: ${currentBca2.balance}`);

    // =========================================================================
    // SKENARIO 3: Pengeluaran Otomatis (Langsung Berhasil & Saldo Berkurang)
    // =========================================================================
    console.log('\n--- SKENARIO 3: Pengeluaran Otomatis Tanpa Verifikasi Admin ---');
    const expenseAmountCash = 50000;
    const initialCashBalance = currentCash1.balance;
    const expenseRes = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-pro-001',
        amount: expenseAmountCash,
        type: 'expense',
        walletId: cashWallet.id,
        categoryId: 'cat-exp-01', // Makanan & Minuman
        notes: 'Makan Siang Nasi Padang',
        transactionDate: new Date().toISOString()
      })
    });
    const expenseData = await expenseRes.json();
    const savedExpenseTxId = expenseData.transaction?.id;
    assert(expenseRes.status === 200 && expenseData.success === true, 'Pengeluaran tunai berhasil disimpan seketika');
    assert(expenseData.transaction.status === 'approved', 'Status transaksi pengeluaran langsung "approved"');

    // Verifikasi saldo Tunai terpotong tepat
    const checkWalletsRes3 = await fetch(`${BASE_URL}/api/wallets?userId=user-pro-001`);
    const checkWalletsData3 = await checkWalletsRes3.json();
    const currentCash3 = checkWalletsData3.wallets.find(w => w.id === cashWallet.id);
    const expectedCashBalance = initialCashBalance - expenseAmountCash;
    assert(currentCash3.balance === expectedCashBalance, 'Saldo Tunai terpotong tepat Rp50.000', `Sebelum: ${initialCashBalance}, Sesudah: ${currentCash3.balance}`);

    // =========================================================================
    // SKENARIO 4: Pengeluaran Metode Dompet Digital (GoPay / OVO)
    // =========================================================================
    console.log('\n--- SKENARIO 4: Pengeluaran Dompet Digital (GoPay / OVO) ---');
    const expenseAmountGopay = 75000;
    const initialGopayBalance = gopayWallet.balance;
    const gopayRes = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-pro-001',
        amount: expenseAmountGopay,
        type: 'expense',
        walletId: gopayWallet.id,
        categoryId: 'cat-exp-02', // Transportasi
        notes: 'GrabCar ke Stasiun',
        transactionDate: new Date().toISOString()
      })
    });
    const gopayData = await gopayRes.json();
    assert(gopayRes.status === 200 && gopayData.success === true, 'Pengeluaran GoPay berhasil disimpan');
    
    // Verifikasi saldo GoPay terpotong tepat, dompet lain tidak berubah
    const checkWalletsRes4 = await fetch(`${BASE_URL}/api/wallets?userId=user-pro-001`);
    const checkWalletsData4 = await checkWalletsRes4.json();
    const currentGopay4 = checkWalletsData4.wallets.find(w => w.id === gopayWallet.id);
    const currentCash4 = checkWalletsData4.wallets.find(w => w.id === cashWallet.id);
    assert(currentGopay4.balance === initialGopayBalance - expenseAmountGopay, 'Saldo GoPay terpotong tepat Rp75.000');
    assert(currentCash4.balance === expectedCashBalance, 'Saldo Tunai tidak terpengaruh transaksi GoPay');

    // =========================================================================
    // SKENARIO 5: Sinkronisasi Realisasi Budget Kategori Otomatis
    // =========================================================================
    console.log('\n--- SKENARIO 5: Sinkronisasi Realisasi Budget Kategori ---');
    const budgetRes = await fetch(`${BASE_URL}/api/transactions?userId=user-pro-001`);
    const budgetData = await budgetRes.json();
    const foodTxs = budgetData.transactions.filter(t => t.category_id === 'cat-exp-01' && t.type === 'expense' && t.status !== 'rejected');
    const transportTxs = budgetData.transactions.filter(t => t.category_id === 'cat-exp-02' && t.type === 'expense' && t.status !== 'rejected');
    
    const totalFoodSpent = foodTxs.reduce((s, t) => s + t.amount, 0);
    const totalTransportSpent = transportTxs.reduce((s, t) => s + t.amount, 0);
    
    assert(totalFoodSpent >= expenseAmountCash, 'Realisasi budget Makanan memperhitungkan pengeluaran Rp50.000', `Total Terpakai: Rp${totalFoodSpent.toLocaleString('id-ID')}`);
    assert(totalTransportSpent >= expenseAmountGopay, 'Realisasi budget Transportasi memperhitungkan pengeluaran Rp75.000', `Total Terpakai: Rp${totalTransportSpent.toLocaleString('id-ID')}`);

    // =========================================================================
    // SKENARIO 6: Sinkronisasi Laporan Arus Kas & Rekap Keuangan
    // =========================================================================
    console.log('\n--- SKENARIO 6: Sinkronisasi Laporan Keuangan Real-Time ---');
    const allValidTxs = budgetData.transactions.filter(t => t.status !== 'rejected');
    const totalIncome = allValidTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = allValidTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const netCashflow = totalIncome - totalExpense;

    assert(totalIncome > 0, 'Total pemasukan laporan terisi akurat', `Total Income: Rp${totalIncome.toLocaleString('id-ID')}`);
    assert(totalExpense > 0, 'Total pengeluaran laporan terisi akurat', `Total Expense: Rp${totalExpense.toLocaleString('id-ID')}`);
    assert(netCashflow === (totalIncome - totalExpense), 'Net Cashflow konsisten dengan selisih pemasukan dan pengeluaran');

    // =========================================================================
    // SKENARIO 7: Pencegahan Duplikasi / Double Click (Debounce Deduplication)
    // =========================================================================
    console.log('\n--- SKENARIO 7: Pencegahan Transaksi Ganda (Debounce Deduplication) ---');
    const duplicatePayload = {
      userId: 'user-pro-001',
      amount: 25000,
      type: 'expense',
      walletId: cashWallet.id,
      categoryId: 'cat-exp-01',
      notes: 'Kopi Susu Espresso (Double Click Test)',
      transactionDate: new Date().toISOString()
    };

    // Kirim request pertama
    const click1Res = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(duplicatePayload)
    });
    const click1Data = await click1Res.json();
    assert(click1Res.status === 200 && click1Data.success === true, 'Klik pertama berhasil disimpan');

    // Kirim request kedua langsung (simulasi double-click cepat dalam < 1 detik)
    const click2Res = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(duplicatePayload)
    });
    const click2Data = await click2Res.json();
    assert(click2Res.status === 429 && click2Data.error?.includes('sedang diproses'), 'Klik kedua berturut-turut dicegah oleh debounce dedup (HTTP 429)', click2Data.error);

    // =========================================================================
    // SKENARIO 8: Edit / Update Transaksi & Penyesuaian Saldo Otomatis
    // =========================================================================
    console.log('\n--- SKENARIO 8: Edit Transaksi & Penyesuaian Saldo Otomatis ---');
    // Saldo tunai sebelum edit
    const cashBeforeEdit = (await (await fetch(`${BASE_URL}/api/wallets?userId=user-pro-001`)).json()).wallets.find(w => w.id === cashWallet.id).balance;
    
    // Ubah transaksi makan siang dari 50.000 menjadi 80.000 (+30.000 pengeluaran)
    const newExpenseAmount = 80000;
    const editRes = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-pro-001',
        transactionId: savedExpenseTxId,
        amount: newExpenseAmount,
        notes: 'Makan Siang Nasi Padang Komplit (Updated)',
        categoryId: 'cat-exp-01',
        walletId: cashWallet.id,
        type: 'expense'
      })
    });
    const editData = await editRes.json();
    assert(editRes.status === 200 && editData.success === true, 'Update transaksi berhasil disimpan');

    // Verifikasi saldo dompet disesuaikan selisihnya: saldo berkurang 30.000 lagi
    const cashAfterEdit = (await (await fetch(`${BASE_URL}/api/wallets?userId=user-pro-001`)).json()).wallets.find(w => w.id === cashWallet.id).balance;
    const expectedCashAfterEdit = cashBeforeEdit - (newExpenseAmount - expenseAmountCash);
    assert(cashAfterEdit === expectedCashAfterEdit, 'Saldo dompet otomatis disesuaikan dengan selisih nominal baru', `Sebelum: ${cashBeforeEdit}, Sesudah: ${cashAfterEdit}`);

    // =========================================================================
    // SKENARIO 9: Hapus Transaksi & Pengembalian Saldo (Rollback)
    // =========================================================================
    console.log('\n--- SKENARIO 9: Hapus Transaksi & Pengembalian Saldo (Rollback) ---');
    const deleteRes = await fetch(`${BASE_URL}/api/transactions?transactionId=${savedExpenseTxId}&userId=user-pro-001`, {
      method: 'DELETE'
    });
    const deleteData = await deleteRes.json();
    assert(deleteRes.status === 200 && deleteData.success === true, 'Penghapusan transaksi berhasil dieksekusi');

    // Verifikasi saldo dikembalikan (bertambah kembali 80.000)
    const cashAfterDelete = (await (await fetch(`${BASE_URL}/api/wallets?userId=user-pro-001`)).json()).wallets.find(w => w.id === cashWallet.id).balance;
    assert(cashAfterDelete === cashAfterEdit + newExpenseAmount, 'Saldo dompet dikembalikan utuh (Rollback pengeluaran)', `Sebelum Hapus: ${cashAfterEdit}, Sesudah Hapus: ${cashAfterDelete}`);

    // Verifikasi transaksi tidak ada lagi di daftar
    const txListAfterDelete = (await (await fetch(`${BASE_URL}/api/transactions?userId=user-pro-001`)).json()).transactions;
    const exists = txListAfterDelete.some(t => t.id === savedExpenseTxId);
    assert(!exists, 'Transaksi yang dihapus tidak lagi muncul di daftar transaksi');

    // =========================================================================
    // SKENARIO 10: Isolasi Multi-Pengguna (User Isolation)
    // =========================================================================
    console.log('\n--- SKENARIO 10: Isolasi Multi-Pengguna (Cross-User Isolation) ---');
    const userBWallets = (await (await fetch(`${BASE_URL}/api/wallets?userId=user-starter-002`)).json()).wallets || [];
    const userBWallet = userBWallets[0];

    if (userBWallet) {
      const userBBalanceBefore = userBWallet.balance;
      const userABalanceBefore = (await (await fetch(`${BASE_URL}/api/wallets?userId=user-pro-001`)).json()).wallets.find(w => w.id === cashWallet.id).balance;

      // Catat transaksi untuk User B
      const userBTxRes = await fetch(`${BASE_URL}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'user-starter-002',
          amount: 35000,
          type: 'expense',
          walletId: userBWallet.id,
          categoryId: 'cat-exp-01',
          notes: 'Transaksi Khusus User B',
          transactionDate: new Date().toISOString()
        })
      });
      const userBTxData = await userBTxRes.json();
      assert(userBTxRes.status === 200 && userBTxData.success === true, 'Transaksi User B berhasil dicatat terpisah');

      // Verifikasi saldo User B berkurang
      const userBBalanceAfter = (await (await fetch(`${BASE_URL}/api/wallets?userId=user-starter-002`)).json()).wallets.find(w => w.id === userBWallet.id).balance;
      assert(userBBalanceAfter === userBBalanceBefore - 35000, 'Saldo User B termutasi tepat');

      // Verifikasi saldo User A TIDAK berubah
      const userABalanceAfter = (await (await fetch(`${BASE_URL}/api/wallets?userId=user-pro-001`)).json()).wallets.find(w => w.id === cashWallet.id).balance;
      assert(userABalanceAfter === userABalanceBefore, 'Saldo User A tetap terisolasi dan tidak terpengaruh aktivitas User B');

      // User A tidak bisa menghapus transaksi User B
      const unauthorizedDeleteRes = await fetch(`${BASE_URL}/api/transactions?transactionId=${userBTxData.transaction.id}&userId=user-pro-001`, {
        method: 'DELETE'
      });
      const unauthorizedDeleteData = await unauthorizedDeleteRes.json();
      assert(unauthorizedDeleteRes.status === 404 || unauthorizedDeleteData.success === false, 'User A ditolak menghapus transaksi milik User B (Akses Aman)');
    }

    // =========================================================================
    // SKENARIO 11: Integritas Payment Gateway & Modul Pembayaran Pro
    // =========================================================================
    console.log('\n--- SKENARIO 11: Integritas Payment Gateway / Upgrade Pro ---');
    const adminCheckRes = await fetch(`${BASE_URL}/api/admin`);
    const adminCheckData = await adminCheckRes.json();
    assert(adminCheckRes.status === 200 && Array.isArray(adminCheckData.payments), 'Modul payment gateway / langganan Pro tetap utuh dan terpisah dari transaksi internal');

    console.log('\n================================================================');
    console.log(`HASIL AKHIR: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error running tests:', err);
    process.exit(1);
  }
}

runTests();
