// ====================================================================
// Test Suite: Verifikasi Pemulihan Relasi Dompet & Alur Transaksi Tata AI
// Membuktikan bahwa wallet-001, wallet-002, dan wallet-003 dikenali secara sah
// oleh admin-owner-talitha dan tidak lagi memicu error "Dompet tidak valid".
// ====================================================================

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('================================================================');
  console.log('   TATADANA: TEST RELASI DOMPET LAMA & INTEGRITAS TATA AI');
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
    // -------------------------------------------------------------------------
    // TEST 1: Verifikasi Kepemilikan Keempat Dompet oleh admin-owner-talitha
    // -------------------------------------------------------------------------
    console.log('--- 1. Verifikasi Kepemilikan Dompet oleh admin-owner-talitha ---');
    const wRes = await fetch(`${BASE_URL}/api/wallets?userId=admin-owner-talitha`);
    const wData = await wRes.json();

    assert(wRes.status === 200, 'API /api/wallets dapat diakses dengan sukses');
    assert(Array.isArray(wData.wallets) && wData.wallets.length === 4, `Jumlah dompet admin tepat 4 (Aktual: ${wData.wallets?.length})`);

    const w1 = wData.wallets.find((w) => w.id === 'wallet-001');
    const w2 = wData.wallets.find((w) => w.id === 'wallet-002');
    const w3 = wData.wallets.find((w) => w.id === 'wallet-003');
    const wAdmin = wData.wallets.find((w) => w.id === 'wallet-admin-talitha');

    assert(w1 && w1.user_id === 'admin-owner-talitha', 'wallet-001 (Tunai) memiliki user_id admin-owner-talitha');
    assert(w2 && w2.user_id === 'admin-owner-talitha', 'wallet-002 (BCA) memiliki user_id admin-owner-talitha');
    assert(w3 && w3.user_id === 'admin-owner-talitha', 'wallet-003 (GoPay/OVO) memiliki user_id admin-owner-talitha');
    assert(wAdmin && wAdmin.user_id === 'admin-owner-talitha', 'wallet-admin-talitha memiliki user_id admin-owner-talitha');

    // -------------------------------------------------------------------------
    // TEST 2: Integritas Relasi Seluruh Transaksi ke Dompet
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Integritas Relasi Seluruh Transaksi Historis ---');
    const txRes = await fetch(`${BASE_URL}/api/transactions?userId=admin-owner-talitha`);
    const txData = await txRes.json();

    assert(txRes.status === 200, 'API /api/transactions sukses dimuat');
    assert(txData.count >= 30, `Jumlah transaksi historis utuh (Aktual: ${txData.count})`);

    // Pastikan setiap transaksi memiliki relasi wallet valid
    const allLinked = txData.transactions.every((t) => t.wallet && t.wallet.name && t.wallet.id === t.wallet_id);
    assert(allLinked, 'Seluruh transaksi terhubung dengan objek wallet yang valid (tidak ada wallet undefined/null)');

    const countW1 = txData.transactions.filter((t) => t.wallet_id === 'wallet-001').length;
    const countW2 = txData.transactions.filter((t) => t.wallet_id === 'wallet-002').length;
    const countW3 = txData.transactions.filter((t) => t.wallet_id === 'wallet-003').length;

    assert(countW1 >= 15, `Transaksi terkait wallet-001 (Tunai) lengkap: ${countW1} transaksi`);
    assert(countW2 >= 10, `Transaksi terkait wallet-002 (BCA) lengkap: ${countW2} transaksi`);
    assert(countW3 >= 7, `Transaksi terkait wallet-003 (GoPay) lengkap: ${countW3} transaksi`);

    // -------------------------------------------------------------------------
    // TEST 3: Transaksi Baru Menggunakan Ketiga Dompet Lama
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Pengujian Transaksi Baru pada Ketiga Dompet Lama ---');

    // Transaksi ke wallet-001 (Tunai)
    const txW1Res = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'admin-owner-talitha',
        walletId: 'wallet-001',
        categoryId: 'cat-001',
        type: 'expense',
        amount: 10000,
        notes: `Uji Dompet Tunai ${Date.now()}`,
      }),
    });
    const txW1Data = await txW1Res.json();
    assert(txW1Res.status === 200 && txW1Data.success === true, 'Transaksi menggunakan wallet-001 (Tunai) berhasil tanpa error');

    // Transaksi ke wallet-002 (BCA)
    const txW2Res = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'admin-owner-talitha',
        walletId: 'wallet-002',
        categoryId: 'cat-001',
        type: 'expense',
        amount: 25000,
        notes: `Uji Dompet BCA ${Date.now()}`,
      }),
    });
    const txW2Data = await txW2Res.json();
    assert(txW2Res.status === 200 && txW2Data.success === true, 'Transaksi menggunakan wallet-002 (BCA) berhasil tanpa error');

    // Transaksi ke wallet-003 (GoPay/OVO)
    const txW3Res = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'admin-owner-talitha',
        walletId: 'wallet-003',
        categoryId: 'cat-002',
        type: 'expense',
        amount: 5000,
        notes: `Uji Dompet GoPay ${Date.now()}`,
      }),
    });
    const txW3Data = await txW3Res.json();
    assert(txW3Res.status === 200 && txW3Data.success === true, 'Transaksi menggunakan wallet-003 (GoPay) berhasil tanpa error');

    // -------------------------------------------------------------------------
    // TEST 4: Proteksi Multi-Tenant (Dompet User Lain Tetap Ditolak)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Proteksi Isolasi Multi-Tenant ---');
    const invalidWalletRes = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'admin-owner-talitha',
        walletId: 'wallet-starter-001', // Milik Budi Santoso
        categoryId: 'cat-001',
        type: 'expense',
        amount: 5000,
        notes: 'Uji Percobaan Pakai Dompet User Lain',
      }),
    });
    const invalidWalletData = await invalidWalletRes.json();
    assert(
      invalidWalletRes.status === 400 && invalidWalletData.error?.includes('tidak valid'),
      'Percobaan transaksi menggunakan dompet pengguna lain tetap ditolak secara aman (HTTP 400)',
      invalidWalletData.error
    );

    // -------------------------------------------------------------------------
    // TEST 5: Alur Tata AI Bot Webhook (Pencatatan Natural ke Dompet Lama)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Alur Tata AI Bot & Telegram Engine ke Dompet Lama ---');
    const botTxRes = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        update_id: Date.now(),
        message: {
          message_id: 11223,
          from: { id: 8806951051, is_bot: false, first_name: 'Talitha', username: 'talithaayusukm' },
          chat: { id: 8806951051, type: 'private', username: 'talithaayusukm' },
          date: Math.floor(Date.now() / 1000),
          text: 'beli kopi 15000 pakai bca',
        },
      }),
    });
    const botTxData = await botTxRes.json();
    assert(botTxRes.status === 200 && botTxData.ok === true, 'Tata AI Bot berhasil memproses transaksi langsung ke dompet BCA');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`HASIL AKHIR: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runTests();
