// Test Suite: Verifikasi Tata AI Bot Web Flow (Selection -> Auto-Approved Mutation)
const BASE_URL = 'http://localhost:3000';

async function testTataAIFlow() {
  console.log('================================================================');
  console.log('   TATADANA: TEST TATA AI BOT WEB FLOW');
  console.log('================================================================\n');

  // Ambil saldo awal dompet BCA
  const walletsRes = await fetch(`${BASE_URL}/api/wallets?userId=user-pro-001`);
  const { wallets } = await walletsRes.json();
  const bcaWallet = wallets.find(w => w.name.includes('BCA') || w.id === 'wallet-002');
  const bcaBalanceBefore = bcaWallet.balance;
  console.log(`Saldo BCA awal: Rp${bcaBalanceBefore.toLocaleString('id-ID')}`);

  // Simulasikan pesan dengan dompet eksplisit: "makan siang 45000 pakai BCA"
  // Sesuai logic Tata AI page, ia mendeteksi BCA dan langsung POST /api/transactions
  const directTxRes = await fetch(`${BASE_URL}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'user-pro-001',
      walletId: bcaWallet.id,
      amount: 45000,
      type: 'expense',
      categoryId: 'cat-exp-01',
      notes: 'makan siang',
      description: 'makan siang',
      source: 'tata_ai_chat',
      transaction_date: new Date().toISOString()
    })
  });
  const directTxData = await directTxRes.json();

  console.log('Status HTTP:', directTxRes.status);
  console.log('Status Transaksi:', directTxData.transaction?.status);
  console.log('Pesan:', directTxData.message);

  if (directTxData.transaction?.status === 'approved') {
    console.log('✅ Status transaksi langsung Berhasil (approved) tanpa pending approval');
  } else {
    console.error('❌ Status transaksi bukan approved');
    process.exit(1);
  }

  // Cek saldo BCA
  const walletsRes2 = await fetch(`${BASE_URL}/api/wallets?userId=user-pro-001`);
  const { wallets: walletsAfter } = await walletsRes2.json();
  const bcaWalletAfter = walletsAfter.find(w => w.id === bcaWallet.id);
  console.log(`Saldo BCA sesudah: Rp${bcaWalletAfter.balance.toLocaleString('id-ID')}`);

  if (bcaWalletAfter.balance === bcaBalanceBefore - 45000) {
    console.log('✅ Saldo BCA termutasi tepat Rp45.000 secara otomatis');
  } else {
    console.error('❌ Saldo BCA tidak sesuai');
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('TATA AI BOT FLOW TEST: ALL PASSED');
  console.log('================================================================\n');
}

testTataAIFlow().catch(e => {
  console.error(e);
  process.exit(1);
});
