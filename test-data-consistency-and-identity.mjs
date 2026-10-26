// Test Suite: Investigasi Konsistensi Identitas & Akses Data TataDana
// Membuktikan bahwa data lama tetap utuh dan data akun baru terisolasi dengan benar

const BASE_URL = 'http://localhost:3000';

async function runInvestigationTests() {
  console.log('================================================================');
  console.log('   TATADANA: TEST KONSISTENSI IDENTITAS & INTEGRITAS DATA');
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
    // TEST 1: Verifikasi Data Lama (Alex Pratama / user-pro-001) Masih Tersimpan Utuh
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Verifikasi Data Lama "user-pro-001" (Read-Only) ---');
    const alexRes = await fetch(`${BASE_URL}/api/transactions?userId=user-pro-001`);
    const alexData = await alexRes.json();

    assert(alexRes.status === 200, 'API /api/transactions untuk user-pro-001 sukses diakses');
    assert(alexData.count === 17, `Seluruh 17 transaksi lama user-pro-001 tetap utuh (Aktual: ${alexData.count})`);
    assert(alexData.totalBalance === 8175000, `Saldo total lama user-pro-001 tetap Rp8.175.000 (Aktual: Rp${alexData.totalBalance})`);
    assert(alexData.wallets.length === 3, '3 dompet lama (Tunai, BCA, GoPay) milik user-pro-001 tetap ada');
    assert(alexData.categories.length > 0, 'Kategori lama milik user-pro-001 tetap ada');

    // -------------------------------------------------------------------------
    // TEST 2: Verifikasi Kondisi Akun Baru Pemilik (admin-owner-talitha)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Verifikasi Akun Baru Pemilik "admin-owner-talitha" ---');
    const adminRes = await fetch(`${BASE_URL}/api/transactions?userId=admin-owner-talitha`);
    const adminData = await adminRes.json();

    assert(adminRes.status === 200, 'API /api/transactions untuk admin-owner-talitha sukses diakses');
    assert(adminData.wallets.length >= 1, 'Akun pemilik memiliki dompet operasional admin tersendiri');
    assert(
      adminData.wallets.some((w) => w.id === 'wallet-admin-talitha'),
      'Dompet "Kas Operasional Admin" aktif pada akun pemilik'
    );
    assert(adminData.totalBalance > 0, `Saldo kas admin terisi (Aktual: Rp${adminData.totalBalance})`);
    assert(
      adminData.transactions.every((t) => t.user_id === 'admin-owner-talitha'),
      'Seluruh transaksi pada profil pemilik hanya milik admin-owner-talitha'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Verifikasi Data Pengguna Starter (user-starter-002)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Verifikasi Data Pengguna Starter "user-starter-002" ---');
    const starterRes = await fetch(`${BASE_URL}/api/transactions?userId=user-starter-002`);
    const starterData = await starterRes.json();

    assert(starterRes.status === 200, 'API transaksi user-starter-002 sukses diakses');
    assert(starterData.count === 2, `Data user-starter-002 tetap 2 transaksi (Aktual: ${starterData.count})`);
    assert(starterData.wallets.length >= 1, 'Dompet user-starter-002 tetap terpisah');

    // -------------------------------------------------------------------------
    // TEST 4: Verifikasi Multi-Tenant Isolation (Tidak Ada Data Tertukar)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Verifikasi Isolasi Multi-Pengguna ---');
    const alexTxIds = new Set(alexData.transactions.map((t) => t.id));
    const adminTxIds = new Set(adminData.transactions.map((t) => t.id));
    const starterTxIds = new Set(starterData.transactions.map((t) => t.id));

    let overlap = false;
    for (const id of alexTxIds) {
      if (adminTxIds.has(id) || starterTxIds.has(id)) overlap = true;
    }
    assert(!overlap, 'Data transaksi sepenuhnya terisolasi, tidak ada tumpang tindih kepemilikan');

    // -------------------------------------------------------------------------
    // TEST 5: Fitur Impersonasi di Admin Portal Tetap Berfungsi Membuka Data Pengguna
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Akses Monitoring Data via Admin Portal ---');
    const adminAllRes = await fetch(`${BASE_URL}/api/admin?action=transactions`);
    const adminAllData = await adminAllRes.json();

    assert(adminAllRes.status === 200, 'Admin Portal dapat memantau seluruh transaksi sistem');
    assert(
      adminAllData.transactions.length >= 19,
      `Admin Portal melihat total seluruh transaksi sistem (${adminAllData.transactions.length} transaksi)`
    );

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`HASIL INVESTIGASI: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runInvestigationTests();
