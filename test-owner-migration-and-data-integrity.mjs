// ====================================================================
// Test Suite: Verifikasi Pemulihan Data Keuangan & Identitas Pemilik TataDana
// Sesuai Arahan Pengguna: Mengganti identitas akun demo ke pemilik (Talitha Ayu Sukma)
// tanpa kehilangan data transaksi, saldo, dompet, budget, dan laporan keuangan.
// ====================================================================

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('================================================================');
  console.log('   TATADANA: TEST PEMULIHAN IDENTITAS PEMILIK & INTEGRITAS DATA');
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
    // 1. Identitas Akun Pemilik & Role Superadmin
    // -------------------------------------------------------------------------
    console.log('--- 1. Identitas Akun Pemilik (Talitha Ayu Sukma) & Role Superadmin ---');
    const profRes = await fetch(`${BASE_URL}/api/auth/profile?userId=admin-owner-talitha`);
    const profData = await profRes.json();

    assert(profRes.status === 200, 'Endpoint /api/auth/profile dapat diakses dengan sukses');
    assert(profData.success === true, 'Response profil sukses');
    assert(
      profData.user?.full_name.includes('Talitha Ayu Sukma'),
      'Nama pemilik tampil sesuai profil akun',
      profData.user?.full_name
    );
    assert(profData.user?.role === 'superadmin', 'Role akun pemilik adalah superadmin', profData.user?.role);
    assert(profData.user?.account_status === 'approved', 'Status akun pemilik adalah approved');
    assert(profData.user?.email === 'talithasukma23@gmail.com', 'Email pemilik terkonfigurasi dengan benar');

    // Default fallback tanpa query param
    const defProfRes = await fetch(`${BASE_URL}/api/auth/profile`);
    const defProfData = await defProfRes.json();
    assert(
      defProfData.user?.id === 'admin-owner-talitha',
      'Default user fallback mengarah ke akun pemilik aplikasi',
      defProfData.user?.id
    );

    // Profil demo Alex Pratama tetap tersimpan terpisah
    const alexProfRes = await fetch(`${BASE_URL}/api/auth/profile?userId=user-pro-001`);
    const alexProfData = await alexProfRes.json();
    assert(
      alexProfData.user?.full_name === 'Alex Pratama',
      'Profil demo Alex Pratama tetap tersimpan utuh dan tidak terhapus'
    );

    // -------------------------------------------------------------------------
    // 2. Data Keuangan Pemilik: Saldo, Dompet, dan Riwayat Transaksi Utuh
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Data Keuangan Akun Pemilik (Saldo, Dompet, & Transaksi Utuh) ---');
    const txRes = await fetch(`${BASE_URL}/api/transactions?userId=admin-owner-talitha`);
    const txData = await txRes.json();

    assert(txRes.status === 200, 'API /api/transactions untuk admin-owner-talitha sukses diakses');
    assert(txData.count >= 10, `Seluruh transaksi demo tampil pada akun pemilik (Total: ${txData.count} transaksi)`);
    assert(txData.totalBalance > 0, `Saldo total pemilik tidak nol (Total: Rp${txData.totalBalance.toLocaleString('id-ID')})`);
    assert(txData.wallets.length >= 3, `Daftar dompet pemilik lengkap (${txData.wallets.length} dompet)`);

    const walletNames = txData.wallets.map((w) => w.name);
    assert(walletNames.some((n) => n.includes('Tunai')), 'Dompet Tunai (Cash) tersedia pada akun pemilik');
    assert(walletNames.some((n) => n.includes('BCA')), 'Dompet Rekening BCA tersedia pada akun pemilik');
    assert(walletNames.some((n) => n.includes('GoPay') || n.includes('OVO')), 'Dompet GoPay/OVO tersedia pada akun pemilik');
    assert(walletNames.some((n) => n.includes('Kas Operasional')), 'Dompet Kas Operasional Admin tersedia pada akun pemilik');

    // Pastikan integritas deskripsi/catatan transaksi asli tidak dirusak
    const notesList = txData.transactions.map((t) => t.description || t.notes || '');
    assert(
      notesList.some((n) => n.includes('PT Teknologi Nusantara')),
      'Catatan transaksi "Gaji Bulan Ini PT Teknologi Nusantara" tetap utuh'
    );
    assert(
      notesList.some((n) => n.includes('Nasi Padang')),
      'Catatan transaksi "Makan siang Nasi Padang + Es Teh" tetap utuh'
    );
    assert(
      notesList.some((n) => n.includes('Superindo')),
      'Catatan transaksi "Struk Belanja Bulanan Superindo" tetap utuh'
    );

    // -------------------------------------------------------------------------
    // 3. Modul Dompet (/api/wallets)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Modul Dompet (/api/wallets) ---');
    const walletRes = await fetch(`${BASE_URL}/api/wallets?userId=admin-owner-talitha`);
    const walletData = await walletRes.json();

    assert(walletRes.status === 200, 'API /api/wallets sukses diakses');
    assert(walletData.wallets.length >= 3, `Jumlah dompet valid (${walletData.wallets.length} dompet)`);
    assert(walletData.totalBalance > 0, `Total saldo konsisten (Rp${walletData.totalBalance.toLocaleString('id-ID')})`);

    // -------------------------------------------------------------------------
    // 4. Modul Budget (/api/budgets)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Modul Budget (/api/budgets) ---');
    const budgetRes = await fetch(`${BASE_URL}/api/budgets?userId=admin-owner-talitha`);
    const budgetData = await budgetRes.json();

    assert(budgetRes.status === 200, 'API /api/budgets sukses diakses');
    assert(budgetData.categories.length >= 8, `Kategori pengeluaran & pemasukan lengkap (${budgetData.categories.length} kategori)`);
    assert(budgetData.budgets.length >= 3, `Batas anggaran kategori aktif (${budgetData.budgets.length} budget)`);

    // -------------------------------------------------------------------------
    // 5. Pencatatan Transaksi Baru Otomatis (Auto Mutation)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Pencatatan Transaksi Baru Otomatis untuk Akun Pemilik ---');
    const primaryWallet = txData.wallets.find((w) => w.id === 'wallet-001') || txData.wallets[0];
    const initialBalance = primaryWallet.balance;
    const testNominal = 15000;

    const addTxRes = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'admin-owner-talitha',
        walletId: primaryWallet.id,
        categoryId: 'cat-001',
        type: 'expense',
        amount: testNominal,
        notes: `Uji Transaksi Pemilik ${Date.now()}`,
      }),
    });
    const addTxData = await addTxRes.json();

    assert(addTxRes.status === 200, 'Transaksi baru berhasil disimpan');
    assert(addTxData.success === true, 'Response transaksi baru sukses');
    assert(addTxData.transaction?.status === 'approved', 'Transaksi langsung berstatus approved tanpa menunggu persetujuan');

    // Verifikasi saldo dompet langsung berkurang
    const verifyWalletRes = await fetch(`${BASE_URL}/api/wallets?userId=admin-owner-talitha`);
    const verifyWalletData = await verifyWalletRes.json();
    const updatedWallet = verifyWalletData.wallets.find((w) => w.id === primaryWallet.id);

    assert(
      updatedWallet.balance === initialBalance - testNominal,
      `Saldo dompet langsung terpotong seketika (Sebelum: Rp${initialBalance}, Sesudah: Rp${updatedWallet.balance})`
    );

    // -------------------------------------------------------------------------
    // 6. Ekspor Laporan Keuangan (/api/reports/export)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Ekspor Laporan Keuangan Pemilik ---');
    const exportRes = await fetch(`${BASE_URL}/api/reports/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'admin-owner-talitha',
        format: 'pdf',
        dateRange: 'Oktober 2026',
      }),
    });
    const exportData = await exportRes.json();

    assert(exportRes.status === 200, 'Fitur ekspor laporan dapat diakses oleh akun pemilik');
    assert(exportData.success === true, 'File PDF laporan berhasil di-generate', exportData.fileName);

    // -------------------------------------------------------------------------
    // 7. Tata AI Bot & Telegram Engine Integration
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Integrasi Tata AI Bot & Telegram Engine ---');
    const webhookRes = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        update_id: Date.now(),
        message: {
          message_id: 9991,
          from: { id: 8806951051, is_bot: false, first_name: 'Talitha', username: 'talithaayusukm' },
          chat: { id: 8806951051, type: 'private', username: 'talithaayusukm' },
          date: Math.floor(Date.now() / 1000),
          text: 'pengeluaran 5000 beli air mineral',
        },
      }),
    });
    const webhookData = await webhookRes.json();

    assert(webhookRes.status === 200, 'Webhook Telegram merespons HTTP 200');
    assert(webhookData.ok === true, 'Pesan transaksi bot berhasil diproses');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`HASIL AKHIR PENGUJIAN: ${passed} PASS, ${failed} FAIL`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
