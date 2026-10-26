// test-whatsapp-and-payment-flow.mjs
import http from 'http';
import fs from 'fs';
import path from 'path';

function request(options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (bodyData) req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
    req.end();
  });
}

function assert(condition, message, detail = '') {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    if (detail) console.error(`   Detail: ${detail}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function run() {
  console.log('====================================================================');
  console.log('🧪 PENGUJIAN KOMPREHENSIF ID OTOMATIS & PEMISAHAN CHAT WHATSAPP');
  console.log('====================================================================\n');

  const testTimestamp = Date.now();
  const testEmail = `user.test.wa.${testTimestamp}@tatadana.app`;
  const testName = `Pengguna Uji WA ${testTimestamp}`;
  const testPhone = `0812999${String(testTimestamp).slice(-5)}`;
  const testPassword = 'Password123!';

  // ------------------------------------------------------------------
  // 1. UJI REGISTRASI PENGGUNA BARU & ID AKUN ASLI
  // ------------------------------------------------------------------
  console.log('--- Uji 1: Registrasi Akun Pengujian Terisolasi ---');
  const regRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      fullName: testName,
      email: testEmail,
      phoneNumber: testPhone,
      password: testPassword,
    }
  );

  assert(regRes.status === 201, 'Registrasi berhasil (HTTP 201)', `Status: ${regRes.status}`);
  const registeredUser = regRes.body.user;
  const originalUserId = registeredUser.id;
  assert(originalUserId && originalUserId.startsWith('user-'), 'ID Akun asli dibuat dengan prefix user-<timestamp>', `ID: ${originalUserId}`);
  assert(registeredUser.role === 'user', 'Role akun baru adalah user');
  assert(registeredUser.account_status === 'pending', 'Status akun baru adalah pending');

  // ------------------------------------------------------------------
  // 2. UJI TEMPLATE WHATSAPP PERSETUJUAN AKUN (BAGIAN 3)
  // ------------------------------------------------------------------
  console.log('\n--- Uji 2: Verifikasi Template WhatsApp Persetujuan Akun ---');
  const waTemplateReg = regRes.body.adminContact?.messageTemplate || '';
  const waLinkReg = regRes.body.adminContact?.waLink || '';

  assert(waTemplateReg.includes('[PERMINTAAN PERSETUJUAN AKUN TATA DANA]'), 'Memiliki judul resmi [PERMINTAAN PERSETUJUAN AKUN TATA DANA]');
  assert(waTemplateReg.includes(`Nama akun: ${testName}`), 'Mencantumkan nama pengguna asli');
  assert(waTemplateReg.includes(`Email akun: ${testEmail}`), 'Mencantumkan email pengguna asli');
  assert(waTemplateReg.includes(`Nomor WhatsApp: ${testPhone}`), 'Mencantumkan nomor WhatsApp terdaftar');
  assert(waTemplateReg.includes(`ID Akun: ${originalUserId}`), 'Mencantumkan ID Akun asli (bukan email/acak)', `Isi pesan: ${waTemplateReg}`);
  assert(!waTemplateReg.includes('99.000'), 'TIDAK mengandung harga PRO (terpisah dari PRO)');
  assert(!waTemplateReg.includes('PRO-'), 'TIDAK mengandung ID pengajuan PRO');
  assert(waLinkReg.includes('https://wa.me/'), 'Link WhatsApp mengarah ke wa.me');

  // Uji endpoint verify-email status untuk halaman pending-approval
  const verifyRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/verify-email',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      action: 'status',
      email: testEmail,
    }
  );
  assert(verifyRes.body.id === originalUserId, 'Endpoint verify-email status mengembalikan ID Akun asli yang sama', `Dapat: ${verifyRes.body.id}`);
  assert(verifyRes.body.adminContact?.messageTemplate?.includes('[PERMINTAAN PERSETUJUAN AKUN TATA DANA]'), 'Template status verify-email sesuai judul Bagian 3');

  // ------------------------------------------------------------------
  // 3. ADMIN MENYETUJUI AKUN PENGGUNA (ROLE TETAP USER & PLAN STARTER)
  // ------------------------------------------------------------------
  console.log('\n--- Uji 3: Admin Menyetujui Akun Pengguna Baru ---');
  const approveUserRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'admin-owner-talitha',
      },
    },
    {
      action: 'approve_user',
      targetUserId: originalUserId,
    }
  );
  assert(approveUserRes.body.success === true, 'Admin berhasil menyetujui akun pengguna');
  assert(approveUserRes.body.user?.account_status === 'approved', 'Status akun berubah menjadi approved');
  assert(approveUserRes.body.user?.plan === 'starter', 'Persetujuan akun TIDAK otomatis mengaktifkan PRO (tetap starter)');

  // ------------------------------------------------------------------
  // 4. PENGAJUAN UPGRADE PRO OTOMATIS & ID PENGAJUAN (BAGIAN 2 & 4)
  // ------------------------------------------------------------------
  console.log('\n--- Uji 4: Pengajuan Upgrade PRO Otomatis & Pembuatan ID Unik ---');
  const proReq1 = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/payment/upgrade',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': originalUserId,
      },
    },
    {
      plan: 'pro',
    }
  );

  assert(proReq1.status === 200, 'Pengajuan PRO berhasil dibuat (HTTP 200)');
  assert(proReq1.body.success === true, 'Response success: true');
  const payment1 = proReq1.body.payment;
  assert(payment1.order_id && payment1.order_id.startsWith('PRO-'), 'ID Pengajuan dibuat otomatis dengan format PRO-<ID_UNIK>', `order_id: ${payment1.order_id}`);
  assert(payment1.user_id === originalUserId, 'ID Akun pada pengajuan cocok dengan ID Akun pemohon yang sedang login');
  assert(payment1.amount === 99000, 'Nominal tersimpan Rp99.000');
  assert(payment1.status === 'pending', 'Status awal pengajuan adalah PENDING');
  assert(payment1.plan === 'pro', 'Paket pengajuan adalah PRO');
  assert(proReq1.body.isExisting === false, 'Pengajuan pertama adalah pengajuan baru (isExisting: false)');

  // Verifikasi template WhatsApp Upgrade PRO (Bagian 4)
  const waTemplatePro = proReq1.body.messageTemplate || '';
  assert(waTemplatePro.includes('[PENGAJUAN UPGRADE PRO TATA DANA]'), 'Memiliki judul resmi [PENGAJUAN UPGRADE PRO TATA DANA]');
  assert(waTemplatePro.includes(`Nama akun: ${testName}`), 'Mencantumkan nama pengguna pemohon');
  assert(waTemplatePro.includes(`Email akun: ${testEmail}`), 'Mencantumkan email pengguna pemohon');
  assert(waTemplatePro.includes(`ID Akun: ${originalUserId}`), 'Mencantumkan ID Akun asli pemohon');
  assert(waTemplatePro.includes(`ID Pengajuan: ${payment1.order_id}`), 'Mencantumkan ID Pengajuan PRO yang tersimpan persis sama');
  assert(waTemplatePro.includes('Paket: PRO'), 'Mencantumkan Paket: PRO');
  assert(waTemplatePro.includes('Harga: Rp99.000 sekali bayar'), 'Mencantumkan Harga: Rp99.000 sekali bayar');
  assert(waTemplatePro.includes('Status: Menunggu pembayaran'), 'Mencantumkan Status: Menunggu pembayaran');
  assert(waTemplatePro.includes('Mohon informasi pembayaran melalui bank atau QRIS'), 'Meminta instruksi bank / QRIS');

  // ------------------------------------------------------------------
  // 5. UJI PENCEGAHAN KLIK GANDA / PERMINTAAN BERULANG (IDEMPOTENCY)
  // ------------------------------------------------------------------
  console.log('\n--- Uji 5: Pencegahan Klik Ganda / Request Berulang (Idempotency) ---');
  const proReq2 = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/payment/upgrade',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': originalUserId,
      },
    },
    {
      plan: 'pro',
    }
  );

  assert(proReq2.status === 200, 'Request kedua berhasil ditangani tanpa error');
  assert(proReq2.body.isExisting === true, 'Mendeteksi pengajuan yang sudah ada (isExisting: true)');
  assert(proReq2.body.payment.order_id === payment1.order_id, 'ID Pengajuan tetap sama, tidak membuat pengajuan duplikat', `Tetap: ${proReq2.body.payment.order_id}`);

  // ------------------------------------------------------------------
  // 6. UJI INTEGRASI ADMIN PORTAL PAYMENT APPROVALS (BAGIAN 5)
  // ------------------------------------------------------------------
  console.log('\n--- Uji 6: Integrasi Menu Payment Approvals Admin Portal ---');
  const adminPaymentsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin?action=payments',
    method: 'GET',
    headers: { 'x-user-id': 'admin-owner-talitha' },
  });

  const allPayments = adminPaymentsRes.body.payments || [];
  const foundInAdmin = allPayments.find(p => p.order_id === payment1.order_id);
  assert(!!foundInAdmin, 'Pengajuan muncul di menu Payment Approvals Admin Portal');
  assert(foundInAdmin.order_id === payment1.order_id, 'ID Pengajuan pada Admin Portal persis sama dengan di WhatsApp');
  assert(foundInAdmin.user_id === originalUserId, 'ID Akun pemohon pada Admin Portal sesuai dengan akun pemohon');
  assert(foundInAdmin.status === 'pending', 'Status pada Admin Portal berstatus pending');

  // ------------------------------------------------------------------
  // 7. UJI PERSISTENSI DISK (SURVIVE HARD RESTART / FILE VERIFICATION)
  // ------------------------------------------------------------------
  console.log('\n--- Uji 7: Verifikasi Persistensi Disk .data-payments.json ---');
  const paymentsFilePath = path.join(process.cwd(), '.data-payments.json');
  assert(fs.existsSync(paymentsFilePath), 'Berkas .data-payments.json ada di disk');
  const diskPayments = JSON.parse(fs.readFileSync(paymentsFilePath, 'utf-8'));
  const foundOnDisk = diskPayments.find(p => p.order_id === payment1.order_id);
  assert(!!foundOnDisk, 'Pengajuan tersimpan secara persisten di disk sebelum WhatsApp dibuka');
  assert(foundOnDisk.status === 'pending', 'Status tersimpan di disk adalah pending');

  // ------------------------------------------------------------------
  // 8. UJI ADMIN REJECT PENGAJUAN (TIDAK BOLEH MENGAKTIFKAN PRO)
  // ------------------------------------------------------------------
  console.log('\n--- Uji 8: Admin Menolak Pengajuan (Reject) ---');
  const rejectRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'admin-owner-talitha',
      },
    },
    {
      action: 'reject_payment',
      orderId: payment1.order_id,
      reason: 'Uji penolakan transfer',
    }
  );
  assert(rejectRes.body.success === true, 'Admin berhasil menolak pengajuan');

  // Verifikasi akun pemohon TIDAK diupgrade saat di-reject
  const checkUserAfterReject = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/verify-email',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      action: 'status',
      email: testEmail,
    }
  );
  assert(checkUserAfterReject.body.role === 'user', 'Role akun tetap user');

  // Verifikasi pengajuan baru dapat dibuat setelah pengajuan lama ditolak
  console.log('\n--- Uji 9: Pembuatan Pengajuan Baru Setelah Penolakan & Approval ---');
  const proReq3 = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/payment/upgrade',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': originalUserId,
      },
    },
    {
      plan: 'pro',
    }
  );
  const payment3 = proReq3.body.payment;
  assert(payment3.order_id !== payment1.order_id, 'Pengajuan baru menghasilkan ID Pengajuan unik baru', `ID Baru: ${payment3.order_id}`);
  assert(payment3.order_id.startsWith('PRO-'), 'ID Pengajuan baru berformat PRO-<ID_UNIK>');

  // ------------------------------------------------------------------
  // 9. ADMIN MENYETUJUI PENGAJUAN (AKTIVASI PRO HANYA PADA PEMOHON)
  // ------------------------------------------------------------------
  console.log('\n--- Uji 10: Admin Menyetujui Pembayaran (Approve PRO) ---');
  const approvePaymentRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'admin-owner-talitha',
      },
    },
    {
      action: 'approve_payment',
      orderId: payment3.order_id,
    }
  );
  assert(approvePaymentRes.body.success === true, 'Admin menyetujui pembayaran pengajuan PRO');

  // Verifikasi status akun pemohon sekarang PRO
  const checkUserAfterApprove = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/payment/upgrade',
    method: 'GET',
    headers: { 'x-user-id': originalUserId },
  });
  assert(checkUserAfterApprove.body.user.plan === 'pro', 'Paket akun pemohon berhasil diaktifkan menjadi PRO');

  // Verifikasi akun lain (user-starter-002) TIDAK terpengaruh (Isolasi Mutlak)
  const checkOtherUser = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/payment/upgrade',
    method: 'GET',
    headers: { 'x-user-id': 'user-starter-002' },
  });
  assert(checkOtherUser.body.user.plan === 'starter', 'Akun lain (user-starter-002) TETAP starter (tidak terpengaruh)');

  // ------------------------------------------------------------------
  // 10. CLEANUP DATA PENGUJIAN TERISOLASI
  // ------------------------------------------------------------------
  console.log('\n--- Uji 11: Cleanup Data Pengujian Terisolasi ---');
  // Bersihkan akun pengujian dari disk dan memori
  const usersPath = path.join(process.cwd(), '.users-registered.json');
  if (fs.existsSync(usersPath)) {
    const list = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    const filtered = list.filter(u => u.id !== originalUserId);
    fs.writeFileSync(usersPath, JSON.stringify(filtered, null, 2), 'utf-8');
  }
  if (fs.existsSync(paymentsFilePath)) {
    const pList = JSON.parse(fs.readFileSync(paymentsFilePath, 'utf-8'));
    const pFiltered = pList.filter(p => p.user_id !== originalUserId);
    fs.writeFileSync(paymentsFilePath, JSON.stringify(pFiltered, null, 2), 'utf-8');
  }
  console.log('✅ [PASS] Data pengujian terisolasi berhasil dibersihkan.');

  console.log('\n====================================================================');
  console.log('✓ SELURUH PENGUJIAN WAJIB (BAGIAN 1–7) BERHASIL 100%!');
  console.log('====================================================================\n');
}

run().catch((err) => {
  console.error('\n❌ PENGUJIAN GAGAL:', err);
  process.exit(1);
});
