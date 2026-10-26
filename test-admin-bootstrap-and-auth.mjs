// Test Suite: Verifikasi Pembuatan Akun ADMIN Utama, Proteksi Role, dan Alur Persetujuan Pengguna
// TataDana Application

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('================================================================');
  console.log('   TATADANA: TEST AKUN ADMIN UTAMA & AUTH APPROVAL SYSTEM');
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
    // TEST 1: Cek Status Bootstrap Awal
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Cek Status Awal Bootstrap Admin ---');
    const statusRes = await fetch(`${BASE_URL}/api/auth/bootstrap-admin`);
    const statusData = await statusRes.json();
    assert(statusRes.status === 200, 'Endpoint bootstrap dapat diakses', `Status: ${statusRes.status}`);

    // -------------------------------------------------------------------------
    // TEST 2: Inisialisasi Akun ADMIN Utama (talithaayusukm)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Bootstrap Akun ADMIN Utama Pertama Kali ---');
    const adminPassword = 'AdminSecret@TataDana2026!';
    const bootstrapRes = await fetch(`${BASE_URL}/api/auth/bootstrap-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'talithaayusukm',
        password: adminPassword,
        fullName: 'Talitha Ayu Sukma (Owner & Superadmin)',
        phone: '081234567899',
        telegramUsername: 'talithaayusukm'
      })
    });
    const bootstrapData = await bootstrapRes.json();
    
    assert(bootstrapRes.status === 201 && bootstrapData.success === true, 'Akun Admin Utama berhasil dibuat', bootstrapData.message);
    assert(bootstrapData.user?.role === 'superadmin', 'Role akun Admin Utama adalah superadmin');
    assert(bootstrapData.user?.account_status === 'approved', 'Status akun Admin Utama langsung APPROVED (tanpa menunggu persetujuan)');
    assert(bootstrapData.user?.password_hash === undefined, 'Kredensial rahasia (hash/salt) tidak terekspos di output API');

    // -------------------------------------------------------------------------
    // TEST 3: Pencegahan Bootstrap Ulang (Single-Use Lock Protection)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Proteksi Penguncian Bootstrap Permanen ---');
    const retryBootstrapRes = await fetch(`${BASE_URL}/api/auth/bootstrap-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'hacker@example.com',
        password: 'hackersandisecret',
        fullName: 'Hacker Admin'
      })
    });
    const retryData = await retryBootstrapRes.json();
    assert(retryBootstrapRes.status === 403 && retryData.success === false, 'Pembuatan Admin tambahan diblokir secara permanen (HTTP 403)', retryData.error);

    // -------------------------------------------------------------------------
    // TEST 4: Login Akun Admin Utama
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Login Menggunakan Identitas Admin Utama (talithaayusukm) ---');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'talithaayusukm',
        password: adminPassword
      })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.success === true, 'Admin Utama berhasil login dengan identifier talithaayusukm');
    assert(loginData.isAdmin === true && loginData.redirectTo === '/admin', 'Admin otomatis diarahkan ke Admin Portal (/admin)');

    // -------------------------------------------------------------------------
    // TEST 5: Akses Admin Portal oleh Admin Sah
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Akses Fitur Administrasi oleh Admin Sah ---');
    const adminAccessRes = await fetch(`${BASE_URL}/api/admin?action=users`, {
      headers: { 'x-user-id': 'admin-owner-talitha' }
    });
    const adminAccessData = await adminAccessRes.json();
    assert(adminAccessRes.status === 200 && Array.isArray(adminAccessData.users), 'Admin sah dapat mengakses data pengguna di Admin Portal');

    // -------------------------------------------------------------------------
    // TEST 6: Proteksi Backend Admin Portal (Akses User Biasa Ditolak)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Proteksi Backend Admin Portal (User Biasa Ditolak) ---');
    const unauthorizedRes = await fetch(`${BASE_URL}/api/admin?action=users`, {
      headers: { 'x-user-id': 'user-starter-002' } // User biasa Budi
    });
    const unauthorizedData = await unauthorizedRes.json();
    assert(unauthorizedRes.status === 403 && unauthorizedData.success === false, 'Pengguna biasa ditolak mengakses Admin Portal di level backend (HTTP 403)', unauthorizedData.error);

    // -------------------------------------------------------------------------
    // TEST 7: Registrasi Publik (Role USER & Status PENDING)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Registrasi Publik Menghasilkan Role USER & Status PENDING ---');
    const publicUserEmail = `calonuser_${Date.now()}@tatadana.app`;
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: publicUserEmail,
        fullName: 'Calon Pengguna Baru',
        phoneNumber: '081299887766',
        password: 'UserPass123!',
        role: 'superadmin' // Mencoba eskalasi privilege, harus diabaikan!
      })
    });
    const regData = await regRes.json();
    assert(regRes.status === 201 && regData.success === true, 'Registrasi publik berhasil dicatat');
    assert(regData.user?.role === 'user', 'Role tetap dipaksa USER meskipun client mencoba mengirim role superadmin');
    assert(regData.user?.account_status === 'pending', 'Status akun publik adalah PENDING (menunggu persetujuan)');
    const pendingUserId = regData.user?.id;

    // -------------------------------------------------------------------------
    // TEST 8: Percobaan Login oleh Akun Berstatus PENDING (Diblokir)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Percobaan Login oleh Pengguna Berstatus PENDING ---');
    const pendingLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: publicUserEmail,
        password: 'UserPass123!'
      })
    });
    const pendingLoginData = await pendingLoginRes.json();
    assert(pendingLoginRes.status === 403 && pendingLoginData.accountStatus === 'pending', 'Pengguna pending diblokir masuk sebelum disetujui (HTTP 403)', pendingLoginData.error);

    // -------------------------------------------------------------------------
    // TEST 9: Admin Utama Menyetujui Akun Pengguna Melalui Admin Portal
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Admin Utama Menyetujui Akun Pengguna via Admin Portal ---');
    const approveRes = await fetch(`${BASE_URL}/api/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'admin-owner-talitha'
      },
      body: JSON.stringify({
        action: 'approve_user',
        targetUserId: pendingUserId,
        adminId: 'admin-owner-talitha'
      })
    });
    const approveData = await approveRes.json();
    assert(approveRes.status === 200 && approveData.success === true, 'Admin Utama berhasil menyetujui akun pengguna');
    assert(approveData.user?.account_status === 'approved', 'Status akun pengguna berubah menjadi APPROVED / AKTIF');

    // -------------------------------------------------------------------------
    // TEST 10: Pengguna yang Telah Disetujui Dapat Login
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: Pengguna yang Disetujui Berhasil Login ke Dashboard ---');
    const approvedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: publicUserEmail,
        password: 'UserPass123!'
      })
    });
    const approvedLoginData = await approvedLoginRes.json();
    assert(approvedLoginRes.status === 200 && approvedLoginData.success === true, 'Pengguna yang disetujui berhasil login');
    assert(approvedLoginData.redirectTo === '/dashboard', 'Pengguna biasa diarahkan ke dashboard pengguna (/dashboard)');

    console.log('\n================================================================');
    console.log(`HASIL AKHIR: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Fatal error during test:', err);
    process.exit(1);
  }
}

runTests();
