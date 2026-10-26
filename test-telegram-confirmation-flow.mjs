// ====================================================================
// Test Suite: Telegram Bot Transaction Confirmation Flow & Idempotency
// ====================================================================

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

async function getWallets() {
  const res = await makeRequest('http://localhost:3000/api/wallets?userId=admin-owner-talitha');
  return res.data?.wallets || [];
}

async function getTransactions() {
  const res = await makeRequest('http://localhost:3000/api/transactions?userId=admin-owner-talitha');
  return res.data?.transactions || [];
}

let updateIdCounter = Date.now();
async function sendTelegramUpdate(chatId, text, customUpdateId = null) {
  const updateId = customUpdateId || ++updateIdCounter;
  const payload = JSON.stringify({
    update_id: updateId,
    message: {
      message_id: updateId,
      from: {
        id: chatId,
        is_bot: false,
        first_name: 'Talitha',
        username: 'talithasukma23',
      },
      chat: {
        id: chatId,
        first_name: 'Talitha',
        username: 'talithasukma23',
        type: 'private',
      },
      date: Math.floor(Date.now() / 1000),
      text: text,
    },
  });

  const res = await makeRequest('http://localhost:3000/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'x-test-sync': 'true',
    },
  }, payload);

  return { updateId, res };
}

async function run() {
  console.log('====================================================================');
  console.log('🧪 PENGUJIAN ALUR PENCATATAN TRANSAKSI TELEGRAM BOT TATADANA');
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

  const testChatId = 881234567;

  // Snapshot awal saldo & transaksi
  const initialWallets = await getWallets();
  const initialTx = await getTransactions();
  const cashWallet = initialWallets.find(w => w.name.includes('Tunai') || w.name.includes('Cash')) || initialWallets[0];
  const initialCashBalance = cashWallet.balance;
  const initialTxCount = initialTx.length;

  console.log(`📌 Kondisi Awal:`);
  console.log(`   - Jumlah Transaksi : ${initialTxCount}`);
  console.log(`   - Dompet Tunai     : ${cashWallet.name} (Saldo: Rp${initialCashBalance.toLocaleString('id-ID')})\n`);

  // ------------------------------------------------------------------
  // Test 1: Pesan tidak lengkap tanpa nominal ("beli kopi")
  // ------------------------------------------------------------------
  console.log('--- Test 1: Pesan Tidak Lengkap Tanpa Nominal ("beli kopi") ---');
  const t1 = await sendTelegramUpdate(testChatId, 'beli kopi');
  const t1Reply = t1.res.data?.reply?.text || '';
  assert(
    t1Reply.includes('Berapa nominal transaksi kamu?') || t1Reply.includes('nominal belum terdeteksi'),
    'Bot merespons meminta nominal transaksi',
    `Respons: "${t1Reply}"`
  );

  const txAfterT1 = await getTransactions();
  const walletsAfterT1 = await getWallets();
  const cashAfterT1 = walletsAfterT1.find(w => w.id === cashWallet.id);
  assert(txAfterT1.length === initialTxCount, 'Tidak ada transaksi baru yang dicatat di DB');
  assert(cashAfterT1.balance === initialCashBalance, 'Saldo dompet tidak berubah');
  console.log('');

  // ------------------------------------------------------------------
  // Test 2: Pesan tanpa dompet jelas ("beli kopi 25rb") -> Pilih Dompet
  // ------------------------------------------------------------------
  console.log('--- Test 2: Pesan Tanpa Dompet Jelas ("beli kopi 25rb") ---');
  const t2 = await sendTelegramUpdate(testChatId, 'beli kopi 25rb');
  const t2Reply = t2.res.data?.reply?.text || '';
  assert(
    t2Reply.includes('Pilih Dompet Sumber Dana') && t2Reply.includes('Kopi') && t2Reply.includes('25.000'),
    'Bot meminta pengguna memilih dompet dengan menampilkan daftar dompet',
    `Respons: "${t2Reply}"`
  );

  const txAfterT2 = await getTransactions();
  const walletsAfterT2 = await getWallets();
  const cashAfterT2 = walletsAfterT2.find(w => w.id === cashWallet.id);
  assert(txAfterT2.length === initialTxCount, 'Sebelum dompet dipilih & dikonfirmasi: tidak ada transaksi dicatat');
  assert(cashAfterT2.balance === initialCashBalance, 'Saldo dompet tetap utuh');
  console.log('');

  // ------------------------------------------------------------------
  // Test 3: Pemilihan Dompet (Kirim "1") -> Tampilkan Ringkasan & Konfirmasi
  // ------------------------------------------------------------------
  console.log('--- Test 3: Memilih Dompet ("1") -> Ringkasan Konfirmasi ---');
  const t3 = await sendTelegramUpdate(testChatId, '1');
  const t3Reply = t3.res.data?.reply?.text || '';
  assert(
    t3Reply.includes('Konfirmasi Transaksi') &&
    t3Reply.includes('Rp25.000') &&
    t3Reply.includes('Kopi') &&
    t3Reply.includes('Saldo Saat Ini') &&
    t3Reply.includes('Estimasi Saldo') &&
    t3Reply.includes('Ketik *YA*') &&
    t3Reply.includes('Ketik *BATAL*'),
    'Bot menampilkan ringkasan lengkap transaksi (nominal, dompet, metode, tanggal, estimasi saldo) dan meminta konfirmasi',
    `Respons: "${t3Reply}"`
  );

  const txAfterT3 = await getTransactions();
  const walletsAfterT3 = await getWallets();
  const cashAfterT3 = walletsAfterT3.find(w => w.id === cashWallet.id);
  assert(txAfterT3.length === initialTxCount, 'Sebelum konfirmasi YA: transaksi BELUM dicatat');
  assert(cashAfterT3.balance === initialCashBalance, 'Sebelum konfirmasi YA: saldo BELUM terpotong');
  console.log('');

  // ------------------------------------------------------------------
  // Test 4: Pembatalan Transaksi ("BATAL")
  // ------------------------------------------------------------------
  console.log('--- Test 4: Pembatalan Transaksi ("BATAL") ---');
  const t4 = await sendTelegramUpdate(testChatId, 'BATAL');
  const t4Reply = t4.res.data?.reply?.text || '';
  assert(
    t4Reply.includes('dibatalkan') && t4Reply.includes('Tidak ada perubahan saldo'),
    'Bot mengonfirmasi pembatalan transaksi',
    `Respons: "${t4Reply}"`
  );

  const txAfterT4 = await getTransactions();
  const walletsAfterT4 = await getWallets();
  const cashAfterT4 = walletsAfterT4.find(w => w.id === cashWallet.id);
  assert(txAfterT4.length === initialTxCount, 'Setelah BATAL: transaksi tidak bertambah');
  assert(cashAfterT4.balance === initialCashBalance, 'Setelah BATAL: saldo dompet tetap 100% utuh');
  console.log('');

  // ------------------------------------------------------------------
  // Test 5: Ketik "YA" saat IDLE (tidak ada pending transaksi)
  // ------------------------------------------------------------------
  console.log('--- Test 5: Ketik "YA" saat IDLE ---');
  const t5 = await sendTelegramUpdate(testChatId, 'YA');
  const t5Reply = t5.res.data?.reply?.text || '';
  assert(
    t5Reply.includes('Tidak ada transaksi yang sedang menunggu konfirmasi'),
    'Bot memberitahu tidak ada transaksi pending',
    `Respons: "${t5Reply}"`
  );
  console.log('');

  // ------------------------------------------------------------------
  // Test 6: Transaksi Lengkap dengan Dompet ("beli kopi 25 rb cash")
  // ------------------------------------------------------------------
  console.log('--- Test 6: Transaksi Lengkap dengan Dompet ("beli kopi 25 rb cash") ---');
  const t6 = await sendTelegramUpdate(testChatId, 'beli kopi 25 rb cash');
  const t6Reply = t6.res.data?.reply?.text || '';
  assert(
    t6Reply.includes('Konfirmasi Transaksi') &&
    t6Reply.includes('Rp25.000') &&
    t6Reply.includes('Kopi') &&
    t6Reply.includes('Tunai') &&
    t6Reply.includes('Ketik *YA*'),
    'Bot langsung menampilkan Ringkasan Konfirmasi (karena dompet cash sudah jelas)',
    `Respons: "${t6Reply}"`
  );

  const txAfterT6 = await getTransactions();
  const walletsAfterT6 = await getWallets();
  const cashAfterT6 = walletsAfterT6.find(w => w.id === cashWallet.id);
  assert(txAfterT6.length === initialTxCount, 'Sebelum YA: transaksi belum masuk DB');
  assert(cashAfterT6.balance === initialCashBalance, 'Sebelum YA: saldo belum berkurang');
  console.log('');

  // ------------------------------------------------------------------
  // Test 7: Konfirmasi Eksplisit ("YA")
  // ------------------------------------------------------------------
  console.log('--- Test 7: Konfirmasi Eksplisit ("YA") ---');
  const t7 = await sendTelegramUpdate(testChatId, 'YA');
  const t7Reply = t7.res.data?.reply?.text || '';
  assert(
    t7Reply.includes('Pengeluaran tercatat!') &&
    t7Reply.includes('Rp25.000'),
    'Bot mencatat transaksi dan membalas dengan ringkasan pengeluaran',
    `Respons: "${t7Reply}"`
  );

  const txAfterT7 = await getTransactions();
  const walletsAfterT7 = await getWallets();
  const cashAfterT7 = walletsAfterT7.find(w => w.id === cashWallet.id);
  assert(txAfterT7.length === initialTxCount + 1, 'Transaksi berhasil dicatat di DB (+1 transaksi)');
  assert(cashAfterT7.balance === initialCashBalance - 25000, `Saldo dompet Tunai berkurang tepat Rp25.000 (dari Rp${initialCashBalance.toLocaleString('id-ID')} ke Rp${cashAfterT7.balance.toLocaleString('id-ID')})`);
  console.log('');

  // ------------------------------------------------------------------
  // Test 8: Pencegahan Transaksi Ganda (Webhook Idempotency)
  // ------------------------------------------------------------------
  console.log('--- Test 8: Webhook Idempotency (Retry Update yang Sama) ---');
  const dupUpdateId = 999888;
  const originalUpdate = await sendTelegramUpdate(testChatId, 'beli bakso 20rb cash', dupUpdateId);
  const txCountBeforeDup = (await getTransactions()).length;

  // Kirim ulang payload yang sama dengan update_id identik
  const retryUpdate = await sendTelegramUpdate(testChatId, 'beli bakso 20rb cash', dupUpdateId);
  const txCountAfterDup = (await getTransactions()).length;
  assert(
    retryUpdate.res.data?.duplicate === true || retryUpdate.res.data?.status === 'already_processed',
    'Webhook mendeteksi duplicate update_id',
    `Status: ${retryUpdate.res.data?.status}`
  );
  assert(txCountAfterDup === txCountBeforeDup, 'Tidak ada transaksi ganda yang dicatat');

  // Bersihkan draft pending dari dupUpdateId dengan kirim BATAL
  await sendTelegramUpdate(testChatId, 'BATAL');
  console.log('');

  // ------------------------------------------------------------------
  // Test 9: Slash Command Konfirmasi & Pembatalan (/ya dan /batal)
  // ------------------------------------------------------------------
  console.log('--- Test 9: Slash Command /batal dan /ya ---');
  const t9a = await sendTelegramUpdate(testChatId, 'bensin 30rb pakai bca');
  const t9aReply = t9a.res.data?.reply?.text || '';
  assert(t9aReply.includes('Konfirmasi Transaksi') && t9aReply.includes('30.000'), 'Draf transaksi bca menunggu konfirmasi');

  const t9b = await sendTelegramUpdate(testChatId, '/batal');
  const t9bReply = t9b.res.data?.reply?.text || '';
  assert(t9bReply.includes('dibatalkan'), 'Command /batal berhasil membatalkan transaksi');
  console.log('');

  // ------------------------------------------------------------------
  // Test 10: Pemasukan Flow dengan Konfirmasi
  // ------------------------------------------------------------------
  console.log('--- Test 10: Pemasukan Flow dengan Konfirmasi ("gajian 8.5jt di bca") ---');
  const bcaWalletBefore = (await getWallets()).find(w => w.name.includes('BCA'));
  const bcaBalanceBefore = bcaWalletBefore.balance;
  const txCountBeforeIncome = (await getTransactions()).length;

  const t10 = await sendTelegramUpdate(testChatId, 'gajian 8.5jt di bca');
  const t10Reply = t10.res.data?.reply?.text || '';
  assert(
    t10Reply.includes('Pemasukan') &&
    t10Reply.includes('Rp8.500.000') &&
    t10Reply.includes('BCA') &&
    t10Reply.includes('Konfirmasi Transaksi'),
    'Bot menampilkan ringkasan konfirmasi untuk pemasukan (Gaji 8.5jt di BCA)'
  );

  const bcaBalanceMid = (await getWallets()).find(w => w.name.includes('BCA')).balance;
  assert(bcaBalanceMid === bcaBalanceBefore, 'Sebelum YA: saldo BCA belum bertambah');

  // Konfirmasi pemasukan
  const t10Confirm = await sendTelegramUpdate(testChatId, 'YA');
  const t10ConfirmReply = t10Confirm.res.data?.reply?.text || '';
  assert(
    t10ConfirmReply.includes('Pemasukan tercatat!') &&
    t10ConfirmReply.includes('Rp8.500.000'),
    'Bot mencatat pemasukan dan mengirim konfirmasi sukses'
  );

  const bcaBalanceAfter = (await getWallets()).find(w => w.name.includes('BCA')).balance;
  const txCountAfterIncome = (await getTransactions()).length;
  assert(txCountAfterIncome === txCountBeforeIncome + 1, 'Pemasukan tersimpan di database (+1 transaksi)');
  assert(bcaBalanceAfter === bcaBalanceBefore + 8500000, `Saldo BCA bertambah tepat Rp8.500.000 (dari Rp${bcaBalanceBefore.toLocaleString('id-ID')} ke Rp${bcaBalanceAfter.toLocaleString('id-ID')})`);
  console.log('');

  // ------------------------------------------------------------------
  // Ringkasan Hasil
  // ------------------------------------------------------------------
  console.log('====================================================================');
  console.log(`HASIL PENGUJIAN: ${passed} PASS, ${failed} FAIL`);
  console.log('====================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
