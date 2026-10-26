// Test Suite: Verifikasi Integrasi Profil Pengguna & Sidebar Dashboard TataDana
// Menguji pemisahan data akun, resolusi sesi, profil Superadmin, dan proteksi role

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('================================================================');
  console.log('   TATADANA: TEST INTEGRASI PROFIL PENGGUNA & SIDEBAR');
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
    // TEST 1: Identifikasi Profil Superadmin Pemilik (talithaayusukm)
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Verifikasi Profil Superadmin Pemilik ---');
    const adminRes = await fetch(`${BASE_URL}/api/auth/profile?userId=admin-owner-talitha`);
    const adminData = await adminRes.json();

    assert(adminRes.status === 200 && adminData.success === true, 'Endpoint /api/auth/profile sukses diakses');
    assert(adminData.user?.id === 'admin-owner-talitha', 'ID Akun adalah admin-owner-talitha');
    assert(
      adminData.user?.full_name?.includes('Talitha Ayu Sukma'),
      'Nama Superadmin adalah Talitha Ayu Sukma (BUKAN Alex Pratama)',
      `Nama aktual: ${adminData.user?.full_name}`
    );
    assert(adminData.user?.role === 'superadmin', 'Role Superadmin terverifikasi');
    assert(adminData.user?.email === 'talithasukma23@gmail.com', 'Email pemilik terverifikasi');
    assert(adminData.user?.password_hash === undefined, 'Kredensial rahasia (hash/salt) tidak bocor di API profil');

    // -------------------------------------------------------------------------
    // TEST 2: Preservasi Profil Demo "Alex Pratama" (Tidak tertimpa secara global)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Preservasi Akun Pengguna Demo "Alex Pratama" ---');
    const alexRes = await fetch(`${BASE_URL}/api/auth/profile?userId=user-pro-001`);
    const alexData = await alexRes.json();

    assert(alexRes.status === 200, 'Akun demo Alex Pratama tetap tersedia');
    assert(alexData.user?.full_name === 'Alex Pratama', 'Nama Alex Pratama tetap utuh untuk akun demo user-pro-001');
    assert(alexData.user?.role === 'user', 'Role Alex Pratama tetap user');
    assert(alexData.user?.id !== adminData.user?.id, 'Akun Alex Pratama terpisah secara tegas dari akun Superadmin');

    // -------------------------------------------------------------------------
    // TEST 3: Preservasi Akun Pengguna Biasa "Budi Santoso"
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Preservasi Akun Pengguna Starter "Budi Santoso" ---');
    const budiRes = await fetch(`${BASE_URL}/api/auth/profile?userId=user-starter-002`);
    const budiData = await budiRes.json();

    assert(budiRes.status === 200, 'Akun starter Budi Santoso dapat diakses');
    assert(budiData.user?.full_name?.includes('Budi Santoso'), 'Nama Budi Santoso tetap utuh');
    assert(budiData.user?.plan === 'starter', 'Paket Budi Santoso adalah starter');

    // -------------------------------------------------------------------------
    // TEST 4: Pemisahan Dompet & Data Keuangan Antar Pengguna
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Pemisahan Data Dompet Antar Akun ---');
    const adminWalletsRes = await fetch(`${BASE_URL}/api/wallets?userId=admin-owner-talitha`);
    const adminWalletsData = await adminWalletsRes.json();
    const starterWalletsRes = await fetch(`${BASE_URL}/api/wallets?userId=user-starter-002`);
    const starterWalletsData = await starterWalletsRes.json();

    assert(Array.isArray(adminWalletsData.wallets) && adminWalletsData.wallets.length > 0, 'Superadmin memiliki dompet tersendiri');
    assert(
      adminWalletsData.wallets.some((w) => w.name.includes('Kas Operasional')),
      'Dompet Superadmin memuat Kas Operasional Admin'
    );
    assert(
      adminWalletsData.wallets[0]?.id !== starterWalletsData.wallets[0]?.id,
      'Dompet Superadmin tidak tertukar dengan dompet pengguna lain'
    );

    // -------------------------------------------------------------------------
    // TEST 5: Mekanisme Pembaruan Profil via PUT (Tanpa Merusak Role/Auth)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Pembaruan Profil via PUT & Proteksi Eskalasi Role ---');
    const updateRes = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'admin-owner-talitha',
        fullName: 'Talitha Ayu Sukma (Owner & Superadmin)',
        phoneNumber: '081234567899',
        timezone: 'Asia/Jakarta',
      }),
    });
    const updateData = await updateRes.json();

    assert(updateRes.status === 200 && updateData.success === true, 'Pembaruan profil Superadmin berhasil via PUT');
    assert(updateData.user?.full_name === 'Talitha Ayu Sukma (Owner & Superadmin)', 'Nama pemilik tetap tersimpan rapi');

    // Uji percobaan eskalasi role oleh user biasa
    const hackRoleRes = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-starter-002',
        role: 'superadmin', // Percobaan eskalasi terlarang
        fullName: 'Budi Santoso (Updated)',
      }),
    });
    const hackRoleData = await hackRoleRes.json();

    assert(
      hackRoleData.user?.role === 'user',
      'Proteksi role aktif: Role user biasa TIDAK DAPAT dieskalasi via endpoint profil'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Resolusi Profil Otomatis dari Cookie Sesi Login (Session Cookie Sync)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Otentikasi Sesi & Resolusi Cookie Profil ---');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'talithasukma23@gmail.com',
        password: '#taltal075',
      }),
    });
    const loginData = await loginRes.json();
    const setCookieHeader = loginRes.headers.get('set-cookie');

    assert(loginRes.status === 200 && loginData.success === true, 'Login Superadmin berhasil');
    assert(setCookieHeader && setCookieHeader.includes('tatadana_session'), 'Cookie tatadana_session diterbitkan');

    // Extract cookie
    const sessionCookie = setCookieHeader.split(';')[0];
    const sessionProfileRes = await fetch(`${BASE_URL}/api/auth/profile`, {
      headers: {
        Cookie: sessionCookie,
      },
    });
    const sessionProfileData = await sessionProfileRes.json();

    assert(
      sessionProfileData.user?.id === 'admin-owner-talitha',
      'Sesi cookie tatadana_session otomatis mengidentifikasi Superadmin pemilik tanpa param manual'
    );
    assert(
      sessionProfileData.user?.full_name.includes('Talitha Ayu Sukma'),
      'Nama profil dari sesi cookie adalah Talitha Ayu Sukma'
    );

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`HASIL AKHIR: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
