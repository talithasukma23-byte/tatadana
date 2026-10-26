// ====================================================================
// Test Script: Verify Financial Persistence Across Real Server Restart
// ====================================================================

import http from 'http';
import fs from 'fs';

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
  console.log('=== TEST RESTART PERSISTENCE ===');

  // 1. Catat 1 transaksi pemasukan
  const txRes = await makeRequest('http://localhost:3000/api/transactions', {
    method: 'POST',
  }, JSON.stringify({
    userId: 'admin-owner-talitha',
    walletId: 'wallet-001',
    amount: 500000,
    type: 'income',
    notes: 'Pemasukan Uji Persistensi Restart',
    categoryId: 'cat-007',
  }));

  console.log('1. Transaksi dibuat (Rp500.000):', txRes.data?.success);
  const createdTxId = txRes.data?.transaction?.id;

  // 2. Periksa disk file
  const disk = JSON.parse(fs.readFileSync('.data-financial.json', 'utf-8'));
  const diskWallet = disk.wallets.find(w => w.id === 'wallet-001');
  console.log('2. Saldo di disk file sebelum restart:', diskWallet.balance);
  console.log('   Jumlah transaksi di disk file:', disk.transactions.length);

  // 3. Output createdTxId untuk tahap verifikasi pasca restart
  console.log('TX_ID_CREATED=' + createdTxId);
}

run().catch(console.error);
