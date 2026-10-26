// Verification script for Admin Portal Access and Authorization
import http from 'http';

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

async function runTests() {
  console.log('=== VERIFIKASI HAK AKSES ADMIN PORTAL TATADANA ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Login sebagai Admin Utama (talithasukma23@gmail.com)
    console.log('--- Uji 1: Login Admin Utama ---');
    const adminLogin = await makeRequest(
      'http://localhost:3000/api/auth/login',
      { method: 'POST' },
      JSON.stringify({
        identifier: 'talithasukma23@gmail.com',
        password: '#taltal075',
      })
    );

    assert(adminLogin.status === 200 && adminLogin.data.success === true, 'Login Admin Utama berhasil (HTTP 200)');
    assert(adminLogin.data.role === 'superadmin', 'Role login adalah superadmin');
    assert(adminLogin.data.isAdmin === true, 'Flag isAdmin adalah true');
    assert(adminLogin.data.redirectTo === '/admin', 'Redirect target mengarah ke /admin');
    assert(adminLogin.data.user.email === 'talithasukma23@gmail.com', 'Email terverifikasi talithasukma23@gmail.com');
    assert(adminLogin.data.user.id === 'admin-owner-talitha', 'ID akun admin adalah admin-owner-talitha');

    const adminCookie = adminLogin.headers['set-cookie']
      ? adminLogin.headers['set-cookie'][0].split(';')[0]
      : '';
    assert(adminCookie.startsWith('tatadana_session='), 'Cookie tatadana_session berhasil diterbitkan untuk Admin');

    // 2. Akses API Admin (/api/admin?action=users) menggunakan Cookie Admin
    console.log('\n--- Uji 2: Otorisasi API Admin oleh Admin Utama ---');
    const adminApi = await makeRequest(
      'http://localhost:3000/api/admin?action=users',
      { headers: { Cookie: adminCookie } }
    );
    assert(adminApi.status === 200, 'API Admin merespons HTTP 200 untuk Admin Utama');
    assert(Array.isArray(adminApi.data.users) && adminApi.data.users.length > 0, `Admin berhasil memuat daftar ${adminApi.data.users?.length} pengguna`);

    // 3. Akses Halaman /admin melalui Middleware dengan Cookie Admin
    console.log('\n--- Uji 3: Akses Server-Side Rute /admin oleh Admin Utama ---');
    const adminPage = await makeRequest(
      'http://localhost:3000/admin',
      { headers: { Cookie: adminCookie } }
    );
    assert(adminPage.status === 200, 'Middleware mengizinkan akses ke /admin (HTTP 200, tidak diredirect)');

    // 4. Login sebagai Akun USER Biasa (budi@tatadana.app)
    console.log('\n--- Uji 4: Login Akun USER Biasa (budi@tatadana.app) ---');
    const userLogin = await makeRequest(
      'http://localhost:3000/api/auth/login',
      { method: 'POST' },
      JSON.stringify({
        identifier: 'budi@tatadana.app',
        password: 'password123',
      })
    );
    assert(userLogin.status === 200 && userLogin.data.success === true, 'Login akun USER biasa berhasil');
    assert(userLogin.data.role === 'user', 'Role akun adalah user');
    assert(userLogin.data.isAdmin === false, 'Flag isAdmin akun user adalah false');
    assert(userLogin.data.redirectTo === '/dashboard', 'Redirect target akun user mengarah ke /dashboard');

    const userCookie = userLogin.headers['set-cookie']
      ? userLogin.headers['set-cookie'][0].split(';')[0]
      : '';

    // 5. Uji Akses Rute /admin menggunakan Akun USER (Harus Ditolak Server / Middleware)
    console.log('\n--- Uji 5: Proteksi Rute /admin dari Akun USER Biasa ---');
    const userAdminPage = await makeRequest(
      'http://localhost:3000/admin',
      { headers: { Cookie: userCookie } }
    );
    const isRedirectedToDashboard =
      userAdminPage.status === 307 ||
      userAdminPage.status === 302 ||
      (userAdminPage.headers.location && userAdminPage.headers.location.includes('/dashboard'));
    assert(isRedirectedToDashboard, `Middleware menolak akses USER ke /admin dan me-redirect ke /dashboard (Status: ${userAdminPage.status}, Location: ${userAdminPage.headers.location})`);

    // 6. Uji Akses API Admin (/api/admin) menggunakan Akun USER (Harus Ditolak HTTP 403)
    console.log('\n--- Uji 6: Proteksi API /api/admin dari Akun USER Biasa ---');
    const userApiAttempt = await makeRequest(
      'http://localhost:3000/api/admin?action=users',
      { headers: { Cookie: userCookie } }
    );
    assert(userApiAttempt.status === 403, `API Admin menolak akses akun USER dengan HTTP 403 (dapat: ${userApiAttempt.status})`);
    assert(
      typeof userApiAttempt.data.error === 'string' && userApiAttempt.data.error.includes('Hanya Admin Utama'),
      `Pesan error sesuai otorisasi: "${userApiAttempt.data.error}"`
    );

    // 7. Uji Akses API Admin tanpa Kredensial (Harus Ditolak HTTP 403)
    console.log('\n--- Uji 7: Proteksi API /api/admin tanpa Kredensial ---');
    const anonymousApi = await makeRequest('http://localhost:3000/api/admin?action=users');
    assert(anonymousApi.status === 403, 'Akses tanpa cookie ditolak HTTP 403');

    // 8. Integritas Data Keuangan & Profil Admin Utama
    console.log('\n--- Uji 8: Integritas Profil & Relasi Data Admin Utama ---');
    const adminProfile = await makeRequest(
      'http://localhost:3000/api/auth/profile?userId=admin-owner-talitha',
      { headers: { Cookie: adminCookie } }
    );
    assert(adminProfile.status === 200 && adminProfile.data.success === true, 'Profil Admin Utama berhasil dimuat');
    assert(adminProfile.data.user.role === 'superadmin', 'Role profil Admin tetap superadmin');
    assert(adminProfile.data.user.account_status === 'approved', 'Status akun Admin tetap approved');
    assert(adminProfile.data.walletsCount >= 1, `Dompet Admin tetap terhubung (${adminProfile.data.walletsCount} dompet)`);

    // 9. Uji Transaksi Tetap Terhubung ke Admin Utama
    console.log('\n--- Uji 9: Integritas Transaksi Akun Admin Utama ---');
    const adminTxs = await makeRequest(
      'http://localhost:3000/api/transactions?userId=admin-owner-talitha'
    );
    assert(adminTxs.status === 200 && Array.isArray(adminTxs.data.transactions), 'Transaksi Admin Utama dapat diakses');
    assert(adminTxs.data.transactions.length === 0, `Kondisi keuangan awal nol terverifikasi: 0 transaksi (${adminTxs.data.transactions.length} transaksi)`);

    console.log('\n======================================================');
    console.log(`HASIL: ${passed} LULUS, ${failed} GAGAL dari ${passed + failed} PENGUJIAN`);
    console.log('======================================================');

    if (failed > 0) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error('Fatal error saat pengujian:', err);
    process.exit(1);
  }
}

runTests();
